import crypto from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import pool from '../../config/db.config';
import type { PaginationMeta } from '../../types/api.types';
import type { AuthUser } from '../../types/auth.types';
import ApiError from '../../utils/api-error';
import auditLogsModel from '../audit-logs/audit-logs.model';
import productsModel from '../products/products.model';
import suppliersModel from '../suppliers/suppliers.model';
import purchasesModel from './purchases.model';
import type {
  CreatePurchaseItemFields,
  PurchaseDetailRecord,
  PurchaseRecord,
  PurchaseSortField,
  PurchaseStatus,
} from './purchases.model';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_MONEY_CENTS = 999999999999;
const MAX_TOTAL_STOCK = 2147483647;

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ListPurchasesQuery {
  page: number;
  limit: number;
  supplierId?: number;
  userId?: number;
  status?: PurchaseStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy: PurchaseSortField;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedPurchasesResult {
  items: PurchaseRecord[];
  pagination: PaginationMeta;
}

export interface CreatePurchaseItemInput {
  productId: number;
  qty: number;
  costPrice: number;
}

export interface CreatePurchaseInput {
  referenceNo?: string | null;
  supplierId?: number | string | null;
  status: 'received' | 'pending';
  note?: string | null;
  purchaseDate?: string;
  items: CreatePurchaseItemInput[];
}

export interface UpdatePurchaseStatusInput {
  status: 'received' | 'cancelled';
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

const parsePurchaseDate = (rawDate: string | undefined): Date | string => {
  if (!rawDate) {
    return new Date();
  }
  if (DATE_ONLY_REGEX.test(rawDate)) {
    return `${rawDate} 00:00:00`;
  }
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    throw ApiError.badRequest('Invalid purchaseDate value');
  }
  return parsed;
};

const generateReferenceNo = async (connection: PoolConnection): Promise<string> => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yyyy}${mm}${dd}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    const candidate = `PO-${datePart}-${randomPart}`;
    const existing = await purchasesModel.findPurchaseByReferenceNo(candidate, connection);
    if (!existing) {
      return candidate;
    }
  }

  throw ApiError.internal('Failed to generate unique purchase reference number');
};

const assertCanManagePurchases = (actor: AuthUser): void => {
  if (actor.role !== 'owner' && actor.role !== 'manager') {
    throw ApiError.forbidden('You do not have permission to manage purchases');
  }
};

const getPurchaseDetailWithConnection = async (id: number, connection: PoolConnection | null = null): Promise<PurchaseDetailRecord | null> => {
  const purchase = await purchasesModel.findPurchaseById(id, connection);
  if (!purchase) {
    return null;
  }

  const items = await purchasesModel.findPurchaseItemsByPurchaseId(id, connection);
  return {
    ...purchase,
    items,
  };
};

