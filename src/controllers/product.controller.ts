import { Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';
import { ok, okList } from '../utils/apiResponse';
import { HttpError } from '../utils/HttpError';

const parseId = (raw: string | string[]): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid id');
  }
  return id;
};

const parsePagination = (query: Request['query']) => ({
  page: Math.max(1, parseInt(query.page as string) || 1),
  perPage: Math.min(100, Math.max(1, parseInt(query.perPage as string) || 20)),
});

export const productController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, perPage } = parsePagination(req.query);
      const search = req.query.search ? String(req.query.search).trim() : undefined;
      let categoryId: number | undefined;
      if (req.query.categoryId !== undefined) {
        categoryId = Number(req.query.categoryId);
        if (!Number.isInteger(categoryId) || categoryId <= 0) throw new HttpError(400, "Invalid categoryId");
      }
      const tagSlug = req.query.tagSlug ? String(req.query.tagSlug).trim() : undefined;
      let isActive: boolean | undefined;
      if (req.query.isActive === "true") isActive = true;
      else if (req.query.isActive === "false") isActive = false;
      const { results, total } = await productService.list({ page, perPage, search, categoryId, tagSlug, isActive });
      res.status(200).json(okList(results, { total, page, perPage }));
    } catch (err) {
      next(err);
    }
  },

  getBySlug: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productService.getBySlug(req.params.slug as string);
      res.status(200).json(ok(product));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await productService.create(req.body);
      res.status(201).json(ok(product, 201));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      const product = await productService.update(id, req.body);
      res.status(200).json(ok(product));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      await productService.remove(id);
      res.status(200).json(ok({ id, deleted: true }));
    } catch (err) {
      next(err);
    }
  },

  getRelated: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = req.params.productId !== undefined ? parseId(req.params.productId) : undefined;
      let limit: number | undefined;
      if (req.query.limit !== undefined) {
        limit = Number(req.query.limit);
        if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
          throw new HttpError(400, "Invalid limit (must be a positive integer ≤ 100)");
        }
      }
      const results = await productService.getRelatedProducts(productId, limit);
      res.status(200).json(okList(results));
    } catch (err) {
      next(err);
    }
  },
};
