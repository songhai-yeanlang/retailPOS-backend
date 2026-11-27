import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';
import type { UserRole } from '../../types/auth.types';

interface UserRow extends RowDataPacket {
  id: number;
  full_name: string;
  username: string;
  email: string | null;
  role: UserRole;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface UserRecord {
  id: number;
  fullName: string;
  username: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserSortField = 'id' | 'fullName' | 'username' | 'role' | 'createdAt';

export interface FindUsersFilters {
  page: number;
  limit: number;
  role?: UserRole;
  isActive?: boolean;
  search?: string;
  sortBy: UserSortField;
  sortOrder: 'asc' | 'desc';
}

export interface FindUsersResult {
  items: UserRecord[];
  total: number;
}

export interface CreateUserFields {
  fullName: string;
  username: string;
  email: string | null;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
}

export interface UpdateUserFields {
  fullName?: string;
  username?: string;
  email?: string | null;
  role?: UserRole;
  isActive?: boolean;
}

const USER_PUBLIC_COLUMNS = `
  id,
  full_name,
  username,
  email,
  role,
  is_active,
  created_at,
  updated_at
`;

const SORT_COLUMN_MAP: Record<UserSortField, string> = {
  id: 'id',
  fullName: 'full_name',
  username: 'username',
  role: 'role',
  createdAt: 'created_at',
};

const escapeLikePattern = (value: string): string => {
  return value.replace(/[!%_]/g, '!$&');
};

const mapUserRow = (row: UserRow): UserRecord => ({
  id: Number(row.id),
  fullName: row.full_name,
  username: row.username,
  email: row.email,
  role: row.role,
  isActive: Boolean(row.is_active),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const findUsers = async (filters: FindUsersFilters, connection: PoolConnection | null = null): Promise<FindUsersResult> => {
  const db = getExecutor(connection);
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.role !== undefined) {
    conditions.push('role = ?');
    params.push(filters.role);
  }

  if (filters.isActive !== undefined) {
    conditions.push('is_active = ?');
    params.push(filters.isActive ? 1 : 0);
  }

  if (filters.search) {
    const likeTerm = `%${escapeLikePattern(filters.search)}%`;
    conditions.push(
      `(full_name LIKE ? ESCAPE '!' OR username LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!')`,
    );
    params.push(likeTerm, likeTerm, likeTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMN_MAP[filters.sortBy] ?? 'created_at';
  const orderDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const orderByClause = sortColumn === 'id' ? `id ${orderDirection}` : `${sortColumn} ${orderDirection}, id ${orderDirection}`;
  const offset = (filters.page - 1) * filters.limit;

  const [countRows] = await db.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM users
     ${whereClause}`,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);
  if (total === 0) {
    return { items: [], total: 0 };
  }

  const [rows] = await db.query<UserRow[]>(
    `SELECT ${USER_PUBLIC_COLUMNS}
     FROM users
     ${whereClause}
     ORDER BY ${orderByClause}
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset],
  );

  return {
    items: rows.map(mapUserRow),
    total,
  };
};

export const findUserById = async (id: number, connection: PoolConnection | null = null): Promise<UserRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<UserRow[]>(
    `SELECT ${USER_PUBLIC_COLUMNS}
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
};

export const findUserByIdForUpdate = async (id: number, connection: PoolConnection): Promise<UserRecord | null> => {
  const [rows] = await connection.query<UserRow[]>(
    `SELECT ${USER_PUBLIC_COLUMNS}
     FROM users
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [id],
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
};

export const findUserByUsername = async (username: string, excludeUserId?: number, connection: PoolConnection | null = null): Promise<UserRecord | null> => {
  const db = getExecutor(connection);
  if (excludeUserId !== undefined) {
    const [rows] = await db.query<UserRow[]>(
      `SELECT ${USER_PUBLIC_COLUMNS}
       FROM users
       WHERE username = ? AND id <> ?
       LIMIT 1`,
      [username, excludeUserId],
    );
    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  const [rows] = await db.query<UserRow[]>(
    `SELECT ${USER_PUBLIC_COLUMNS}
     FROM users
     WHERE username = ?
     LIMIT 1`,
    [username],
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
};

export const findUserByEmail = async (email: string, excludeUserId?: number, connection: PoolConnection | null = null): Promise<UserRecord | null> => {
  const db = getExecutor(connection);
  if (excludeUserId !== undefined) {
    const [rows] = await db.query<UserRow[]>(
      `SELECT ${USER_PUBLIC_COLUMNS}
       FROM users
       WHERE email = ? AND id <> ?
       LIMIT 1`,
      [email, excludeUserId],
    );
    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  const [rows] = await db.query<UserRow[]>(
    `SELECT ${USER_PUBLIC_COLUMNS}
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email],
  );

  return rows[0] ? mapUserRow(rows[0]) : null;
};

export const countActiveOwners = async (connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM users
     WHERE role = 'owner' AND is_active = 1`,
  );

  return Number(rows[0]?.total ?? 0);
};

export const countActiveOwnersForUpdate = async (connection: PoolConnection): Promise<number> => {
  const [rows] = await connection.query<RowDataPacket[]>(
    `SELECT id
     FROM users
     WHERE role = 'owner' AND is_active = 1
     FOR UPDATE`,
  );

  return rows.length;
};

export const createUser = async (fields: CreateUserFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO users (full_name, username, email, password, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      fields.fullName,
      fields.username,
      fields.email,
      fields.passwordHash,
      fields.role,
      fields.isActive ? 1 : 0,
    ],
  );

  return Number(result.insertId);
};

export const updateUserById = async (id: number, fields: UpdateUserFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const updates: string[] = [];
  const params: Array<string | number | null> = [];

  if (fields.fullName !== undefined) {
    updates.push('full_name = ?');
    params.push(fields.fullName);
  }

  if (fields.username !== undefined) {
    updates.push('username = ?');
    params.push(fields.username);
  }

  if (fields.email !== undefined) {
    updates.push('email = ?');
    params.push(fields.email);
  }

  if (fields.role !== undefined) {
    updates.push('role = ?');
    params.push(fields.role);
  }

  if (fields.isActive !== undefined) {
    updates.push('is_active = ?');
    params.push(fields.isActive ? 1 : 0);
  }

  if (updates.length === 0) {
    return 0;
  }

  params.push(id);

  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE users
     SET ${updates.join(', ')}
     WHERE id = ?`,
    params,
  );

  return result.affectedRows;
};

export const updateUserStatusById = async (id: number, isActive: boolean, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE users
     SET is_active = ?
     WHERE id = ?`,
    [isActive ? 1 : 0, id],
  );

  return result.affectedRows;
};

export const resetUserPasswordById = async (id: number, passwordHash: string, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE users
     SET password = ?, reset_token = NULL, reset_token_expires = NULL
     WHERE id = ?`,
    [passwordHash, id],
  );

  return result.affectedRows;
};

export const deleteUserById = async (id: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM users WHERE id = ?',
    [id],
  );

  return result.affectedRows;
};

export const usersModel = {
  findUsers,
  findUserById,
  findUserByIdForUpdate,
  findUserByUsername,
  findUserByEmail,
  countActiveOwners,
  countActiveOwnersForUpdate,
  createUser,
  updateUserById,
  updateUserStatusById,
  resetUserPasswordById,
  deleteUserById,
};

export default usersModel;
