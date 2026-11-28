import type { NextFunction, Request, Response } from 'express';
import ApiError from '../../utils/api-error';
import purchasesService from './purchases.service';
import type {
  CreatePurchaseInput,
  ListPurchasesQuery,
  RequestMetadata,
  UpdatePurchaseStatusInput,
} from './purchases.service';

const getRequestMeta = (req: Request): RequestMetadata => ({
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get('user-agent') || null,
});

export const listPurchases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as ListPurchasesQuery;
    const { items, pagination } = await purchasesService.listPurchases(query);

    res.status(200).json({
      success: true,
      message: 'Purchases retrieved successfully',
      data: items,
      pagination,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getPurchaseById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const data = await purchasesService.getPurchaseById(id);

    res.status(200).json({
      success: true,
      message: 'Purchase retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const createPurchase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const payload = req.body as CreatePurchaseInput;
    const data = await purchasesService.createPurchase(req.user, payload, getRequestMeta(req));

    res.status(201).json({
      success: true,
      message: 'Purchase created successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updatePurchaseStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as UpdatePurchaseStatusInput;
    const data = await purchasesService.updatePurchaseStatus(req.user, id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Purchase status updated successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const purchasesController = {
  listPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchaseStatus,
};

export default purchasesController;
