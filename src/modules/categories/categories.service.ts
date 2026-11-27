import pool from '../../config/db.config';
import type { PaginationMeta } from '../../types/api.types';
import type { AuthUser } from '../../types/auth.types';
import ApiError from '../../utils/api-error';
import auditLogsModel from '../audit-logs/audit-logs.model';
import categoriesModel from './categories.model';
import type { CategoryRecord, CategorySortField, UpdateCategoryFields } from './categories.model';

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ListCategoriesQuery {
  page: number;
  limit: number;
  search?: string;
  sortBy: CategorySortField;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedCategoriesResult {
  items: CategoryRecord[];
  pagination: PaginationMeta;
}

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
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

const toAuditSnapshot = (category: CategoryRecord): Record<string, unknown> => ({
  name: category.name,
  description: category.description,
});

const assertCanManageCategories = (actor: AuthUser): void => {
  if (actor.role !== 'owner' && actor.role !== 'manager') {
    throw ApiError.forbidden('You do not have permission to manage categories');
  }
};

export const listCategories = async (query: ListCategoriesQuery): Promise<PaginatedCategoriesResult> => {
  const { items, total } = await categoriesModel.findCategories({
    page: query.page,
    limit: query.limit,
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

export const getCategoryById = async (id: number): Promise<CategoryRecord> => {
  const category = await categoriesModel.findCategoryById(id);
  if (!category) {
    throw ApiError.notFound('Category not found');
  }

  return category;
};

export const createCategory = async (actor: AuthUser, input: CreateCategoryInput, meta: RequestMetadata): Promise<CategoryRecord> => {
  assertCanManageCategories(actor);

  const normalizedName = input.name.trim();
  const normalizedDescription = normalizeNullableText(input.description) ?? null;

  if (!normalizedName) {
    throw ApiError.badRequest('Category name is required');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const duplicate = await categoriesModel.findCategoryByName(normalizedName, undefined, connection);
    if (duplicate) {
      throw ApiError.conflict('Category name already exists');
    }

    const categoryId = await categoriesModel.createCategory(
      {
        name: normalizedName,
        description: normalizedDescription,
      },
      connection,
    );

    const created = await categoriesModel.findCategoryById(categoryId, connection);
    if (!created) {
      throw ApiError.internal('Failed to retrieve created category');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'CREATE_CATEGORY',
        tableName: 'categories',
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

export const updateCategory = async (actor: AuthUser, id: number, input: UpdateCategoryInput, meta: RequestMetadata): Promise<CategoryRecord> => {
  assertCanManageCategories(actor);

  const normalizedName = input.name !== undefined ? input.name.trim() : undefined;
  const normalizedDescription = normalizeNullableText(input.description);

  if (normalizedName !== undefined && normalizedName.length === 0) {
    throw ApiError.badRequest('Category name cannot be empty');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await categoriesModel.findCategoryByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Category not found');
    }

    const fieldsToUpdate: UpdateCategoryFields = {};

    if (normalizedName !== undefined && normalizedName !== existing.name) {
      const duplicate = await categoriesModel.findCategoryByName(normalizedName, existing.id, connection);
      if (duplicate) {
        throw ApiError.conflict('Category name already exists');
      }
      fieldsToUpdate.name = normalizedName;
    }

    if (normalizedDescription !== undefined && normalizedDescription !== existing.description) {
      fieldsToUpdate.description = normalizedDescription;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      const current = await categoriesModel.findCategoryById(existing.id, connection);
      await connection.commit();
      return current ?? existing;
    }

    await categoriesModel.updateCategoryById(existing.id, fieldsToUpdate, connection);

    const updated = await categoriesModel.findCategoryById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated category');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'UPDATE_CATEGORY',
        tableName: 'categories',
        recordId: updated.id,
        oldValues: toAuditSnapshot(existing),
        newValues: toAuditSnapshot(updated),
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

export const deleteCategory = async (actor: AuthUser, id: number, meta: RequestMetadata): Promise<void> => {
  assertCanManageCategories(actor);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await categoriesModel.findCategoryByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Category not found');
    }

    await categoriesModel.deleteCategoryById(existing.id, connection);

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'DELETE_CATEGORY',
        tableName: 'categories',
        recordId: existing.id,
        oldValues: toAuditSnapshot(existing),
        newValues: null,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const categoriesService = {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};

export default categoriesService;
