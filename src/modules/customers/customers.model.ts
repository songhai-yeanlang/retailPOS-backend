import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';

interface CustomerRow extends RowDataPacket {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  points: number;
  sales_count?: number;
  total_spent?: string | number;
  created_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface CustomerRecord {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  points: number;
  salesCount: number;
  totalSpent: number;
  createdAt: Date;
}

export type CustomerSortField = 'id' | 'name' | 'points' | 'createdAt' | 'salesCount' | 'totalSpent';

export interface FindCustomersFilters {
  page: number;
  limit: number;
  minPoints?: number;
  search?: string;
  sortBy: CustomerSortField;
  sortOrder: 'asc' | 'desc';
}

export interface FindCustomersResult {
  items: CustomerRecord[];
  total: number;
}

export interface CreateCustomerFields {
  name: string;
  phone: string | null;
  address: string | null;
  points: number;
}

export interface UpdateCustomerFields {
  name?: string;
  phone?: string | null;
  address?: string | null;
}

const CUSTOMER_SELECT_COLUMNS = `
  c.id,
  c.name,
  c.phone,
  c.address,
  c.points,
  (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id AND s.status = 'completed') AS sales_count,
  (SELECT COALESCE(SUM(s.total_amount), 0) FROM sales s WHERE s.customer_id = c.id AND s.status = 'completed') AS total_spent,
  c.created_at
`;

const SORT_COLUMN_MAP: Record<CustomerSortField, string> = {
  id: 'c.id',
  name: 'c.name',
  points: 'c.points',
  createdAt: 'c.created_at',
  salesCount: 'sales_count',
  totalSpent: 'total_spent',
};

const escapeLikePattern = (value: string): string => {
  return value.replace(/[!%_]/g, '!$&');
};

const mapCustomerRow = (row: CustomerRow): CustomerRecord => ({
  id: Number(row.id),
  name: row.name,
  phone: row.phone,
  address: row.address,
  points: Number(row.points),
  salesCount: Number(row.sales_count ?? 0),
  totalSpent: Number(row.total_spent ?? 0),
  createdAt: row.created_at,
});

export const findCustomers = async (filters: FindCustomersFilters, connection: PoolConnection | null = null): Promise<FindCustomersResult> => {
  const db = getExecutor(connection);
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.minPoints !== undefined) {
    conditions.push('c.points >= ?');
    params.push(filters.minPoints);
  }

  if (filters.search) {
    const likeTerm = `%${escapeLikePattern(filters.search)}%`;
    conditions.push(`(c.name LIKE ? ESCAPE '!' OR c.phone LIKE ? ESCAPE '!' OR c.address LIKE ? ESCAPE '!')`);
    params.push(likeTerm, likeTerm, likeTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMN_MAP[filters.sortBy] ?? 'c.created_at';
  const orderDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const orderByClause = sortColumn === 'c.id' ? `c.id ${orderDirection}` : `${sortColumn} ${orderDirection}, c.id ${orderDirection}`;
  const offset = (filters.page - 1) * filters.limit;

  const [countRows] = await db.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM customers c
     ${whereClause}`,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);
  if (total === 0) {
    return { items: [], total: 0 };
  }

  const [rows] = await db.query<CustomerRow[]>(
    `SELECT ${CUSTOMER_SELECT_COLUMNS}
     FROM customers c
     ${whereClause}
     ORDER BY ${orderByClause}
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset],
  );

  return {
    items: rows.map(mapCustomerRow),
    total,
  };
};

export const findCustomerById = async (id: number, connection: PoolConnection | null = null): Promise<CustomerRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<CustomerRow[]>(
    `SELECT ${CUSTOMER_SELECT_COLUMNS}
     FROM customers c
     WHERE c.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapCustomerRow(rows[0]) : null;
};

export const findCustomerByIdForUpdate = async (id: number, connection: PoolConnection): Promise<CustomerRecord | null> => {
  const [rows] = await connection.query<CustomerRow[]>(
    `SELECT id, name, phone, address, points, created_at
     FROM customers
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [id],
  );

  return rows[0] ? mapCustomerRow(rows[0]) : null;
};

export const findCustomerByPhone = async (phone: string, excludeCustomerId?: number, connection: PoolConnection | null = null): Promise<CustomerRecord | null> => {
  const db = getExecutor(connection);
  if (excludeCustomerId !== undefined) {
    const [rows] = await db.query<CustomerRow[]>(
      `SELECT id, name, phone, address, points, created_at
       FROM customers
       WHERE phone = ? AND id <> ?
       LIMIT 1`,
      [phone, excludeCustomerId],
    );
    return rows[0] ? mapCustomerRow(rows[0]) : null;
  }

  const [rows] = await db.query<CustomerRow[]>(
    `SELECT id, name, phone, address, points, created_at
     FROM customers
     WHERE phone = ?
     LIMIT 1`,
    [phone],
  );

  return rows[0] ? mapCustomerRow(rows[0]) : null;
};

export const createCustomer = async (fields: CreateCustomerFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO customers (name, phone, address, points)
     VALUES (?, ?, ?, ?)`,
    [fields.name, fields.phone, fields.address, fields.points],
  );

  return Number(result.insertId);
};

export const updateCustomerById = async (id: number, fields: UpdateCustomerFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const updates: string[] = [];
  const params: Array<string | number | null> = [];

  if (fields.name !== undefined) {
    updates.push('name = ?');
    params.push(fields.name);
  }

  if (fields.phone !== undefined) {
    updates.push('phone = ?');
    params.push(fields.phone);
  }

  if (fields.address !== undefined) {
    updates.push('address = ?');
    params.push(fields.address);
  }

  if (updates.length === 0) {
    return 0;
  }

  params.push(id);

  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE customers
     SET ${updates.join(', ')}
     WHERE id = ?`,
    params,
  );

  return result.affectedRows;
};

export const updateCustomerPointsById = async (id: number, points: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE customers
     SET points = ?
     WHERE id = ?`,
    [points, id],
  );

  return result.affectedRows;
};

export const deleteCustomerById = async (id: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM customers WHERE id = ?',
    [id],
  );

  return result.affectedRows;
};

export const customersModel = {
  findCustomers,
  findCustomerById,
  findCustomerByIdForUpdate,
  findCustomerByPhone,
  createCustomer,
  updateCustomerById,
  updateCustomerPointsById,
  deleteCustomerById,
};

export default customersModel;
