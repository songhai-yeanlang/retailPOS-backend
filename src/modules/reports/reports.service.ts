import ApiError from '../../utils/api-error';
import settingsModel from '../settings/settings.model';
import reportsModel from './reports.model';
import type {
  InventoryByCategoryRecord,
  InventorySummaryData,
  LowStockItemRecord,
  PurchasesBySupplierRecord,
  PurchasesSeriesPointRecord,
  ReportGroupBy,
  TopProductRecord,
  TopProductsSortField,
} from './reports.model';
import type { UserRole } from '../../types/auth.types';
import type { PaymentMethodType } from '../payments/payments.model';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DEFAULT_EXCHANGE_RATE = 4100;

export interface DateRangeQuery {
  startDate?: string;
  endDate?: string;
}

export interface SalesSummaryQuery extends DateRangeQuery {
  groupBy: ReportGroupBy;
  userId?: number;
  customerId?: number;
  paymentMethodId?: number;
}

export interface TopProductsQuery extends DateRangeQuery {
  categoryId?: number;
  limit: number;
  sortBy: TopProductsSortField;
  sortOrder: 'asc' | 'desc';
}

export interface InventoryReportQuery {
  categoryId?: number;
  isActive?: boolean;
  lowStockLimit: number;
}

export interface PurchasesSummaryQuery extends DateRangeQuery {
  supplierId?: number;
  groupBy: ReportGroupBy;
}

export interface ReportDateRange {
  startDate: string | null;
  endDate: string | null;
}

export interface DashboardReportResult {
  range: ReportDateRange;
  exchangeRate: number;
  sales: {
    totalSalesCount: number;
    completedCount: number;
    cancelledCount: number;
    refundedCount: number;
    subtotal: number;
    discount: number;
    tax: number;
    netSales: number;
    revenue: number;
    totalItemsSold: number;
    averageOrderValue: number;
    cost: number;
    grossProfit: number;
    profitMarginPercent: number;
  };
  purchases: {
    totalPurchasesCount: number;
    receivedCount: number;
    pendingCount: number;
    cancelledCount: number;
    totalSpent: number;
    totalItemsPurchased: number;
  };
  inventory: InventorySummaryData & {
    potentialProfit: number;
  };
  customers: {
    totalCustomers: number;
    newCustomersInPeriod: number;
  };
}

export interface SalesSummarySeriesPoint {
  period: string;
  salesCount: number;
  totalItemsSold: number;
  subtotal: number;
  discount: number;
  tax: number;
  netSales: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  profitMarginPercent: number;
}

export interface SalesSummaryReportResult {
  range: ReportDateRange;
  groupBy: ReportGroupBy;
  summary: {
    totalSalesCount: number;
    completedCount: number;
    cancelledCount: number;
    refundedCount: number;
    totalItemsSold: number;
    subtotal: number;
    discount: number;
    tax: number;
    netSales: number;
    revenue: number;
    cost: number;
    grossProfit: number;
    profitMarginPercent: number;
    averageOrderValue: number;
  };
  series: SalesSummarySeriesPoint[];
}

export interface TopProductItem extends TopProductRecord {
  profitMarginPercent: number;
}

export interface TopProductsReportResult {
  range: ReportDateRange;
  items: TopProductItem[];
}

export interface PaymentMethodReportItem {
  paymentMethodId: number;
  name: string;
  type: PaymentMethodType;
  isActive: boolean;
  salesCount: number;
  totalAmount: number;
  sharePercent: number;
}

export interface PaymentMethodsReportResult {
  range: ReportDateRange;
  summary: {
    totalSalesCount: number;
    totalAmount: number;
  };
  items: PaymentMethodReportItem[];
}

