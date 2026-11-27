import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';

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

const truncate = (value: string | null | undefined, maxLength: number): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

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

export const auditLogsModel = {
  createAuditLog,
};

export default auditLogsModel;
