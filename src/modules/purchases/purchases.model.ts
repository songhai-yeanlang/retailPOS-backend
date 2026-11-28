import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';

export type PurchaseStatus = 'received' | 'pending' | 'cancelled';
export type PurchaseSortField = 'id' | 'purchaseDate' | 'totalAmount' | 'status';

interface PurchaseRow extends RowDataPacket {
  id: number;
  reference_no: string | null;
  supplier_id: number | null;
  user_id: number;
  total_amount: string | number;
  status: PurchaseStatus;
  note: string | null;
  purchase_date: Date;
  item_count?: number;
  total_qty?: number;
  s_id?: number | null;
  s_name?: string | null;
  s_phone?: string | null;
  u_id?: number | null;
  u_full_name?: string | null;
  u_username?: string | null;
}

interface PurchaseItemRow extends RowDataPacket {
  id: number;
  purchase_id: number;
  product_id: number;
  qty: number;
  cost_price: string | number;
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

export interface PurchaseSupplierSummary {
  id: number;
  name: string;
  phone: string | null;
}

export interface PurchaseUserSummary {
  id: number;
  fullName: string;
  username: string;
}

export interface PurchaseProductSummary {
  id: number;
  name: string;
  barcode: string | null;
  unit: string;
  image: string | null;
}

export interface PurchaseItemRecord {
  id: number;
  purchaseId: number;
  productId: number;
  product: PurchaseProductSummary | null;
  qty: number;
  costPrice: number;
  subtotal: number;
}

export interface PurchaseRecord {
  id: number;
  referenceNo: string | null;
  supplierId: number | null;
  supplier: PurchaseSupplierSummary | null;
  userId: number;
  user: PurchaseUserSummary | null;
  totalAmount: number;
  status: PurchaseStatus;
  note: string | null;
  itemCount: number;
  totalQty: number;
  purchaseDate: Date;
}

export interface PurchaseDetailRecord extends PurchaseRecord {
  items: PurchaseItemRecord[];
}

export interface FindPurchasesFilters {
  page: number;
  limit: number;
  supplierId?: number;
  userId?: number;
  status?: PurchaseStatus;
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
  sortBy: PurchaseSortField;
  sortOrder: 'asc' | 'desc';
}

export interface FindPurchasesResult {
  items: PurchaseRecord[];
  total: number;
}

export interface CreatePurchaseFields {
  referenceNo: string;
  supplierId: number | null;
  userId: number;
  totalAmount: number;
  status: 'received' | 'pending';
  note: string | null;
  purchaseDate: Date | string;
}

export interface CreatePurchaseItemFields {
  productId: number;
  qty: number;
  costPrice: number;
  subtotal: number;
}

const PURCHASE_SELECT_COLUMNS = `
  pu.id,
  pu.reference_no,
  pu.supplier_id,
  pu.user_id,
  pu.total_amount,
  pu.status,
  pu.note,
  pu.purchase_date,
  (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = pu.id) AS item_count,
  (SELECT COALESCE(SUM(pi.qty), 0) FROM purchase_items pi WHERE pi.purchase_id = pu.id) AS total_qty,
  s.id AS s_id,
  s.name AS s_name,
  s.phone AS s_phone,
  u.id AS u_id,
  u.full_name AS u_full_name,
  u.username AS u_username
`;

const PURCHASE_ITEM_SELECT_COLUMNS = `
  pi.id,
  pi.purchase_id,
  pi.product_id,
  pi.qty,
  pi.cost_price,
  pi.subtotal,
  p.id AS p_id,
  p.name AS p_name,
  p.barcode AS p_barcode,
  p.unit AS p_unit,
  p.image AS p_image
`;

const SORT_COLUMN_MAP: Record<PurchaseSortField, string> = {
  id: 'pu.id',
  purchaseDate: 'pu.purchase_date',
  totalAmount: 'pu.total_amount',
  status: 'pu.status',
};

const escapeLikePattern = (value: string): string => {
  return value.replace(/[!%_]/g, '!$&');
};

const mapPurchaseRow = (row: PurchaseRow): PurchaseRecord => ({
  id: Number(row.id),
  referenceNo: row.reference_no,
  supplierId: row.supplier_id !== null ? Number(row.supplier_id) : null,
  supplier:
    row.s_id !== undefined && row.s_id !== null
      ? {
          id: Number(row.s_id),
          name: row.s_name ?? '',
          phone: row.s_phone ?? null,
        }
      : null,
  userId: Number(row.user_id),
  user:
    row.u_id !== undefined && row.u_id !== null
      ? {
          id: Number(row.u_id),
          fullName: row.u_full_name ?? '',
          username: row.u_username ?? '',
        }
      : null,
  totalAmount: Number(row.total_amount),
  status: row.status,
  note: row.note,
  itemCount: Number(row.item_count ?? 0),
  totalQty: Number(row.total_qty ?? 0),
  purchaseDate: row.purchase_date,
});

const mapPurchaseItemRow = (row: PurchaseItemRow): PurchaseItemRecord => ({
  id: Number(row.id),
  purchaseId: Number(row.purchase_id),
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
  subtotal: Number(row.subtotal),
});

export const findPurchases = async (filters: FindPurchasesFilters, connection: PoolConnection | null = null): Promise<FindPurchasesResult> => {
  const db = getExecutor(connection);
  const conditions: string[] = [];
  const params: Array<string | number | Date> = [];

  if (filters.supplierId !== undefined) {
    conditions.push('pu.supplier_id = ?');
    params.push(filters.supplierId);
  }

  if (filters.userId !== undefined) {
    conditions.push('pu.user_id = ?');
    params.push(filters.userId);
  }

  if (filters.status !== undefined) {
    conditions.push('pu.status = ?');
    params.push(filters.status);
  }

  if (filters.startDate !== undefined) {
    conditions.push('pu.purchase_date >= ?');
    params.push(filters.startDate);
  }

  if (filters.endDate !== undefined) {
    conditions.push('pu.purchase_date <= ?');
    params.push(filters.endDate);
  }

  if (filters.search) {
    const likeTerm = `%${escapeLikePattern(filters.search)}%`;
    conditions.push(
      `(pu.reference_no LIKE ? ESCAPE '!' OR pu.note LIKE ? ESCAPE '!' OR s.name LIKE ? ESCAPE '!' OR u.full_name LIKE ? ESCAPE '!' OR u.username LIKE ? ESCAPE '!')`,
    );
    params.push(likeTerm, likeTerm, likeTerm, likeTerm, likeTerm);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortColumn = SORT_COLUMN_MAP[filters.sortBy] ?? 'pu.purchase_date';
  const orderDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const orderByClause = sortColumn === 'pu.id' ? `pu.id ${orderDirection}` : `${sortColumn} ${orderDirection}, pu.id ${orderDirection}`;
  const offset = (filters.page - 1) * filters.limit;
  const countJoinClause = filters.search
    ? 'LEFT JOIN suppliers s ON pu.supplier_id = s.id LEFT JOIN users u ON pu.user_id = u.id'
    : '';

  const [countRows] = await db.query<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM purchases pu
     ${countJoinClause}
     ${whereClause}`,
    params,
  );

  const total = Number(countRows[0]?.total ?? 0);
  if (total === 0) {
    return { items: [], total: 0 };
  }

  const [rows] = await db.query<PurchaseRow[]>(
    `SELECT ${PURCHASE_SELECT_COLUMNS}
     FROM purchases pu
     LEFT JOIN suppliers s ON pu.supplier_id = s.id
     LEFT JOIN users u ON pu.user_id = u.id
     ${whereClause}
     ORDER BY ${orderByClause}
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, offset],
  );

