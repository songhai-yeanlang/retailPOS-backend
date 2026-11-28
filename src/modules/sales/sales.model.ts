import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';
import type { PaymentMethodType } from '../payments/payments.model';

export type SaleStatus = 'completed' | 'cancelled' | 'refunded';
export type SaleSortField = 'id' | 'createdAt' | 'totalAmount' | 'status';

interface SaleRow extends RowDataPacket {
  id: number;
  invoice_no: string;
  user_id: number;
  customer_id: number | null;
  payment_method_id: number;
  payment_ref: string | null;
  subtotal: string | number;
  discount: string | number;
  tax: string | number;
  total_amount: string | number;
  paid_amount: string | number;
  change_amount: string | number;
  exchange_rate: string | number;
  status: SaleStatus;
  note: string | null;
  created_at: Date;
  item_count?: number;
  total_qty?: number;
  u_id?: number | null;
  u_full_name?: string | null;
  u_username?: string | null;
  c_id?: number | null;
  c_name?: string | null;
  c_phone?: string | null;
  pm_id?: number | null;
  pm_name?: string | null;
  pm_type?: PaymentMethodType | null;
}

interface SaleItemRow extends RowDataPacket {
  id: number;
  sale_id: number;
  product_id: number;
  qty: number;
  cost_price: string | number;
  unit_price: string | number;
  subtotal: string | number;
  p_id?: number | null;
  p_name?: string | null;
  p_barcode?: string | null;
  p_unit?: string | null;
  p_image?: string | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

export interface SaleUserSummary {
  id: number;
  fullName: string;
  username: string;
}

export interface SaleCustomerSummary {
  id: number;
  name: string;
  phone: string | null;
}

export interface SalePaymentMethodSummary {
  id: number;
  name: string;
  type: PaymentMethodType;
}

export interface SaleProductSummary {
  id: number;
  name: string;
  barcode: string | null;
  unit: string;
  image: string | null;
}

export interface SaleItemRecord {
  id: number;
  saleId: number;
  productId: number;
  product: SaleProductSummary | null;
  qty: number;
  costPrice: number;
  unitPrice: number;
  subtotal: number;
}

export interface SaleRecord {
  id: number;
  invoiceNo: string;
  userId: number;
  user: SaleUserSummary | null;
  customerId: number | null;
  customer: SaleCustomerSummary | null;
  paymentMethodId: number;
  paymentMethod: SalePaymentMethodSummary | null;
  paymentRef: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  exchangeRate: number;
  status: SaleStatus;
  note: string | null;
  itemCount: number;
  totalQty: number;
  createdAt: Date;
}

export interface SaleDetailRecord extends SaleRecord {
  items: SaleItemRecord[];
}

export interface FindSalesFilters {
  page: number;
  limit: number;
  userId?: number;
  customerId?: number;
  paymentMethodId?: number;
  status?: SaleStatus;
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
  sortBy: SaleSortField;
  sortOrder: 'asc' | 'desc';
}

export interface FindSalesResult {
  items: SaleRecord[];
  total: number;
}

export interface CreateSaleFields {
  invoiceNo: string;
  userId: number;
  customerId: number | null;
  paymentMethodId: number;
  paymentRef: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  exchangeRate: number;
  status: SaleStatus;
  note: string | null;
}

export interface CreateSaleItemFields {
  productId: number;
  qty: number;
  costPrice: number;
  unitPrice: number;
  subtotal: number;
}

const SALE_SELECT_COLUMNS = `
  sa.id,
  sa.invoice_no,
  sa.user_id,
  sa.customer_id,
  sa.payment_method_id,
  sa.payment_ref,
  sa.subtotal,
  sa.discount,
  sa.tax,
  sa.total_amount,
  sa.paid_amount,
  sa.change_amount,
  sa.exchange_rate,
  sa.status,
  sa.note,
  sa.created_at,
  (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = sa.id) AS item_count,
  (SELECT COALESCE(SUM(si.qty), 0) FROM sale_items si WHERE si.sale_id = sa.id) AS total_qty,
  u.id AS u_id,
  u.full_name AS u_full_name,
  u.username AS u_username,
  c.id AS c_id,
  c.name AS c_name,
  c.phone AS c_phone,
  pm.id AS pm_id,
  pm.name AS pm_name,
  pm.type AS pm_type
`;

const SALE_BASE_COLUMNS = `
  id,
  invoice_no,
  user_id,
  customer_id,
  payment_method_id,
  payment_ref,
  subtotal,
  discount,
  tax,
  total_amount,
  paid_amount,
  change_amount,
  exchange_rate,
  status,
  note,
  created_at
`;

const SALE_ITEM_SELECT_COLUMNS = `
  si.id,
  si.sale_id,
  si.product_id,
  si.qty,
  si.cost_price,
  si.unit_price,
  si.subtotal,
  p.id AS p_id,
  p.name AS p_name,
  p.barcode AS p_barcode,
  p.unit AS p_unit,
  p.image AS p_image
`;

const SORT_COLUMN_MAP: Record<SaleSortField, string> = {
  id: 'sa.id',
  createdAt: 'sa.created_at',
  totalAmount: 'sa.total_amount',
  status: 'sa.status',
};

const escapeLikePattern = (value: string): string => {
  return value.replace(/[!%_]/g, '!$&');
};

const mapSaleRow = (row: SaleRow): SaleRecord => ({
  id: Number(row.id),
  invoiceNo: row.invoice_no,
  userId: Number(row.user_id),
  user:
    row.u_id !== undefined && row.u_id !== null
      ? {
          id: Number(row.u_id),
          fullName: row.u_full_name ?? '',
          username: row.u_username ?? '',
        }
      : null,
  customerId: row.customer_id !== null ? Number(row.customer_id) : null,
  customer:
    row.c_id !== undefined && row.c_id !== null
      ? {
          id: Number(row.c_id),
          name: row.c_name ?? '',
          phone: row.c_phone ?? null,
        }
      : null,
  paymentMethodId: Number(row.payment_method_id),
  paymentMethod:
    row.pm_id !== undefined && row.pm_id !== null && row.pm_type !== undefined && row.pm_type !== null
      ? {
          id: Number(row.pm_id),
          name: row.pm_name ?? '',
          type: row.pm_type,
        }
      : null,
  paymentRef: row.payment_ref,
  subtotal: Number(row.subtotal),
  discount: Number(row.discount),
  tax: Number(row.tax),
  totalAmount: Number(row.total_amount),
  paidAmount: Number(row.paid_amount),
  changeAmount: Number(row.change_amount),
  exchangeRate: Number(row.exchange_rate),
  status: row.status,
  note: row.note,
  itemCount: Number(row.item_count ?? 0),
  totalQty: Number(row.total_qty ?? 0),
  createdAt: row.created_at,
});

const mapSaleItemRow = (row: SaleItemRow): SaleItemRecord => ({
  id: Number(row.id),
  saleId: Number(row.sale_id),
  productId: Number(row.product_id),
  product:
    row.p_id !== undefined && row.p_id !== null
      ? {
          id: Number(row.p_id),
          name: row.p_name ?? '',
          barcode: row.p_barcode ?? null,
          unit: row.p_unit ?? 'pcs',
          image: row.p_image ?? null,
        }
      : null,
  qty: Number(row.qty),
  costPrice: Number(row.cost_price),
  unitPrice: Number(row.unit_price),
  subtotal: Number(row.subtotal),
});

export const findSales = async (filters: FindSalesFilters, connection: PoolConnection | null = null): Promise<FindSalesResult> => {
  const db = getExecutor(connection);
  const conditions: string[] = [];
  const params: Array<string | number | Date> = [];

  if (filters.userId !== undefined) {
    conditions.push('sa.user_id = ?');
    params.push(filters.userId);
  }

  if (filters.customerId !== undefined) {
    conditions.push('sa.customer_id = ?');
    params.push(filters.customerId);
  }

  if (filters.paymentMethodId !== undefined) {
    conditions.push('sa.payment_method_id = ?');
    params.push(filters.paymentMethodId);
  }

  if (filters.status !== undefined) {
    conditions.push('sa.status = ?');
    params.push(filters.status);
  }

  if (filters.startDate !== undefined) {
    conditions.push('sa.created_at >= ?');
    params.push(filters.startDate);
  }

  if (filters.endDate !== undefined) {
    conditions.push('sa.created_at <= ?');
    params.push(filters.endDate);
  }

  if (filters.search) {
    const likeTerm = `%${escapeLikePattern(filters.search)}%`;
    conditions.push(
      `(sa.invoice_no LIKE ? ESCAPE '!' OR sa.payment_ref LIKE ? ESCAPE '!' OR sa.note LIKE ? ESCAPE '!' OR c.name LIKE ? ESCAPE '!' OR c.phone LIKE ? ESCAPE '!' OR u.full_name LIKE ? ESCAPE '!' OR u.username LIKE ? ESCAPE '!')`,
    );
    params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMN_MAP[filters.sortBy] ?? 'sa.created_at';
  const orderDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const orderByClause = sortColumn === 'sa.id' ? `sa.id ${orderDirection}` : `${sortColumn} ${orderDirection}, sa.id ${orderDirection}`;
  const offset = (filters.page - 1) * filters.limit;
  const countJoinClause = filters.search
    ? 'LEFT JOIN customers c ON sa.customer_id = c.id LEFT JOIN users u ON sa.user_id = u.id'
    : '';

  const [countRows] = await db.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM sales sa
     ${countJoinClause}
     ${whereClause}`,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);
  if (total === 0) {
    return { items: [], total: 0 };
  }

  const [rows] = await db.query<SaleRow[]>(
    `SELECT ${SALE_SELECT_COLUMNS}
     FROM sales sa
     LEFT JOIN users u ON sa.user_id = u.id
     LEFT JOIN customers c ON sa.customer_id = c.id
     LEFT JOIN payment_methods pm ON sa.payment_method_id = pm.id
     ${whereClause}
     ORDER BY ${orderByClause}
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset],
  );

