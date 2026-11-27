import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import suppliersController from './suppliers.controller';
import {
    createSupplierSchema,
    listSuppliersSchema,
    supplierIdParamSchema,
    updateSupplierSchema,
} from './suppliers.validation';

const router = Router();

router.use('/suppliers', authenticate);

router.get('/suppliers', authorize('owner', 'manager'), validate(listSuppliersSchema), suppliersController.listSuppliers);
router.get('/suppliers/:id', authorize('owner', 'manager'), validate(supplierIdParamSchema), suppliersController.getSupplierById);
router.post('/suppliers', authorize('owner', 'manager'), validate(createSupplierSchema), suppliersController.createSupplier);
router.put('/suppliers/:id', authorize('owner', 'manager'), validate(updateSupplierSchema), suppliersController.updateSupplier);
router.delete('/suppliers/:id', authorize('owner', 'manager'), validate(supplierIdParamSchema), suppliersController.deleteSupplier);

export default router;
