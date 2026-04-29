import { Request, Response, NextFunction } from "express";
import { categoryService } from "../services/category.service";
import { ok, okList } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";

const parseId = (raw: string | string[]): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
};

const parsePagination = (query: Request["query"]) => ({
  page: Math.max(1, parseInt(query.page as string) || 1),
  perPage: Math.min(100, Math.max(1, parseInt(query.perPage as string) || 20)),
});

export const categoryController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, perPage } = parsePagination(req.query);
      let productId: number | undefined;
      if (req.query.productId !== undefined) {
        productId = Number(req.query.productId);
        if (!Number.isInteger(productId) || productId <= 0) throw new HttpError(400, "Invalid productId");
      }
      const { results, total } = await categoryService.getCategories({ page, perPage, productId });
      res.status(200).json(okList(results, { total, page, perPage }));
    } catch (err) {
      next(err);
    }
  },

  getBySlug: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await categoryService.getCategoryBySlug(req.params.slug as string);
      res.status(200).json(ok(category));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await categoryService.createCategory(req.body);
      res.status(201).json(ok(category, 201));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      const category = await categoryService.updateCategory(id, req.body);
      res.status(200).json(ok(category));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      await categoryService.deleteCategory(id);
      res.status(200).json(ok({ id, deleted: true }));
    } catch (err) {
      next(err);
    }
  },
};
