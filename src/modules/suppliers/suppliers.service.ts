import pool from '../../config/db.config';
import type { PaginationMeta } from '../../types/api.types';
import type { AuthUser } from '../../types/auth.types';
import ApiError from '../../utils/api-error';
import auditLogsModel from '../audit-logs/audit-logs.model';
import suppliersModel from './suppliers.model';
import type { SupplierRecord, SupplierSortField, UpdateSupplierFields } from './suppliers.model';

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ListSuppliersQuery {
  page: number;
  limit: number;
  search?: string;
  sortBy: SupplierSortField;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedSuppliersResult {
  items: SupplierRecord[];
  pagination: PaginationMeta;
}

export interface CreateSupplierInput {
  name: string;
  phone?: string | null;
  address?: string | null;
}

export interface UpdateSupplierInput {
  name?: string;
  phone?: string | null;
  address?: string | null;
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

const toAuditSnapshot = (supplier: SupplierRecord): Record<string, unknown> => ({
  name: supplier.name,
  phone: supplier.phone,
  address: supplier.address,
});

const assertCanManageSuppliers = (actor: AuthUser): void => {
  if (actor.role !== 'owner' && actor.role !== 'manager') {
    throw ApiError.forbidden('You do not have permission to manage suppliers');
  }
};

export const listSuppliers = async (query: ListSuppliersQuery): Promise<PaginatedSuppliersResult> => {
  const { items, total } = await suppliersModel.findSuppliers({
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

export const getSupplierById = async (id: number): Promise<SupplierRecord> => {
  const supplier = await suppliersModel.findSupplierById(id);
  if (!supplier) {
    throw ApiError.notFound('Supplier not found');
  }

  return supplier;
};

export const createSupplier = async (actor: AuthUser, input: CreateSupplierInput, meta: RequestMetadata): Promise<SupplierRecord> => {
  assertCanManageSuppliers(actor);

  const normalizedName = input.name.trim();
  const normalizedPhone = normalizeNullableText(input.phone) ?? null;
  const normalizedAddress = normalizeNullableText(input.address) ?? null;

  if (!normalizedName) {
    throw ApiError.badRequest('Supplier name is required');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const duplicate = await suppliersModel.findSupplierByName(normalizedName, undefined, connection);
    if (duplicate) {
      throw ApiError.conflict('Supplier name already exists');
    }

    const supplierId = await suppliersModel.createSupplier(
      {
        name: normalizedName,
        phone: normalizedPhone,
        address: normalizedAddress,
      },
      connection,
    );

    const created = await suppliersModel.findSupplierById(supplierId, connection);
    if (!created) {
      throw ApiError.internal('Failed to retrieve created supplier');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'CREATE_SUPPLIER',
        tableName: 'suppliers',
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

export const updateSupplier = async (actor: AuthUser, id: number, input: UpdateSupplierInput, meta: RequestMetadata): Promise<SupplierRecord> => {
  assertCanManageSuppliers(actor);

  const normalizedName = input.name !== undefined ? input.name.trim() : undefined;
  const normalizedPhone = normalizeNullableText(input.phone);
  const normalizedAddress = normalizeNullableText(input.address);

  if (normalizedName !== undefined && normalizedName.length === 0) {
    throw ApiError.badRequest('Supplier name cannot be empty');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await suppliersModel.findSupplierByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Supplier not found');
    }

    const fieldsToUpdate: UpdateSupplierFields = {};

    if (normalizedName !== undefined && normalizedName !== existing.name) {
      const duplicate = await suppliersModel.findSupplierByName(normalizedName, existing.id, connection);
      if (duplicate) {
        throw ApiError.conflict('Supplier name already exists');
      }
      fieldsToUpdate.name = normalizedName;
    }

    if (normalizedPhone !== undefined && normalizedPhone !== existing.phone) {
      fieldsToUpdate.phone = normalizedPhone;
    }

    if (normalizedAddress !== undefined && normalizedAddress !== existing.address) {
      fieldsToUpdate.address = normalizedAddress;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      const current = await suppliersModel.findSupplierById(existing.id, connection);
      await connection.commit();
      return current ?? existing;
    }

    await suppliersModel.updateSupplierById(existing.id, fieldsToUpdate, connection);

    const updated = await suppliersModel.findSupplierById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated supplier');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'UPDATE_SUPPLIER',
        tableName: 'suppliers',
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

export const deleteSupplier = async (actor: AuthUser, id: number, meta: RequestMetadata): Promise<void> => {
  assertCanManageSuppliers(actor);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await suppliersModel.findSupplierByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Supplier not found');
    }

    await suppliersModel.deleteSupplierById(existing.id, connection);

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'DELETE_SUPPLIER',
        tableName: 'suppliers',
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

export const suppliersService = {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};

export default suppliersService;
