import { Request, Response, NextFunction } from "express";
import { slideService } from "../services/slide.service";
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

const isPositiveInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

export const slideController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, perPage } = parsePagination(req.query);
      let isActive: boolean | undefined;
      if (req.query.isActive === "true") isActive = true;
      else if (req.query.isActive === "false") isActive = false;
      const { results, total } = await slideService.getSlides({ page, perPage, isActive });
      res.status(200).json(okList(results, { total, page, perPage }));
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      const slide = await slideService.getSlideById(id);
      res.status(200).json(ok(slide));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slide = await slideService.createSlide(req.body);
      res.status(201).json(ok(slide, 201));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      const slide = await slideService.updateSlide(id, req.body);
      res.status(200).json(ok(slide));
    } catch (err) {
      next(err);
    }
  },

  reorder: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slideId, newPosition } = req.body;
      if (!isPositiveInt(slideId)) {
        throw new HttpError(400, '"slideId" must be a positive integer');
      }
      if (!isPositiveInt(newPosition)) {
        throw new HttpError(400, '"newPosition" must be a positive integer');
      }
      const slide = await slideService.reorderSlide(slideId, newPosition);
      res.status(200).json(ok(slide));
    } catch (err) {
      next(err);
    }
  },
};
