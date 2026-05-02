import { Request, Response, NextFunction } from "express";
import { productVariantService } from "../services/productVariant.service";
import { ok, okList } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";

const parseId = (raw: string | string[]): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
};

export const productVariantController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const variants = await productVariantService.list(productId);
      res.status(200).json(okList(variants));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const variant = await productVariantService.create(productId, req.body);
      res.status(201).json(ok(variant, 201));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const variantId = parseId(req.params.variantId);
      const variant = await productVariantService.update(productId, variantId, req.body);
      res.status(200).json(ok(variant));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const variantId = parseId(req.params.variantId);
      await productVariantService.remove(productId, variantId);
      res.status(200).json(ok({ id: variantId, deleted: true }));
    } catch (err) {
      next(err);
    }
  },
};
