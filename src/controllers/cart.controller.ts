import { Request, Response, NextFunction } from "express";
import { cartService } from "../services/cart.service";
import { ok } from "../utils/apiResponse";

export const cartController = {
  validate: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await cartService.validateCart(req.body);
      res.status(200).json(ok(result));
    } catch (err) {
      next(err);
    }
  },
};
