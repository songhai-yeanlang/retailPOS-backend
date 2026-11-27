import pool from '../../config/db.config';
import { deleteUploadedFile } from '../../middlewares/upload';
import type { PaginationMeta } from '../../types/api.types';
import type { AuthUser } from '../../types/auth.types';
import ApiError from '../../utils/api-error';
import auditLogsModel from '../audit-logs/audit-logs.model';
import paymentsModel from './payments.model';
import type {
  PaymentMethodRecord,
  PaymentMethodSortField,
  PaymentMethodType,
  UpdatePaymentMethodFields,
} from './payments.model';

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ListPaymentMethodsQuery {
  page: number;
  limit: number;
  type?: PaymentMethodType;
  isActive?: boolean;
  search?: string;
  sortBy: PaymentMethodSortField;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedPaymentMethodsResult {
  items: PaymentMethodRecord[];
  pagination: PaginationMeta;
}

export interface CreatePaymentMethodInput {
  name: string;
  type: PaymentMethodType;
  accountName?: string | null;
  accountNumber?: string | null;
  isActive: boolean;
}

export interface UpdatePaymentMethodInput {
  name?: string;
  type?: PaymentMethodType;
  accountName?: string | null;
  accountNumber?: string | null;
  isActive?: boolean;
  removeQrImage?: boolean;
}

export interface UpdatePaymentMethodStatusInput {
  isActive: boolean;
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

const toAuditSnapshot = (method: PaymentMethodRecord): Record<string, unknown> => ({
  name: method.name,
  type: method.type,
  accountName: method.accountName,
  accountNumber: method.accountNumber,
  qrImage: method.qrImage,
  isActive: method.isActive,
});

const isForeignKeyReferenceError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  return error.code === 'ER_ROW_IS_REFERENCED' || error.code === 'ER_ROW_IS_REFERENCED_2';
};

const assertCanManagePaymentMethods = (actor: AuthUser): void => {
  if (actor.role !== 'owner' && actor.role !== 'manager') {
    throw ApiError.forbidden('You do not have permission to manage payment methods');
  }
};

export const listPaymentMethods = async (query: ListPaymentMethodsQuery): Promise<PaginatedPaymentMethodsResult> => {
  const { items, total } = await paymentsModel.findPaymentMethods({
    page: query.page,
    limit: query.limit,
    type: query.type,
    isActive: query.isActive,
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

export const getPaymentMethodById = async (id: number): Promise<PaymentMethodRecord> => {
  const method = await paymentsModel.findPaymentMethodById(id);
  if (!method) {
    throw ApiError.notFound('Payment method not found');
  }

  return method;
};

export const createPaymentMethod = async (actor: AuthUser, input: CreatePaymentMethodInput, uploadedQrPath: string | null, meta: RequestMetadata): Promise<PaymentMethodRecord> => {
  assertCanManagePaymentMethods(actor);

  const normalizedName = input.name.trim();
  const normalizedAccountName = normalizeNullableText(input.accountName) ?? null;
  const normalizedAccountNumber = normalizeNullableText(input.accountNumber) ?? null;

  if (!normalizedName) {
    throw ApiError.badRequest('Payment method name is required');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const duplicate = await paymentsModel.findPaymentMethodByName(normalizedName, undefined, connection);
    if (duplicate) {
      throw ApiError.conflict('Payment method name already exists');
    }

    const methodId = await paymentsModel.createPaymentMethod(
      {
        name: normalizedName,
        type: input.type,
        accountName: normalizedAccountName,
        accountNumber: normalizedAccountNumber,
        qrImage: uploadedQrPath,
        isActive: input.isActive,
      },
      connection,
    );

    const created = await paymentsModel.findPaymentMethodById(methodId, connection);
    if (!created) {
      throw ApiError.internal('Failed to retrieve created payment method');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'CREATE_PAYMENT_METHOD',
        tableName: 'payment_methods',
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

export const updatePaymentMethod = async (actor: AuthUser, id: number, input: UpdatePaymentMethodInput, uploadedQrPath: string | null, meta: RequestMetadata): Promise<PaymentMethodRecord> => {
  assertCanManagePaymentMethods(actor);

  const hasBodyFields = Object.values(input).some((value) => value !== undefined);
  if (!hasBodyFields && !uploadedQrPath) {
    throw ApiError.badRequest('At least one payment method field or QR image must be provided');
  }

  if (uploadedQrPath && input.removeQrImage === true) {
    throw ApiError.badRequest('Cannot upload a new QR image and removeQrImage at the same time');
  }

  const normalizedName = input.name !== undefined ? input.name.trim() : undefined;
  const normalizedAccountName = normalizeNullableText(input.accountName);
  const normalizedAccountNumber = normalizeNullableText(input.accountNumber);

  if (normalizedName !== undefined && normalizedName.length === 0) {
    throw ApiError.badRequest('Payment method name cannot be empty');
  }

  let oldQrImageToDelete: string | null = null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await paymentsModel.findPaymentMethodByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Payment method not found');
    }

    const fieldsToUpdate: UpdatePaymentMethodFields = {};

    if (normalizedName !== undefined && normalizedName !== existing.name) {
      const duplicate = await paymentsModel.findPaymentMethodByName(normalizedName, existing.id, connection);
      if (duplicate) {
        throw ApiError.conflict('Payment method name already exists');
      }
      fieldsToUpdate.name = normalizedName;
    }

    if (input.type !== undefined && input.type !== existing.type) {
      fieldsToUpdate.type = input.type;
    }

    if (normalizedAccountName !== undefined && normalizedAccountName !== existing.accountName) {
      fieldsToUpdate.accountName = normalizedAccountName;
    }

    if (normalizedAccountNumber !== undefined && normalizedAccountNumber !== existing.accountNumber) {
      fieldsToUpdate.accountNumber = normalizedAccountNumber;
    }

    if (input.isActive !== undefined && input.isActive !== existing.isActive) {
      fieldsToUpdate.isActive = input.isActive;
    }

    if (uploadedQrPath) {
      fieldsToUpdate.qrImage = uploadedQrPath;
      if (existing.qrImage && existing.qrImage !== uploadedQrPath) {
        oldQrImageToDelete = existing.qrImage;
      }
    } else if (input.removeQrImage === true && existing.qrImage !== null) {
      fieldsToUpdate.qrImage = null;
      oldQrImageToDelete = existing.qrImage;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      const current = await paymentsModel.findPaymentMethodById(existing.id, connection);
      await connection.commit();
      return current ?? existing;
    }

    await paymentsModel.updatePaymentMethodById(existing.id, fieldsToUpdate, connection);

    const updated = await paymentsModel.findPaymentMethodById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated payment method');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'UPDATE_PAYMENT_METHOD',
        tableName: 'payment_methods',
        recordId: updated.id,
        oldValues: toAuditSnapshot(existing),
        newValues: toAuditSnapshot(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();

    if (oldQrImageToDelete) {
      void deleteUploadedFile(oldQrImageToDelete);
    }

    return updated;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updatePaymentMethodStatus = async (actor: AuthUser, id: number, input: UpdatePaymentMethodStatusInput, meta: RequestMetadata): Promise<PaymentMethodRecord> => {
  assertCanManagePaymentMethods(actor);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await paymentsModel.findPaymentMethodByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Payment method not found');
    }

    if (existing.isActive === input.isActive) {
      const current = await paymentsModel.findPaymentMethodById(existing.id, connection);
      await connection.commit();
      return current ?? existing;
    }

    await paymentsModel.updatePaymentMethodStatusById(existing.id, input.isActive, connection);

    const updated = await paymentsModel.findPaymentMethodById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated payment method');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'UPDATE_PAYMENT_METHOD_STATUS',
        tableName: 'payment_methods',
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

export const deletePaymentMethod = async (actor: AuthUser, id: number, meta: RequestMetadata): Promise<void> => {
  if (actor.role !== 'owner') {
    throw ApiError.forbidden('Only owners can delete payment methods');
  }

  let qrImageToDelete: string | null = null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await paymentsModel.findPaymentMethodByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Payment method not found');
    }

    try {
      await paymentsModel.deletePaymentMethodById(existing.id, connection);
    } catch (error: unknown) {
      if (isForeignKeyReferenceError(error)) {
        throw ApiError.conflict(
          'Cannot delete payment method because it is referenced by existing sales. Deactivate it instead.',
        );
      }
      throw error;
    }

    qrImageToDelete = existing.qrImage;

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'DELETE_PAYMENT_METHOD',
        tableName: 'payment_methods',
        recordId: existing.id,
        oldValues: toAuditSnapshot(existing),
        newValues: null,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();

    if (qrImageToDelete) {
      void deleteUploadedFile(qrImageToDelete);
    }
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const paymentsService = {
  listPaymentMethods,
  getPaymentMethodById,
  createPaymentMethod,
  updatePaymentMethod,
  updatePaymentMethodStatus,
  deletePaymentMethod,
};

export default paymentsService;