export interface CashierReportItem {
  userId: number;
  fullName: string;
  username: string;
  role: UserRole;
  totalSalesCount: number;
  completedCount: number;
  cancelledCount: number;
  refundedCount: number;
  totalItemsSold: number;
  totalDiscount: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export interface CashiersReportResult {
  range: ReportDateRange;
  items: CashierReportItem[];
}

export interface InventoryReportResult {
  summary: InventorySummaryData & {
    potentialProfit: number;
  };
  byCategory: Array<InventoryByCategoryRecord & { potentialProfit: number }>;
  lowStockItems: LowStockItemRecord[];
}

export interface PurchasesSummaryReportResult {
  range: ReportDateRange;
  groupBy: ReportGroupBy;
  summary: {
    totalPurchasesCount: number;
    receivedCount: number;
    pendingCount: number;
    cancelledCount: number;
    totalSpent: number;
    totalItemsPurchased: number;
  };
  series: PurchasesSeriesPointRecord[];
  bySupplier: PurchasesBySupplierRecord[];
}

interface ParsedDateBoundary {
  sqlValue: Date | string;
  timestampMs: number;
}

const toCents = (amount: number): number => {
  if (!Number.isFinite(amount) || amount === 0) {
    return 0;
  }
  const sign = amount < 0 ? -1 : 1;
  const cents = sign * Math.round((Math.abs(amount) + Number.EPSILON) * 100);
  return cents === 0 ? 0 : cents;
};

const round2 = (value: number): number => {
  if (!Number.isFinite(value) || value === 0) {
    return 0;
  }
  const sign = value < 0 ? -1 : 1;
  const rounded = (sign * Math.round((Math.abs(value) + Number.EPSILON) * 100)) / 100;
  return rounded === 0 ? 0 : rounded;
};

const parseDateBoundary = (rawDate: string, boundary: 'start' | 'end'): ParsedDateBoundary => {
  const dateOnlyMatch = DATE_ONLY_REGEX.exec(rawDate);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const timeSuffix = boundary === 'start' ? '00:00:00' : '23:59:59';
    const parsed =
      boundary === 'start'
        ? new Date(year, month - 1, day, 0, 0, 0, 0)
        : new Date(year, month - 1, day, 23, 59, 59, 999);

    if (Number.isNaN(parsed.getTime())) {
      throw ApiError.badRequest(`Invalid ${boundary}Date value`);
    }

    return {
      sqlValue: `${rawDate} ${timeSuffix}`,
      timestampMs: parsed.getTime(),
    };
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    throw ApiError.badRequest(`Invalid ${boundary}Date value`);
  }

  return {
    sqlValue: parsed,
    timestampMs: parsed.getTime(),
  };
};

const resolveDateRange = (query: DateRangeQuery): { sqlStartDate?: Date | string; sqlEndDate?: Date | string; range: ReportDateRange } => {
  const startBoundary = query.startDate ? parseDateBoundary(query.startDate, 'start') : undefined;
  const endBoundary = query.endDate ? parseDateBoundary(query.endDate, 'end') : undefined;

  if (startBoundary && endBoundary && startBoundary.timestampMs > endBoundary.timestampMs) {
    throw ApiError.badRequest('endDate must be greater than or equal to startDate');
  }

  return {
    sqlStartDate: startBoundary?.sqlValue,
    sqlEndDate: endBoundary?.sqlValue,
    range: {
      startDate: query.startDate ?? null,
      endDate: query.endDate ?? null,
    },
  };
};

const computeProfitMetrics = (subtotal: number, discount: number, cost: number): { netSales: number; grossProfit: number; profitMarginPercent: number } => {
  const netSalesCents = toCents(subtotal) - toCents(discount);
  const grossProfitCents = netSalesCents - toCents(cost);
  const netSales = netSalesCents / 100;
  const grossProfit = grossProfitCents / 100;
  const profitMarginPercent = netSalesCents > 0 ? round2((grossProfitCents / netSalesCents) * 100) : 0;

  return { netSales, grossProfit, profitMarginPercent };
};

export const getDashboardReport = async (query: DateRangeQuery): Promise<DashboardReportResult> => {
  const { sqlStartDate, sqlEndDate, range } = resolveDateRange(query);
  const dateFilter = { startDate: sqlStartDate, endDate: sqlEndDate };

  const [
    salesHeader,
    saleItemsTotals,
    purchasesHeader,
    totalItemsPurchased,
    inventorySummary,
    totalCustomers,
    newCustomersInPeriod,
    settings,
  ] = await Promise.all([
    reportsModel.getSalesHeaderTotals(dateFilter),
    reportsModel.getCompletedSaleItemsTotals(dateFilter),
    reportsModel.getPurchasesHeaderTotals(dateFilter),
    reportsModel.getReceivedPurchaseItemsTotal(dateFilter),
    reportsModel.getInventorySummary(),
    reportsModel.getCustomersCount(),
    sqlStartDate !== undefined || sqlEndDate !== undefined
      ? reportsModel.getCustomersCount(dateFilter)
      : Promise.resolve<number | null>(null),
    settingsModel.findSettings(),
  ]);

  const { netSales, grossProfit, profitMarginPercent } = computeProfitMetrics(
    salesHeader.subtotal,
    salesHeader.discount,
    saleItemsTotals.totalCost,
  );

  const averageOrderValue =
    salesHeader.completedCount > 0 ? round2(salesHeader.revenue / salesHeader.completedCount) : 0;

  const potentialProfit = (toCents(inventorySummary.totalRetailValue) - toCents(inventorySummary.totalCostValue)) / 100;

  return {
    range,
    exchangeRate: settings?.exchangeRate ?? DEFAULT_EXCHANGE_RATE,
    sales: {
      totalSalesCount: salesHeader.totalSalesCount,
      completedCount: salesHeader.completedCount,
      cancelledCount: salesHeader.cancelledCount,
      refundedCount: salesHeader.refundedCount,
      subtotal: round2(salesHeader.subtotal),
      discount: round2(salesHeader.discount),
      tax: round2(salesHeader.tax),
      netSales,
      revenue: round2(salesHeader.revenue),
      totalItemsSold: saleItemsTotals.totalItemsSold,
      averageOrderValue,
      cost: round2(saleItemsTotals.totalCost),
      grossProfit,
      profitMarginPercent,
    },
    purchases: {
      totalPurchasesCount: purchasesHeader.totalPurchasesCount,
      receivedCount: purchasesHeader.receivedCount,
      pendingCount: purchasesHeader.pendingCount,
      cancelledCount: purchasesHeader.cancelledCount,
      totalSpent: round2(purchasesHeader.totalSpent),
      totalItemsPurchased,
    },
    inventory: {
      ...inventorySummary,
      totalCostValue: round2(inventorySummary.totalCostValue),
      totalRetailValue: round2(inventorySummary.totalRetailValue),
      potentialProfit,
    },
    customers: {
      totalCustomers,
      newCustomersInPeriod: newCustomersInPeriod ?? totalCustomers,
    },
  };
};

