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
      const { results, total } = await productService.list({ page, perPage });
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
};
