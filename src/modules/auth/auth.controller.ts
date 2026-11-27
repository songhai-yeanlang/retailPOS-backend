import type { NextFunction, Request, Response } from 'express';
import ApiError from '../../utils/api-error';
import authService from './auth.service';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  LogoutInput,
  RefreshTokenInput,
  RequestMetadata,
  ResetPasswordInput,
} from './auth.service';

const getRequestMeta = (req: Request): RequestMetadata => ({
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get('user-agent') || null,
});

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as LoginInput;
    const data = await authService.login(payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as RefreshTokenInput;
    const data = await authService.refreshTokens(payload);

    res.status(200).json({
      success: true,
      message: 'Access token refreshed successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const payload = (req.body ?? {}) as LogoutInput;
    await authService.logout(req.user.id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      data: null,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const data = await authService.getMe(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Authenticated user retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const payload = req.body as ChangePasswordInput;
    await authService.changePassword(req.user.id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
      data: null,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as ForgotPasswordInput;
    await authService.forgotPassword(payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset email has been sent',
      data: null,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as ResetPasswordInput;
    await authService.resetPassword(payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
      data: null,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const authController = {
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
};

export default authController;
