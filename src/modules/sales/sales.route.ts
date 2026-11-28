import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import salesController from './sales.controller';
import {
    createSaleSchema,
    listSalesSchema,
    saleIdParamSchema,
    saleInvoiceParamSchema,
    updateSaleStatusSchema,
} from './sales.validation';

const router = Router();

router.use('/sales', authenticate);

router.get('/sales', authorize('owner', 'manager', 'cashier'), validate(listSalesSchema), salesController.listSales);
router.get('/sales/invoice/:invoiceNo', authorize('owner', 'manager', 'cashier'), validate(saleInvoiceParamSchema), salesController.getSaleByInvoiceNo);
router.get('/sales/:id', authorize('owner', 'manager', 'cashier'), validate(saleIdParamSchema), salesController.getSaleById);
router.post('/sales', authorize('owner', 'manager', 'cashier'), validate(createSaleSchema), salesController.createSale);
router.patch('/sales/:id/status', authorize('owner', 'manager'), validate(updateSaleStatusSchema), salesController.updateSaleStatus);

export default router;
