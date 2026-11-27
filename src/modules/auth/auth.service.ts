import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import pool from '../../config/db.config';
import env from '../../config/env.config';
import ApiError from '../../utils/api-error';
import logger from '../../utils/logger.util';
import mailer from '../../utils/mailer.util';
import auditLogsModel from '../audit-logs/audit-logs.model';
import authModel from './auth.model';
import type { AuthUserRecord, PublicAuthUser } from './auth.model';

const BCRYPT_SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MINUTES = 15;

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface LogoutInput {
  refreshToken?: string;
  allDevices?: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface AuthSessionResult {
  user: PublicAuthUser;
  accessToken: string;
  refreshToken: string;
}

interface GeneratedTokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const sanitizeUser = (user: AuthUserRecord): PublicAuthUser => ({
  id: user.id,
  fullName: user.fullName,
  username: user.username,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const hashToken = (rawToken: string): string => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

const generateTokenPair = (user: AuthUserRecord): GeneratedTokenPair => {
  const accessOptions: SignOptions = {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: env.jwt.expiresIn as SignOptions['expiresIn'],
  };

  const refreshOptions: SignOptions = {
    algorithm: 'HS256',
    subject: String(user.id),
    jwtid: crypto.randomUUID(),
    expiresIn: env.jwt.refreshExpiresIn as SignOptions['expiresIn'],
  };

  const accessToken = jwt.sign(
    {
      username: user.username,
      role: user.role,
      type: 'access',
    },
    env.jwt.secret,
    accessOptions,
  );

  const refreshToken = jwt.sign(
    {
      username: user.username,
      role: user.role,
      type: 'refresh',
    },
    env.jwt.refreshSecret,
    refreshOptions,
  );

  const decodedRefresh = jwt.decode(refreshToken);
  const expSeconds =
    typeof decodedRefresh === 'object' &&
      decodedRefresh !== null &&
      typeof decodedRefresh.exp === 'number'
      ? decodedRefresh.exp
      : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

  return {
    accessToken,
    refreshToken,
    refreshExpiresAt: new Date(expSeconds * 1000),
  };
};

const parseRefreshTokenSubject = (decoded: string | jwt.JwtPayload): number => {
  if (typeof decoded !== 'object' || decoded === null) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  if (!('type' in decoded) || decoded.type !== 'refresh') {
    throw ApiError.unauthorized('Invalid refresh token type');
  }

  const userId = Number(decoded.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw ApiError.unauthorized('Invalid refresh token payload');
  }

  return userId;
};

export const login = async (input: LoginInput, meta: RequestMetadata): Promise<AuthSessionResult> => {
  const user = await authModel.findUserByIdentifier(input.username);
  if (!user) {
    throw ApiError.unauthorized('Invalid username or password');
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid username or password');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('User account is deactivated');
  }

  const { accessToken, refreshToken, refreshExpiresAt } = generateTokenPair(user);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await authModel.deleteExpiredUserRefreshTokens(user.id, connection);
    await authModel.createRefreshToken(
      user.id,
      hashToken(refreshToken),
      refreshExpiresAt,
      connection,
    );

    await auditLogsModel.createAuditLog(
      {
        userId: user.id,
        action: 'LOGIN',
        tableName: 'users',
        recordId: user.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const refreshTokens = async (input: RefreshTokenInput): Promise<AuthSessionResult> => {
  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(input.refreshToken, env.jwt.refreshSecret, {
      algorithms: ['HS256'],
    });
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Refresh token has expired');
    }
    throw ApiError.unauthorized('Invalid refresh token');
  }

  const tokenUserId = parseRefreshTokenSubject(decoded);
  const hashedIncomingToken = hashToken(input.refreshToken);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const storedToken = await authModel.findValidRefreshToken(
      hashedIncomingToken,
      connection,
    );
    if (!storedToken || storedToken.userId !== tokenUserId) {
      throw ApiError.unauthorized('Refresh token is invalid or has been revoked');
    }

    const user = await authModel.findUserById(storedToken.userId, connection);
    if (!user) {
      throw ApiError.unauthorized('User account no longer exists');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('User account is deactivated');
    }

    // Rotate refresh token atomically (verify row was actually deleted to prevent concurrent double-redemption)
    const deletedRows = await authModel.deleteRefreshToken(
      hashedIncomingToken,
      user.id,
      connection,
    );
    if (deletedRows === 0) {
      throw ApiError.unauthorized('Refresh token is invalid or has been revoked');
    }

    await authModel.deleteExpiredUserRefreshTokens(user.id, connection);

    const { accessToken, refreshToken, refreshExpiresAt } = generateTokenPair(user);
    await authModel.createRefreshToken(
      user.id,
      hashToken(refreshToken),
      refreshExpiresAt,
      connection,
    );

    await connection.commit();

    return {
      user: sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const logout = async (userId: number, input: LogoutInput, meta: RequestMetadata): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (input.allDevices) {
      await authModel.deleteAllUserRefreshTokens(userId, connection);
    } else if (input.refreshToken) {
      await authModel.deleteRefreshToken(
        hashToken(input.refreshToken),
        userId,
        connection,
      );
    }

    await auditLogsModel.createAuditLog(
      {
        userId,
        action: input.allDevices ? 'LOGOUT_ALL' : 'LOGOUT',
        tableName: 'users',
        recordId: userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const getMe = async (userId: number): Promise<PublicAuthUser> => {
  const user = await authModel.findUserById(userId);
  if (!user) {
    throw ApiError.notFound('User account not found');
  }
  return sanitizeUser(user);
};

export const changePassword = async (userId: number, input: ChangePasswordInput, meta: RequestMetadata): Promise<void> => {
  const user = await authModel.findUserById(userId);
  if (!user) {
    throw ApiError.notFound('User account not found');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('User account is deactivated');
  }

  const isCurrentValid = await bcrypt.compare(input.currentPassword, user.password);
  if (!isCurrentValid) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  if (input.currentPassword === input.newPassword) {
    throw ApiError.badRequest('New password must be different from current password');
  }

  const newPasswordHash = await bcrypt.hash(input.newPassword, BCRYPT_SALT_ROUNDS);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await authModel.updateUserPassword(userId, newPasswordHash, connection);
    await authModel.deleteAllUserRefreshTokens(userId, connection);

    await auditLogsModel.createAuditLog(
      {
        userId,
        action: 'CHANGE_PASSWORD',
        tableName: 'users',
        recordId: userId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const forgotPassword = async (input: ForgotPasswordInput, meta: RequestMetadata): Promise<void> => {
  const user = await authModel.findUserByEmail(input.email.toLowerCase());
  if (!user || !user.isActive || !user.email) {
    // Return silently to avoid exposing whether an email address is registered
    return;
  }

  const rawResetToken = crypto.randomBytes(32).toString('hex');
  const hashedResetToken = hashToken(rawResetToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await authModel.saveResetToken(user.id, hashedResetToken, expiresAt);

  try {
    await mailer.sendPasswordResetEmail(
      user.email,
      user.fullName,
      rawResetToken,
      RESET_TOKEN_TTL_MINUTES,
    );
  } catch (error: unknown) {
    try {
      await authModel.clearResetToken(user.id);
    } catch (cleanupError: unknown) {
      logger.warn('Failed to clear reset token after SMTP error', cleanupError);
    }
    logger.error('Failed to send password reset email', error);
    throw ApiError.internal('Failed to send password reset email. Please try again later.');
  }

  await auditLogsModel.createAuditLog({
    userId: user.id,
    action: 'FORGOT_PASSWORD',
    tableName: 'users',
    recordId: user.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
};

export const resetPassword = async (input: ResetPasswordInput, meta: RequestMetadata): Promise<void> => {
  const hashedToken = hashToken(input.token);
  const user = await authModel.findUserByResetToken(hashedToken);

  if (!user) {
    throw ApiError.badRequest('Invalid or expired password reset token');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('User account is deactivated');
  }

  const newPasswordHash = await bcrypt.hash(input.newPassword, BCRYPT_SALT_ROUNDS);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const updatedRows = await authModel.consumeResetTokenAndUpdatePassword(
      user.id,
      hashedToken,
      newPasswordHash,
      connection,
    );
    if (updatedRows === 0) {
      throw ApiError.badRequest('Invalid or expired password reset token');
    }

    await authModel.deleteAllUserRefreshTokens(user.id, connection);

    await auditLogsModel.createAuditLog(
      {
        userId: user.id,
        action: 'RESET_PASSWORD',
        tableName: 'users',
        recordId: user.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const authService = {
  login,
  refreshTokens,
  logout,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
};

export default authService;
