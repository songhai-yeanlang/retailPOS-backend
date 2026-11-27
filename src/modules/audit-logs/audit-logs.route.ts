import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import auditLogsController from './audit-logs.controller';
import {
    auditLogIdParamSchema,
    listAuditLogsSchema,
} from './audit-logs.validation';

const router = Router();

router.use('/audit-logs', authenticate);

router.get('/audit-logs', authorize('owner', 'manager'), validate(listAuditLogsSchema), auditLogsController.listAuditLogs);
router.get('/audit-logs/:id', authorize('owner', 'manager'), validate(auditLogIdParamSchema), auditLogsController.getAuditLogById);
router.delete('/audit-logs', authorize('owner'), auditLogsController.deleteAllAuditLogs);
router.delete('/audit-logs/:id', authorize('owner'), validate(auditLogIdParamSchema), auditLogsController.deleteAuditLogById);

export default router;
