import type { PaginationMeta } from '../../types/api.types';
import ApiError from '../../utils/api-error';
import auditLogsModel from './audit-logs.model';
import type { AuditLogRecord } from './audit-logs.model';

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface ListAuditLogsQuery {
  page: number;
  limit: number;
  userId?: number;
  action?: string;
  tableName?: string;
  recordId?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginatedAuditLogsResult {
  items: AuditLogRecord[];
  pagination: PaginationMeta;
}

export interface DeleteAllAuditLogsResult {
  deletedCount: number;
}

interface ParsedDateBoundary {
  sqlValue: Date | string;
  timestampMs: number;
}

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

export const listAuditLogs = async (query: ListAuditLogsQuery): Promise<PaginatedAuditLogsResult> => {
  const startBoundary = query.startDate
    ? parseDateBoundary(query.startDate, 'start')
    : undefined;
  const endBoundary = query.endDate
    ? parseDateBoundary(query.endDate, 'end')
    : undefined;

  if (
    startBoundary &&
    endBoundary &&
    startBoundary.timestampMs > endBoundary.timestampMs
  ) {
    throw ApiError.badRequest('endDate must be greater than or equal to startDate');
  }

  const { items, total } = await auditLogsModel.findAuditLogs({
    page: query.page,
    limit: query.limit,
    userId: query.userId,
    action: query.action,
    tableName: query.tableName,
    recordId: query.recordId,
    startDate: startBoundary?.sqlValue,
    endDate: endBoundary?.sqlValue,
    search: query.search,
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

export const getAuditLogById = async (id: number): Promise<AuditLogRecord> => {
  const auditLog = await auditLogsModel.findAuditLogById(id);
  if (!auditLog) {
    throw ApiError.notFound('Audit log not found');
  }

  return auditLog;
};

export const deleteAuditLogById = async (id: number): Promise<void> => {
  const deletedRows = await auditLogsModel.deleteAuditLogById(id);
  if (deletedRows === 0) {
    throw ApiError.notFound('Audit log not found');
  }
};

export const deleteAllAuditLogs = async (): Promise<DeleteAllAuditLogsResult> => {
  const deletedCount = await auditLogsModel.deleteAllAuditLogs();
  return { deletedCount };
};

export const auditLogsService = {
  listAuditLogs,
  getAuditLogById,
  deleteAuditLogById,
  deleteAllAuditLogs,
};

export default auditLogsService;