  return {
    items: rows.map(mapSaleRow),
    total,
  };
};

export const findSaleById = async (id: number, connection: PoolConnection | null = null): Promise<SaleRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<SaleRow[]>(
    `SELECT ${SALE_SELECT_COLUMNS}
     FROM sales sa
     LEFT JOIN users u ON sa.user_id = u.id
     LEFT JOIN customers c ON sa.customer_id = c.id
     LEFT JOIN payment_methods pm ON sa.payment_method_id = pm.id
     WHERE sa.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapSaleRow(rows[0]) : null;
};

export const findSaleByInvoiceNo = async (invoiceNo: string, connection: PoolConnection | null = null): Promise<SaleRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<SaleRow[]>(
    `SELECT ${SALE_SELECT_COLUMNS}
     FROM sales sa
     LEFT JOIN users u ON sa.user_id = u.id
     LEFT JOIN customers c ON sa.customer_id = c.id
     LEFT JOIN payment_methods pm ON sa.payment_method_id = pm.id
     WHERE sa.invoice_no = ?
     LIMIT 1`,
    [invoiceNo],
  );

  return rows[0] ? mapSaleRow(rows[0]) : null;
};

export const existsSaleByInvoiceNo = async (invoiceNo: string, connection: PoolConnection | null = null): Promise<boolean> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id
     FROM sales
     WHERE invoice_no = ?
     LIMIT 1`,
    [invoiceNo],
  );

  return rows.length > 0;
};

