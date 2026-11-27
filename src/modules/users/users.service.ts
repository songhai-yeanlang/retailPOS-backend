import bcrypt from 'bcryptjs';
import pool from '../../config/db.config';
import type { PaginationMeta } from '../../types/api.types';
import type { AuthUser, UserRole } from '../../types/auth.types';
import ApiError from '../../utils/api-error';
import auditLogsModel from '../audit-logs/audit-logs.model';
import authModel from '../auth/auth.model';
import usersModel from './users.model';
import type { UpdateUserFields, UserRecord, UserSortField } from './users.model';

const BCRYPT_SALT_ROUNDS = 10;

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ListUsersQuery {
  page: number;
  limit: number;
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  sortBy: UserSortField;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedUsersResult {
  items: UserRecord[];
  pagination: PaginationMeta;
}

export interface CreateUserInput {
  fullName: string;
  username: string;
  email?: string | null;
  password: string;
  role: UserRole;
  isActive: boolean;
}

export interface UpdateUserInput {
  fullName?: string;
  username?: string;
  email?: string | null;
  role?: UserRole;
  isActive?: boolean;
}

export interface UpdateUserStatusInput {
  isActive: boolean;
}

export interface AdminResetPasswordInput {
  newPassword: string;
}

const normalizeNullableEmail = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value.trim() === '') {
    return null;
  }
  return value.trim().toLowerCase();
};

const toAuditSnapshot = (user: UserRecord): Record<string, unknown> => ({
  fullName: user.fullName,
  username: user.username,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
});

const isForeignKeyReferenceError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  return error.code === 'ER_ROW_IS_REFERENCED' || error.code === 'ER_ROW_IS_REFERENCED_2';
};

const assertCanManageTargetUser = (actor: AuthUser, target: UserRecord): void => {
  if (actor.role !== 'owner' && actor.role !== 'manager') {
    throw ApiError.forbidden('You do not have permission to manage user accounts');
  }
  if (actor.role === 'manager' && target.role !== 'cashier') {
    throw ApiError.forbidden('Managers can only manage cashier accounts');
  }
};

export const listUsers = async (query: ListUsersQuery): Promise<PaginatedUsersResult> => {
  const { items, total } = await usersModel.findUsers({
    page: query.page,
    limit: query.limit,
    role: query.role,
    isActive: query.isActive,
    search: query.search,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });

  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
    },
  };
};

export const getUserById = async (id: number): Promise<UserRecord> => {
  const user = await usersModel.findUserById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  return user;
};

