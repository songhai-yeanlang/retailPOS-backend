import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authRateLimiter } from '../../middlewares/rate-limiter';
import { validate } from '../../middlewares/validate';
import authController from './auth.controller';
import {
    changePasswordSchema,
    forgotPasswordSchema,
    loginSchema,
    logoutSchema,
    refreshTokenSchema,
    resetPasswordSchema,
} from './auth.validation';

const router = Router();

router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authRateLimiter, validate(refreshTokenSchema), authController.refreshToken);
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), authController.resetPassword);

router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, validate(logoutSchema), authController.logout);
router.put('/change-password', authRateLimiter, authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;
