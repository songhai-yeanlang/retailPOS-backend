import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';

interface ProductRow extends RowDataPacket {
  id: number;
  category_id: number | null;
  barcode: string | null;
  name: string;
  cost_price: string | number;
  sell_price: string | number;
  stock_qty: number;
  alert_qty: number;
  unit: string;
  image: string | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
  c_id?: number | null;
  c_name?: string | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface ProductCategorySummary {
  id: number;
  name: string;
}

export interface ProductRecord {
  id: number;
  categoryId: number | null;
  category: ProductCategorySummary | null;
  barcode: string | null;
  name: string;
  costPrice: number;
  sellPrice: number;
  stockQty: number;
  alertQty: number;
  isLowStock: boolean;
  unit: string;
  image: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductSortField = 'id' | 'name' | 'sellPrice' | 'costPrice' | 'stockQty' | 'createdAt';

export interface FindProductsFilters {
  page: number;
  limit: number;
  categoryId?: number;
  isActive?: boolean;
  lowStock?: boolean;
  outOfStock?: boolean;
  search?: string;
  sortBy: ProductSortField;
  sortOrder: 'asc' | 'desc';
}

export interface FindProductsResult {
  items: ProductRecord[];
  total: number;
}

export interface CreateProductFields {
  categoryId: number | null;
  barcode: string | null;
  name: string;
  costPrice: number;
  sellPrice: number;
  stockQty: number;
  alertQty: number;
  unit: string;
  image: string | null;
  isActive: boolean;
}

export interface UpdateProductFields {
  categoryId?: number | null;
  barcode?: string | null;
  name?: string;
  costPrice?: number;
  sellPrice?: number;
  alertQty?: number;
  unit?: string;
  image?: string | null;
  isActive?: boolean;
}

const PRODUCT_SELECT_COLUMNS = `
  p.id,
  p.category_id,
  p.barcode,
  p.name,
  p.cost_price,
  p.sell_price,
  p.stock_qty,
  p.alert_qty,
  p.unit,
  p.image,
  p.is_active,
  p.created_at,
  p.updated_at,
  c.id AS c_id,
  c.name AS c_name
`;

const PRODUCT_BASE_COLUMNS = `
  id,
  category_id,
  barcode,
  name,
  cost_price,
  sell_price,
  stock_qty,
  alert_qty,
  unit,
  image,
  is_active,
  created_at,
  updated_at
`;

const SORT_COLUMN_MAP: Record<ProductSortField, string> = {
  id: 'p.id',
  name: 'p.name',
  sellPrice: 'p.sell_price',
  costPrice: 'p.cost_price',
  stockQty: 'p.stock_qty',
  createdAt: 'p.created_at',
};

const escapeLikePattern = (value: string): string => {
  return value.replace(/[!%_]/g, '!$&');
};

const mapProductRow = (row: ProductRow): ProductRecord => {
  const stockQty = Number(row.stock_qty);
  const alertQty = Number(row.alert_qty);

  return {
    id: Number(row.id),
    categoryId: row.category_id !== null ? Number(row.category_id) : null,
    category:
      row.c_id !== undefined && row.c_id !== null
        ? {
            id: Number(row.c_id),
            name: row.c_name ?? '',
          }
        : null,
    barcode: row.barcode,
    name: row.name,
    costPrice: Number(row.cost_price),
    sellPrice: Number(row.sell_price),
    stockQty,
    alertQty,
    isLowStock: stockQty <= alertQty,
    unit: row.unit,
    image: row.image,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const findProducts = async (filters: FindProductsFilters, connection: PoolConnection | null = null): Promise<FindProductsResult> => {
  const db = getExecutor(connection);
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.categoryId !== undefined) {
    conditions.push('p.category_id = ?');
    params.push(filters.categoryId);
  }

  if (filters.isActive !== undefined) {
    conditions.push('p.is_active = ?');
    params.push(filters.isActive ? 1 : 0);
  }

  if (filters.lowStock !== undefined) {
    conditions.push(filters.lowStock ? 'p.stock_qty <= p.alert_qty' : 'p.stock_qty > p.alert_qty');
  }

  if (filters.outOfStock !== undefined) {
    conditions.push(filters.outOfStock ? 'p.stock_qty <= 0' : 'p.stock_qty > 0');
  }

  if (filters.search) {
    const likeTerm = `%${escapeLikePattern(filters.search)}%`;
    conditions.push(`(p.name LIKE ? ESCAPE '!' OR p.barcode LIKE ? ESCAPE '!' OR c.name LIKE ? ESCAPE '!')`);
    params.push(likeTerm, likeTerm, likeTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMN_MAP[filters.sortBy] ?? 'p.created_at';
  const orderDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const orderByClause = sortColumn === 'p.id' ? `p.id ${orderDirection}` : `${sortColumn} ${orderDirection}, p.id ${orderDirection}`;
  const offset = (filters.page - 1) * filters.limit;
  const countJoinClause = filters.search ? 'LEFT JOIN categories c ON p.category_id = c.id' : '';

  const [countRows] = await db.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM products p
     ${countJoinClause}
     ${whereClause}`,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);
  if (total === 0) {
    return { items: [], total: 0 };
  }

  const [rows] = await db.query<ProductRow[]>(
    `SELECT ${PRODUCT_SELECT_COLUMNS}
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     ${whereClause}
     ORDER BY ${orderByClause}
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset],
  );

  return {
    items: rows.map(mapProductRow),
    total,
  };
};

export const findProductById = async (id: number, connection: PoolConnection | null = null): Promise<ProductRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<ProductRow[]>(
    `SELECT ${PRODUCT_SELECT_COLUMNS}
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapProductRow(rows[0]) : null;
};

export const findProductByIdForUpdate = async (id: number, connection: PoolConnection): Promise<ProductRecord | null> => {
  const [rows] = await connection.query<ProductRow[]>(
    `SELECT ${PRODUCT_BASE_COLUMNS}
     FROM products
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [id],
  );

  return rows[0] ? mapProductRow(rows[0]) : null;
};

export const findProductByBarcode = async (barcode: string, excludeProductId?: number, connection: PoolConnection | null = null): Promise<ProductRecord | null> => {
  const db = getExecutor(connection);
  if (excludeProductId !== undefined) {
    const [rows] = await db.query<ProductRow[]>(
      `SELECT ${PRODUCT_BASE_COLUMNS}
       FROM products
       WHERE barcode = ? AND id <> ?
       LIMIT 1`,
      [barcode, excludeProductId],
    );
    return rows[0] ? mapProductRow(rows[0]) : null;
  }

  const [rows] = await db.query<ProductRow[]>(
    `SELECT ${PRODUCT_SELECT_COLUMNS}
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.barcode = ?
     LIMIT 1`,
    [barcode],
  );

  return rows[0] ? mapProductRow(rows[0]) : null;
};

export const createProduct = async (fields: CreateProductFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO products
      (category_id, barcode, name, cost_price, sell_price, stock_qty, alert_qty, unit, image, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fields.categoryId,
      fields.barcode,
      fields.name,
      fields.costPrice,
      fields.sellPrice,
      fields.stockQty,
      fields.alertQty,
      fields.unit,
      fields.image,
      fields.isActive ? 1 : 0,
    ],
  );

