import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import categoriesController from './categories.controller';
import {
    categoryIdParamSchema,
    createCategorySchema,
    listCategoriesSchema,
    updateCategorySchema,
} from './categories.validation';

const router = Router();

router.use('/categories', authenticate);

router.get('/categories', authorize('owner', 'manager', 'cashier'), validate(listCategoriesSchema), categoriesController.listCategories);
router.get('/categories/:id', authorize('owner', 'manager', 'cashier'), validate(categoryIdParamSchema), categoriesController.getCategoryById);
router.post('/categories', authorize('owner', 'manager'), validate(createCategorySchema), categoriesController.createCategory);
router.put('/categories/:id', authorize('owner', 'manager'), validate(updateCategorySchema), categoriesController.updateCategory);
router.delete('/categories/:id', authorize('owner', 'manager'), validate(categoryIdParamSchema), categoriesController.deleteCategory);

export default router;
