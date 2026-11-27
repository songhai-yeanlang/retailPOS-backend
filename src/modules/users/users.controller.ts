import type { NextFunction, Request, Response } from 'express';
import ApiError from '../../utils/api-error';
import usersService from './users.service';
import type {
  AdminResetPasswordInput,
  CreateUserInput,
  ListUsersQuery,
  RequestMetadata,
  UpdateUserInput,
  UpdateUserStatusInput,
} from './users.service';

const getRequestMeta = (req: Request): RequestMetadata => ({
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get('user-agent') || null,
});

export const listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as ListUsersQuery;
    const { items, pagination } = await usersService.listUsers(query);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: items,
      pagination,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const data = await usersService.getUserById(id);

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const payload = req.body as CreateUserInput;
    const data = await usersService.createUser(req.user, payload, getRequestMeta(req));

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as UpdateUserInput;
    const data = await usersService.updateUser(req.user, id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as UpdateUserStatusInput;
    const data = await usersService.updateUserStatus(req.user, id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: `User ${data.isActive ? 'activated' : 'deactivated'} successfully`,
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const adminResetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as AdminResetPasswordInput;
    await usersService.adminResetPassword(req.user, id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'User password reset successfully',
      data: null,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    await usersService.deleteUser(req.user, id, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: null,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const usersController = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  adminResetPassword,
  deleteUser,
};

export default usersController;
