import type { NextFunction, Request, Response } from 'express';
import ApiError from '../../utils/api-error';
import categoriesService from './categories.service';
import type {
  CreateCategoryInput,
  ListCategoriesQuery,
  RequestMetadata,
  UpdateCategoryInput,
} from './categories.service';

const getRequestMeta = (req: Request): RequestMetadata => ({
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get('user-agent') || null,
});

export const listCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as ListCategoriesQuery;
    const { items, pagination } = await categoriesService.listCategories(query);

    res.status(200).json({
      success: true,
      message: 'Categories retrieved successfully',
      data: items,
      pagination,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const data = await categoriesService.getCategoryById(id);

    res.status(200).json({
      success: true,
      message: 'Category retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const payload = req.body as CreateCategoryInput;
    const data = await categoriesService.createCategory(req.user, payload, getRequestMeta(req));

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as UpdateCategoryInput;
    const data = await categoriesService.updateCategory(req.user, id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    await categoriesService.deleteCategory(req.user, id, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
      data: null,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const categoriesController = {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};

export default categoriesController;
