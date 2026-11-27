import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';

interface CategoryRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  product_count?: number;
  created_at: Date;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface CategoryRecord {
  id: number;
  name: string;
  description: string | null;
  productCount: number;
  createdAt: Date;
}

export type CategorySortField = 'id' | 'name' | 'createdAt' | 'productCount';

export interface FindCategoriesFilters {
  page: number;
  limit: number;
  search?: string;
  sortBy: CategorySortField;
  sortOrder: 'asc' | 'desc';
}

export interface FindCategoriesResult {
  items: CategoryRecord[];
  total: number;
}

export interface CreateCategoryFields {
  name: string;
  description: string | null;
}

export interface UpdateCategoryFields {
  name?: string;
  description?: string | null;
}

const CATEGORY_SELECT_COLUMNS = `
  c.id,
  c.name,
  c.description,
  (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count,
  c.created_at
`;

const SORT_COLUMN_MAP: Record<CategorySortField, string> = {
  id: 'c.id',
  name: 'c.name',
  createdAt: 'c.created_at',
  productCount: 'product_count',
};

const escapeLikePattern = (value: string): string => {
  return value.replace(/[!%_]/g, '!$&');
};

const mapCategoryRow = (row: CategoryRow): CategoryRecord => ({
  id: Number(row.id),
  name: row.name,
  description: row.description,
  productCount: Number(row.product_count ?? 0),
  createdAt: row.created_at,
});

export const findCategories = async (filters: FindCategoriesFilters, connection: PoolConnection | null = null): Promise<FindCategoriesResult> => {
  const db = getExecutor(connection);
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.search) {
    const likeTerm = `%${escapeLikePattern(filters.search)}%`;
    conditions.push(`(c.name LIKE ? ESCAPE '!' OR c.description LIKE ? ESCAPE '!')`);
    params.push(likeTerm, likeTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMN_MAP[filters.sortBy] ?? 'c.created_at';
  const orderDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const orderByClause = sortColumn === 'c.id' ? `c.id ${orderDirection}` : `${sortColumn} ${orderDirection}, c.id ${orderDirection}`;
  const offset = (filters.page - 1) * filters.limit;

  const [countRows] = await db.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM categories c
     ${whereClause}`,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);
  if (total === 0) {
    return { items: [], total: 0 };
  }

  const [rows] = await db.query<CategoryRow[]>(
    `SELECT ${CATEGORY_SELECT_COLUMNS}
     FROM categories c
     ${whereClause}
     ORDER BY ${orderByClause}
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset],
  );

  return {
    items: rows.map(mapCategoryRow),
    total,
  };
};

export const findCategoryById = async (id: number, connection: PoolConnection | null = null): Promise<CategoryRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<CategoryRow[]>(
    `SELECT ${CATEGORY_SELECT_COLUMNS}
     FROM categories c
     WHERE c.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapCategoryRow(rows[0]) : null;
};

export const findCategoryByIdForUpdate = async (id: number, connection: PoolConnection): Promise<CategoryRecord | null> => {
  const [rows] = await connection.query<CategoryRow[]>(
    `SELECT id, name, description, created_at
     FROM categories
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [id],
  );

  return rows[0] ? mapCategoryRow(rows[0]) : null;
};

export const findCategoryByName = async (name: string, excludeCategoryId?: number, connection: PoolConnection | null = null): Promise<CategoryRecord | null> => {
  const db = getExecutor(connection);
  if (excludeCategoryId !== undefined) {
    const [rows] = await db.query<CategoryRow[]>(
      `SELECT id, name, description, created_at
       FROM categories
       WHERE name = ? AND id <> ?
       LIMIT 1`,
      [name, excludeCategoryId],
    );
    return rows[0] ? mapCategoryRow(rows[0]) : null;
  }

  const [rows] = await db.query<CategoryRow[]>(
    `SELECT id, name, description, created_at
     FROM categories
     WHERE name = ?
     LIMIT 1`,
    [name],
  );

  return rows[0] ? mapCategoryRow(rows[0]) : null;
};

export const createCategory = async (fields: CreateCategoryFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO categories (name, description)
     VALUES (?, ?)`,
    [fields.name, fields.description],
  );

  return Number(result.insertId);
};

export const updateCategoryById = async (id: number, fields: UpdateCategoryFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const updates: string[] = [];
  const params: Array<string | number | null> = [];

  if (fields.name !== undefined) {
    updates.push('name = ?');
    params.push(fields.name);
  }

  if (fields.description !== undefined) {
    updates.push('description = ?');
    params.push(fields.description);
  }

  if (updates.length === 0) {
    return 0;
  }

  params.push(id);

  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE categories
     SET ${updates.join(', ')}
     WHERE id = ?`,
    params,
  );

  return result.affectedRows;
};

export const deleteCategoryById = async (id: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM categories WHERE id = ?',
    [id],
  );

  return result.affectedRows;
};

export const categoriesModel = {
  findCategories,
  findCategoryById,
  findCategoryByIdForUpdate,
  findCategoryByName,
  createCategory,
  updateCategoryById,
  deleteCategoryById,
};

export default categoriesModel;
