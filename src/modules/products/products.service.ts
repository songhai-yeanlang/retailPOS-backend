import pool from '../../config/db.config';
import { deleteUploadedFile } from '../../middlewares/upload';
import type { PaginationMeta } from '../../types/api.types';
import type { AuthUser } from '../../types/auth.types';
import ApiError from '../../utils/api-error';
import auditLogsModel from '../audit-logs/audit-logs.model';
import categoriesModel from '../categories/categories.model';
import productsModel from './products.model';
import type { ProductRecord, ProductSortField, UpdateProductFields } from './products.model';

const MAX_TOTAL_STOCK = 2147483647;

export type StockAdjustmentAction = 'add' | 'deduct' | 'set';

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ListProductsQuery {
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

export interface ListLowStockProductsQuery {
  page: number;
  limit: number;
  categoryId?: number;
  search?: string;
}

export interface PaginatedProductsResult {
  items: ProductRecord[];
  pagination: PaginationMeta;
}

export interface CreateProductInput {
  categoryId?: number | string | null;
  barcode?: string | null;
  name: string;
  costPrice: number;
  sellPrice: number;
  stockQty: number;
  alertQty: number;
  unit: string;
  isActive: boolean;
}

export interface UpdateProductInput {
  categoryId?: number | string | null;
  barcode?: string | null;
  name?: string;
  costPrice?: number;
  sellPrice?: number;
  alertQty?: number;
  unit?: string;
  isActive?: boolean;
  removeImage?: boolean;
}

export interface UpdateProductStatusInput {
  isActive: boolean;
}

export interface AdjustProductStockInput {
  action: StockAdjustmentAction;
  qty: number;
  reason?: string | null;
}

const normalizeNullableText = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value.trim() === '') {
    return null;
  }
  return value.trim();
};

const normalizeNullableCategoryId = (value: number | string | null | undefined): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw ApiError.badRequest('Category ID must be a positive integer');
  }
  return parsed;
};

const toAuditSnapshot = (product: ProductRecord): Record<string, unknown> => ({
  categoryId: product.categoryId,
  barcode: product.barcode,
  name: product.name,
  costPrice: product.costPrice,
  sellPrice: product.sellPrice,
  stockQty: product.stockQty,
  alertQty: product.alertQty,
  unit: product.unit,
  image: product.image,
  isActive: product.isActive,
});

const isForeignKeyReferenceError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  return error.code === 'ER_ROW_IS_REFERENCED' || error.code === 'ER_ROW_IS_REFERENCED_2';
};

const assertCanManageProducts = (actor: AuthUser): void => {
  if (actor.role !== 'owner' && actor.role !== 'manager') {
    throw ApiError.forbidden('You do not have permission to manage products');
  }
};

