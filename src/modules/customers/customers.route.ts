import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import customersController from './customers.controller';
import {
    adjustCustomerPointsSchema,
    createCustomerSchema,
    customerIdParamSchema,
    listCustomersSchema,
    updateCustomerSchema,
} from './customers.validation';

const router = Router();

router.use('/customers', authenticate);

router.get('/customers', authorize('owner', 'manager', 'cashier'), validate(listCustomersSchema), customersController.listCustomers);
router.get('/customers/:id', authorize('owner', 'manager', 'cashier'), validate(customerIdParamSchema), customersController.getCustomerById);
router.post('/customers', authorize('owner', 'manager', 'cashier'), validate(createCustomerSchema), customersController.createCustomer);
router.put('/customers/:id', authorize('owner', 'manager', 'cashier'), validate(updateCustomerSchema), customersController.updateCustomer);
router.patch('/customers/:id/points', authorize('owner', 'manager'), validate(adjustCustomerPointsSchema), customersController.adjustCustomerPoints);
router.delete('/customers/:id', authorize('owner', 'manager'), validate(customerIdParamSchema), customersController.deleteCustomer);

export default router;
