import crypto from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import pool from '../../config/db.config';
import type { PaginationMeta } from '../../types/api.types';
import type { AuthUser } from '../../types/auth.types';
import ApiError from '../../utils/api-error';
import auditLogsModel from '../audit-logs/audit-logs.model';
import customersModel from '../customers/customers.model';
import paymentsModel from '../payments/payments.model';
import productsModel from '../products/products.model';
import settingsModel from '../settings/settings.model';
import salesModel from './sales.model';
import type {
  CreateSaleItemFields,
  SaleDetailRecord,
  SaleRecord,
  SaleSortField,
  SaleStatus,
} from './sales.model';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const DEFAULT_EXCHANGE_RATE = 4100;
const MAX_MONEY_CENTS = 999999999999;
const MAX_TOTAL_STOCK = 2147483647;
const MAX_TOTAL_POINTS = 2147483647;

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ListSalesQuery {
  page: number;
  limit: number;
  userId?: number;
  customerId?: number;
  paymentMethodId?: number;
  status?: SaleStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy: SaleSortField;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedSalesResult {
  items: SaleRecord[];
  pagination: PaginationMeta;
}

export interface CreateSaleItemInput {
  productId: number;
  qty: number;
}

export interface CreateSaleInput {
  customerId?: number | string | null;
  paymentMethodId: number;
  paymentRef?: string | null;
  discount: number;
  tax: number;
  paidAmount: number;
  note?: string | null;
  items: CreateSaleItemInput[];
}

export interface UpdateSaleStatusInput {
  status: 'cancelled' | 'refunded';
  reason?: string | null;
}

interface ParsedDateBoundary {
  sqlValue: Date | string;
  timestampMs: number;
}

const toCents = (amount: number): number => {
  return Math.round((amount + Number.EPSILON) * 100);
};

const normalizeNullableText = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value.trim() === '') {
    return null;
  }
  return value.trim();
};

const normalizeNullableId = (value: number | string | null | undefined, label: string): number | null => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw ApiError.badRequest(`${label} must be a positive integer`);
  }
  return parsed;
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

const generateInvoiceNo = async (connection: PoolConnection): Promise<string> => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    const candidate = `INV-${datePart}-${randomPart}`;
    const exists = await salesModel.existsSaleByInvoiceNo(candidate, connection);
    if (!exists) {
      return candidate;
    }
  }

  throw ApiError.internal('Failed to generate unique invoice number');
};

const getSaleDetailWithConnection = async (id: number, connection: PoolConnection | null = null): Promise<SaleDetailRecord | null> => {
  const sale = await salesModel.findSaleById(id, connection);
  if (!sale) {
    return null;
  }

  const items = await salesModel.findSaleItemsBySaleId(id, connection);
  return {
    ...sale,
    items,
  };
};

export const listSales = async (query: ListSalesQuery): Promise<PaginatedSalesResult> => {
  const startBoundary = query.startDate ? parseDateBoundary(query.startDate, 'start') : undefined;
  const endBoundary = query.endDate ? parseDateBoundary(query.endDate, 'end') : undefined;

  if (startBoundary && endBoundary && startBoundary.timestampMs > endBoundary.timestampMs) {
    throw ApiError.badRequest('endDate must be greater than or equal to startDate');
  }

  const { items, total } = await salesModel.findSales({
    page: query.page,
    limit: query.limit,
    userId: query.userId,
    customerId: query.customerId,
    paymentMethodId: query.paymentMethodId,
    status: query.status,
    startDate: startBoundary?.sqlValue,
    endDate: endBoundary?.sqlValue,
    search: query.search,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  });

  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
    },
  };
};

export const getSaleById = async (id: number): Promise<SaleDetailRecord> => {
  const detail = await getSaleDetailWithConnection(id);
  if (!detail) {
    throw ApiError.notFound('Sale not found');
  }

  return detail;
};

export const getSaleByInvoiceNo = async (invoiceNo: string): Promise<SaleDetailRecord> => {
  const normalizedInvoiceNo = invoiceNo.trim();
  if (!normalizedInvoiceNo) {
    throw ApiError.badRequest('Invoice number is required');
  }

  const sale = await salesModel.findSaleByInvoiceNo(normalizedInvoiceNo);
  if (!sale) {
    throw ApiError.notFound('Sale not found');
  }

  const items = await salesModel.findSaleItemsBySaleId(sale.id);
  return {
    ...sale,
    items,
  };
};

