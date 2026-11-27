import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';
import type { UserRole } from '../../types/auth.types';

interface UserRow extends RowDataPacket {
  id: number;
  full_name: string;
  username: string;
  email: string | null;
  password: string;
  role: UserRole;
  is_active: number;
  reset_token: string | null;
  reset_token_expires: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface RefreshTokenRow extends RowDataPacket {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export interface AuthUserRecord {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  password: string;
  role: UserRole;
  isActive: boolean;
  resetToken: string | null;
  resetTokenExpires: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicAuthUser = Omit<
  AuthUserRecord,
  'password' | 'resetToken' | 'resetTokenExpires'
>;

export interface RefreshTokenRecord {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const USER_SELECT_COLUMNS = `
  id,
  full_name,
  username,
  email,
  password,
  role,
  is_active,
  reset_token,
  reset_token_expires,
  created_at,
  updated_at
`;

const mapUserRow = (row: UserRow): AuthUserRecord => ({
  id: Number(row.id),
  fullName: row.full_name,
  username: row.username,
  email: row.email,
  password: row.password,
  role: row.role,
  isActive: Boolean(row.is_active),
  resetToken: row.reset_token,
  resetTokenExpires: row.reset_token_expires,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRefreshTokenRow = (row: RefreshTokenRow): RefreshTokenRecord => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  token: row.token,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

export const findUserByIdentifier = async (identifier: string, connection: PoolConnection | null = null): Promise<AuthUserRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<UserRow[]>(
    `SELECT ${USER_SELECT_COLUMNS}
     FROM users
     WHERE username = ? OR email = ?
     LIMIT 1`,
    [identifier, identifier],
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
};

export const findUserByEmail = async (email: string, connection: PoolConnection | null = null): Promise<AuthUserRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<UserRow[]>(
    `SELECT ${USER_SELECT_COLUMNS}
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email],
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
};

export const findUserById = async (id: number, connection: PoolConnection | null = null): Promise<AuthUserRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<UserRow[]>(
    `SELECT ${USER_SELECT_COLUMNS}
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [id],
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
};

export const findUserByResetToken = async (hashedToken: string, connection: PoolConnection | null = null): Promise<AuthUserRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<UserRow[]>(
    `SELECT ${USER_SELECT_COLUMNS}
     FROM users
     WHERE reset_token = ? AND reset_token_expires > NOW()
     LIMIT 1`,
    [hashedToken],
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
};

export const updateUserPassword = async (userId: number, passwordHash: string, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE users
     SET password = ?
     WHERE id = ?`,
    [passwordHash, userId],
  );
  return result.affectedRows;
};

export const consumeResetTokenAndUpdatePassword = async (userId: number, hashedToken: string, passwordHash: string, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE users
     SET password = ?, reset_token = NULL, reset_token_expires = NULL
     WHERE id = ? AND reset_token = ? AND reset_token_expires > NOW()`,
    [passwordHash, userId, hashedToken],
  );
  return result.affectedRows;
};

export const saveResetToken = async (userId: number, hashedToken: string, expiresAt: Date, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE users
     SET reset_token = ?, reset_token_expires = ?
     WHERE id = ?`,
    [hashedToken, expiresAt, userId],
  );
  return result.affectedRows;
};

export const clearResetToken = async (userId: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE users
     SET reset_token = NULL, reset_token_expires = NULL
     WHERE id = ?`,
    [userId],
  );
  return result.affectedRows;
};

export const createRefreshToken = async (userId: number, hashedToken: string, expiresAt: Date, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES (?, ?, ?)`,
    [userId, hashedToken, expiresAt],
  );
  return Number(result.insertId);
};

export const findValidRefreshToken = async (hashedToken: string, connection: PoolConnection | null = null): Promise<RefreshTokenRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<RefreshTokenRow[]>(
    `SELECT id, user_id, token, expires_at, created_at
     FROM refresh_tokens
     WHERE token = ? AND expires_at > NOW()
     LIMIT 1`,
    [hashedToken],
  );
  return rows[0] ? mapRefreshTokenRow(rows[0]) : null;
};

export const deleteRefreshToken = async (hashedToken: string, userId?: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  if (userId !== undefined) {
    const [result] = await db.execute<ResultSetHeader>(
      'DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?',
      [hashedToken, userId],
    );
    return result.affectedRows;
  }

  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM refresh_tokens WHERE token = ?',
    [hashedToken],
  );
  return result.affectedRows;
};

export const deleteAllUserRefreshTokens = async (userId: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM refresh_tokens WHERE user_id = ?',
    [userId],
  );
  return result.affectedRows;
};

export const deleteExpiredUserRefreshTokens = async (userId: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at <= NOW()',
    [userId],
  );
  return result.affectedRows;
};

export const authModel = {
  findUserByIdentifier,
  findUserByEmail,
  findUserById,
  findUserByResetToken,
  updateUserPassword,
  consumeResetTokenAndUpdatePassword,
  saveResetToken,
  clearResetToken,
  createRefreshToken,
  findValidRefreshToken,
  deleteRefreshToken,
  deleteAllUserRefreshTokens,
  deleteExpiredUserRefreshTokens,
};

export default authModel;
