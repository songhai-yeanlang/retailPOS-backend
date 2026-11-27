import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';
import type { UserRole } from '../../types/auth.types';

interface AuditLogRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  action: string;
  table_name: string;
  record_id: number | null;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  u_id: number | null;
  u_full_name: string | null;
  u_username: string | null;
  u_role: UserRole | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface CreateAuditLogInput {
  userId?: number | null;
  action: string;
  tableName: string;
  recordId?: number | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogUserSummary {
  id: number;
  fullName: string;
  username: string;
  role: UserRole;
}

export interface AuditLogRecord {
  id: number;
  userId: number | null;
  user: AuditLogUserSummary | null;
  action: string;
  tableName: string;
  recordId: number | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface FindAuditLogsFilters {
  page: number;
  limit: number;
  userId?: number;
  action?: string;
  tableName?: string;
  recordId?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
  sortOrder: 'asc' | 'desc';
}

export interface FindAuditLogsResult {
  items: AuditLogRecord[];
  total: number;
}

const AUDIT_LOG_SELECT_COLUMNS = `
  al.id,
  al.user_id,
  al.action,
  al.table_name,
  al.record_id,
  al.old_values,
  al.new_values,
  al.ip_address,
  al.user_agent,
  al.created_at,
  u.id AS u_id,
  u.full_name AS u_full_name,
  u.username AS u_username,
  u.role AS u_role
`;

const truncate = (value: string | null | undefined, maxLength: number): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const escapeLikePattern = (value: string): string => {
  return value.replace(/[!%_]/g, '!$&');
};

const parseJsonColumn = (value: unknown): Record<string, unknown> | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const rawString = Buffer.isBuffer(value)
    ? value.toString('utf8')
    : typeof value === 'string'
      ? value
      : null;

  if (rawString !== null) {
    try {
      const parsed: unknown = JSON.parse(rawString);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

const mapAuditLogRow = (row: AuditLogRow): AuditLogRecord => ({
  id: Number(row.id),
  userId: row.user_id !== null ? Number(row.user_id) : null,
  user:
    row.u_id !== null && row.u_role !== null
      ? {
          id: Number(row.u_id),
          fullName: row.u_full_name ?? '',
          username: row.u_username ?? '',
          role: row.u_role,
        }
      : null,
  action: row.action,
  tableName: row.table_name,
  recordId: row.record_id !== null ? Number(row.record_id) : null,
  oldValues: parseJsonColumn(row.old_values),
  newValues: parseJsonColumn(row.new_values),
  ipAddress: row.ip_address,
  userAgent: row.user_agent,
  createdAt: row.created_at,
});

export const createAuditLog = async (input: CreateAuditLogInput, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO audit_logs
      (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.userId ?? null,
      truncate(input.action, 50) ?? 'UNKNOWN',
      truncate(input.tableName, 50) ?? 'unknown',
      input.recordId ?? null,
      input.oldValues ? JSON.stringify(input.oldValues) : null,
      input.newValues ? JSON.stringify(input.newValues) : null,
      truncate(input.ipAddress, 45),
      truncate(input.userAgent, 255),
    ],
  );

  return Number(result.insertId);
};

export const findAuditLogs = async (filters: FindAuditLogsFilters, connection: PoolConnection | null = null): Promise<FindAuditLogsResult> => {
  const db = getExecutor(connection);
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.userId !== undefined) {
    conditions.push('al.user_id = ?');
    params.push(filters.userId);
  }

  if (filters.action) {
    conditions.push('al.action = ?');
    params.push(filters.action);
  }

  if (filters.tableName) {
    conditions.push('al.table_name = ?');
    params.push(filters.tableName);
  }

  if (filters.recordId !== undefined) {
    conditions.push('al.record_id = ?');
    params.push(filters.recordId);
  }

  if (filters.startDate !== undefined) {
    conditions.push('al.created_at >= ?');
    params.push(filters.startDate);
  }

  if (filters.endDate !== undefined) {
    conditions.push('al.created_at <= ?');
    params.push(filters.endDate);
  }

  if (filters.search) {
    const likeTerm = `%${escapeLikePattern(filters.search)}%`;
    conditions.push(
      `(al.action LIKE ? ESCAPE '!' OR al.table_name LIKE ? ESCAPE '!' OR al.ip_address LIKE ? ESCAPE '!' OR u.username LIKE ? ESCAPE '!' OR u.full_name LIKE ? ESCAPE '!')`,
    );
    params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const offset = (filters.page - 1) * filters.limit;

  const countJoinClause = filters.search ? 'LEFT JOIN users u ON al.user_id = u.id' : '';

  const [countRows] = await db.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM audit_logs al
     ${countJoinClause}
     ${whereClause}`,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);
  if (total === 0) {
    return { items: [], total: 0 };
  }

  const [rows] = await db.query<AuditLogRow[]>(
    `SELECT ${AUDIT_LOG_SELECT_COLUMNS}
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     ${whereClause}
     ORDER BY al.created_at ${orderDirection}, al.id ${orderDirection}
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset],
  );

  return {
    items: rows.map(mapAuditLogRow),
    total,
  };
};

export const findAuditLogById = async (id: number, connection: PoolConnection | null = null): Promise<AuditLogRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<AuditLogRow[]>(
    `SELECT ${AUDIT_LOG_SELECT_COLUMNS}
     FROM audit_logs al
     LEFT JOIN users u ON al.user_id = u.id
     WHERE al.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapAuditLogRow(rows[0]) : null;
};

export const deleteAuditLogById = async (id: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM audit_logs WHERE id = ?',
    [id],
  );

  return result.affectedRows;
};

export const deleteAllAuditLogs = async (connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>('DELETE FROM audit_logs');

  return result.affectedRows;
};

export const auditLogsModel = {
  createAuditLog,
  findAuditLogs,
  findAuditLogById,
  deleteAuditLogById,
  deleteAllAuditLogs,
};

export default auditLogsModel;
