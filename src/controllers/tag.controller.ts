import { Request, Response, NextFunction } from "express";
import { tagService } from "../services/tag.service";
import { ok, okList } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";

const parseId = (raw: string | string[]): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
};

export const tagController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const tags = await tagService.list(productId);
      res.status(200).json(okList(tags));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const tag = await tagService.create(productId, req.body);
      res.status(201).json(ok(tag, 201));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const tagId = parseId(req.params.tagId);
      const tag = await tagService.update(productId, tagId, req.body);
      res.status(200).json(ok(tag));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = parseId(req.params.productId);
      const tagId = parseId(req.params.tagId);
      await tagService.remove(productId, tagId);
      res.status(200).json(ok({ id: tagId, deleted: true }));
    } catch (err) {
      next(err);
    }
  },
};
