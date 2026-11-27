import type { NextFunction, Request, Response } from 'express';
import ApiError from '../../utils/api-error';
import customersService from './customers.service';
import type {
  AdjustCustomerPointsInput,
  CreateCustomerInput,
  ListCustomersQuery,
  RequestMetadata,
  UpdateCustomerInput,
} from './customers.service';

const getRequestMeta = (req: Request): RequestMetadata => ({
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get('user-agent') || null,
});

export const listCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as ListCustomersQuery;
    const { items, pagination } = await customersService.listCustomers(query);

    res.status(200).json({
      success: true,
      message: 'Customers retrieved successfully',
      data: items,
      pagination,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getCustomerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const data = await customersService.getCustomerById(id);

    res.status(200).json({
      success: true,
      message: 'Customer retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const createCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const payload = req.body as CreateCustomerInput;
    const data = await customersService.createCustomer(req.user, payload, getRequestMeta(req));

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as UpdateCustomerInput;
    const data = await customersService.updateCustomer(req.user, id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Customer updated successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const adjustCustomerPoints = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as AdjustCustomerPointsInput;
    const data = await customersService.adjustCustomerPoints(req.user, id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Customer points updated successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const deleteCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    await customersService.deleteCustomer(req.user, id, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully',
      data: null,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const customersController = {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  adjustCustomerPoints,
  deleteCustomer,
};

export default customersController;
