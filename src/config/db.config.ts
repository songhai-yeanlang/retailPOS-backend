import mysql from 'mysql2/promise';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import env from './env.config';
import logger from '../utils/logger.util';

export const pool: Pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export type DbExecutor = Pool | PoolConnection;

export const getExecutor = (connection: PoolConnection | null = null): DbExecutor => {
  return connection ?? pool;
};

export const connectDB = async (): Promise<void> => {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
    logger.info(`MySQL connected to "${env.db.name}" at ${env.db.host}:${env.db.port}`);
  } finally {
    connection.release();
  }
};

export const closeDB = async (): Promise<void> => {
  await pool.end();
  logger.info('MySQL connection pool closed');
};

export type { Pool, PoolConnection, ResultSetHeader, RowDataPacket };

export default pool;
