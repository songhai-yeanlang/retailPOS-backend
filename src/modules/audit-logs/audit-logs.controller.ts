import type { NextFunction, Request, Response } from 'express';
import auditLogsService from './audit-logs.service';
import type { ListAuditLogsQuery } from './audit-logs.service';

export const listAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as ListAuditLogsQuery;
    const { items, pagination } = await auditLogsService.listAuditLogs(query);

    res.status(200).json({
      success: true,
      message: 'Audit logs retrieved successfully',
      data: items,
      pagination,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getAuditLogById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const data = await auditLogsService.getAuditLogById(id);

    res.status(200).json({
      success: true,
      message: 'Audit log retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const deleteAuditLogById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await auditLogsService.deleteAuditLogById(id);

    res.status(200).json({
      success: true,
      message: 'Audit log deleted successfully',
      data: null,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const deleteAllAuditLogs = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await auditLogsService.deleteAllAuditLogs();

    res.status(200).json({
      success: true,
      message: 'All audit logs deleted successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const auditLogsController = {
  listAuditLogs,
  getAuditLogById,
  deleteAuditLogById,
  deleteAllAuditLogs,
};

export default auditLogsController;
