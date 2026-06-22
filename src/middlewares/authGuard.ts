import { Request, Response, NextFunction } from "express";
import { HttpError } from "../utils/HttpError";
import { authService, AccessTokenPayload } from "../services/auth.service";
import { UserRole } from "../services/user.service";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
    }
  }
}

// Standard messages from the authorization spec — reused everywhere so the
// frontend can rely on consistent 401/403 copy.
export const AUTH_REQUIRED_MESSAGE = "Authentication required.";
export const FORBIDDEN_MESSAGE = "You do not have permission to perform this action.";

export const jwtAuthGuard = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new HttpError(401, AUTH_REQUIRED_MESSAGE);
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) throw new HttpError(401, AUTH_REQUIRED_MESSAGE);
    req.auth = authService.verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new HttpError(401, AUTH_REQUIRED_MESSAGE));
    if (!roles.includes(req.auth.role as UserRole)) {
      return next(new HttpError(403, FORBIDDEN_MESSAGE));
    }
    next();
  };

// Declarative, `@Roles(...)`-style guard. Express flattens the returned array,
// so a route can do: router.post("/", authorize("super", "admin"), ctrl.create)
export const authorize = (...roles: UserRole[]) => [jwtAuthGuard, requireRole(...roles)];