export const findSaleByIdForUpdate = async (id: number, connection: PoolConnection): Promise<SaleRecord | null> => {
  const [rows] = await connection.query<SaleRow[]>(
    `SELECT ${SALE_BASE_COLUMNS}
     FROM sales
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [id],
  );

  return rows[0] ? mapSaleRow(rows[0]) : null;
};

export const findSaleItemsBySaleId = async (saleId: number, connection: PoolConnection | null = null): Promise<SaleItemRecord[]> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<SaleItemRow[]>(
    `SELECT ${SALE_ITEM_SELECT_COLUMNS}
     FROM sale_items si
     LEFT JOIN products p ON si.product_id = p.id
     WHERE si.sale_id = ?
     ORDER BY si.id ASC`,
    [saleId],
  );

  return rows.map(mapSaleItemRow);
};

export const createSale = async (fields: CreateSaleFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO sales
      (invoice_no, user_id, customer_id, payment_method_id, payment_ref, subtotal, discount, tax, total_amount, paid_amount, change_amount, exchange_rate, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fields.invoiceNo,
      fields.userId,
      fields.customerId,
      fields.paymentMethodId,
      fields.paymentRef,
      fields.subtotal,
      fields.discount,
      fields.tax,
      fields.totalAmount,
      fields.paidAmount,
      fields.changeAmount,
      fields.exchangeRate,
      fields.status,
      fields.note,
    ],
  );

  return Number(result.insertId);
};

export const createSaleItems = async (saleId: number, items: CreateSaleItemFields[], connection: PoolConnection | null = null): Promise<number> => {
  if (items.length === 0) {
    return 0;
  }

  const db = getExecutor(connection);
  const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
  const params: Array<number> = [];

  for (const item of items) {
    params.push(saleId, item.productId, item.qty, item.costPrice, item.unitPrice, item.subtotal);
  }

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO sale_items (sale_id, product_id, qty, cost_price, unit_price, subtotal)
     VALUES ${placeholders}`,
    params,
  );

  return result.affectedRows;
};

export const updateSaleStatusById = async (id: number, status: SaleStatus, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE sales
     SET status = ?
     WHERE id = ?`,
    [status, id],
  );

  return result.affectedRows;
};

export const salesModel = {
  findSales,
  findSaleById,
  findSaleByInvoiceNo,
  existsSaleByInvoiceNo,
  findSaleByIdForUpdate,
  findSaleItemsBySaleId,
  createSale,
  createSaleItems,
  updateSaleStatusById,
};

export default salesModel;
