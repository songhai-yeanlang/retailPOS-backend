import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';

export type PaymentMethodType = 'cash' | 'qr' | 'card' | 'other';

interface PaymentMethodRow extends RowDataPacket {
  id: number;
  name: string;
  type: PaymentMethodType;
  account_name: string | null;
  account_number: string | null;
  qr_image: string | null;
  is_active: number;
  sales_count?: number;
  created_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface PaymentMethodRecord {
  id: number;
  name: string;
  type: PaymentMethodType;
  accountName: string | null;
  accountNumber: string | null;
  qrImage: string | null;
  isActive: boolean;
  salesCount: number;
  createdAt: Date;
}

export type PaymentMethodSortField = 'id' | 'name' | 'type' | 'createdAt' | 'salesCount';

export interface FindPaymentMethodsFilters {
  page: number;
  limit: number;
  type?: PaymentMethodType;
  isActive?: boolean;
  search?: string;
  sortBy: PaymentMethodSortField;
  sortOrder: 'asc' | 'desc';
}

export interface FindPaymentMethodsResult {
  items: PaymentMethodRecord[];
  total: number;
}

export interface CreatePaymentMethodFields {
  name: string;
  type: PaymentMethodType;
  accountName: string | null;
  accountNumber: string | null;
  qrImage: string | null;
  isActive: boolean;
}

export interface UpdatePaymentMethodFields {
  name?: string;
  type?: PaymentMethodType;
  accountName?: string | null;
  accountNumber?: string | null;
  qrImage?: string | null;
  isActive?: boolean;
}

const PAYMENT_METHOD_SELECT_COLUMNS = `
  pm.id,
  pm.name,
  pm.type,
  pm.account_name,
  pm.account_number,
  pm.qr_image,
  pm.is_active,
  (SELECT COUNT(*) FROM sales s WHERE s.payment_method_id = pm.id) AS sales_count,
  pm.created_at
`;

const SORT_COLUMN_MAP: Record<PaymentMethodSortField, string> = {
  id: 'pm.id',
  name: 'pm.name',
  type: 'pm.type',
  createdAt: 'pm.created_at',
  salesCount: 'sales_count',
};

const escapeLikePattern = (value: string): string => {
  return value.replace(/[!%_]/g, '!$&');
};

const mapPaymentMethodRow = (row: PaymentMethodRow): PaymentMethodRecord => ({
  id: Number(row.id),
  name: row.name,
  type: row.type,
  accountName: row.account_name,
  accountNumber: row.account_number,
  qrImage: row.qr_image,
  isActive: Boolean(row.is_active),
  salesCount: Number(row.sales_count ?? 0),
  createdAt: row.created_at,
});

export const findPaymentMethods = async (filters: FindPaymentMethodsFilters, connection: PoolConnection | null = null): Promise<FindPaymentMethodsResult> => {
  const db = getExecutor(connection);
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.type !== undefined) {
    conditions.push('pm.type = ?');
    params.push(filters.type);
  }

  if (filters.isActive !== undefined) {
    conditions.push('pm.is_active = ?');
    params.push(filters.isActive ? 1 : 0);
  }

  if (filters.search) {
    const likeTerm = `%${escapeLikePattern(filters.search)}%`;
    conditions.push(
      `(pm.name LIKE ? ESCAPE '!' OR pm.account_name LIKE ? ESCAPE '!' OR pm.account_number LIKE ? ESCAPE '!')`,
    );
    params.push(likeTerm, likeTerm, likeTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMN_MAP[filters.sortBy] ?? 'pm.created_at';
  const orderDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const orderByClause = sortColumn === 'pm.id' ? `pm.id ${orderDirection}` : `${sortColumn} ${orderDirection}, pm.id ${orderDirection}`;
  const offset = (filters.page - 1) * filters.limit;

  const [countRows] = await db.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM payment_methods pm
     ${whereClause}`,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);
  if (total === 0) {
    return { items: [], total: 0 };
  }

  const [rows] = await db.query<PaymentMethodRow[]>(
    `SELECT ${PAYMENT_METHOD_SELECT_COLUMNS}
     FROM payment_methods pm
     ${whereClause}
     ORDER BY ${orderByClause}
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset],
  );

