import type { NextFunction, Request, Response } from 'express';
import ApiError from '../../utils/api-error';
import productsService from './products.service';
import type {
  AdjustProductStockInput,
  CreateProductInput,
  ListLowStockProductsQuery,
  ListProductsQuery,
  RequestMetadata,
  UpdateProductInput,
  UpdateProductStatusInput,
} from './products.service';

const getRequestMeta = (req: Request): RequestMetadata => ({
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get('user-agent') || null,
});

export const listProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as ListProductsQuery;
    const { items, pagination } = await productsService.listProducts(query);

    res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      data: items,
      pagination,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const listLowStockProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as ListLowStockProductsQuery;
    const { items, pagination } = await productsService.listLowStockProducts(query);

    res.status(200).json({
      success: true,
      message: 'Low-stock products retrieved successfully',
      data: items,
      pagination,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const data = await productsService.getProductById(id);

    res.status(200).json({
      success: true,
      message: 'Product retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getProductByBarcode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const barcode = String(req.params.barcode);
    const data = await productsService.getProductByBarcode(barcode);

    res.status(200).json({
      success: true,
      message: 'Product retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const payload = req.body as CreateProductInput;
    const uploadedImagePath = req.file?.path ?? null;
    const data = await productsService.createProduct(req.user, payload, uploadedImagePath, getRequestMeta(req));

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as UpdateProductInput;
    const uploadedImagePath = req.file?.path ?? null;
    const data = await productsService.updateProduct(req.user, id, payload, uploadedImagePath, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updateProductStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as UpdateProductStatusInput;
    const data = await productsService.updateProductStatus(req.user, id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: `Product ${data.isActive ? 'activated' : 'deactivated'} successfully`,
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const adjustProductStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    const payload = req.body as AdjustProductStockInput;
    const data = await productsService.adjustProductStock(req.user, id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Product stock updated successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const id = Number(req.params.id);
    await productsService.deleteProduct(req.user, id, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: null,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const productsController = {
  listProducts,
  listLowStockProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  updateProductStatus,
  adjustProductStock,
  deleteProduct,
};

export default productsController;
