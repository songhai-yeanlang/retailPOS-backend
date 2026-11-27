import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import usersController from './users.controller';
import {
    adminResetPasswordSchema,
    createUserSchema,
    listUsersSchema,
    updateUserSchema,
    updateUserStatusSchema,
    userIdParamSchema,
} from './users.validation';

const router = Router();

router.use('/users', authenticate);

router.get('/users', authorize('owner', 'manager'), validate(listUsersSchema), usersController.listUsers);
router.get('/users/:id', authorize('owner', 'manager'), validate(userIdParamSchema), usersController.getUserById);
router.post('/users', authorize('owner', 'manager'), validate(createUserSchema), usersController.createUser);
router.put('/users/:id', authorize('owner', 'manager'), validate(updateUserSchema), usersController.updateUser);
router.patch('/users/:id/status', authorize('owner', 'manager'), validate(updateUserStatusSchema), usersController.updateUserStatus);
router.patch('/users/:id/reset-password', authorize('owner', 'manager'), validate(adminResetPasswordSchema), usersController.adminResetPassword);
router.delete('/users/:id', authorize('owner'), validate(userIdParamSchema), usersController.deleteUser);

export default router;
