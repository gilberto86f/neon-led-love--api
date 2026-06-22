import { Request, Response, NextFunction } from "express";
import {
  userService,
  USER_ROLES,
  USER_STATUS,
  UserRole,
  UserStatus,
} from "../services/user.service";
import { ok, okList } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";
import { canViewUser, canManageUser } from "../utils/authorization";
import { FORBIDDEN_MESSAGE } from "../middlewares/authGuard";

const parseId = (raw: string | string[]): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
};

const parsePagination = (query: Request["query"]) => ({
  page: Math.max(1, parseInt(query.page as string) || 1),
  perPage: Math.min(100, Math.max(1, parseInt(query.perPage as string) || 20)),
});

export const userController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, perPage } = parsePagination(req.query);
      const search = req.query.search ? String(req.query.search).trim() : undefined;

      let role: UserRole | undefined;
      if (req.query.role !== undefined) {
        const raw = String(req.query.role);
        if (!USER_ROLES.includes(raw as UserRole)) {
          throw new HttpError(400, `Invalid role (must be one of: ${USER_ROLES.join(", ")})`);
        }
        role = raw as UserRole;
      }

      let status: UserStatus | undefined;
      if (req.query.status !== undefined) {
        const raw = Number(req.query.status);
        if (!USER_STATUS.includes(raw as UserStatus)) {
          throw new HttpError(400, `Invalid status (must be one of: ${USER_STATUS.join(", ")})`);
        }
        status = raw as UserStatus;
      }

      let isGuest: boolean | undefined;
      if (req.query.isGuest !== undefined) {
        const raw = String(req.query.isGuest);
        if (raw !== "true" && raw !== "false") {
          throw new HttpError(400, `Invalid isGuest (must be "true" or "false")`);
        }
        isGuest = raw === "true";
      }

      const { results, total } = await userService.getUsers({
        page,
        perPage,
        search,
        role,
        status,
        isGuest,
      });
      res.status(200).json(okList(results, { total, page, perPage }));
    } catch (err) {
      next(err);
    }
  },

  checkEmail: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const email = req.query.email !== undefined ? String(req.query.email) : "";
      const result = await userService.checkEmail(email);
      res.status(200).json(ok(result));
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (!req.auth || !canViewUser(req.auth, id)) {
        throw new HttpError(403, FORBIDDEN_MESSAGE);
      }
      const user = await userService.getUserById(id);
      res.status(200).json(ok(user));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.createUser(req.body);
      res.status(201).json(ok(user, 201));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (!req.auth || !canManageUser(req.auth, id)) {
        throw new HttpError(403, FORBIDDEN_MESSAGE);
      }
      // A non-super actor may only update their own account, and must not be
      // able to escalate privileges or reactivate/deactivate via a self-update.
      // Pin role/status to the persisted values regardless of what the body sends.
      if (req.auth.role !== "super") {
        const current = await userService.getUserById(id);
        req.body = { ...req.body, role: current.role, status: current.status };
      }
      const user = await userService.updateUser(id, req.body);
      res.status(200).json(ok(user));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (!req.auth || !canManageUser(req.auth, id)) {
        throw new HttpError(403, FORBIDDEN_MESSAGE);
      }
      await userService.deleteUser(id);
      res.status(200).json(ok({ id, deleted: true }));
    } catch (err) {
      next(err);
    }
  },
};
