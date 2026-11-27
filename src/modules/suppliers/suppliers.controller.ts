import type { NextFunction, Request, Response } from 'express';
import ApiError from '../../utils/api-error';
import suppliersService from './suppliers.service';
import type {
  CreateSupplierInput,
  ListSuppliersQuery,
  RequestMetadata,
  UpdateSupplierInput,
} from './suppliers.service';

const getRequestMeta = (req: Request): RequestMetadata => ({
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get('user-agent') || null,
});

export const listSuppliers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as ListSuppliersQuery;
    const { items, pagination } = await suppliersService.listSuppliers(query);

    res.status(200).json({
      success: true,
      message: 'Suppliers retrieved successfully',
      data: items,
      pagination,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getSupplierById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const data = await suppliersService.getSupplierById(id);

    res.status(200).json({
      success: true,
      message: 'Supplier retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const createSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const payload = req.body as CreateSupplierInput;
    const data = await suppliersService.createSupplier(req.user, payload, getRequestMeta(req));

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updateSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as UpdateSupplierInput;
    const data = await suppliersService.updateSupplier(req.user, id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Supplier updated successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const deleteSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    await suppliersService.deleteSupplier(req.user, id, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Supplier deleted successfully',
      data: null,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const suppliersController = {
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};

export default suppliersController;
