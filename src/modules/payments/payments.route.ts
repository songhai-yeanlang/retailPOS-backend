import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/authenticate';
import { uploadImage } from '../../middlewares/upload';
import { validate } from '../../middlewares/validate';
import paymentsController from './payments.controller';
import {
    createPaymentMethodSchema,
    listPaymentMethodsSchema,
    paymentMethodIdParamSchema,
    updatePaymentMethodSchema,
    updatePaymentMethodStatusSchema,
} from './payments.validation';

const router = Router();

router.use('/payments', authenticate);

router.get('/payments', authorize('owner', 'manager', 'cashier'), validate(listPaymentMethodsSchema), paymentsController.listPaymentMethods);
router.get('/payments/:id', authorize('owner', 'manager', 'cashier'), validate(paymentMethodIdParamSchema), paymentsController.getPaymentMethodById);
router.post('/payments', authorize('owner', 'manager'), ...uploadImage('qrImage', 'payments'), validate(createPaymentMethodSchema), paymentsController.createPaymentMethod);
router.put('/payments/:id', authorize('owner', 'manager'), validate(paymentMethodIdParamSchema), ...uploadImage('qrImage', 'payments'), validate(updatePaymentMethodSchema), paymentsController.updatePaymentMethod);
router.patch('/payments/:id/status', authorize('owner', 'manager'), validate(updatePaymentMethodStatusSchema), paymentsController.updatePaymentMethodStatus);
router.delete('/payments/:id', authorize('owner'), validate(paymentMethodIdParamSchema), paymentsController.deletePaymentMethod);

export default router;