  return {
    items: rows.map(mapPaymentMethodRow),
    total,
  };
};

export const findPaymentMethodById = async (id: number, connection: PoolConnection | null = null): Promise<PaymentMethodRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<PaymentMethodRow[]>(
    `SELECT ${PAYMENT_METHOD_SELECT_COLUMNS}
     FROM payment_methods pm
     WHERE pm.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapPaymentMethodRow(rows[0]) : null;
};

export const findPaymentMethodBasicById = async (id: number, connection: PoolConnection | null = null): Promise<PaymentMethodRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<PaymentMethodRow[]>(
    `SELECT id, name, type, account_name, account_number, qr_image, is_active, created_at
     FROM payment_methods
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapPaymentMethodRow(rows[0]) : null;
};

export const findPaymentMethodByIdForUpdate = async (id: number, connection: PoolConnection): Promise<PaymentMethodRecord | null> => {
  const [rows] = await connection.query<PaymentMethodRow[]>(
    `SELECT id, name, type, account_name, account_number, qr_image, is_active, created_at
     FROM payment_methods
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [id],
  );

  return rows[0] ? mapPaymentMethodRow(rows[0]) : null;
};

export const findPaymentMethodByName = async (name: string, excludeId?: number, connection: PoolConnection | null = null): Promise<PaymentMethodRecord | null> => {
  const db = getExecutor(connection);
  if (excludeId !== undefined) {
    const [rows] = await db.query<PaymentMethodRow[]>(
      `SELECT id, name, type, account_name, account_number, qr_image, is_active, created_at
       FROM payment_methods
       WHERE name = ? AND id <> ?
       LIMIT 1`,
      [name, excludeId],
    );
    return rows[0] ? mapPaymentMethodRow(rows[0]) : null;
  }

  const [rows] = await db.query<PaymentMethodRow[]>(
    `SELECT id, name, type, account_name, account_number, qr_image, is_active, created_at
     FROM payment_methods
     WHERE name = ?
     LIMIT 1`,
    [name],
  );

  return rows[0] ? mapPaymentMethodRow(rows[0]) : null;
};

export const createPaymentMethod = async (fields: CreatePaymentMethodFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO payment_methods (name, type, account_name, account_number, qr_image, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      fields.name,
      fields.type,
      fields.accountName,
      fields.accountNumber,
      fields.qrImage,
      fields.isActive ? 1 : 0,
    ],
  );

  return Number(result.insertId);
};

export const updatePaymentMethodById = async (id: number, fields: UpdatePaymentMethodFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const updates: string[] = [];
  const params: Array<string | number | null> = [];

  if (fields.name !== undefined) {
    updates.push('name = ?');
    params.push(fields.name);
  }

  if (fields.type !== undefined) {
    updates.push('type = ?');
    params.push(fields.type);
  }

  if (fields.accountName !== undefined) {
    updates.push('account_name = ?');
    params.push(fields.accountName);
  }

  if (fields.accountNumber !== undefined) {
    updates.push('account_number = ?');
    params.push(fields.accountNumber);
  }

  if (fields.qrImage !== undefined) {
    updates.push('qr_image = ?');
    params.push(fields.qrImage);
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
    `UPDATE payment_methods
     SET ${updates.join(', ')}
     WHERE id = ?`,
    params,
  );

  return result.affectedRows;
};

export const updatePaymentMethodStatusById = async (id: number, isActive: boolean, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE payment_methods
     SET is_active = ?
     WHERE id = ?`,
    [isActive ? 1 : 0, id],
  );

  return result.affectedRows;
};

export const deletePaymentMethodById = async (id: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM payment_methods WHERE id = ?',
    [id],
  );

  return result.affectedRows;
};

export const paymentsModel = {
  findPaymentMethods,
  findPaymentMethodById,
  findPaymentMethodBasicById,
  findPaymentMethodByIdForUpdate,
  findPaymentMethodByName,
  createPaymentMethod,
  updatePaymentMethodById,
  updatePaymentMethodStatusById,
  deletePaymentMethodById,
};

export default paymentsModel;
