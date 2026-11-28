import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';
import type { UserRole } from '../../types/auth.types';
import type { PaymentMethodType } from '../payments/payments.model';

export type ReportGroupBy = 'day' | 'month' | 'year';
export type TopProductsSortField = 'qtySold' | 'revenue' | 'grossProfit';

export interface DateRangeFilter {
  startDate?: Date | string;
  endDate?: Date | string;
}

export interface SalesSummaryFilters extends DateRangeFilter {
  groupBy: ReportGroupBy;
  userId?: number;
  customerId?: number;
  paymentMethodId?: number;
}

export interface TopProductsFilters extends DateRangeFilter {
  categoryId?: number;
  limit: number;
  sortBy: TopProductsSortField;
  sortOrder: 'asc' | 'desc';
}

export interface InventoryReportFilters {
  categoryId?: number;
  isActive?: boolean;
  lowStockLimit: number;
}

export interface PurchasesSummaryFilters extends DateRangeFilter {
  supplierId?: number;
  groupBy: ReportGroupBy;
}

interface SalesHeaderAggRow extends RowDataPacket {
  total_sales_count: number | string;
  completed_count: number | string;
  cancelled_count: number | string;
  refunded_count: number | string;
  subtotal: number | string;
  discount: number | string;
  tax: number | string;
  revenue: number | string;
}

interface SaleItemsAggRow extends RowDataPacket {
  total_items_sold: number | string;
  total_cost: number | string;
}

interface PurchasesHeaderAggRow extends RowDataPacket {
  total_purchases_count: number | string;
  received_count: number | string;
  pending_count: number | string;
  cancelled_count: number | string;
  total_spent: number | string;
}

interface PurchaseItemsAggRow extends RowDataPacket {
  total_items_purchased: number | string;
}

interface CustomersCountRow extends RowDataPacket {
  total_customers: number | string;
}

interface SalesSeriesHeaderRow extends RowDataPacket {
  period: string;
  sales_count: number | string;
  subtotal: number | string;
  discount: number | string;
  tax: number | string;
  revenue: number | string;
}

interface SalesSeriesItemsRow extends RowDataPacket {
  period: string;
  total_items_sold: number | string;
  total_cost: number | string;
}

interface TopProductRow extends RowDataPacket {
  product_id: number;
  name: string;
  barcode: string | null;
  unit: string;
  image: string | null;
  stock_qty: number;
  category_id: number | null;
  category_name: string | null;
  sales_count: number | string;
  qty_sold: number | string;
  revenue: number | string;
  cost: number | string;
  gross_profit: number | string;
}

interface PaymentMethodReportRow extends RowDataPacket {
  payment_method_id: number;
  name: string;
  type: PaymentMethodType;
  is_active: number;
  sales_count: number | string;
  total_amount: number | string;
}

interface CashierHeaderRow extends RowDataPacket {
  user_id: number;
  full_name: string;
  username: string;
  role: UserRole;
  total_sales_count: number | string;
  completed_count: number | string;
  cancelled_count: number | string;
  refunded_count: number | string;
  total_discount: number | string;
  total_revenue: number | string;
}

interface CashierItemsRow extends RowDataPacket {
  user_id: number;
  total_items_sold: number | string;
}

interface InventorySummaryRow extends RowDataPacket {
  total_products: number | string;
  active_products: number | string;
  inactive_products: number | string;
  low_stock_count: number | string;
  out_of_stock_count: number | string;
  total_stock_units: number | string;
  total_cost_value: number | string;
  total_retail_value: number | string;
}

interface InventoryCategoryRow extends RowDataPacket {
  category_id: number | null;
  category_name: string | null;
  product_count: number | string;
  total_stock_units: number | string;
  total_cost_value: number | string;
  total_retail_value: number | string;
}

interface LowStockProductRow extends RowDataPacket {
  id: number;
  name: string;
  barcode: string | null;
  category_id: number | null;
  category_name: string | null;
  stock_qty: number;
  alert_qty: number;
  unit: string;
  cost_price: number | string;
  sell_price: number | string;
  is_active: number;
}