  return Number(result.insertId);
};

export const updateProductById = async (id: number, fields: UpdateProductFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const updates: string[] = [];
  const params: Array<string | number | null> = [];

  if (fields.categoryId !== undefined) {
    updates.push('category_id = ?');
    params.push(fields.categoryId);
  }

  if (fields.barcode !== undefined) {
    updates.push('barcode = ?');
    params.push(fields.barcode);
  }

  if (fields.name !== undefined) {
    updates.push('name = ?');
    params.push(fields.name);
  }

  if (fields.costPrice !== undefined) {
    updates.push('cost_price = ?');
    params.push(fields.costPrice);
  }

  if (fields.sellPrice !== undefined) {
    updates.push('sell_price = ?');
    params.push(fields.sellPrice);
  }

  if (fields.alertQty !== undefined) {
    updates.push('alert_qty = ?');
    params.push(fields.alertQty);
  }

  if (fields.unit !== undefined) {
    updates.push('unit = ?');
    params.push(fields.unit);
  }

  if (fields.image !== undefined) {
    updates.push('image = ?');
    params.push(fields.image);
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
    `UPDATE products
     SET ${updates.join(', ')}
     WHERE id = ?`,
    params,
  );

  return result.affectedRows;
};

export const updateProductStatusById = async (id: number, isActive: boolean, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE products
     SET is_active = ?
     WHERE id = ?`,
    [isActive ? 1 : 0, id],
  );

  return result.affectedRows;
};

export const updateProductStockById = async (id: number, stockQty: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE products
     SET stock_qty = ?
     WHERE id = ?`,
    [stockQty, id],
  );

  return result.affectedRows;
};

export const updateProductStockAndCostById = async (id: number, stockQty: number, costPrice: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE products
     SET stock_qty = ?, cost_price = ?
     WHERE id = ?`,
    [stockQty, costPrice, id],
  );

  return result.affectedRows;
};

export const deleteProductById = async (id: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM products WHERE id = ?',
    [id],
  );

  return result.affectedRows;
};

export const productsModel = {
  findProducts,
  findProductById,
  findProductByIdForUpdate,
  findProductByBarcode,
  createProduct,
  updateProductById,
  updateProductStatusById,
  updateProductStockById,
  updateProductStockAndCostById,
  deleteProductById,
};

export default productsModel;