export const listProducts = async (query: ListProductsQuery): Promise<PaginatedProductsResult> => {
  const { items, total } = await productsModel.findProducts({
    page: query.page,
    limit: query.limit,
    categoryId: query.categoryId,
    isActive: query.isActive,
    lowStock: query.lowStock,
    outOfStock: query.outOfStock,
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

export const listLowStockProducts = async (query: ListLowStockProductsQuery): Promise<PaginatedProductsResult> => {
  return listProducts({
    page: query.page,
    limit: query.limit,
    categoryId: query.categoryId,
    isActive: true,
    lowStock: true,
    search: query.search,
    sortBy: 'stockQty',
    sortOrder: 'asc',
  });
};

export const getProductById = async (id: number): Promise<ProductRecord> => {
  const product = await productsModel.findProductById(id);
  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  return product;
};

export const getProductByBarcode = async (barcode: string): Promise<ProductRecord> => {
  const normalizedBarcode = barcode.trim();
  if (!normalizedBarcode) {
    throw ApiError.badRequest('Barcode is required');
  }

  const product = await productsModel.findProductByBarcode(normalizedBarcode);
  if (!product) {
    throw ApiError.notFound('Product not found');
  }

  return product;
};

export const createProduct = async (actor: AuthUser, input: CreateProductInput, uploadedImagePath: string | null, meta: RequestMetadata): Promise<ProductRecord> => {
  assertCanManageProducts(actor);

  const normalizedName = input.name.trim();
  const normalizedBarcode = normalizeNullableText(input.barcode) ?? null;
  const normalizedCategoryId = normalizeNullableCategoryId(input.categoryId) ?? null;
  const normalizedUnit = input.unit.trim() || 'pcs';

  if (!normalizedName) {
    throw ApiError.badRequest('Product name is required');
  }

  if (!Number.isInteger(input.stockQty) || input.stockQty < 0 || input.stockQty > MAX_TOTAL_STOCK) {
    throw ApiError.badRequest('Stock quantity must be a valid non-negative integer');
  }

  if (!Number.isInteger(input.alertQty) || input.alertQty < 0 || input.alertQty > MAX_TOTAL_STOCK) {
    throw ApiError.badRequest('Alert quantity must be a valid non-negative integer');
  }

  if (!Number.isFinite(input.costPrice) || input.costPrice < 0 || !Number.isFinite(input.sellPrice) || input.sellPrice < 0) {
    throw ApiError.badRequest('Cost price and sell price must be non-negative numbers');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (normalizedCategoryId !== null) {
      const category = await categoriesModel.findCategoryById(normalizedCategoryId, connection);
      if (!category) {
        throw ApiError.badRequest('Selected category does not exist');
      }
    }

    if (normalizedBarcode !== null) {
      const duplicateBarcode = await productsModel.findProductByBarcode(normalizedBarcode, undefined, connection);
      if (duplicateBarcode) {
        throw ApiError.conflict('Product barcode already exists');
      }
    }

    const productId = await productsModel.createProduct(
      {
        categoryId: normalizedCategoryId,
        barcode: normalizedBarcode,
        name: normalizedName,
        costPrice: input.costPrice,
        sellPrice: input.sellPrice,
        stockQty: input.stockQty,
        alertQty: input.alertQty,
        unit: normalizedUnit,
        image: uploadedImagePath,
        isActive: input.isActive,
      },
      connection,
    );

    const created = await productsModel.findProductById(productId, connection);
    if (!created) {
      throw ApiError.internal('Failed to retrieve created product');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'CREATE_PRODUCT',
        tableName: 'products',
        recordId: created.id,
        oldValues: null,
        newValues: toAuditSnapshot(created),
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

export const updateProduct = async (actor: AuthUser, id: number, input: UpdateProductInput, uploadedImagePath: string | null, meta: RequestMetadata): Promise<ProductRecord> => {
  assertCanManageProducts(actor);

  const hasBodyFields = Object.values(input).some((value) => value !== undefined);
  if (!hasBodyFields && !uploadedImagePath) {
    throw ApiError.badRequest('At least one product field or image must be provided');
  }

  if (uploadedImagePath && input.removeImage === true) {
    throw ApiError.badRequest('Cannot upload a new image and removeImage at the same time');
  }

  const normalizedName = input.name !== undefined ? input.name.trim() : undefined;
  const normalizedBarcode = normalizeNullableText(input.barcode);
  const normalizedCategoryId = normalizeNullableCategoryId(input.categoryId);
  const normalizedUnit = input.unit !== undefined ? input.unit.trim() : undefined;

  if (normalizedName !== undefined && normalizedName.length === 0) {
    throw ApiError.badRequest('Product name cannot be empty');
  }

  if (normalizedUnit !== undefined && normalizedUnit.length === 0) {
    throw ApiError.badRequest('Unit cannot be empty');
  }

  if (input.alertQty !== undefined && (!Number.isInteger(input.alertQty) || input.alertQty < 0 || input.alertQty > MAX_TOTAL_STOCK)) {
    throw ApiError.badRequest('Alert quantity must be a valid non-negative integer');
  }

  if ((input.costPrice !== undefined && (!Number.isFinite(input.costPrice) || input.costPrice < 0)) || (input.sellPrice !== undefined && (!Number.isFinite(input.sellPrice) || input.sellPrice < 0))) {
    throw ApiError.badRequest('Cost price and sell price must be non-negative numbers');
  }

  let oldImageToDelete: string | null = null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await productsModel.findProductByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Product not found');
    }

    const fieldsToUpdate: UpdateProductFields = {};

    if (normalizedCategoryId !== undefined && normalizedCategoryId !== existing.categoryId) {
      if (normalizedCategoryId !== null) {
        const category = await categoriesModel.findCategoryById(normalizedCategoryId, connection);
        if (!category) {
          throw ApiError.badRequest('Selected category does not exist');
        }
      }
      fieldsToUpdate.categoryId = normalizedCategoryId;
    }

    if (normalizedBarcode !== undefined && normalizedBarcode !== existing.barcode) {
      if (normalizedBarcode !== null) {
        const duplicateBarcode = await productsModel.findProductByBarcode(normalizedBarcode, existing.id, connection);
        if (duplicateBarcode) {
          throw ApiError.conflict('Product barcode already exists');
        }
      }
      fieldsToUpdate.barcode = normalizedBarcode;
    }

    if (normalizedName !== undefined && normalizedName !== existing.name) {
      fieldsToUpdate.name = normalizedName;
    }

    if (input.costPrice !== undefined && input.costPrice !== existing.costPrice) {
      fieldsToUpdate.costPrice = input.costPrice;
    }

    if (input.sellPrice !== undefined && input.sellPrice !== existing.sellPrice) {
      fieldsToUpdate.sellPrice = input.sellPrice;
    }

    if (input.alertQty !== undefined && input.alertQty !== existing.alertQty) {
      fieldsToUpdate.alertQty = input.alertQty;
    }

    if (normalizedUnit !== undefined && normalizedUnit !== existing.unit) {
      fieldsToUpdate.unit = normalizedUnit;
    }

    if (input.isActive !== undefined && input.isActive !== existing.isActive) {
      fieldsToUpdate.isActive = input.isActive;
    }

    if (uploadedImagePath) {
      fieldsToUpdate.image = uploadedImagePath;
      if (existing.image && existing.image !== uploadedImagePath) {
        oldImageToDelete = existing.image;
      }
    } else if (input.removeImage === true && existing.image !== null) {
      fieldsToUpdate.image = null;
      oldImageToDelete = existing.image;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      const current = await productsModel.findProductById(existing.id, connection);
      await connection.commit();
      return current ?? existing;
    }

    await productsModel.updateProductById(existing.id, fieldsToUpdate, connection);

    const updated = await productsModel.findProductById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated product');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'UPDATE_PRODUCT',
        tableName: 'products',
        recordId: updated.id,
        oldValues: toAuditSnapshot(existing),
        newValues: toAuditSnapshot(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();

    if (oldImageToDelete) {
      void deleteUploadedFile(oldImageToDelete);
    }

    return updated;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateProductStatus = async (actor: AuthUser, id: number, input: UpdateProductStatusInput, meta: RequestMetadata): Promise<ProductRecord> => {
  assertCanManageProducts(actor);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await productsModel.findProductByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Product not found');
    }

    if (existing.isActive === input.isActive) {
      const current = await productsModel.findProductById(existing.id, connection);
      await connection.commit();
      return current ?? existing;
    }

    await productsModel.updateProductStatusById(existing.id, input.isActive, connection);

    const updated = await productsModel.findProductById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated product');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'UPDATE_PRODUCT_STATUS',
        tableName: 'products',
        recordId: updated.id,
        oldValues: { isActive: existing.isActive },
        newValues: { isActive: updated.isActive },
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

export const adjustProductStock = async (actor: AuthUser, id: number, input: AdjustProductStockInput, meta: RequestMetadata): Promise<ProductRecord> => {
  assertCanManageProducts(actor);

  if (!Number.isInteger(input.qty) || input.qty < 0 || input.qty > MAX_TOTAL_STOCK) {
    throw ApiError.badRequest('Quantity must be a valid non-negative integer');
  }

  if ((input.action === 'add' || input.action === 'deduct') && input.qty < 1) {
    throw ApiError.badRequest('Quantity must be at least 1 for add or deduct actions');
  }

  const normalizedReason = normalizeNullableText(input.reason) ?? null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await productsModel.findProductByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Product not found');
    }

    let nextStockQty: number;
    if (input.action === 'add') {
      nextStockQty = existing.stockQty + input.qty;
      if (nextStockQty > MAX_TOTAL_STOCK) {
        throw ApiError.badRequest('Product stock quantity exceeds the maximum allowed limit');
      }
    } else if (input.action === 'deduct') {
      if (input.qty > existing.stockQty) {
        throw ApiError.badRequest('Insufficient product stock quantity');
      }
      nextStockQty = existing.stockQty - input.qty;
    } else {
      nextStockQty = input.qty;
    }

    if (nextStockQty === existing.stockQty) {
      const current = await productsModel.findProductById(existing.id, connection);
      await connection.commit();
      return current ?? existing;
    }

    await productsModel.updateProductStockById(existing.id, nextStockQty, connection);

    const updated = await productsModel.findProductById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated product');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'ADJUST_PRODUCT_STOCK',
        tableName: 'products',
        recordId: updated.id,
        oldValues: { stockQty: existing.stockQty },
        newValues: {
          stockQty: updated.stockQty,
          action: input.action,
          qty: input.qty,
          reason: normalizedReason,
        },
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

export const deleteProduct = async (actor: AuthUser, id: number, meta: RequestMetadata): Promise<void> => {
  if (actor.role !== 'owner') {
    throw ApiError.forbidden('Only owners can delete products');
  }

  let imageToDelete: string | null = null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await productsModel.findProductByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Product not found');
    }

    try {
      await productsModel.deleteProductById(existing.id, connection);
    } catch (error: unknown) {
      if (isForeignKeyReferenceError(error)) {
        throw ApiError.conflict(
          'Cannot delete product because it is referenced by existing sales or purchases. Deactivate it instead.',
        );
      }
      throw error;
    }

    imageToDelete = existing.image;

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'DELETE_PRODUCT',
        tableName: 'products',
        recordId: existing.id,
        oldValues: toAuditSnapshot(existing),
        newValues: null,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();

    if (imageToDelete) {
      void deleteUploadedFile(imageToDelete);
    }
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const productsService = {
  listProducts,
  listLowStockProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  updateProductStatus,
  adjustProductStock,
  deleteProduct,
};

export default productsService;
