import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getExecutor } from '../../config/db.config';

interface SettingsRow extends RowDataPacket {
  id: number;
  shop_name: string;
  phone: string | null;
  address: string | null;
  exchange_rate: string | number;
  receipt_footer: string | null;
  updated_at: Date;
}

export interface SettingsRecord {
  id: number;
  shopName: string;
  phone: string | null;
  address: string | null;
  exchangeRate: number;
  receiptFooter: string | null;
  updatedAt: Date;
}

export interface CreateSettingsInput {
  shopName: string;
  phone: string | null;
  address: string | null;
  exchangeRate: number;
  receiptFooter: string | null;
}

export interface UpdateSettingsFields {
  shopName?: string;
  phone?: string | null;
  address?: string | null;
  exchangeRate?: number;
  receiptFooter?: string | null;
}

const SETTINGS_SELECT_COLUMNS = `
  id,
  shop_name,
  phone,
  address,
  exchange_rate,
  receipt_footer,
  updated_at
`;

const mapSettingsRow = (row: SettingsRow): SettingsRecord => ({
  id: Number(row.id),
  shopName: row.shop_name,
  phone: row.phone,
  address: row.address,
  exchangeRate: Number(row.exchange_rate),
  receiptFooter: row.receipt_footer,
  updatedAt: row.updated_at,
});

export const findSettings = async (connection: PoolConnection | null = null): Promise<SettingsRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<SettingsRow[]>(
    `SELECT ${SETTINGS_SELECT_COLUMNS}
     FROM settings
     ORDER BY id ASC
     LIMIT 1`,
  );

  return rows[0] ? mapSettingsRow(rows[0]) : null;
};

export const findSettingsForUpdate = async (connection: PoolConnection): Promise<SettingsRecord | null> => {
  const [rows] = await connection.query<SettingsRow[]>(
    `SELECT ${SETTINGS_SELECT_COLUMNS}
     FROM settings
     ORDER BY id ASC
     LIMIT 1
     FOR UPDATE`,
  );

  return rows[0] ? mapSettingsRow(rows[0]) : null;
};

export const findSettingsById = async (id: number, connection: PoolConnection | null = null): Promise<SettingsRecord | null> => {
  const db = getExecutor(connection);
  const [rows] = await db.query<SettingsRow[]>(
    `SELECT ${SETTINGS_SELECT_COLUMNS}
     FROM settings
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapSettingsRow(rows[0]) : null;
};

export const createSettings = async (input: CreateSettingsInput, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO settings (shop_name, phone, address, exchange_rate, receipt_footer)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.shopName,
      input.phone,
      input.address,
      input.exchangeRate,
      input.receiptFooter,
    ],
  );

  return Number(result.insertId);
};

export const updateSettingsById = async (id: number, fields: UpdateSettingsFields, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const updates: string[] = [];
  const params: Array<string | number | null> = [];

  if (fields.shopName !== undefined) {
    updates.push('shop_name = ?');
    params.push(fields.shopName);
  }

  if (fields.phone !== undefined) {
    updates.push('phone = ?');
    params.push(fields.phone);
  }

  if (fields.address !== undefined) {
    updates.push('address = ?');
    params.push(fields.address);
  }

  if (fields.exchangeRate !== undefined) {
    updates.push('exchange_rate = ?');
    params.push(fields.exchangeRate);
  }

  if (fields.receiptFooter !== undefined) {
    updates.push('receipt_footer = ?');
    params.push(fields.receiptFooter);
  }

  if (updates.length === 0) {
    return 0;
  }

  params.push(id);

  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE settings
     SET ${updates.join(', ')}
     WHERE id = ?`,
    params,
  );

  return result.affectedRows;
};

export const updateExchangeRateById = async (id: number, exchangeRate: number, connection: PoolConnection | null = null): Promise<number> => {
  const db = getExecutor(connection);
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE settings
     SET exchange_rate = ?
     WHERE id = ?`,
    [exchangeRate, id],
  );

  return result.affectedRows;
};

export const settingsModel = {
  findSettings,
  findSettingsForUpdate,
  findSettingsById,
  createSettings,
  updateSettingsById,
  updateExchangeRateById,
};

export default settingsModel;
