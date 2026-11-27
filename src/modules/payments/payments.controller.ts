import type { NextFunction, Request, Response } from 'express';
import ApiError from '../../utils/api-error';
import paymentsService from './payments.service';
import type {
  CreatePaymentMethodInput,
  ListPaymentMethodsQuery,
  RequestMetadata,
  UpdatePaymentMethodInput,
  UpdatePaymentMethodStatusInput,
} from './payments.service';

const getRequestMeta = (req: Request): RequestMetadata => ({
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get('user-agent') || null,
});

export const listPaymentMethods = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as ListPaymentMethodsQuery;
    const { items, pagination } = await paymentsService.listPaymentMethods(query);

    res.status(200).json({
      success: true,
      message: 'Payment methods retrieved successfully',
      data: items,
      pagination,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getPaymentMethodById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const data = await paymentsService.getPaymentMethodById(id);

    res.status(200).json({
      success: true,
      message: 'Payment method retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const createPaymentMethod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const payload = req.body as CreatePaymentMethodInput;
    const uploadedQrPath = req.file?.path ?? null;
    const data = await paymentsService.createPaymentMethod(req.user, payload, uploadedQrPath, getRequestMeta(req));

    res.status(201).json({
      success: true,
      message: 'Payment method created successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updatePaymentMethod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as UpdatePaymentMethodInput;
    const uploadedQrPath = req.file?.path ?? null;
    const data = await paymentsService.updatePaymentMethod(req.user, id, payload, uploadedQrPath, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Payment method updated successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updatePaymentMethodStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as UpdatePaymentMethodStatusInput;
    const data = await paymentsService.updatePaymentMethodStatus(req.user, id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: `Payment method ${data.isActive ? 'activated' : 'deactivated'} successfully`,
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const deletePaymentMethod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    await paymentsService.deletePaymentMethod(req.user, id, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully',
      data: null,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const paymentsController = {
  listPaymentMethods,
  getPaymentMethodById,
  createPaymentMethod,
  updatePaymentMethod,
  updatePaymentMethodStatus,
  deletePaymentMethod,
};

export default paymentsController;
