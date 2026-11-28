import path from 'node:path';
import type { Server } from 'node:http';
import cors from 'cors';
import express from 'express';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import { closeDB, connectDB } from './config/db.config';
import env from './config/env.config';
import errorHandler from './middlewares/error-handler';
import notFound from './middlewares/not-found';
import { apiRateLimiter } from './middlewares/rate-limiter';
import logger from './utils/logger.util';

// Feature Routes
import auditLogsRoutes from './modules/audit-logs/audit-logs.route';
import authRoutes from './modules/auth/auth.route';
import categoriesRoutes from './modules/categories/categories.route';
import customersRoutes from './modules/customers/customers.route';
import paymentsRoutes from './modules/payments/payments.route';
import productsRoutes from './modules/products/products.route';
import purchasesRoutes from './modules/purchases/purchases.route';
import salesRoutes from './modules/sales/sales.route';
import settingsRoutes from './modules/settings/settings.route';
import suppliersRoutes from './modules/suppliers/suppliers.route';
import usersRoutes from './modules/users/users.route';

export const app = express();

// Trust first proxy (for accurate client IP & rate limiting behind reverse proxies)
app.set('trust proxy', 1);

// Core Security & Parsing Middlewares
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
);
app.use(
    cors({
        origin: env.cors.origin,
        credentials: env.cors.origin !== '*',
    }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Uploaded Assets
app.use('/uploads', express.static(path.resolve(process.cwd(), env.upload.dir)));

// Health Check Endpoint (registered before rate limiter so health probes never hit 429)
app.get('/api/health', (_req: Request, res: Response): void => {
    res.status(200).json({
        success: true,
        message: 'Retail POS API is running',
        data: {
            status: 'ok',
            environment: env.nodeEnv,
            timestamp: new Date().toISOString(),
        },
    });
});

// Global API Rate Limiter
app.use('/api', apiRateLimiter);

// Register Feature Endpoints
app.use('/api/auth', authRoutes);
app.use('/api', auditLogsRoutes);
app.use('/api', settingsRoutes);
app.use('/api', usersRoutes);
app.use('/api', categoriesRoutes);
app.use('/api', suppliersRoutes);
app.use('/api', customersRoutes);
app.use('/api', paymentsRoutes);
app.use('/api', productsRoutes);
app.use('/api', purchasesRoutes);
app.use('/api', salesRoutes);

// 404 & Global Error Handlers
app.use(notFound);
app.use(errorHandler);

let server: Server | null = null;
let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;

    logger.info(`Received ${signal}. Shutting down gracefully...`);

    if (server) {
        await new Promise<void>((resolve) => {
            server?.close(() => resolve());
        });
    }

    try {
        await closeDB();
    } catch (error: unknown) {
        logger.error('Error closing MySQL pool during shutdown', error);
    }

    process.exit(0);
};

export const startServer = async (): Promise<void> => {
    try {
        await connectDB();

        server = app.listen(env.port, () => {
            logger.info(`Server is running at http://localhost:${env.port} (${env.nodeEnv})`);
        });

        process.once('SIGINT', () => {
            void shutdown('SIGINT');
        });
        process.once('SIGTERM', () => {
            void shutdown('SIGTERM');
        });
    } catch (error: unknown) {
        logger.error('Failed to start server', error);
        process.exit(1);
    }
};

if (env.nodeEnv !== 'test') {
    void startServer();
}

export default app;