export const createUser = async (actor: AuthUser, input: CreateUserInput, meta: RequestMetadata): Promise<UserRecord> => {
  const normalizedFullName = input.fullName.trim();
  const normalizedUsername = input.username.trim();
  const normalizedEmail = normalizeNullableEmail(input.email) ?? null;

  if (!normalizedFullName) {
    throw ApiError.badRequest('Full name is required');
  }

  if (!normalizedUsername) {
    throw ApiError.badRequest('Username is required');
  }

  if (actor.role !== 'owner' && actor.role !== 'manager') {
    throw ApiError.forbidden('You do not have permission to create user accounts');
  }

  if (actor.role === 'manager' && input.role !== 'cashier') {
    throw ApiError.forbidden('Managers can only create cashier accounts');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existingUsername = await usersModel.findUserByUsername(normalizedUsername, undefined, connection);
    if (existingUsername) {
      throw ApiError.conflict('Username already exists');
    }

    if (normalizedEmail) {
      const existingEmail = await usersModel.findUserByEmail(normalizedEmail, undefined, connection);
      if (existingEmail) {
        throw ApiError.conflict('Email already exists');
      }
    }

    const userId = await usersModel.createUser(
      {
        fullName: normalizedFullName,
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        role: input.role,
        isActive: input.isActive,
      },
      connection,
    );

    const created = await usersModel.findUserById(userId, connection);
    if (!created) {
      throw ApiError.internal('Failed to retrieve created user');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'CREATE_USER',
        tableName: 'users',
        recordId: created.id,
        oldValues: null,
        newValues: toAuditSnapshot(created),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();
    return created;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateUser = async (actor: AuthUser, id: number, input: UpdateUserInput, meta: RequestMetadata): Promise<UserRecord> => {
  const normalizedFullName = input.fullName !== undefined ? input.fullName.trim() : undefined;
  const normalizedUsername = input.username !== undefined ? input.username.trim() : undefined;
  const normalizedEmail = normalizeNullableEmail(input.email);

  if (normalizedFullName !== undefined && normalizedFullName.length === 0) {
    throw ApiError.badRequest('Full name cannot be empty');
  }

  if (normalizedUsername !== undefined && normalizedUsername.length === 0) {
    throw ApiError.badRequest('Username cannot be empty');
  }

  if (actor.role === 'manager' && input.role !== undefined && input.role !== 'cashier') {
    throw ApiError.forbidden('Managers cannot assign owner or manager roles');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await usersModel.findUserByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('User not found');
    }

    assertCanManageTargetUser(actor, existing);

    if (actor.id === existing.id) {
      if (input.role !== undefined && input.role !== existing.role) {
        throw ApiError.badRequest('You cannot change your own role');
      }
      if (input.isActive === false) {
        throw ApiError.badRequest('You cannot deactivate your own account');
      }
    }

    const willDemoteOrDeactivateActiveOwner =
      existing.role === 'owner' &&
      existing.isActive &&
      ((input.role !== undefined && input.role !== 'owner') || input.isActive === false);

    if (willDemoteOrDeactivateActiveOwner) {
      const activeOwners = await usersModel.countActiveOwnersForUpdate(connection);
      if (activeOwners <= 1) {
        throw ApiError.badRequest('Cannot demote or deactivate the last active owner account');
      }
    }

    const fieldsToUpdate: UpdateUserFields = {};

    if (normalizedFullName !== undefined && normalizedFullName !== existing.fullName) {
      fieldsToUpdate.fullName = normalizedFullName;
    }

    if (normalizedUsername !== undefined && normalizedUsername !== existing.username) {
      const existingUsername = await usersModel.findUserByUsername(normalizedUsername, existing.id, connection);
      if (existingUsername) {
        throw ApiError.conflict('Username already exists');
      }
      fieldsToUpdate.username = normalizedUsername;
    }

    if (normalizedEmail !== undefined && normalizedEmail !== existing.email) {
      if (normalizedEmail !== null) {
        const existingEmail = await usersModel.findUserByEmail(normalizedEmail, existing.id, connection);
        if (existingEmail) {
          throw ApiError.conflict('Email already exists');
        }
      }
      fieldsToUpdate.email = normalizedEmail;
    }

    if (input.role !== undefined && input.role !== existing.role) {
      fieldsToUpdate.role = input.role;
    }

    if (input.isActive !== undefined && input.isActive !== existing.isActive) {
      fieldsToUpdate.isActive = input.isActive;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      await connection.commit();
      return existing;
    }

    await usersModel.updateUserById(existing.id, fieldsToUpdate, connection);

    if (fieldsToUpdate.isActive === false) {
      await authModel.deleteAllUserRefreshTokens(existing.id, connection);
    }

    const updated = await usersModel.findUserById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated user');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'UPDATE_USER',
        tableName: 'users',
        recordId: updated.id,
        oldValues: toAuditSnapshot(existing),
        newValues: toAuditSnapshot(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();
    return updated;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateUserStatus = async (actor: AuthUser, id: number, input: UpdateUserStatusInput, meta: RequestMetadata): Promise<UserRecord> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await usersModel.findUserByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('User not found');
    }

    assertCanManageTargetUser(actor, existing);

    if (actor.id === existing.id && !input.isActive) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }

    if (existing.isActive === input.isActive) {
      await connection.commit();
      return existing;
    }

    if (existing.role === 'owner' && existing.isActive && !input.isActive) {
      const activeOwners = await usersModel.countActiveOwnersForUpdate(connection);
      if (activeOwners <= 1) {
        throw ApiError.badRequest('Cannot deactivate the last active owner account');
      }
    }

    await usersModel.updateUserStatusById(existing.id, input.isActive, connection);

    if (!input.isActive) {
      await authModel.deleteAllUserRefreshTokens(existing.id, connection);
    }

    const updated = await usersModel.findUserById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated user');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'UPDATE_USER_STATUS',
        tableName: 'users',
        recordId: updated.id,
        oldValues: { isActive: existing.isActive },
        newValues: { isActive: updated.isActive },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();
    return updated;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const adminResetPassword = async (actor: AuthUser, id: number, input: AdminResetPasswordInput, meta: RequestMetadata): Promise<void> => {
  const newPasswordHash = await bcrypt.hash(input.newPassword, BCRYPT_SALT_ROUNDS);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await usersModel.findUserByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('User not found');
    }

    assertCanManageTargetUser(actor, existing);

    await usersModel.resetUserPasswordById(existing.id, newPasswordHash, connection);
    await authModel.deleteAllUserRefreshTokens(existing.id, connection);

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'ADMIN_RESET_PASSWORD',
        tableName: 'users',
        recordId: existing.id,
        oldValues: null,
        newValues: { passwordReset: true },
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

export const deleteUser = async (actor: AuthUser, id: number, meta: RequestMetadata): Promise<void> => {
  if (actor.role !== 'owner') {
    throw ApiError.forbidden('Only owners can delete user accounts');
  }

  if (actor.id === id) {
    throw ApiError.badRequest('You cannot delete your own account');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await usersModel.findUserByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('User not found');
    }

    if (existing.role === 'owner' && existing.isActive) {
      const activeOwners = await usersModel.countActiveOwnersForUpdate(connection);
      if (activeOwners <= 1) {
        throw ApiError.badRequest('Cannot delete the last active owner account');
      }
    }

    try {
      await usersModel.deleteUserById(existing.id, connection);
    } catch (error: unknown) {
      if (isForeignKeyReferenceError(error)) {
        throw ApiError.conflict(
          'Cannot delete user because they have associated sales or purchases. Deactivate the account instead.',
        );
      }
      throw error;
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'DELETE_USER',
        tableName: 'users',
        recordId: existing.id,
        oldValues: toAuditSnapshot(existing),
        newValues: null,
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

export const usersService = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  adminResetPassword,
  deleteUser,
};

export default usersService;