  return {
    items: rows.map(mapPurchaseRow),
    total,
  };
};

export const findPurchaseById = async (id: number, connection: PoolConnection | null = null): Promise<PurchaseRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<PurchaseRow[]>(
    `SELECT ${PURCHASE_SELECT_COLUMNS}
     FROM purchases pu
     LEFT JOIN suppliers s ON pu.supplier_id = s.id
     LEFT JOIN users u ON pu.user_id = u.id
     WHERE pu.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapPurchaseRow(rows[0]) : null;
};

export const findPurchaseByIdForUpdate = async (id: number, connection: PoolConnection): Promise<PurchaseRecord | null> => {
  const [rows] = await connection.query<PurchaseRow[]>(
    `SELECT id, reference_no, supplier_id, user_id, total_amount, status, note, purchase_date
     FROM purchases
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [id],
  );

  return rows[0] ? mapPurchaseRow(rows[0]) : null;
};

export const findPurchaseByReferenceNo = async (referenceNo: string, connection: PoolConnection | null = null): Promise<PurchaseRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<PurchaseRow[]>(
    `SELECT id, reference_no, supplier_id, user_id, total_amount, status, note, purchase_date
     FROM purchases
     WHERE reference_no = ?
     LIMIT 1`,
    [referenceNo],
  );

  return rows[0] ? mapPurchaseRow(rows[0]) : null;
};

export const findPurchaseItemsByPurchaseId = async (purchaseId: number, connection: PoolConnection | null = null): Promise<PurchaseItemRecord[]> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<PurchaseItemRow[]>(
    `SELECT ${PURCHASE_ITEM_SELECT_COLUMNS}
     FROM purchase_items pi
     LEFT JOIN products p ON pi.product_id = p.id
     WHERE pi.purchase_id = ?
     ORDER BY pi.id ASC`,
    [purchaseId],
  );

  return rows.map(mapPurchaseItemRow);
};

export const createPurchase = async (fields: CreatePurchaseFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO purchases (reference_no, supplier_id, user_id, total_amount, status, note, purchase_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      fields.referenceNo,
      fields.supplierId,
      fields.userId,
      fields.totalAmount,
      fields.status,
      fields.note,
      fields.purchaseDate,
    ],
  );

  return Number(result.insertId);
};

export const createPurchaseItems = async (purchaseId: number, items: CreatePurchaseItemFields[], connection: PoolConnection | null = null): Promise<number> => {
  if (items.length === 0) {
    return 0;
  }

  const db = getExecutor(connection);
  const placeholders = items.map(() => '(?, ?, ?, ?, ?)').join(', ');
  const params: Array<number> = [];

  for (const item of items) {
    params.push(purchaseId, item.productId, item.qty, item.costPrice, item.subtotal);
  }

  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO purchase_items (purchase_id, product_id, qty, cost_price, subtotal)
     VALUES ${placeholders}`,
    params,
  );

  return result.affectedRows;
};

export const updatePurchaseStatusById = async (id: number, status: PurchaseStatus, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE purchases
     SET status = ?
     WHERE id = ?`,
    [status, id],
  );

  return result.affectedRows;
};

export const purchasesModel = {
  findPurchases,
  findPurchaseById,
  findPurchaseByIdForUpdate,
  findPurchaseByReferenceNo,
  findPurchaseItemsByPurchaseId,
  createPurchase,
  createPurchaseItems,
  updatePurchaseStatusById,
};

export default purchasesModel;
