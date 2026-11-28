import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import purchasesController from './purchases.controller';
import {
    createPurchaseSchema,
    listPurchasesSchema,
    purchaseIdParamSchema,
    updatePurchaseStatusSchema,
} from './purchases.validation';

const router = Router();

router.use('/purchases', authenticate);

router.get('/purchases', authorize('owner', 'manager'), validate(listPurchasesSchema), purchasesController.listPurchases);
router.get('/purchases/:id', authorize('owner', 'manager'), validate(purchaseIdParamSchema), purchasesController.getPurchaseById);
router.post('/purchases', authorize('owner', 'manager'), validate(createPurchaseSchema), purchasesController.createPurchase);
router.patch('/purchases/:id/status', authorize('owner', 'manager'), validate(updatePurchaseStatusSchema), purchasesController.updatePurchaseStatus);

export default router;