export const getSalesSummaryReport = async (query: SalesSummaryQuery): Promise<SalesSummaryReportResult> => {
  const { sqlStartDate, sqlEndDate, range } = resolveDateRange(query);
  const sharedFilters = {
    startDate: sqlStartDate,
    endDate: sqlEndDate,
    userId: query.userId,
    customerId: query.customerId,
    paymentMethodId: query.paymentMethodId,
  };

  const [headerTotals, itemTotals, rawSeries] = await Promise.all([
    reportsModel.getSalesHeaderTotals(sharedFilters),
    reportsModel.getCompletedSaleItemsTotals(sharedFilters),
    reportsModel.getSalesSummarySeries({ ...sharedFilters, groupBy: query.groupBy }),
  ]);

  const summaryProfit = computeProfitMetrics(headerTotals.subtotal, headerTotals.discount, itemTotals.totalCost);
  const averageOrderValue =
    headerTotals.completedCount > 0 ? round2(headerTotals.revenue / headerTotals.completedCount) : 0;

  const series: SalesSummarySeriesPoint[] = rawSeries.map((point) => {
    const profit = computeProfitMetrics(point.subtotal, point.discount, point.cost);
    return {
      period: point.period,
      salesCount: point.salesCount,
      totalItemsSold: point.totalItemsSold,
      subtotal: round2(point.subtotal),
      discount: round2(point.discount),
      tax: round2(point.tax),
      netSales: profit.netSales,
      revenue: round2(point.revenue),
      cost: round2(point.cost),
      grossProfit: profit.grossProfit,
      profitMarginPercent: profit.profitMarginPercent,
    };
  });

  return {
    range,
    groupBy: query.groupBy,
    summary: {
      totalSalesCount: headerTotals.totalSalesCount,
      completedCount: headerTotals.completedCount,
      cancelledCount: headerTotals.cancelledCount,
      refundedCount: headerTotals.refundedCount,
      totalItemsSold: itemTotals.totalItemsSold,
      subtotal: round2(headerTotals.subtotal),
      discount: round2(headerTotals.discount),
      tax: round2(headerTotals.tax),
      netSales: summaryProfit.netSales,
      revenue: round2(headerTotals.revenue),
      cost: round2(itemTotals.totalCost),
      grossProfit: summaryProfit.grossProfit,
      profitMarginPercent: summaryProfit.profitMarginPercent,
      averageOrderValue,
    },
    series,
  };
};

export const getTopProductsReport = async (query: TopProductsQuery): Promise<TopProductsReportResult> => {
  const { sqlStartDate, sqlEndDate, range } = resolveDateRange(query);
  const rows = await reportsModel.getTopProducts({
    startDate: sqlStartDate,
    endDate: sqlEndDate,
    categoryId: query.categoryId,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });

  const items: TopProductItem[] = rows.map((row) => {
    const revenueCents = toCents(row.revenue);
    const costCents = toCents(row.cost);
    const grossProfitCents = revenueCents - costCents;
    const profitMarginPercent = revenueCents > 0 ? round2((grossProfitCents / revenueCents) * 100) : 0;

    return {
      ...row,
      revenue: revenueCents / 100,
      cost: costCents / 100,
      grossProfit: grossProfitCents / 100,
      profitMarginPercent,
    };
  });

  return {
    range,
    items,
  };
};

