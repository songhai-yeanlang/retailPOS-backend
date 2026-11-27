import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import settingsController from './settings.controller';
import {
    updateExchangeRateSchema,
    updateSettingsSchema,
} from './settings.validation';

const router = Router();

router.use(authenticate);

router.get('/settings', authorize('owner', 'manager', 'cashier'), settingsController.getSettings);
router.put('/settings', authorize('owner'), validate(updateSettingsSchema), settingsController.updateSettings);
router.patch('/settings/exchange-rate', authorize('owner', 'manager'), validate(updateExchangeRateSchema), settingsController.updateExchangeRate);

export default router;
