import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import env from '../config/env.config';
import ApiError from '../utils/api-error';
import logger from '../utils/logger.util';

export type UploadSubfolder = 'products' | 'payments' | 'general';

export interface ProcessImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const ALLOWED_IMAGE_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_FILE_SIZE_BYTES = env.upload.maxFileSizeMb * 1024 * 1024;
const UPLOADS_ROOT = path.resolve(process.cwd(), env.upload.dir);

const multerInstance = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      callback(
        ApiError.badRequest(
          'Unsupported file type. Only JPEG, PNG, WEBP, and GIF images are allowed',
        ),
      );
      return;
    }
    callback(null, true);
  },
});

export const uploadSingleImage = (fieldName = 'image'): RequestHandler => {
  return multerInstance.single(fieldName);
};

export const processUploadedImage = (subfolder: UploadSubfolder = 'general', options: ProcessImageOptions = {}): RequestHandler => {
  const maxWidth = options.maxWidth ?? 1200;
  const maxHeight = options.maxHeight ?? 1200;
  const quality = options.quality ?? 82;

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      next();
      return;
    }

    try {
      const targetDir = path.join(UPLOADS_ROOT, subfolder);
      await fs.mkdir(targetDir, { recursive: true });

      const fileName = `${Date.now()}-${crypto.randomUUID()}.webp`;
      const absolutePath = path.join(targetDir, fileName);

      const outputInfo = await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: maxWidth,
          height: maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality })
        .toFile(absolutePath);

      req.file.filename = fileName;
      req.file.destination = targetDir;
      req.file.path = path.posix.join(env.upload.dir, subfolder, fileName);
      req.file.mimetype = 'image/webp';
      req.file.size = outputInfo.size;

      next();
    } catch (error: unknown) {
      logger.warn('Failed to process uploaded image with sharp', error);
      next(ApiError.badRequest('Invalid or corrupted image file'));
    }
  };
};

export const uploadImage = (fieldName = 'image', subfolder: UploadSubfolder = 'general', options: ProcessImageOptions = {}): RequestHandler[] => {
  return [uploadSingleImage(fieldName), processUploadedImage(subfolder, options)];
};

export const deleteUploadedFile = async (relativePath: string | null | undefined): Promise<void> => {
  if (!relativePath) {
    return;
  }

  const normalized = relativePath.replace(/^[/\\]+/, '');
  const resolvedPath = path.resolve(process.cwd(), normalized);
  const relativeToRoot = path.relative(UPLOADS_ROOT, resolvedPath);

  if (
    !relativeToRoot ||
    relativeToRoot.startsWith('..') ||
    path.isAbsolute(relativeToRoot)
  ) {
    logger.warn('Blocked attempt to delete file outside uploads directory', { relativePath });
    return;
  }

  try {
    await fs.unlink(resolvedPath);
  } catch (error: unknown) {
    const isNotFound =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT';

    if (!isNotFound) {
      logger.warn('Failed to delete uploaded file', { relativePath, error });
    }
  }
};

export default uploadImage;