export const getPaymentMethodsReport = async (query: DateRangeQuery): Promise<PaymentMethodsReportResult> => {
  const { sqlStartDate, sqlEndDate, range } = resolveDateRange(query);
  const rows = await reportsModel.getPaymentMethodsReport({
    startDate: sqlStartDate,
    endDate: sqlEndDate,
  });

  let totalSalesCount = 0;
  let totalAmountCents = 0;
  for (const row of rows) {
    totalSalesCount += row.salesCount;
    totalAmountCents += toCents(row.totalAmount);
  }

  const items: PaymentMethodReportItem[] = rows.map((row) => {
    const amountCents = toCents(row.totalAmount);
    const sharePercent = totalAmountCents > 0 ? round2((amountCents / totalAmountCents) * 100) : 0;

    return {
      paymentMethodId: row.paymentMethodId,
      name: row.name,
      type: row.type,
      isActive: row.isActive,
      salesCount: row.salesCount,
      totalAmount: amountCents / 100,
      sharePercent,
    };
  });

  return {
    range,
    summary: {
      totalSalesCount,
      totalAmount: totalAmountCents / 100,
    },
    items,
  };
};

export const getCashiersReport = async (query: DateRangeQuery): Promise<CashiersReportResult> => {
  const { sqlStartDate, sqlEndDate, range } = resolveDateRange(query);
  const rows = await reportsModel.getCashierPerformance({
    startDate: sqlStartDate,
    endDate: sqlEndDate,
  });

  const items: CashierReportItem[] = rows.map((row) => ({
    userId: row.userId,
    fullName: row.fullName,
    username: row.username,
    role: row.role,
    totalSalesCount: row.totalSalesCount,
    completedCount: row.completedCount,
    cancelledCount: row.cancelledCount,
    refundedCount: row.refundedCount,
    totalItemsSold: row.totalItemsSold,
    totalDiscount: round2(row.totalDiscount),
    totalRevenue: round2(row.totalRevenue),
    averageOrderValue: row.completedCount > 0 ? round2(row.totalRevenue / row.completedCount) : 0,
  }));

  return {
    range,
    items,
  };
};

export const getInventoryReport = async (query: InventoryReportQuery): Promise<InventoryReportResult> => {
  const baseFilters = {
    categoryId: query.categoryId,
    isActive: query.isActive,
  };

  const [summary, rawCategories, lowStockItems] = await Promise.all([
    reportsModel.getInventorySummary(baseFilters),
    reportsModel.getInventoryByCategory(baseFilters),
    reportsModel.getLowStockItems({
      categoryId: query.categoryId,
      isActive: query.isActive ?? true,
      lowStockLimit: query.lowStockLimit,
    }),
  ]);

  const potentialProfit = (toCents(summary.totalRetailValue) - toCents(summary.totalCostValue)) / 100;

  const byCategory = rawCategories.map((cat) => ({
    ...cat,
    totalCostValue: round2(cat.totalCostValue),
    totalRetailValue: round2(cat.totalRetailValue),
    potentialProfit: (toCents(cat.totalRetailValue) - toCents(cat.totalCostValue)) / 100,
  }));

  return {
    summary: {
      ...summary,
      totalCostValue: round2(summary.totalCostValue),
      totalRetailValue: round2(summary.totalRetailValue),
      potentialProfit,
    },
    byCategory,
    lowStockItems,
  };
};

export const getPurchasesSummaryReport = async (query: PurchasesSummaryQuery): Promise<PurchasesSummaryReportResult> => {
  const { sqlStartDate, sqlEndDate, range } = resolveDateRange(query);
  const sharedFilters = {
    startDate: sqlStartDate,
    endDate: sqlEndDate,
    supplierId: query.supplierId,
  };

  const [headerTotals, totalItemsPurchased, rawSeries, rawSuppliers] = await Promise.all([
    reportsModel.getPurchasesHeaderTotals(sharedFilters),
    reportsModel.getReceivedPurchaseItemsTotal(sharedFilters),
    reportsModel.getPurchasesSummarySeries({ ...sharedFilters, groupBy: query.groupBy }),
    reportsModel.getPurchasesBySupplier(sharedFilters),
  ]);

  return {
    range,
    groupBy: query.groupBy,
    summary: {
      totalPurchasesCount: headerTotals.totalPurchasesCount,
      receivedCount: headerTotals.receivedCount,
      pendingCount: headerTotals.pendingCount,
      cancelledCount: headerTotals.cancelledCount,
      totalSpent: round2(headerTotals.totalSpent),
      totalItemsPurchased,
    },
    series: rawSeries.map((point) => ({
      ...point,
      totalSpent: round2(point.totalSpent),
    })),
    bySupplier: rawSuppliers.map((sup) => ({
      ...sup,
      totalSpent: round2(sup.totalSpent),
    })),
  };
};

export const reportsService = {
  getDashboardReport,
  getSalesSummaryReport,
  getTopProductsReport,
  getPaymentMethodsReport,
  getCashiersReport,
  getInventoryReport,
  getPurchasesSummaryReport,
};

export default reportsService;
