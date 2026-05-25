import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/HttpError";
import { authService, AccessTokenPayload } from "../services/auth.service";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

export const jwtAuthGuard = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new HttpError(401, "Missing or invalid Authorization header");
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) throw new HttpError(401, "Missing access token");
    req.auth = authService.verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new HttpError(401, "Unauthenticated"));
    if (!roles.includes(req.auth.role)) {
      return next(new HttpError(403, "Insufficient permissions"));
    }
    next();
  };
