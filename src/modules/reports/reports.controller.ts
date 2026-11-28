import type { NextFunction, Request, Response } from 'express';
import reportsService from './reports.service';
import type {
  DateRangeQuery,
  InventoryReportQuery,
  PurchasesSummaryQuery,
  SalesSummaryQuery,
  TopProductsQuery,
} from './reports.service';

export const getDashboardReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as DateRangeQuery;
    const data = await reportsService.getDashboardReport(query);

    res.status(200).json({
      success: true,
      message: 'Dashboard report retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getSalesSummaryReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as SalesSummaryQuery;
    const data = await reportsService.getSalesSummaryReport(query);

    res.status(200).json({
      success: true,
      message: 'Sales summary report retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getTopProductsReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as TopProductsQuery;
    const data = await reportsService.getTopProductsReport(query);

    res.status(200).json({
      success: true,
      message: 'Top products report retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getPaymentMethodsReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as DateRangeQuery;
    const data = await reportsService.getPaymentMethodsReport(query);

    res.status(200).json({
      success: true,
      message: 'Payment methods report retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getCashiersReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as DateRangeQuery;
    const data = await reportsService.getCashiersReport(query);

    res.status(200).json({
      success: true,
      message: 'Cashiers report retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getInventoryReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as InventoryReportQuery;
    const data = await reportsService.getInventoryReport(query);

    res.status(200).json({
      success: true,
      message: 'Inventory report retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const getPurchasesSummaryReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = req.query as unknown as PurchasesSummaryQuery;
    const data = await reportsService.getPurchasesSummaryReport(query);

    res.status(200).json({
      success: true,
      message: 'Purchases summary report retrieved successfully',
      data,
    });
  } catch (error: unknown) {
    next(error);
  }
};

export const reportsController = {
  getDashboardReport,
  getSalesSummaryReport,
  getTopProductsReport,
  getPaymentMethodsReport,
  getCashiersReport,
  getInventoryReport,
  getPurchasesSummaryReport,
};

export default reportsController;
