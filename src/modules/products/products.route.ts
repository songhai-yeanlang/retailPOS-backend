import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/authenticate';
import { uploadImage } from '../../middlewares/upload';
import { validate } from '../../middlewares/validate';
import productsController from './products.controller';
import {
    adjustProductStockSchema,
    createProductSchema,
    listLowStockProductsSchema,
    listProductsSchema,
    productBarcodeParamSchema,
    productIdParamSchema,
    updateProductSchema,
    updateProductStatusSchema,
} from './products.validation';

const router = Router();

router.use('/products', authenticate);

router.get('/products', authorize('owner', 'manager', 'cashier'), validate(listProductsSchema), productsController.listProducts);
router.get('/products/low-stock', authorize('owner', 'manager', 'cashier'), validate(listLowStockProductsSchema), productsController.listLowStockProducts);
router.get('/products/barcode/:barcode', authorize('owner', 'manager', 'cashier'), validate(productBarcodeParamSchema), productsController.getProductByBarcode);
router.get('/products/:id', authorize('owner', 'manager', 'cashier'), validate(productIdParamSchema), productsController.getProductById);
router.post('/products', authorize('owner', 'manager'), ...uploadImage('image', 'products'), validate(createProductSchema), productsController.createProduct);
router.put('/products/:id', authorize('owner', 'manager'), validate(productIdParamSchema), ...uploadImage('image', 'products'), validate(updateProductSchema), productsController.updateProduct);
router.patch('/products/:id/status', authorize('owner', 'manager'), validate(updateProductStatusSchema), productsController.updateProductStatus);
router.patch('/products/:id/stock', authorize('owner', 'manager'), validate(adjustProductStockSchema), productsController.adjustProductStock);
router.delete('/products/:id', authorize('owner'), validate(productIdParamSchema), productsController.deleteProduct);

export default router;