interface PurchasesSeriesHeaderRow extends RowDataPacket {
  period: string;
  purchases_count: number | string;
  total_spent: number | string;
}

interface PurchasesSeriesItemsRow extends RowDataPacket {
  period: string;
  total_items_purchased: number | string;
}

interface PurchasesBySupplierRow extends RowDataPacket {
  supplier_id: number | null;
  supplier_name: string | null;
  purchases_count: number | string;
  total_spent: number | string;
}

export interface SalesHeaderTotals {
  totalSalesCount: number;
  completedCount: number;
  cancelledCount: number;
  refundedCount: number;
  subtotal: number;
  discount: number;
  tax: number;
  revenue: number;
}

export interface SaleItemsTotals {
  totalItemsSold: number;
  totalCost: number;
}

export interface PurchasesHeaderTotals {
  totalPurchasesCount: number;
  receivedCount: number;
  pendingCount: number;
  cancelledCount: number;
  totalSpent: number;
}

export interface SalesSeriesPointRaw {
  period: string;
  salesCount: number;
  totalItemsSold: number;
  subtotal: number;
  discount: number;
  tax: number;
  revenue: number;
  cost: number;
}

export interface TopProductRecord {
  productId: number;
  name: string;
  barcode: string | null;
  unit: string;
  image: string | null;
  stockQty: number;
  categoryId: number | null;
  categoryName: string | null;
  salesCount: number;
  qtySold: number;
  revenue: number;
  cost: number;
  grossProfit: number;
}

export interface PaymentMethodSummaryRow {
  paymentMethodId: number;
  name: string;
  type: PaymentMethodType;
  isActive: boolean;
  salesCount: number;
  totalAmount: number;
}

export interface CashierPerformanceRaw {
  userId: number;
  fullName: string;
  username: string;
  role: UserRole;
  totalSalesCount: number;
  completedCount: number;
  cancelledCount: number;
  refundedCount: number;
  totalDiscount: number;
  totalRevenue: number;
  totalItemsSold: number;
}

export interface InventorySummaryData {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
}

export interface InventoryByCategoryRecord {
  categoryId: number | null;
  categoryName: string;
  productCount: number;
  totalStockUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
}

export interface LowStockItemRecord {
  id: number;
  name: string;
  barcode: string | null;
  categoryId: number | null;
  categoryName: string | null;
  stockQty: number;
  alertQty: number;
  unit: string;
  costPrice: number;
  sellPrice: number;
  isActive: boolean;
}

export interface PurchasesSeriesPointRecord {
  period: string;
  purchasesCount: number;
  totalItemsPurchased: number;
  totalSpent: number;
}

export interface PurchasesBySupplierRecord {
  supplierId: number | null;
  supplierName: string;
  purchasesCount: number;
  totalSpent: number;
}

const GROUP_BY_FORMAT_MAP: Record<ReportGroupBy, string> = {
  day: '%Y-%m-%d',
  month: '%Y-%m',
  year: '%Y',
};

const TOP_PRODUCTS_SORT_MAP: Record<TopProductsSortField, string> = {
  qtySold: 'qty_sold',
  revenue: 'revenue',
  grossProfit: 'gross_profit',
};

