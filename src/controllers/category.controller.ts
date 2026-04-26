import { Request, Response, NextFunction } from "express";
import { categoryService } from "../services/category.service";
import { ok, okList } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";

const parseId = (raw: string | string[]): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
};

export const categoryController = {
  list: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await categoryService.getCategories();
      res.status(200).json(okList(categories));
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
