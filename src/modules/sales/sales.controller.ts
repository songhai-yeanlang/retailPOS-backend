import type { NextFunction, Request, Response } from 'express';
import ApiError from '../../utils/api-error';
import salesService from './sales.service';
import type {
  CreateSaleInput,
  ListSalesQuery,
  RequestMetadata,
  UpdateSaleStatusInput,
} from './sales.service';

const getRequestMeta = (req: Request): RequestMetadata => ({
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get('user-agent') || null,
});

export const listSales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as ListSalesQuery;
    const { items, pagination } = await salesService.listSales(query);

    res.status(200).json({
      success: true,
      message: 'Sales retrieved successfully',
      data: items,
      pagination,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getSaleById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const data = await salesService.getSaleById(id);

    res.status(200).json({
      success: true,
      message: 'Sale retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getSaleByInvoiceNo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const invoiceNo = String(req.params.invoiceNo);
    const data = await salesService.getSaleByInvoiceNo(invoiceNo);

    res.status(200).json({
      success: true,
      message: 'Sale retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const createSale = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const payload = req.body as CreateSaleInput;
    const data = await salesService.createSale(req.user, payload, getRequestMeta(req));

    res.status(201).json({
      success: true,
      message: 'Sale completed successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updateSaleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as UpdateSaleStatusInput;
    const data = await salesService.updateSaleStatus(req.user, id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: `Sale ${data.status} successfully`,
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const salesController = {
  listSales,
  getSaleById,
  getSaleByInvoiceNo,
  createSale,
  updateSaleStatus,
};

export default salesController;
