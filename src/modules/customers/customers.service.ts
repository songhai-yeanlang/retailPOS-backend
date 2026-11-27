import pool from '../../config/db.config';
import type { PaginationMeta } from '../../types/api.types';
import type { AuthUser } from '../../types/auth.types';
import ApiError from '../../utils/api-error';
import auditLogsModel from '../audit-logs/audit-logs.model';
import customersModel from './customers.model';
import type { CustomerRecord, CustomerSortField, UpdateCustomerFields } from './customers.model';

const MAX_TOTAL_POINTS = 2147483647;

export type PointsAdjustmentAction = 'add' | 'deduct' | 'set';

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ListCustomersQuery {
  page: number;
  limit: number;
  minPoints?: number;
  search?: string;
  sortBy: CustomerSortField;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedCustomersResult {
  items: CustomerRecord[];
  pagination: PaginationMeta;
}

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  points: number;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string | null;
  address?: string | null;
}

export interface AdjustCustomerPointsInput {
  action: PointsAdjustmentAction;
  points: number;
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

const toAuditSnapshot = (customer: CustomerRecord): Record<string, unknown> => ({
  name: customer.name,
  phone: customer.phone,
  address: customer.address,
  points: customer.points,
});

const assertCanManagePointsOrDelete = (actor: AuthUser, actionLabel: string): void => {
  if (actor.role !== 'owner' && actor.role !== 'manager') {
    throw ApiError.forbidden(`Only owners and managers can ${actionLabel}`);
  }
};

export const listCustomers = async (query: ListCustomersQuery): Promise<PaginatedCustomersResult> => {
  const { items, total } = await customersModel.findCustomers({
    page: query.page,
    limit: query.limit,
    minPoints: query.minPoints,
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

export const getCustomerById = async (id: number): Promise<CustomerRecord> => {
  const customer = await customersModel.findCustomerById(id);
  if (!customer) {
    throw ApiError.notFound('Customer not found');
  }

  return customer;
};

export const createCustomer = async (actor: AuthUser, input: CreateCustomerInput, meta: RequestMetadata): Promise<CustomerRecord> => {
  const normalizedName = input.name.trim();
  const normalizedPhone = normalizeNullableText(input.phone) ?? null;
  const normalizedAddress = normalizeNullableText(input.address) ?? null;
  const initialPoints = input.points ?? 0;

  if (!normalizedName) {
    throw ApiError.badRequest('Customer name is required');
  }

  if (!Number.isInteger(initialPoints) || initialPoints < 0 || initialPoints > MAX_TOTAL_POINTS) {
    throw ApiError.badRequest('Initial loyalty points must be a non-negative integer');
  }

  if (initialPoints > 0) {
    assertCanManagePointsOrDelete(actor, 'set initial loyalty points');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    if (normalizedPhone) {
      const duplicatePhone = await customersModel.findCustomerByPhone(normalizedPhone, undefined, connection);
      if (duplicatePhone) {
        throw ApiError.conflict('Customer phone number already exists');
      }
    }

    const customerId = await customersModel.createCustomer(
      {
        name: normalizedName,
        phone: normalizedPhone,
        address: normalizedAddress,
        points: initialPoints,
      },
      connection,
    );

    const created = await customersModel.findCustomerById(customerId, connection);
    if (!created) {
      throw ApiError.internal('Failed to retrieve created customer');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'CREATE_CUSTOMER',
        tableName: 'customers',
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

export const updateCustomer = async (actor: AuthUser, id: number, input: UpdateCustomerInput, meta: RequestMetadata): Promise<CustomerRecord> => {
  const normalizedName = input.name !== undefined ? input.name.trim() : undefined;
  const normalizedPhone = normalizeNullableText(input.phone);
  const normalizedAddress = normalizeNullableText(input.address);

  if (normalizedName !== undefined && normalizedName.length === 0) {
    throw ApiError.badRequest('Customer name cannot be empty');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await customersModel.findCustomerByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Customer not found');
    }

    const fieldsToUpdate: UpdateCustomerFields = {};

    if (normalizedName !== undefined && normalizedName !== existing.name) {
      fieldsToUpdate.name = normalizedName;
    }

    if (normalizedPhone !== undefined && normalizedPhone !== existing.phone) {
      if (normalizedPhone !== null) {
        const duplicatePhone = await customersModel.findCustomerByPhone(normalizedPhone, existing.id, connection);
        if (duplicatePhone) {
          throw ApiError.conflict('Customer phone number already exists');
        }
      }
      fieldsToUpdate.phone = normalizedPhone;
    }

    if (normalizedAddress !== undefined && normalizedAddress !== existing.address) {
      fieldsToUpdate.address = normalizedAddress;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      const current = await customersModel.findCustomerById(existing.id, connection);
      await connection.commit();
      return current ?? existing;
    }

    await customersModel.updateCustomerById(existing.id, fieldsToUpdate, connection);

    const updated = await customersModel.findCustomerById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated customer');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'UPDATE_CUSTOMER',
        tableName: 'customers',
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

export const adjustCustomerPoints = async (actor: AuthUser, id: number, input: AdjustCustomerPointsInput, meta: RequestMetadata): Promise<CustomerRecord> => {
  assertCanManagePointsOrDelete(actor, 'adjust customer loyalty points');

  if (!Number.isInteger(input.points) || input.points < 0 || input.points > MAX_TOTAL_POINTS) {
    throw ApiError.badRequest('Points must be a valid non-negative integer');
  }

  if ((input.action === 'add' || input.action === 'deduct') && input.points < 1) {
    throw ApiError.badRequest('Points must be at least 1 for add or deduct actions');
  }

  const normalizedReason = normalizeNullableText(input.reason) ?? null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await customersModel.findCustomerByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Customer not found');
    }

    let nextPoints: number;
    if (input.action === 'add') {
      nextPoints = existing.points + input.points;
      if (nextPoints > MAX_TOTAL_POINTS) {
        throw ApiError.badRequest('Customer points balance exceeds the maximum allowed limit');
      }
    } else if (input.action === 'deduct') {
      if (input.points > existing.points) {
        throw ApiError.badRequest('Insufficient customer points');
      }
      nextPoints = existing.points - input.points;
    } else {
      nextPoints = input.points;
    }

    if (nextPoints === existing.points) {
      const current = await customersModel.findCustomerById(existing.id, connection);
      await connection.commit();
      return current ?? existing;
    }

    await customersModel.updateCustomerPointsById(existing.id, nextPoints, connection);

    const updated = await customersModel.findCustomerById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated customer');
    }

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'ADJUST_CUSTOMER_POINTS',
        tableName: 'customers',
        recordId: updated.id,
        oldValues: { points: existing.points },
        newValues: {
          points: updated.points,
          action: input.action,
          amount: input.points,
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

export const deleteCustomer = async (actor: AuthUser, id: number, meta: RequestMetadata): Promise<void> => {
  assertCanManagePointsOrDelete(actor, 'delete customers');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await customersModel.findCustomerByIdForUpdate(id, connection);
    if (!existing) {
      throw ApiError.notFound('Customer not found');
    }

    await customersModel.deleteCustomerById(existing.id, connection);

    await auditLogsModel.createAuditLog(
      {
        userId: actor.id,
        action: 'DELETE_CUSTOMER',
        tableName: 'customers',
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

export const customersService = {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  adjustCustomerPoints,
  deleteCustomer,
};

export default customersService;