export const createSale = async (actor: AuthUser, input: CreateSaleInput, meta: RequestMetadata): Promise<SaleDetailRecord> => {
  if (!Number.isInteger(input.paymentMethodId) || input.paymentMethodId <= 0) {
    throw ApiError.badRequest('Payment method ID must be a positive integer');
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw ApiError.badRequest('At least one sale item is required');
  }

  if (!Number.isFinite(input.discount) || input.discount < 0) {
    throw ApiError.badRequest('Discount must be a non-negative number');
  }

  if (!Number.isFinite(input.tax) || input.tax < 0) {
    throw ApiError.badRequest('Tax must be a non-negative number');
  }

  if (!Number.isFinite(input.paidAmount) || input.paidAmount < 0) {
    throw ApiError.badRequest('Paid amount must be a non-negative number');
  }

  const normalizedCustomerId = normalizeNullableId(input.customerId, 'Customer ID');
  const normalizedPaymentRef = normalizeNullableText(input.paymentRef) ?? null;
  const normalizedNote = normalizeNullableText(input.note) ?? null;

  const qtyByProduct = new Map<number, number>();
  for (const item of input.items) {
    if (!Number.isInteger(item.productId) || item.productId <= 0) {
      throw ApiError.badRequest('Product ID must be a positive integer');
    }
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      throw ApiError.badRequest('Item quantity must be at least 1');
    }
    qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.qty);
  }

  const sortedProductIds = [...qtyByProduct.keys()].sort((a, b) => a - b);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const paymentMethod = await paymentsModel.findPaymentMethodBasicById(input.paymentMethodId, connection);
    if (!paymentMethod) {
      throw ApiError.badRequest('Selected payment method does not exist');
    }
    if (!paymentMethod.isActive) {
      throw ApiError.badRequest(`Payment method "${paymentMethod.name}" is inactive`);
    }

    // Lock products in ascending ID order to prevent deadlocks
    const lockedProducts = new Map<number, { name: string; costPrice: number; sellPrice: number; stockQty: number }>();
    for (const productId of sortedProductIds) {
      const product = await productsModel.findProductByIdForUpdate(productId, connection);
      if (!product) {
        throw ApiError.badRequest(`Product with ID ${productId} does not exist`);
      }
      if (!product.isActive) {
        throw ApiError.badRequest(`Product "${product.name}" is inactive and cannot be sold`);
      }

      const requestedQty = qtyByProduct.get(productId)!;
      if (product.stockQty < requestedQty) {
        throw ApiError.badRequest(
          `Insufficient stock for product "${product.name}" (available: ${product.stockQty}, requested: ${requestedQty})`,
        );
      }

      lockedProducts.set(productId, {
        name: product.name,
        costPrice: product.costPrice,
        sellPrice: product.sellPrice,
        stockQty: product.stockQty,
      });
    }

    let lockedCustomer: { id: number; points: number } | null = null;
    if (normalizedCustomerId !== null) {
      const customer = await customersModel.findCustomerByIdForUpdate(normalizedCustomerId, connection);
      if (!customer) {
        throw ApiError.badRequest('Selected customer does not exist');
      }
      lockedCustomer = { id: customer.id, points: customer.points };
    }

    const preparedItems: CreateSaleItemFields[] = [];
    let subtotalCents = 0;

    for (const item of input.items) {
      const locked = lockedProducts.get(item.productId)!;
      const costPriceCents = toCents(locked.costPrice);
      const unitPriceCents = toCents(locked.sellPrice);
      const lineSubtotalCents = item.qty * unitPriceCents;

      if (!Number.isSafeInteger(lineSubtotalCents) || lineSubtotalCents > MAX_MONEY_CENTS) {
        throw ApiError.badRequest('Sale line subtotal exceeds the maximum allowed amount');
      }

      subtotalCents += lineSubtotalCents;
      if (!Number.isSafeInteger(subtotalCents) || subtotalCents > MAX_MONEY_CENTS) {
        throw ApiError.badRequest('Sale subtotal exceeds the maximum allowed amount');
      }

      preparedItems.push({
        productId: item.productId,
        qty: item.qty,
        costPrice: costPriceCents / 100,
        unitPrice: unitPriceCents / 100,
        subtotal: lineSubtotalCents / 100,
      });
    }

    const discountCents = toCents(input.discount);
    if (discountCents > subtotalCents) {
      throw ApiError.badRequest('Discount cannot exceed subtotal');
    }

    const taxCents = toCents(input.tax);
    const totalAmountCents = subtotalCents - discountCents + taxCents;
    if (!Number.isSafeInteger(totalAmountCents) || totalAmountCents > MAX_MONEY_CENTS) {
      throw ApiError.badRequest('Sale total amount exceeds the maximum allowed amount');
    }

    const paidAmountCents = toCents(input.paidAmount);
    if (!Number.isSafeInteger(paidAmountCents) || paidAmountCents > MAX_MONEY_CENTS) {
      throw ApiError.badRequest('Paid amount exceeds the maximum allowed amount');
    }
    if (paidAmountCents < totalAmountCents) {
      throw ApiError.badRequest('Paid amount is less than total amount');
    }

    const changeAmountCents = paidAmountCents - totalAmountCents;
    const subtotal = subtotalCents / 100;
    const discount = discountCents / 100;
    const tax = taxCents / 100;
    const totalAmount = totalAmountCents / 100;
    const paidAmount = paidAmountCents / 100;
    const changeAmount = changeAmountCents / 100;

    const settings = await settingsModel.findSettings(connection);
    const exchangeRate = settings?.exchangeRate ?? DEFAULT_EXCHANGE_RATE;
    const invoiceNo = await generateInvoiceNo(connection);

    const saleId = await salesModel.createSale(
      {
        invoiceNo,
        userId: actor.id,
        customerId: normalizedCustomerId,
        paymentMethodId: paymentMethod.id,
        paymentRef: normalizedPaymentRef,
        subtotal,
        discount,
        tax,
        totalAmount,
        paidAmount,
        changeAmount,
        exchangeRate,
        status: 'completed',
        note: normalizedNote,
      },
      connection,
    );

    await salesModel.createSaleItems(saleId, preparedItems, connection);

    for (const productId of sortedProductIds) {
      const locked = lockedProducts.get(productId)!;
      const soldQty = qtyByProduct.get(productId)!;
      await productsModel.updateProductStockById(productId, locked.stockQty - soldQty, connection);
    }

    const earnedPoints = Math.floor(totalAmountCents / 100);
    if (lockedCustomer && earnedPoints > 0) {
      const nextPoints = Math.min(MAX_TOTAL_POINTS, lockedCustomer.points + earnedPoints);
      if (nextPoints !== lockedCustomer.points) {
        await customersModel.updateCustomerPointsById(lockedCustomer.id, nextPoints, connection);
      }
    }

    const created = await getSaleDetailWithConnection(saleId, connection);
    if (!created) {
      throw ApiError.internal('Failed to retrieve created sale');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'CREATE_SALE',
        tableName: 'sales',
        recordId: created.id,
        oldValues: null,
        newValues: {
          invoiceNo: created.invoiceNo,
          customerId: created.customerId,
          paymentMethodId: created.paymentMethodId,
          totalAmount: created.totalAmount,
          status: created.status,
          itemCount: created.itemCount,
          totalQty: created.totalQty,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();
    return created;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateSaleStatus = async (actor: AuthUser, id: number, input: UpdateSaleStatusInput, meta: RequestMetadata): Promise<SaleDetailRecord> => {
  if (actor.role !== 'owner' && actor.role !== 'manager') {
    throw ApiError.forbidden('Only owners and managers can cancel or refund sales');
  }

  if (input.status !== 'cancelled' && input.status !== 'refunded') {
    throw ApiError.badRequest('Target status must be cancelled or refunded');
  }

  const normalizedReason = normalizeNullableText(input.reason) ?? null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await salesModel.findSaleByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Sale not found');
    }

    if (existing.status === input.status) {
      const current = await getSaleDetailWithConnection(existing.id, connection);
      if (!current) {
        throw ApiError.internal('Failed to retrieve sale');
      }
      await connection.commit();
      return current;
    }

    if (existing.status !== 'completed') {
      throw ApiError.badRequest(`Cannot change status of a ${existing.status} sale`);
    }

    const items = await salesModel.findSaleItemsBySaleId(existing.id, connection);
    const qtyByProduct = new Map<number, number>();
    for (const item of items) {
      qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.qty);
    }

    const sortedProductIds = [...qtyByProduct.keys()].sort((a, b) => a - b);
    const lockedProducts = new Map<number, { stockQty: number; name: string }>();

    for (const productId of sortedProductIds) {
      const product = await productsModel.findProductByIdForUpdate(productId, connection);
      if (!product) {
        throw ApiError.badRequest(`Product with ID ${productId} no longer exists`);
      }

      const qtyToRestore = qtyByProduct.get(productId)!;
      if (product.stockQty + qtyToRestore > MAX_TOTAL_STOCK) {
        throw ApiError.badRequest(`Stock quantity for product "${product.name}" exceeds the maximum allowed limit`);
      }

      lockedProducts.set(productId, { stockQty: product.stockQty, name: product.name });
    }

    for (const productId of sortedProductIds) {
      const locked = lockedProducts.get(productId)!;
      const qtyToRestore = qtyByProduct.get(productId)!;
      await productsModel.updateProductStockById(productId, locked.stockQty + qtyToRestore, connection);
    }

    if (existing.customerId !== null) {
      const customer = await customersModel.findCustomerByIdForUpdate(existing.customerId, connection);
      const pointsToReverse = Math.floor(toCents(existing.totalAmount) / 100);
      if (customer && pointsToReverse > 0 && customer.points > 0) {
        const nextPoints = Math.max(0, customer.points - pointsToReverse);
        await customersModel.updateCustomerPointsById(customer.id, nextPoints, connection);
      }
    }

    await salesModel.updateSaleStatusById(existing.id, input.status, connection);

    const updated = await getSaleDetailWithConnection(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated sale');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: input.status === 'refunded' ? 'REFUND_SALE' : 'CANCEL_SALE',
        tableName: 'sales',
        recordId: updated.id,
        oldValues: { status: existing.status },
        newValues: { status: updated.status, reason: normalizedReason },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();
    return updated;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const salesService = {
  listSales,
  getSaleById,
  getSaleByInvoiceNo,
  createSale,
  updateSaleStatus,
};

export default salesService;
