import pool from '../../config/db.config';
import ApiError from '../../utils/api-error';
import auditLogsModel from '../audit-logs/audit-logs.model';
import settingsModel from './settings.model';
import type { SettingsRecord, UpdateSettingsFields } from './settings.model';

const DEFAULT_EXCHANGE_RATE = 4100;
const DEFAULT_RECEIPT_FOOTER = 'Thank you! Please come again.';

export interface RequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface UpdateSettingsInput {
  shopName?: string;
  phone?: string | null;
  address?: string | null;
  exchangeRate?: number;
  receiptFooter?: string | null;
}

export interface UpdateExchangeRateInput {
  exchangeRate: number;
}

const normalizeNullableString = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value.trim() === '') {
    return null;
  }
  return value.trim();
};

const toAuditSnapshot = (settings: SettingsRecord): Record<string, unknown> => ({
  shopName: settings.shopName,
  phone: settings.phone,
  address: settings.address,
  exchangeRate: settings.exchangeRate,
  receiptFooter: settings.receiptFooter,
});

export const getSettings = async (): Promise<SettingsRecord> => {
  const settings = await settingsModel.findSettings();
  if (!settings) {
    throw ApiError.notFound('Shop settings have not been configured yet');
  }

  return settings;
};

export const updateSettings = async (userId: number, input: UpdateSettingsInput, meta: RequestMetadata): Promise<SettingsRecord> => {
  const normalizedShopName = input.shopName !== undefined ? input.shopName.trim() : undefined;
  const normalizedPhone = normalizeNullableString(input.phone);
  const normalizedAddress = normalizeNullableString(input.address);
  const normalizedReceiptFooter = normalizeNullableString(input.receiptFooter);

  if (normalizedShopName !== undefined && normalizedShopName.length === 0) {
    throw ApiError.badRequest('Shop name cannot be empty');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await settingsModel.findSettingsForUpdate(connection);

    if (!existing) {
      if (!normalizedShopName) {
        throw ApiError.badRequest('Shop name is required when initializing shop settings');
      }

      const newId = await settingsModel.createSettings(
        {
          shopName: normalizedShopName,
          phone: normalizedPhone ?? null,
          address: normalizedAddress ?? null,
          exchangeRate: input.exchangeRate ?? DEFAULT_EXCHANGE_RATE,
          receiptFooter:
            normalizedReceiptFooter !== undefined
              ? normalizedReceiptFooter
              : DEFAULT_RECEIPT_FOOTER,
        },
        connection,
      );

      const created = await settingsModel.findSettingsById(newId, connection);
      if (!created) {
        throw ApiError.internal('Failed to retrieve created shop settings');
      }

      await auditLogsModel.createAuditLog(
        {
          userId,
          action: 'CREATE_SETTINGS',
          tableName: 'settings',
          recordId: created.id,
          oldValues: null,
          newValues: toAuditSnapshot(created),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        connection,
      );

      await connection.commit();
      return created;
    }

    const fieldsToUpdate: UpdateSettingsFields = {};

    if (normalizedShopName !== undefined && normalizedShopName !== existing.shopName) {
      fieldsToUpdate.shopName = normalizedShopName;
    }
    if (normalizedPhone !== undefined && normalizedPhone !== existing.phone) {
      fieldsToUpdate.phone = normalizedPhone;
    }
    if (normalizedAddress !== undefined && normalizedAddress !== existing.address) {
      fieldsToUpdate.address = normalizedAddress;
    }
    if (input.exchangeRate !== undefined && input.exchangeRate !== existing.exchangeRate) {
      fieldsToUpdate.exchangeRate = input.exchangeRate;
    }
    if (normalizedReceiptFooter !== undefined && normalizedReceiptFooter !== existing.receiptFooter) {
      fieldsToUpdate.receiptFooter = normalizedReceiptFooter;
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      await connection.commit();
      return existing;
    }

    await settingsModel.updateSettingsById(existing.id, fieldsToUpdate, connection);

    const updated = await settingsModel.findSettingsById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated shop settings');
    }

    await auditLogsModel.createAuditLog(
      {
        userId,
        action: 'UPDATE_SETTINGS',
        tableName: 'settings',
        recordId: updated.id,
        oldValues: toAuditSnapshot(existing),
        newValues: toAuditSnapshot(updated),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();
    return updated;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateExchangeRate = async (userId: number, input: UpdateExchangeRateInput, meta: RequestMetadata): Promise<SettingsRecord> => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const existing = await settingsModel.findSettingsForUpdate(connection);
    if (!existing) {
      throw ApiError.notFound('Shop settings have not been configured yet');
    }

    if (existing.exchangeRate === input.exchangeRate) {
      await connection.commit();
      return existing;
    }

    await settingsModel.updateExchangeRateById(existing.id, input.exchangeRate, connection);

    const updated = await settingsModel.findSettingsById(existing.id, connection);
    if (!updated) {
      throw ApiError.internal('Failed to retrieve updated shop settings');
    }

    await auditLogsModel.createAuditLog(
      {
        userId,
        action: 'UPDATE_EXCHANGE_RATE',
        tableName: 'settings',
        recordId: updated.id,
        oldValues: { exchangeRate: existing.exchangeRate },
        newValues: { exchangeRate: updated.exchangeRate },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      connection,
    );

    await connection.commit();
    return updated;
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const settingsService = {
  getSettings,
  updateSettings,
  updateExchangeRate,
};

export default settingsService;
