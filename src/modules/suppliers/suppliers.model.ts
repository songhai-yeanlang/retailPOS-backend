import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';

interface SupplierRow extends RowDataPacket {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  purchase_count?: number;
  created_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface SupplierRecord {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  purchaseCount: number;
  createdAt: Date;
}

export type SupplierSortField = 'id' | 'name' | 'createdAt' | 'purchaseCount';

export interface FindSuppliersFilters {
  page: number;
  limit: number;
  search?: string;
  sortBy: SupplierSortField;
  sortOrder: 'asc' | 'desc';
}

export interface FindSuppliersResult {
  items: SupplierRecord[];
  total: number;
}

export interface CreateSupplierFields {
  name: string;
  phone: string | null;
  address: string | null;
}

export interface UpdateSupplierFields {
  name?: string;
  phone?: string | null;
  address?: string | null;
}

const SUPPLIER_SELECT_COLUMNS = `
  s.id,
  s.name,
  s.phone,
  s.address,
  (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id = s.id) AS purchase_count,
  s.created_at
`;

const SORT_COLUMN_MAP: Record<SupplierSortField, string> = {
  id: 's.id',
  name: 's.name',
  createdAt: 's.created_at',
  purchaseCount: 'purchase_count',
};

const escapeLikePattern = (value: string): string => {
  return value.replace(/[!%_]/g, '!$&');
};

const mapSupplierRow = (row: SupplierRow): SupplierRecord => ({
  id: Number(row.id),
  name: row.name,
  phone: row.phone,
  address: row.address,
  purchaseCount: Number(row.purchase_count ?? 0),
  createdAt: row.created_at,
});

export const findSuppliers = async (filters: FindSuppliersFilters, connection: PoolConnection | null = null): Promise<FindSuppliersResult> => {
  const db = getExecutor(connection);
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.search) {
    const likeTerm = `%${escapeLikePattern(filters.search)}%`;
    conditions.push(`(s.name LIKE ? ESCAPE '!' OR s.phone LIKE ? ESCAPE '!' OR s.address LIKE ? ESCAPE '!')`);
    params.push(likeTerm, likeTerm, likeTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMN_MAP[filters.sortBy] ?? 's.created_at';
  const orderDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const orderByClause = sortColumn === 's.id' ? `s.id ${orderDirection}` : `${sortColumn} ${orderDirection}, s.id ${orderDirection}`;
  const offset = (filters.page - 1) * filters.limit;

  const [countRows] = await db.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM suppliers s
     ${whereClause}`,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);
  if (total === 0) {
    return { items: [], total: 0 };
  }

  const [rows] = await db.query<SupplierRow[]>(
    `SELECT ${SUPPLIER_SELECT_COLUMNS}
     FROM suppliers s
     ${whereClause}
     ORDER BY ${orderByClause}
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset],
  );

  return {
    items: rows.map(mapSupplierRow),
    total,
  };
};

export const findSupplierById = async (id: number, connection: PoolConnection | null = null): Promise<SupplierRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<SupplierRow[]>(
    `SELECT ${SUPPLIER_SELECT_COLUMNS}
     FROM suppliers s
     WHERE s.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapSupplierRow(rows[0]) : null;
};

export const findSupplierByIdForUpdate = async (id: number, connection: PoolConnection): Promise<SupplierRecord | null> => {
  const [rows] = await connection.query<SupplierRow[]>(
    `SELECT id, name, phone, address, created_at
     FROM suppliers
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [id],
  );

  return rows[0] ? mapSupplierRow(rows[0]) : null;
};

export const findSupplierByName = async (name: string, excludeSupplierId?: number, connection: PoolConnection | null = null): Promise<SupplierRecord | null> => {
  const db = getExecutor(connection);
  if (excludeSupplierId !== undefined) {
    const [rows] = await db.query<SupplierRow[]>(
      `SELECT id, name, phone, address, created_at
       FROM suppliers
       WHERE name = ? AND id <> ?
       LIMIT 1`,
      [name, excludeSupplierId],
    );
    return rows[0] ? mapSupplierRow(rows[0]) : null;
  }

  const [rows] = await db.query<SupplierRow[]>(
    `SELECT id, name, phone, address, created_at
     FROM suppliers
     WHERE name = ?
     LIMIT 1`,
    [name],
  );

  return rows[0] ? mapSupplierRow(rows[0]) : null;
};

export const createSupplier = async (fields: CreateSupplierFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO suppliers (name, phone, address)
     VALUES (?, ?, ?)`,
    [fields.name, fields.phone, fields.address],
  );

  return Number(result.insertId);
};

export const updateSupplierById = async (id: number, fields: UpdateSupplierFields, connection: PoolConnection | null = null): Promise<number> => {
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
    `UPDATE suppliers
     SET ${updates.join(', ')}
     WHERE id = ?`,
    params,
  );

  return result.affectedRows;
};

export const deleteSupplierById = async (id: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM suppliers WHERE id = ?',
    [id],
  );

  return result.affectedRows;
};

export const suppliersModel = {
  findSuppliers,
  findSupplierById,
  findSupplierByIdForUpdate,
  findSupplierByName,
  createSupplier,
  updateSupplierById,
  deleteSupplierById,
};

export default suppliersModel;
