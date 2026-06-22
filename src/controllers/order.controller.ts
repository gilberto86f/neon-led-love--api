import { Request, Response, NextFunction } from "express";
import { orderService, ORDER_STATUSES, OrderStatus } from "../services/order.service";
import { ok, okList } from "../utils/apiResponse";
import { HttpError } from "../utils/HttpError";
import { isStaff, canAccessOrder } from "../utils/authorization";
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

export const orderController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, perPage } = parsePagination(req.query);
      const search = req.query.search ? String(req.query.search).trim() : undefined;

      let status: OrderStatus | undefined;
      if (req.query.status !== undefined) {
        const raw = String(req.query.status);
        if (!ORDER_STATUSES.includes(raw as OrderStatus)) {
          throw new HttpError(400, `Invalid status (must be one of: ${ORDER_STATUSES.join(", ")})`);
        }
        status = raw as OrderStatus;
      }

      // Staff (super/admin) see all orders; a client is scoped to their own.
      const userId = req.auth && !isStaff(req.auth.role) ? req.auth.sub : undefined;

      const { results, total } = await orderService.getOrders({
        page,
        perPage,
        search,
        status,
        userId,
      });
      res.status(200).json(okList(results, { total, page, perPage }));
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      const order = await orderService.getOrderById(id);
      if (!req.auth || !canAccessOrder(req.auth, order.userId)) {
        throw new HttpError(403, FORBIDDEN_MESSAGE);
      }
      res.status(200).json(ok(order));
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await orderService.createOrder(req.body);
      res.status(201).json(ok(order, 201));
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      const order = await orderService.updateOrder(id, req.body);
      res.status(200).json(ok(order));
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      await orderService.deleteOrder(id);
      res.status(200).json(ok({ id, deleted: true }));
    } catch (err) {
      next(err);
    }
  },
};
