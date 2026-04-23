import { Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';
import { ok, okList } from '../utils/apiResponse';
import { HttpError } from '../utils/HttpError';

const parseId = (raw: string): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'Invalid id');
  }
  return id;
};

export const productController = {
  list: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const products = await productService.list();
      res.status(200).json(okList(products));
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      const product = await productService.getById(id);
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
