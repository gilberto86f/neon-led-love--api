import { Request, Response, NextFunction } from "express";
import {
  quoteService,
  QUOTE_STATUS_VALUES,
  QUOTE_SORT_FIELDS,
  SORT_DIRECTIONS,
  QuoteSortField,
  SortDirection,
} from "../services/quote.service";
import { ok, okList } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";
import { isStaff, canAccessQuote } from "../utils/authorization";
import { FORBIDDEN_MESSAGE } from "../middlewares/authGuard";

const parseId = (raw: string | string[]): number => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid id");
  return id;
};

const parsePagination = (query: Request["query"]) => ({
  page: Math.max(1, parseInt(query.page as string) || 1),
  perPage: Math.min(100, Math.max(1, parseInt(query.perPage as string) || 20)),
});

export const quoteController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, perPage } = parsePagination(req.query);
      const search = req.query.search ? String(req.query.search).trim() : undefined;

      let status: number | undefined;
      if (req.query.status !== undefined) {
        const raw = Number(req.query.status);
        if (!QUOTE_STATUS_VALUES.includes(raw)) {
          throw new HttpError(
            400,
            `Invalid status (must be one of: ${QUOTE_STATUS_VALUES.join(", ")})`,
          );
        }
        status = raw;
      }

      let sortBy: QuoteSortField | undefined;
      if (req.query.sortBy !== undefined) {
        const raw = String(req.query.sortBy);
        if (!QUOTE_SORT_FIELDS.includes(raw as QuoteSortField)) {
          throw new HttpError(400, `Invalid sortBy (must be one of: ${QUOTE_SORT_FIELDS.join(", ")})`);
        }
        sortBy = raw as QuoteSortField;
      }

      let sortDirection: SortDirection | undefined;
      if (req.query.sortDirection !== undefined) {
        const raw = String(req.query.sortDirection);
        if (!SORT_DIRECTIONS.includes(raw as SortDirection)) {
          throw new HttpError(
            400,
            `Invalid sortDirection (must be one of: ${SORT_DIRECTIONS.join(", ")})`,
          );
        }
        sortDirection = raw as SortDirection;
      }

      // Staff (super/admin) see all quotes; a client is scoped to their own.
      // A staff caller may still narrow the list with the `clientId` filter.
      let clientId: number | undefined;
      if (req.auth && !isStaff(req.auth.role)) {
        clientId = req.auth.sub;
      } else if (req.query.clientId !== undefined) {
        clientId = Number(req.query.clientId);
        if (!Number.isInteger(clientId) || clientId <= 0) {
          throw new HttpError(400, "Invalid clientId");
        }
      }

      const { results, total } = await quoteService.getQuotes({
        page,
        perPage,
        search,
        status,
        clientId,
        sortBy,
        sortDirection,
      });
      res.status(200).json(okList(results, { total, page, perPage }));
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      const quote = await quoteService.getQuoteById(id);
      if (!req.auth || !canAccessQuote(req.auth, quote.clientId)) {
        throw new HttpError(403, FORBIDDEN_MESSAGE);
      }
      res.status(200).json(ok(quote));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quote = await quoteService.createQuote(req.body);
      res.status(201).json(ok(quote, 201));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      const quote = await quoteService.updateQuote(id, req.body);
      res.status(200).json(ok(quote));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      await quoteService.deleteQuote(id);
      res.status(200).json(ok({ id, deleted: true }));
    } catch (err) {
      next(err);
    }
  },
};
