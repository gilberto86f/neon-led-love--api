import { Request, Response, NextFunction } from "express";
import { productColorOptionService } from "../services/productColorOption.service";
import { ok, okList } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";

const parseId = (raw: string | string[]): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
};

export const productColorOptionController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const options = await productColorOptionService.list(productId);
      res.status(200).json(okList(options));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const option = await productColorOptionService.create(productId, req.body);
      res.status(201).json(ok(option, 201));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const optionId = parseId(req.params.optionId);
      const option = await productColorOptionService.update(productId, optionId, req.body);
      res.status(200).json(ok(option));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const optionId = parseId(req.params.optionId);
      await productColorOptionService.remove(productId, optionId);
      res.status(200).json(ok({ id: optionId, deleted: true }));
    } catch (err) {
      next(err);
    }
  },
};
