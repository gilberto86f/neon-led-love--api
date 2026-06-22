import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { ok } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";
import { AUTH_REQUIRED_MESSAGE } from "../middlewares/authGuard";

export const authController = {
  register: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, verificationToken } = await authService.register(req.body);
      res.status(201).json(ok({ user, verificationToken }, 201));
    } catch (err) {
      next(err);
    }
  },

  login: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body);
      res.status(200).json(ok(result));
    } catch (err) {
      next(err);
    }
  },

  refresh: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.refresh(req.body);
      res.status(200).json(ok(result));
    } catch (err) {
      next(err);
    }
  },

  logout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw new HttpError(401, AUTH_REQUIRED_MESSAGE);
      await authService.logout(req.auth.sub);
      res.status(200).json(ok({ loggedOut: true }));
    } catch (err) {
      next(err);
    }
  },

  verifyAccount: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.verifyAccount(req.body);
      res.status(200).json(ok(user));
    } catch (err) {
      next(err);
    }
  },

  me: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) throw new HttpError(401, AUTH_REQUIRED_MESSAGE);
      const user = await authService.getCurrentUser(req.auth.sub);
      res.status(200).json(ok(user));
    } catch (err) {
      next(err);
    }
  },
};