const buildSalesWhere = (filters: { startDate?: Date | string; endDate?: Date | string; userId?: number; customerId?: number; paymentMethodId?: number; status?: 'completed' }, alias = 's'): { whereClause: string; params: Array<string | number | Date> } => {
  const conditions: string[] = [];
  const params: Array<string | number | Date> = [];

  if (filters.status !== undefined) {
    conditions.push(`${alias}.status = ?`);
    params.push(filters.status);
  }
  if (filters.startDate !== undefined) {
    conditions.push(`${alias}.created_at >= ?`);
    params.push(filters.startDate);
  }
  if (filters.endDate !== undefined) {
    conditions.push(`${alias}.created_at <= ?`);
    params.push(filters.endDate);
  }
  if (filters.userId !== undefined) {
    conditions.push(`${alias}.user_id = ?`);
    params.push(filters.userId);
  }
  if (filters.customerId !== undefined) {
    conditions.push(`${alias}.customer_id = ?`);
    params.push(filters.customerId);
  }
  if (filters.paymentMethodId !== undefined) {
    conditions.push(`${alias}.payment_method_id = ?`);
    params.push(filters.paymentMethodId);
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
};

const buildPurchasesWhere = (filters: { startDate?: Date | string; endDate?: Date | string; supplierId?: number; status?: 'received' }, alias = 'pu'): { whereClause: string; params: Array<string | number | Date> } => {
  const conditions: string[] = [];
  const params: Array<string | number | Date> = [];

  if (filters.status !== undefined) {
    conditions.push(`${alias}.status = ?`);
    params.push(filters.status);
  }
  if (filters.startDate !== undefined) {
    conditions.push(`${alias}.purchase_date >= ?`);
    params.push(filters.startDate);
  }
  if (filters.endDate !== undefined) {
    conditions.push(`${alias}.purchase_date <= ?`);
    params.push(filters.endDate);
  }
  if (filters.supplierId !== undefined) {
    conditions.push(`${alias}.supplier_id = ?`);
    params.push(filters.supplierId);
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
};

export const getSalesHeaderTotals = async (filters: { startDate?: Date | string; endDate?: Date | string; userId?: number; customerId?: number; paymentMethodId?: number }, connection: PoolConnection | null = null): Promise<SalesHeaderTotals> => {
  const db = getExecutor(connection);
  const { whereClause, params } = buildSalesWhere(filters, 's');

  const [rows] = await db.query<SalesHeaderAggRow[]>(
    `SELECT
       COUNT(*) AS total_sales_count,
       COALESCE(SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_count,
       COALESCE(SUM(CASE WHEN s.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_count,
       COALESCE(SUM(CASE WHEN s.status = 'refunded' THEN 1 ELSE 0 END), 0) AS refunded_count,
       COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.subtotal ELSE 0 END), 0) AS subtotal,
       COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.discount ELSE 0 END), 0) AS discount,
       COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.tax ELSE 0 END), 0) AS tax,
       COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total_amount ELSE 0 END), 0) AS revenue
     FROM sales s
     ${whereClause}`,
    params,
  );

  const row = rows[0];
  return {
    totalSalesCount: Number(row?.total_sales_count ?? 0),
    completedCount: Number(row?.completed_count ?? 0),
    cancelledCount: Number(row?.cancelled_count ?? 0),
    refundedCount: Number(row?.refunded_count ?? 0),
    subtotal: Number(row?.subtotal ?? 0),
    discount: Number(row?.discount ?? 0),
    tax: Number(row?.tax ?? 0),
    revenue: Number(row?.revenue ?? 0),
  };
};

export const getCompletedSaleItemsTotals = async (filters: { startDate?: Date | string; endDate?: Date | string; userId?: number; customerId?: number; paymentMethodId?: number }, connection: PoolConnection | null = null): Promise<SaleItemsTotals> => {
  const db = getExecutor(connection);
  const { whereClause, params } = buildSalesWhere({ ...filters, status: 'completed' }, 's');

  const [rows] = await db.query<SaleItemsAggRow[]>(
    `SELECT
       COALESCE(SUM(si.qty), 0) AS total_items_sold,
       COALESCE(SUM(si.qty * si.cost_price), 0) AS total_cost
     FROM sale_items si
     INNER JOIN sales s ON si.sale_id = s.id
     ${whereClause}`,
    params,
  );

  const row = rows[0];
  return {
    totalItemsSold: Number(row?.total_items_sold ?? 0),
    totalCost: Number(row?.total_cost ?? 0),
  };
};

export const getPurchasesHeaderTotals = async (filters: { startDate?: Date | string; endDate?: Date | string; supplierId?: number }, connection: PoolConnection | null = null): Promise<PurchasesHeaderTotals> => {
  const db = getExecutor(connection);
  const { whereClause, params } = buildPurchasesWhere(filters, 'pu');

  const [rows] = await db.query<PurchasesHeaderAggRow[]>(
    `SELECT
       COUNT(*) AS total_purchases_count,
       COALESCE(SUM(CASE WHEN pu.status = 'received' THEN 1 ELSE 0 END), 0) AS received_count,
       COALESCE(SUM(CASE WHEN pu.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
       COALESCE(SUM(CASE WHEN pu.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_count,
       COALESCE(SUM(CASE WHEN pu.status = 'received' THEN pu.total_amount ELSE 0 END), 0) AS total_spent
     FROM purchases pu
     ${whereClause}`,
    params,
  );

  const row = rows[0];
  return {
    totalPurchasesCount: Number(row?.total_purchases_count ?? 0),
    receivedCount: Number(row?.received_count ?? 0),
    pendingCount: Number(row?.pending_count ?? 0),
    cancelledCount: Number(row?.cancelled_count ?? 0),
    totalSpent: Number(row?.total_spent ?? 0),
  };
};

export const getReceivedPurchaseItemsTotal = async (filters: { startDate?: Date | string; endDate?: Date | string; supplierId?: number }, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const { whereClause, params } = buildPurchasesWhere({ ...filters, status: 'received' }, 'pu');

  const [rows] = await db.query<PurchaseItemsAggRow[]>(
    `SELECT COALESCE(SUM(pi.qty), 0) AS total_items_purchased
     FROM purchase_items pi
     INNER JOIN purchases pu ON pi.purchase_id = pu.id
     ${whereClause}`,
    params,
  );

  return Number(rows[0]?.total_items_purchased ?? 0);
};

export const getCustomersCount = async (filters: DateRangeFilter = {}, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const conditions: string[] = [];
  const params: Array<string | Date> = [];

  if (filters.startDate !== undefined) {
    conditions.push('created_at >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate !== undefined) {
    conditions.push('created_at <= ?');
    params.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await db.query<CustomersCountRow[]>(
    `SELECT COUNT(*) AS total_customers
     FROM customers
     ${whereClause}`,
    params,
  );

  return Number(rows[0]?.total_customers ?? 0);
};

export const getSalesSummarySeries = async (filters: SalesSummaryFilters, connection: PoolConnection | null = null): Promise<SalesSeriesPointRaw[]> => {
  const db = getExecutor(connection);
  const dateFormat = GROUP_BY_FORMAT_MAP[filters.groupBy] ?? '%Y-%m-%d';
  const { whereClause, params } = buildSalesWhere(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
      userId: filters.userId,
      customerId: filters.customerId,
      paymentMethodId: filters.paymentMethodId,
      status: 'completed',
    },
    's',
  );

  const [headerRows] = await db.query<SalesSeriesHeaderRow[]>(
    `SELECT
       DATE_FORMAT(s.created_at, '${dateFormat}') AS period,
       COUNT(*) AS sales_count,
       COALESCE(SUM(s.subtotal), 0) AS subtotal,
       COALESCE(SUM(s.discount), 0) AS discount,
       COALESCE(SUM(s.tax), 0) AS tax,
       COALESCE(SUM(s.total_amount), 0) AS revenue
     FROM sales s
     ${whereClause}
     GROUP BY DATE_FORMAT(s.created_at, '${dateFormat}')
     ORDER BY DATE_FORMAT(s.created_at, '${dateFormat}') ASC`,
    params,
  );

  if (headerRows.length === 0) {
    return [];
  }

  const [itemRows] = await db.query<SalesSeriesItemsRow[]>(
    `SELECT
       DATE_FORMAT(s.created_at, '${dateFormat}') AS period,
       COALESCE(SUM(si.qty), 0) AS total_items_sold,
       COALESCE(SUM(si.qty * si.cost_price), 0) AS total_cost
     FROM sale_items si
     INNER JOIN sales s ON si.sale_id = s.id
     ${whereClause}
     GROUP BY DATE_FORMAT(s.created_at, '${dateFormat}')
     ORDER BY DATE_FORMAT(s.created_at, '${dateFormat}') ASC`,
    params,
  );

  const itemsByPeriod = new Map<string, { totalItemsSold: number; totalCost: number }>();
  for (const row of itemRows) {
    itemsByPeriod.set(row.period, {
      totalItemsSold: Number(row.total_items_sold ?? 0),
      totalCost: Number(row.total_cost ?? 0),
    });
  }

  return headerRows.map((row) => {
    const itemStats = itemsByPeriod.get(row.period);
    return {
      period: row.period,
      salesCount: Number(row.sales_count ?? 0),
      totalItemsSold: itemStats?.totalItemsSold ?? 0,
      subtotal: Number(row.subtotal ?? 0),
      discount: Number(row.discount ?? 0),
      tax: Number(row.tax ?? 0),
      revenue: Number(row.revenue ?? 0),
      cost: itemStats?.totalCost ?? 0,
    };
  });
};

export const getTopProducts = async (filters: TopProductsFilters, connection: PoolConnection | null = null): Promise<TopProductRecord[]> => {
  const db = getExecutor(connection);
  const conditions: string[] = [`s.status = 'completed'`];
  const params: Array<string | number | Date> = [];

  if (filters.startDate !== undefined) {
    conditions.push('s.created_at >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate !== undefined) {
    conditions.push('s.created_at <= ?');
    params.push(filters.endDate);
  }
  if (filters.categoryId !== undefined) {
    conditions.push('p.category_id = ?');
    params.push(filters.categoryId);
  }

  const sortColumn = TOP_PRODUCTS_SORT_MAP[filters.sortBy] ?? 'qty_sold';
  const orderDirection = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const [rows] = await db.query<TopProductRow[]>(
    `SELECT
       p.id AS product_id,
       p.name,
       p.barcode,
       p.unit,
       p.image,
       p.stock_qty,
       c.id AS category_id,
       c.name AS category_name,
       COUNT(DISTINCT si.sale_id) AS sales_count,
       COALESCE(SUM(si.qty), 0) AS qty_sold,
       COALESCE(SUM(si.subtotal), 0) AS revenue,
       COALESCE(SUM(si.qty * si.cost_price), 0) AS cost,
       COALESCE(SUM(si.subtotal - (si.qty * si.cost_price)), 0) AS gross_profit
     FROM sale_items si
     INNER JOIN sales s ON si.sale_id = s.id
     INNER JOIN products p ON si.product_id = p.id
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.id, p.name, p.barcode, p.unit, p.image, p.stock_qty, c.id, c.name
     ORDER BY ${sortColumn} ${orderDirection}, p.id ASC
     LIMIT ?`,
    [...params, filters.limit],
  );

  return rows.map((row) => ({
    productId: Number(row.product_id),
    name: row.name,
    barcode: row.barcode,
    unit: row.unit,
    image: row.image,
    stockQty: Number(row.stock_qty),
    categoryId: row.category_id !== null ? Number(row.category_id) : null,
    categoryName: row.category_name ?? null,
    salesCount: Number(row.sales_count ?? 0),
    qtySold: Number(row.qty_sold ?? 0),
    revenue: Number(row.revenue ?? 0),
    cost: Number(row.cost ?? 0),
    grossProfit: Number(row.gross_profit ?? 0),
  }));
};

export const getPaymentMethodsReport = async (filters: DateRangeFilter, connection: PoolConnection | null = null): Promise<PaymentMethodSummaryRow[]> => {
  const db = getExecutor(connection);
  const joinConditions: string[] = [`s.payment_method_id = pm.id`, `s.status = 'completed'`];
  const params: Array<string | Date> = [];

  if (filters.startDate !== undefined) {
    joinConditions.push('s.created_at >= ?');
    params.push(filters.startDate);
  }
  if (filters.endDate !== undefined) {
    joinConditions.push('s.created_at <= ?');
    params.push(filters.endDate);
  }

  const [rows] = await db.query<PaymentMethodReportRow[]>(
    `SELECT
       pm.id AS payment_method_id,
       pm.name,
       pm.type,
       pm.is_active,
       COUNT(s.id) AS sales_count,
       COALESCE(SUM(s.total_amount), 0) AS total_amount
     FROM payment_methods pm
     LEFT JOIN sales s ON ${joinConditions.join(' AND ')}
     WHERE pm.is_active = 1 OR s.id IS NOT NULL
     GROUP BY pm.id, pm.name, pm.type, pm.is_active
     ORDER BY total_amount DESC, sales_count DESC, pm.id ASC`,
    params,
  );

  return rows.map((row) => ({
    paymentMethodId: Number(row.payment_method_id),
    name: row.name,
    type: row.type,
    isActive: Boolean(row.is_active),
    salesCount: Number(row.sales_count ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
  }));
};

export const getCashierPerformance = async (filters: DateRangeFilter, connection: PoolConnection | null = null): Promise<CashierPerformanceRaw[]> => {
  const db = getExecutor(connection);
  const { whereClause, params } = buildSalesWhere(filters, 's');

  const [headerRows] = await db.query<CashierHeaderRow[]>(
    `SELECT
       u.id AS user_id,
       u.full_name,
       u.username,
       u.role,
       COUNT(s.id) AS total_sales_count,
       COALESCE(SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_count,
       COALESCE(SUM(CASE WHEN s.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_count,
       COALESCE(SUM(CASE WHEN s.status = 'refunded' THEN 1 ELSE 0 END), 0) AS refunded_count,
       COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.discount ELSE 0 END), 0) AS total_discount,
       COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total_amount ELSE 0 END), 0) AS total_revenue
     FROM sales s
     INNER JOIN users u ON s.user_id = u.id
     ${whereClause}
     GROUP BY u.id, u.full_name, u.username, u.role
     ORDER BY total_revenue DESC, completed_count DESC, u.id ASC`,
    params,
  );

  if (headerRows.length === 0) {
    return [];
  }

  const completedWhere = buildSalesWhere({ ...filters, status: 'completed' }, 's');
  const [itemRows] = await db.query<CashierItemsRow[]>(
    `SELECT
       s.user_id,
       COALESCE(SUM(si.qty), 0) AS total_items_sold
     FROM sale_items si
     INNER JOIN sales s ON si.sale_id = s.id
     ${completedWhere.whereClause}
     GROUP BY s.user_id`,
    completedWhere.params,
  );

  const itemsByUser = new Map<number, number>();
  for (const row of itemRows) {
    itemsByUser.set(Number(row.user_id), Number(row.total_items_sold ?? 0));
  }

  return headerRows.map((row) => {
    const userId = Number(row.user_id);
    return {
      userId,
      fullName: row.full_name,
      username: row.username,
      role: row.role,
      totalSalesCount: Number(row.total_sales_count ?? 0),
      completedCount: Number(row.completed_count ?? 0),
      cancelledCount: Number(row.cancelled_count ?? 0),
      refundedCount: Number(row.refunded_count ?? 0),
      totalDiscount: Number(row.total_discount ?? 0),
      totalRevenue: Number(row.total_revenue ?? 0),
      totalItemsSold: itemsByUser.get(userId) ?? 0,
    };
  });
};

export const getInventorySummary = async (filters: { categoryId?: number; isActive?: boolean } = {}, connection: PoolConnection | null = null): Promise<InventorySummaryData> => {
  const db = getExecutor(connection);
  const conditions: string[] = [];
  const params: Array<number> = [];

  if (filters.categoryId !== undefined) {
    conditions.push('p.category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.isActive !== undefined) {
    conditions.push('p.is_active = ?');
    params.push(filters.isActive ? 1 : 0);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const lowStockCondition =
    filters.isActive === undefined
      ? 'p.is_active = 1 AND p.stock_qty <= p.alert_qty'
      : 'p.stock_qty <= p.alert_qty';
  const outOfStockCondition =
    filters.isActive === undefined
      ? 'p.is_active = 1 AND p.stock_qty <= 0'
      : 'p.stock_qty <= 0';

  const [rows] = await db.query<InventorySummaryRow[]>(
    `SELECT
       COUNT(*) AS total_products,
       COALESCE(SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END), 0) AS active_products,
       COALESCE(SUM(CASE WHEN p.is_active = 0 THEN 1 ELSE 0 END), 0) AS inactive_products,
       COALESCE(SUM(CASE WHEN ${lowStockCondition} THEN 1 ELSE 0 END), 0) AS low_stock_count,
       COALESCE(SUM(CASE WHEN ${outOfStockCondition} THEN 1 ELSE 0 END), 0) AS out_of_stock_count,
       COALESCE(SUM(p.stock_qty), 0) AS total_stock_units,
       COALESCE(SUM(p.stock_qty * p.cost_price), 0) AS total_cost_value,
       COALESCE(SUM(p.stock_qty * p.sell_price), 0) AS total_retail_value
     FROM products p
     ${whereClause}`,
    params,
  );

  const row = rows[0];
  return {
    totalProducts: Number(row?.total_products ?? 0),
    activeProducts: Number(row?.active_products ?? 0),
    inactiveProducts: Number(row?.inactive_products ?? 0),
    lowStockCount: Number(row?.low_stock_count ?? 0),
    outOfStockCount: Number(row?.out_of_stock_count ?? 0),
    totalStockUnits: Number(row?.total_stock_units ?? 0),
    totalCostValue: Number(row?.total_cost_value ?? 0),
    totalRetailValue: Number(row?.total_retail_value ?? 0),
  };
};

export const getInventoryByCategory = async (filters: { categoryId?: number; isActive?: boolean } = {}, connection: PoolConnection | null = null): Promise<InventoryByCategoryRecord[]> => {
  const db = getExecutor(connection);
  const conditions: string[] = [];
  const params: Array<number> = [];

  if (filters.categoryId !== undefined) {
    conditions.push('p.category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.isActive !== undefined) {
    conditions.push('p.is_active = ?');
    params.push(filters.isActive ? 1 : 0);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await db.query<InventoryCategoryRow[]>(
    `SELECT
       c.id AS category_id,
       c.name AS category_name,
       COUNT(p.id) AS product_count,
       COALESCE(SUM(p.stock_qty), 0) AS total_stock_units,
       COALESCE(SUM(p.stock_qty * p.cost_price), 0) AS total_cost_value,
       COALESCE(SUM(p.stock_qty * p.sell_price), 0) AS total_retail_value
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     ${whereClause}
     GROUP BY c.id, c.name
     ORDER BY total_retail_value DESC, product_count DESC, c.id ASC`,
    params,
  );

  return rows.map((row) => ({
    categoryId: row.category_id !== null ? Number(row.category_id) : null,
    categoryName: row.category_name ?? 'Uncategorized',
    productCount: Number(row.product_count ?? 0),
    totalStockUnits: Number(row.total_stock_units ?? 0),
    totalCostValue: Number(row.total_cost_value ?? 0),
    totalRetailValue: Number(row.total_retail_value ?? 0),
  }));
};

export const getLowStockItems = async (filters: InventoryReportFilters, connection: PoolConnection | null = null): Promise<LowStockItemRecord[]> => {
  const db = getExecutor(connection);
  const conditions: string[] = ['p.stock_qty <= p.alert_qty'];
  const params: Array<number> = [];

  if (filters.categoryId !== undefined) {
    conditions.push('p.category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.isActive !== undefined) {
    conditions.push('p.is_active = ?');
    params.push(filters.isActive ? 1 : 0);
  }

  const [rows] = await db.query<LowStockProductRow[]>(
    `SELECT
       p.id,
       p.name,
       p.barcode,
       c.id AS category_id,
       c.name AS category_name,
       p.stock_qty,
       p.alert_qty,
       p.unit,
       p.cost_price,
       p.sell_price,
       p.is_active
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY p.stock_qty ASC, p.id ASC
     LIMIT ?`,
    [...params, filters.lowStockLimit],
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    barcode: row.barcode,
    categoryId: row.category_id !== null ? Number(row.category_id) : null,
    categoryName: row.category_name ?? null,
    stockQty: Number(row.stock_qty),
    alertQty: Number(row.alert_qty),
    unit: row.unit,
    costPrice: Number(row.cost_price),
    sellPrice: Number(row.sell_price),
    isActive: Boolean(row.is_active),
  }));
};

export const getPurchasesSummarySeries = async (filters: PurchasesSummaryFilters, connection: PoolConnection | null = null): Promise<PurchasesSeriesPointRecord[]> => {
  const db = getExecutor(connection);
  const dateFormat = GROUP_BY_FORMAT_MAP[filters.groupBy] ?? '%Y-%m-%d';
  const { whereClause, params } = buildPurchasesWhere(
    {
      startDate: filters.startDate,
      endDate: filters.endDate,
      supplierId: filters.supplierId,
      status: 'received',
    },
    'pu',
  );

  const [headerRows] = await db.query<PurchasesSeriesHeaderRow[]>(
    `SELECT
       DATE_FORMAT(pu.purchase_date, '${dateFormat}') AS period,
       COUNT(*) AS purchases_count,
       COALESCE(SUM(pu.total_amount), 0) AS total_spent
     FROM purchases pu
     ${whereClause}
     GROUP BY DATE_FORMAT(pu.purchase_date, '${dateFormat}')
     ORDER BY DATE_FORMAT(pu.purchase_date, '${dateFormat}') ASC`,
    params,
  );

  if (headerRows.length === 0) {
    return [];
  }

  const [itemRows] = await db.query<PurchasesSeriesItemsRow[]>(
    `SELECT
       DATE_FORMAT(pu.purchase_date, '${dateFormat}') AS period,
       COALESCE(SUM(pi.qty), 0) AS total_items_purchased
     FROM purchase_items pi
     INNER JOIN purchases pu ON pi.purchase_id = pu.id
     ${whereClause}
     GROUP BY DATE_FORMAT(pu.purchase_date, '${dateFormat}')
     ORDER BY DATE_FORMAT(pu.purchase_date, '${dateFormat}') ASC`,
    params,
  );

  const itemsByPeriod = new Map<string, number>();
  for (const row of itemRows) {
    itemsByPeriod.set(row.period, Number(row.total_items_purchased ?? 0));
  }

  return headerRows.map((row) => ({
    period: row.period,
    purchasesCount: Number(row.purchases_count ?? 0),
    totalItemsPurchased: itemsByPeriod.get(row.period) ?? 0,
    totalSpent: Number(row.total_spent ?? 0),
  }));
};

export const getPurchasesBySupplier = async (filters: { startDate?: Date | string; endDate?: Date | string; supplierId?: number }, connection: PoolConnection | null = null): Promise<PurchasesBySupplierRecord[]> => {
  const db = getExecutor(connection);
  const { whereClause, params } = buildPurchasesWhere({ ...filters, status: 'received' }, 'pu');

  const [rows] = await db.query<PurchasesBySupplierRow[]>(
    `SELECT
       sup.id AS supplier_id,
       sup.name AS supplier_name,
       COUNT(pu.id) AS purchases_count,
       COALESCE(SUM(pu.total_amount), 0) AS total_spent
     FROM purchases pu
     LEFT JOIN suppliers sup ON pu.supplier_id = sup.id
     ${whereClause}
     GROUP BY sup.id, sup.name
     ORDER BY total_spent DESC, purchases_count DESC, sup.id ASC`,
    params,
  );

  return rows.map((row) => ({
    supplierId: row.supplier_id !== null ? Number(row.supplier_id) : null,
    supplierName: row.supplier_name ?? 'Unspecified Supplier',
    purchasesCount: Number(row.purchases_count ?? 0),
    totalSpent: Number(row.total_spent ?? 0),
  }));
};

export const reportsModel = {
  getSalesHeaderTotals,
  getCompletedSaleItemsTotals,
  getPurchasesHeaderTotals,
  getReceivedPurchaseItemsTotal,
  getCustomersCount,
  getSalesSummarySeries,
  getTopProducts,
  getPaymentMethodsReport,
  getCashierPerformance,
  getInventorySummary,
  getInventoryByCategory,
  getLowStockItems,
  getPurchasesSummarySeries,
  getPurchasesBySupplier,
};

export default reportsModel;
