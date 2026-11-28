import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import reportsController from './reports.controller';
import {
  dateRangeReportSchema,
  inventoryReportSchema,
  purchasesSummaryReportSchema,
  salesSummaryReportSchema,
  topProductsReportSchema,
} from './reports.validation';

const router = Router();

router.use('/reports', authenticate);

router.get('/reports/dashboard', authorize('owner', 'manager'), validate(dateRangeReportSchema), reportsController.getDashboardReport);
router.get('/reports/sales-summary', authorize('owner', 'manager'), validate(salesSummaryReportSchema), reportsController.getSalesSummaryReport);
router.get('/reports/top-products', authorize('owner', 'manager'), validate(topProductsReportSchema), reportsController.getTopProductsReport);
router.get('/reports/payment-methods', authorize('owner', 'manager'), validate(dateRangeReportSchema), reportsController.getPaymentMethodsReport);
router.get('/reports/cashiers', authorize('owner', 'manager'), validate(dateRangeReportSchema), reportsController.getCashiersReport);
router.get('/reports/inventory', authorize('owner', 'manager'), validate(inventoryReportSchema), reportsController.getInventoryReport);
router.get('/reports/purchases-summary', authorize('owner', 'manager'), validate(purchasesSummaryReportSchema), reportsController.getPurchasesSummaryReport);

export default router;
