import type { NextFunction, Request, Response } from 'express';
import ApiError from '../../utils/api-error';
import settingsService from './settings.service';
import type {
  RequestMetadata,
  UpdateExchangeRateInput,
  UpdateSettingsInput,
} from './settings.service';

const getRequestMeta = (req: Request): RequestMetadata => ({
  ipAddress: req.ip || req.socket?.remoteAddress || null,
  userAgent: req.get('user-agent') || null,
});

export const getSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await settingsService.getSettings();

    res.status(200).json({
      success: true,
      message: 'Shop settings retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const payload = req.body as UpdateSettingsInput;
    const data = await settingsService.updateSettings(req.user.id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Shop settings updated successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const updateExchangeRate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication is required');
    }

    const payload = req.body as UpdateExchangeRateInput;
    const data = await settingsService.updateExchangeRate(req.user.id, payload, getRequestMeta(req));

    res.status(200).json({
      success: true,
      message: 'Exchange rate updated successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const settingsController = {
  getSettings,
  updateSettings,
  updateExchangeRate,
};

export default settingsController;
