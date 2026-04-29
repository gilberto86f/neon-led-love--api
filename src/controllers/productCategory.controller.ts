import { Request, Response, NextFunction } from "express";
import { productCategoryService } from "../services/productCategory.service";
import { ok } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";

const parseId = (raw: string | string[]): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
};

export const productCategoryController = {
  add: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const categoryId = parseId(req.params.categoryId);
      const product = await productCategoryService.addCategory(productId, categoryId);
      res.status(200).json(ok(product));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const categoryId = parseId(req.params.categoryId);
      const product = await productCategoryService.removeCategory(productId, categoryId);
      res.status(200).json(ok(product));
    } catch (err) {
      next(err);
    }
  },
};
