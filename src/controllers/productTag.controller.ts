import { Request, Response, NextFunction } from "express";
import { productTagService } from "../services/productTag.service";
import { ok, okList } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";

const parseId = (raw: string | string[]): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
};

export const productTagController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const tags = await productTagService.list(productId);
      res.status(200).json(okList(tags));
    } catch (err) {
      next(err);
    }
  },

  add: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const tagId = parseId(req.params.tagId);
      const product = await productTagService.addTag(productId, tagId);
      res.status(200).json(ok(product));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const tagId = parseId(req.params.tagId);
      const product = await productTagService.removeTag(productId, tagId);
      res.status(200).json(ok(product));
    } catch (err) {
      next(err);
    }
  },
};
