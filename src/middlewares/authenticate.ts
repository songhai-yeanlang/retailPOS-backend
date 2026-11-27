import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { RowDataPacket } from "mysql2/promise";
import pool from "../config/db.config";
import env from "../config/env.config";
import type { UserRole } from "../types/auth.types";
import ApiError from "../utils/api-error";

interface AuthUserRow extends RowDataPacket {
  id: number;
  full_name: string;
  username: string;
  email: string | null;
  role: UserRole;
  is_active: number;
}

const extractBearerToken = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer" || !parts[1]) {
    return null;
  }

  return parts[1];
};

const parseUserIdFromToken = (decoded: string | jwt.JwtPayload): number | null => {
  if (typeof decoded !== "object" || decoded === null) {
    return null;
  }

  if (
    "type" in decoded &&
    decoded.type !== undefined &&
    decoded.type !== "access"
  ) {
    return null;
  }

  const rawId = decoded.sub ?? ("id" in decoded ? decoded.id : undefined);
  const parsedId = typeof rawId === "number" ? rawId : Number(rawId);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return null;
  }

  return parsedId;
};

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw ApiError.unauthorized("Authentication token is required");
    }

    let decoded: string | jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, env.jwt.secret, { algorithms: ["HS256"] });
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthorized("Authentication token has expired");
      }
      throw ApiError.unauthorized("Invalid authentication token");
    }

    const userId = parseUserIdFromToken(decoded);
    if (!userId) {
      throw ApiError.unauthorized("Invalid token payload");
    }

    const [rows] = await pool.query<AuthUserRow[]>(
      "SELECT id, full_name, username, email, role, is_active FROM users WHERE id = ? LIMIT 1",
      [userId],
    );

    const user = rows[0];
    if (!user) {
      throw ApiError.unauthorized("User account no longer exists");
    }

    if (!Boolean(user.is_active)) {
      throw ApiError.forbidden("User account is deactivated");
    }

    req.user = {
      id: Number(user.id),
      fullName: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error: unknown) {
    next(error);
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized("Authentication is required"));
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      next(
        ApiError.forbidden("You do not have permission to perform this action"),
      );
      return;
    }

    next();
  };
};

export default authenticate;
