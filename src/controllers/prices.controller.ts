import { Request, Response, NextFunction } from "express";
import { pricesService } from "../services/prices.service";
import { ok } from "../utils/apiResponse";

export const pricesController = {
  getCustom: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const prices = await pricesService.getCustomPrices();
      res.status(200).json(ok(prices));
    } catch (err) {
      next(err);
    }
  },

  updateCustom: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const prices = await pricesService.updateCustomPrices(req.body);
      res.status(200).json(ok(prices));
    } catch (err) {
      next(err);
    }
  },
};
