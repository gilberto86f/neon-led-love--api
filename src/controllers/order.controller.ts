import { Request, Response, NextFunction } from "express";
import { orderService, ORDER_STATUS_VALUES, OrderStatus } from "../services/order.service";
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
        const raw = Number(req.query.status);
        if (!ORDER_STATUS_VALUES.includes(raw)) {
          throw new HttpError(
            400,
            `Invalid status (must be one of: ${ORDER_STATUS_VALUES.join(", ")})`,
          );
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
      if (!req.auth || !canAccessOrder(req.auth, order.userId as number)) {
        throw new HttpError(403, FORBIDDEN_MESSAGE);
      }
      res.status(200).json(ok(order));
    } catch (err) {
      next(err);
    }
  },

  // GET /orders/:id/status-history — same ownership rule as reading the order.
  statusHistory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      const { ownerUserId, orderStatusHistory } = await orderService.getStatusHistory(id);
      if (!req.auth || !canAccessOrder(req.auth, ownerUserId)) {
        throw new HttpError(403, FORBIDDEN_MESSAGE);
      }
      res.status(200).json(okList(orderStatusHistory));
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

  // PATCH /orders/:id/status — the only way `status` ever changes. The actor is
  // taken from the verified token, never from the request body.
  updateStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      if (!req.auth) throw new HttpError(403, FORBIDDEN_MESSAGE);
      const order = await orderService.updateStatus(id, req.body, req.auth.sub);
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