export const listPurchases = async (query: ListPurchasesQuery): Promise<PaginatedPurchasesResult> => {
  const startBoundary = query.startDate ? parseDateBoundary(query.startDate, 'start') : undefined;
  const endBoundary = query.endDate ? parseDateBoundary(query.endDate, 'end') : undefined;

  if (startBoundary && endBoundary && startBoundary.timestampMs > endBoundary.timestampMs) {
    throw ApiError.badRequest('endDate must be greater than or equal to startDate');
  }

  const { items, total } = await purchasesModel.findPurchases({
    page: query.page,
    limit: query.limit,
    supplierId: query.supplierId,
    userId: query.userId,
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

export const getPurchaseById = async (id: number): Promise<PurchaseDetailRecord> => {
  const detail = await getPurchaseDetailWithConnection(id);
  if (!detail) {
    throw ApiError.notFound('Purchase not found');
  }

  return detail;
};

export const createPurchase = async (actor: AuthUser, input: CreatePurchaseInput, meta: RequestMetadata): Promise<PurchaseDetailRecord> => {
  assertCanManagePurchases(actor);

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw ApiError.badRequest('At least one purchase item is required');
  }

  if (input.status !== 'received' && input.status !== 'pending') {
    throw ApiError.badRequest('Initial purchase status must be received or pending');
  }

  const normalizedRef = normalizeNullableText(input.referenceNo) ?? null;
  const normalizedSupplierId = normalizeNullableId(input.supplierId, 'Supplier ID');
  const normalizedNote = normalizeNullableText(input.note) ?? null;
  const purchaseDate = parsePurchaseDate(input.purchaseDate);

  const preparedItems: CreatePurchaseItemFields[] = [];
  const qtyAndCostByProduct = new Map<number, { totalQty: number; latestCostPrice: number }>();
  let totalAmountCents = 0;

  for (const item of input.items) {
    if (!Number.isInteger(item.productId) || item.productId <= 0) {
      throw ApiError.badRequest('Product ID must be a positive integer');
    }
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      throw ApiError.badRequest('Item quantity must be at least 1');
    }
    if (!Number.isFinite(item.costPrice) || item.costPrice < 0) {
      throw ApiError.badRequest('Item cost price must be a non-negative number');
    }

    const costPriceCents = toCents(item.costPrice);
    const subtotalCents = item.qty * costPriceCents;
    if (!Number.isSafeInteger(subtotalCents) || subtotalCents > MAX_MONEY_CENTS) {
      throw ApiError.badRequest('Purchase line subtotal exceeds the maximum allowed amount');
    }

    totalAmountCents += subtotalCents;
    if (!Number.isSafeInteger(totalAmountCents) || totalAmountCents > MAX_MONEY_CENTS) {
      throw ApiError.badRequest('Purchase total amount exceeds the maximum allowed amount');
    }

    const roundedCostPrice = costPriceCents / 100;
    const subtotal = subtotalCents / 100;

    preparedItems.push({
      productId: item.productId,
      qty: item.qty,
      costPrice: roundedCostPrice,
      subtotal,
    });

    const prev = qtyAndCostByProduct.get(item.productId);
    qtyAndCostByProduct.set(item.productId, {
      totalQty: (prev?.totalQty ?? 0) + item.qty,
      latestCostPrice: roundedCostPrice,
    });
  }

  const totalAmount = totalAmountCents / 100;

  const sortedProductIds = [...qtyAndCostByProduct.keys()].sort((a, b) => a - b);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (normalizedSupplierId !== null) {
      const supplier = await suppliersModel.findSupplierById(normalizedSupplierId, connection);
      if (!supplier) {
        throw ApiError.badRequest('Selected supplier does not exist');
      }
    }

    let referenceNo: string;
    if (normalizedRef !== null) {
      const duplicateRef = await purchasesModel.findPurchaseByReferenceNo(normalizedRef, connection);
      if (duplicateRef) {
        throw ApiError.conflict('Purchase reference number already exists');
      }
      referenceNo = normalizedRef;
    } else {
      referenceNo = await generateReferenceNo(connection);
    }

    // Lock products in canonical ID order to prevent deadlocks and validate existence/overflow
    const lockedProducts = new Map<number, { stockQty: number; name: string }>();
    for (const productId of sortedProductIds) {
      const product = await productsModel.findProductByIdForUpdate(productId, connection);
      if (!product) {
        throw ApiError.badRequest(`Product with ID ${productId} does not exist`);
      }

      if (input.status === 'received') {
        const delta = qtyAndCostByProduct.get(productId)!;
        if (product.stockQty + delta.totalQty > MAX_TOTAL_STOCK) {
          throw ApiError.badRequest(`Stock quantity for product "${product.name}" exceeds the maximum allowed limit`);
        }
      }

      lockedProducts.set(productId, { stockQty: product.stockQty, name: product.name });
    }

    const purchaseId = await purchasesModel.createPurchase(
      {
        referenceNo,
        supplierId: normalizedSupplierId,
        userId: actor.id,
        totalAmount,
        status: input.status,
        note: normalizedNote,
        purchaseDate,
      },
      connection,
    );

    await purchasesModel.createPurchaseItems(purchaseId, preparedItems, connection);

    if (input.status === 'received') {
      for (const productId of sortedProductIds) {
        const locked = lockedProducts.get(productId)!;
        const delta = qtyAndCostByProduct.get(productId)!;
        await productsModel.updateProductStockAndCostById(
          productId,
          locked.stockQty + delta.totalQty,
          delta.latestCostPrice,
          connection,
        );
      }
    }

    const created = await getPurchaseDetailWithConnection(purchaseId, connection);
    if (!created) {
      throw ApiError.internal('Failed to retrieve created purchase');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'CREATE_PURCHASE',
        tableName: 'purchases',
        recordId: created.id,
        oldValues: null,
        newValues: {
          referenceNo: created.referenceNo,
          supplierId: created.supplierId,
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

export const updatePurchaseStatus = async (actor: AuthUser, id: number, input: UpdatePurchaseStatusInput, meta: RequestMetadata): Promise<PurchaseDetailRecord> => {
  assertCanManagePurchases(actor);

  if (input.status !== 'received' && input.status !== 'cancelled') {
    throw ApiError.badRequest('Target status must be received or cancelled');
  }

  const normalizedReason = normalizeNullableText(input.reason) ?? null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await purchasesModel.findPurchaseByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Purchase not found');
    }

    if (existing.status === input.status) {
      const current = await getPurchaseDetailWithConnection(existing.id, connection);
      await connection.commit();
      if (!current) {
        throw ApiError.internal('Failed to retrieve purchase');
      }
      return current;
    }

    if (existing.status === 'cancelled') {
      throw ApiError.badRequest('Cannot change status of a cancelled purchase');
    }

    const items = await purchasesModel.findPurchaseItemsByPurchaseId(existing.id, connection);

    if (existing.status === 'pending' && input.status === 'received') {
      const qtyAndCostByProduct = new Map<number, { totalQty: number; latestCostPrice: number }>();
      for (const item of items) {
        const prev = qtyAndCostByProduct.get(item.productId);
        qtyAndCostByProduct.set(item.productId, {
          totalQty: (prev?.totalQty ?? 0) + item.qty,
          latestCostPrice: item.costPrice,
        });
      }

      const sortedProductIds = [...qtyAndCostByProduct.keys()].sort((a, b) => a - b);
      const lockedProducts = new Map<number, { stockQty: number; name: string }>();

      for (const productId of sortedProductIds) {
        const product = await productsModel.findProductByIdForUpdate(productId, connection);
        if (!product) {
          throw ApiError.badRequest(`Product with ID ${productId} no longer exists`);
        }

        const delta = qtyAndCostByProduct.get(productId)!;
        if (product.stockQty + delta.totalQty > MAX_TOTAL_STOCK) {
          throw ApiError.badRequest(`Stock quantity for product "${product.name}" exceeds the maximum allowed limit`);
        }

        lockedProducts.set(productId, { stockQty: product.stockQty, name: product.name });
      }

      for (const productId of sortedProductIds) {
        const locked = lockedProducts.get(productId)!;
        const delta = qtyAndCostByProduct.get(productId)!;
        await productsModel.updateProductStockAndCostById(
          productId,
          locked.stockQty + delta.totalQty,
          delta.latestCostPrice,
          connection,
        );
      }
    } else if (existing.status === 'received' && input.status === 'cancelled') {
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

        const qtyToDeduct = qtyByProduct.get(productId)!;
        if (product.stockQty < qtyToDeduct) {
          throw ApiError.badRequest(
            `Insufficient stock for product "${product.name}" to cancel this purchase (available: ${product.stockQty}, required: ${qtyToDeduct})`,
          );
        }

        lockedProducts.set(productId, { stockQty: product.stockQty, name: product.name });
      }

      for (const productId of sortedProductIds) {
        const locked = lockedProducts.get(productId)!;
        const qtyToDeduct = qtyByProduct.get(productId)!;
        await productsModel.updateProductStockById(
          productId,
          locked.stockQty - qtyToDeduct,
          connection,
        );
      }
    }

    await purchasesModel.updatePurchaseStatusById(existing.id, input.status, connection);

    const updated = await getPurchaseDetailWithConnection(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated purchase');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'UPDATE_PURCHASE_STATUS',
        tableName: 'purchases',
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

export const purchasesService = {
  listPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchaseStatus,
};

export default purchasesService;
