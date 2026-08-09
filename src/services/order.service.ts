import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";
import { PUBLIC_USER_SELECT } from "./user.service";

/**
 * Lifecycle of an order. Numeric enum shared with the frontend: the API stores
 * and returns the number, not the name. New orders always start at
 * PENDING_PAYMENT — the client never chooses the initial status.
 */
export enum OrderStatus {
  PENDING_PAYMENT = 0,
  PAID = 1,
  PAYMENT_FAILED = 2,
  PENDING_PRODUCTION = 3,
  IN_PRODUCTION = 4,
  QUALITY_CHECK = 5,
  READY_TO_SHIP = 6,
  SHIPPED = 7,
  DELIVERED = 8,
  CANCELLED = 9,
  REFUNDED = 10,
}

// Valid numeric status values (0..10), derived from the enum so the two can't drift.
export const ORDER_STATUS_VALUES = Object.values(OrderStatus).filter(
  (v): v is number => typeof v === "number",
);

/**
 * The single source of truth for which status transitions are legal. Every
 * status change in the application goes through `applyStatusChange`, which
 * consults this table — no controller, route, or ad-hoc Prisma call may bypass
 * it. Terminal states map to an empty list.
 *
 * Normal path: PENDING_PAYMENT → PAID → PENDING_PRODUCTION → IN_PRODUCTION →
 * QUALITY_CHECK → READY_TO_SHIP → SHIPPED → DELIVERED.
 *
 * Exceptional paths: CANCELLED is reachable only while the order has not left
 * the building (anything before SHIPPED); REFUNDED only from states where the
 * customer has actually paid.
 */
export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING_PAYMENT]: [
    OrderStatus.PAID,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [
    OrderStatus.PENDING_PRODUCTION,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],
  // A failed charge can be retried: the order goes back to awaiting payment.
  [OrderStatus.PAYMENT_FAILED]: [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED],
  [OrderStatus.PENDING_PRODUCTION]: [
    OrderStatus.IN_PRODUCTION,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.IN_PRODUCTION]: [
    OrderStatus.QUALITY_CHECK,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],
  // Failing QC sends the sign back to the workshop.
  [OrderStatus.QUALITY_CHECK]: [
    OrderStatus.READY_TO_SHIP,
    OrderStatus.IN_PRODUCTION,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.READY_TO_SHIP]: [
    OrderStatus.SHIPPED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],
  // Once it is with the carrier it can no longer be cancelled — only refunded.
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

/**
 * Statuses that mean money has changed hands. An order that ever reached one of
 * these is a financial record and can no longer be deleted (see `deleteOrder`).
 */
const SETTLED_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PENDING_PRODUCTION,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.QUALITY_CHECK,
  OrderStatus.READY_TO_SHIP,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.REFUNDED,
];

/** Past this point the parcel is packed/labelled — the address is frozen. */
const ADDRESS_LOCKED_FROM = OrderStatus.READY_TO_SHIP;

// ── Actors ──────────────────────────────────────────────────────────────────
// `changedByUser` holds either a user id (as text) or one of these non-user
// actors. The API converts a numeric-looking value back to a number on the way
// out, so the frontend sees `User['id'] | 'system' | 'Stripe Webhook'`.

/** The application itself — order creation, scheduled jobs, migrations. */
export const CHANGED_BY_SYSTEM = "system";
/** A verified Stripe webhook. The frontend is never the authority on payment. */
export const CHANGED_BY_STRIPE_WEBHOOK = "Stripe Webhook";

export interface OrderItemInput {
  productId: number;
  productName: string;
  productSlug: string;
  productImageUrl?: string | null;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
}

export interface ShippingAddressInput {
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  fullName: string;
  phoneNumber: string;
}

/** Payload accepted by POST /orders. `status` is deliberately absent. */
export interface OrderInput {
  userId: number;
  currency: string;
  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  items: OrderItemInput[];
  shippingAddress?: ShippingAddressInput | null;
  paymentId?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
}

/**
 * Payload accepted by PUT /orders/:id — only the fields that stay editable
 * after an order exists. Everything omitted is left untouched.
 */
export interface OrderUpdateInput {
  shippingAddress?: ShippingAddressInput | null;
  trackingNumber?: string | null;
  notes?: string | null;
}

/** Payload accepted by PATCH /orders/:id/status. */
export interface OrderStatusChangeInput {
  status: number;
  comment?: string | null;
}

const AMOUNT_EPSILON = 0.01;

const SHIPPING_FIELDS: (keyof ShippingAddressInput)[] = [
  "address",
  "city",
  "state",
  "postalCode",
  "country",
  "fullName",
  "phoneNumber",
];

/**
 * Fields a client may never write after creation. `status` is here too: it
 * changes only through PATCH /orders/:id/status, which records the transition.
 */
const IMMUTABLE_UPDATE_FIELDS = [
  "userId",
  "currency",
  "subtotalAmount",
  "shippingAmount",
  "taxAmount",
  "totalAmount",
  "items",
  "paymentId",
  "status",
  "orderStatusHistory",
  "statusHistory",
] as const;

type Rec = Record<string, any>;

const requireNonNegativeNumber = (input: Rec, field: string) => {
  const value = input[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new HttpError(400, `Field must be a non-negative number: "${field}"`);
  }
};

const requireString = (input: Rec, field: string) => {
  const value = input[field];
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `Field is required: "${field}"`);
  }
};

const optionalString = (input: Rec, field: string) => {
  const value = input[field];
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new HttpError(400, `Field must be a string: "${field}"`);
  }
};

const validateShippingAddress = (addr: ShippingAddressInput) => {
  if (typeof addr !== "object" || addr === null || Array.isArray(addr)) {
    throw new HttpError(400, `Field "shippingAddress" must be an object`);
  }
  for (const key of SHIPPING_FIELDS) {
    const v = addr[key];
    if (typeof v !== "string" || !v.trim()) {
      throw new HttpError(
        400,
        `Field "shippingAddress.${key}" is required and must be a non-empty string`,
      );
    }
  }
};

const validateItem = (item: OrderItemInput, index: number) => {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    throw new HttpError(400, `items[${index}] must be an object`);
  }
  if (!Number.isInteger(item.productId) || item.productId <= 0) {
    throw new HttpError(400, `items[${index}].productId must be a positive integer`);
  }
  if (typeof item.productName !== "string" || !item.productName.trim()) {
    throw new HttpError(400, `items[${index}].productName is required`);
  }
  if (typeof item.productSlug !== "string" || !item.productSlug.trim()) {
    throw new HttpError(400, `items[${index}].productSlug is required`);
  }
  if (
    item.productImageUrl !== undefined &&
    item.productImageUrl !== null &&
    typeof item.productImageUrl !== "string"
  ) {
    throw new HttpError(400, `items[${index}].productImageUrl must be a string when provided`);
  }
  if (typeof item.unitPrice !== "number" || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
    throw new HttpError(400, `items[${index}].unitPrice must be a non-negative number`);
  }
  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    throw new HttpError(400, `items[${index}].quantity must be a positive integer`);
  }
  if (
    typeof item.totalAmount !== "number" ||
    !Number.isFinite(item.totalAmount) ||
    item.totalAmount < 0
  ) {
    throw new HttpError(400, `items[${index}].totalAmount must be a non-negative number`);
  }
  const expected = item.unitPrice * item.quantity;
  if (Math.abs(item.totalAmount - expected) > AMOUNT_EPSILON) {
    throw new HttpError(
      400,
      `items[${index}].totalAmount (${item.totalAmount}) must equal unitPrice * quantity (${expected})`,
    );
  }
};

/** Validates the create payload. The initial status is the server's business. */
const validateCreate = (input: Rec) => {
  if (input.status !== undefined) {
    throw new HttpError(
      400,
      `Field "status" is set by the server: a new order always starts at ` +
        `${OrderStatus.PENDING_PAYMENT} (PENDING_PAYMENT). Use PATCH /api/orders/{id}/status to move it.`,
    );
  }
  if (input.orderStatusHistory !== undefined || input.statusHistory !== undefined) {
    throw new HttpError(
      400,
      `Field "orderStatusHistory" is read-only: the server writes it on every status change.`,
    );
  }

  if (!Number.isInteger(input.userId) || (input.userId as number) <= 0) {
    throw new HttpError(400, `Field "userId" must be a positive integer`);
  }

  requireString(input, "currency");

  requireNonNegativeNumber(input, "subtotalAmount");
  requireNonNegativeNumber(input, "shippingAmount");
  requireNonNegativeNumber(input, "taxAmount");
  requireNonNegativeNumber(input, "totalAmount");

  const expectedTotal =
    (input.subtotalAmount as number) +
    (input.shippingAmount as number) +
    (input.taxAmount as number);
  if (Math.abs((input.totalAmount as number) - expectedTotal) > AMOUNT_EPSILON) {
    throw new HttpError(
      400,
      `totalAmount (${input.totalAmount}) must equal subtotalAmount + shippingAmount + taxAmount (${expectedTotal})`,
    );
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new HttpError(400, `Field "items" must be a non-empty array`);
  }
  input.items.forEach((item: OrderItemInput, i: number) => validateItem(item, i));

  if (input.shippingAddress !== undefined && input.shippingAddress !== null) {
    validateShippingAddress(input.shippingAddress);
  }

  optionalString(input, "paymentId");
  optionalString(input, "trackingNumber");
  optionalString(input, "notes");
};

/**
 * Validates the restricted update payload. Sending an immutable field is a hard
 * 400 rather than a silent no-op — a caller that still posts the whole order
 * should find out immediately instead of assuming the change took effect.
 */
const validateUpdate = (input: Rec) => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new HttpError(400, "Request body must be an object");
  }

  const rejected = IMMUTABLE_UPDATE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(input, field),
  );
  if (rejected.length > 0) {
    throw new HttpError(
      400,
      `These fields cannot be changed after an order is created: ${rejected.join(", ")}. ` +
        `Editable fields are: shippingAddress, trackingNumber, notes. ` +
        `Use PATCH /api/orders/{id}/status to change the status.`,
    );
  }

  if (input.shippingAddress !== undefined && input.shippingAddress !== null) {
    validateShippingAddress(input.shippingAddress);
  }
  optionalString(input, "trackingNumber");
  optionalString(input, "notes");
};

const validateStatusChange = (input: Rec): { status: OrderStatus; comment: string | null } => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new HttpError(400, "Request body must be an object");
  }
  if (!ORDER_STATUS_VALUES.includes(input.status)) {
    throw new HttpError(400, `Field "status" must be one of: ${ORDER_STATUS_VALUES.join(", ")}`);
  }
  optionalString(input, "comment");
  return {
    status: input.status as OrderStatus,
    comment: typeof input.comment === "string" ? input.comment.trim() || null : null,
  };
};

const normalizeItem = (item: OrderItemInput) => ({
  productId: item.productId,
  productName: item.productName.trim(),
  productSlug: item.productSlug.trim(),
  productImageUrl: item.productImageUrl?.trim() || null,
  unitPrice: item.unitPrice,
  quantity: item.quantity,
  totalAmount: item.totalAmount,
});

const normalizeShippingAddress = (addr: ShippingAddressInput) => ({
  address: addr.address.trim(),
  city: addr.city.trim(),
  state: addr.state.trim(),
  postalCode: addr.postalCode.trim(),
  country: addr.country.trim(),
  fullName: addr.fullName.trim(),
  phoneNumber: addr.phoneNumber.trim(),
});

const normalizeCreate = (input: OrderInput) => ({
  userId: input.userId,
  currency: input.currency.trim(),
  subtotalAmount: input.subtotalAmount,
  shippingAmount: input.shippingAmount,
  taxAmount: input.taxAmount,
  totalAmount: input.totalAmount,
  shippingAddress: input.shippingAddress ? normalizeShippingAddress(input.shippingAddress) : null,
  paymentId: input.paymentId?.trim() || null,
  trackingNumber: input.trackingNumber?.trim() || null,
  notes: input.notes?.trim() || null,
});

const ensureUserExists = async (userId: number) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(400, `User not found ${userId}`);
};

// ── Query shapes ────────────────────────────────────────────────────────────

/** Oldest → newest; `id` breaks ties between rows written in the same tick. */
const HISTORY_ORDER_BY: Prisma.OrderStatusHistoryOrderByWithRelationInput[] = [
  { createdAt: "asc" },
  { id: "asc" },
];

/**
 * List rows carry the current `status` but **not** the history — a page of 100
 * orders would otherwise drag in every transition ever recorded.
 */
const LIST_INCLUDE = {
  items: true,
  user: { select: PUBLIC_USER_SELECT },
} as const;

/** Detail rows add the full audit trail. */
const DETAIL_INCLUDE = {
  items: true,
  user: { select: PUBLIC_USER_SELECT },
  statusHistory: { orderBy: HISTORY_ORDER_BY },
} as const;

// ── Output mapping ──────────────────────────────────────────────────────────

/**
 * Maps a stored history row to the shape the frontend expects
 * (`StatusHistory<OrderStatus>`): the FK is exposed as the generic `typeId`,
 * and `changedByUser` becomes a number again when it holds a user id.
 */
const toStatusHistory = (row: {
  id: number;
  orderId: number;
  previousStatus: number | null;
  newStatus: number;
  changedByUser: string;
  comment: string | null;
  createdAt: Date;
}) => ({
  id: row.id,
  typeId: row.orderId,
  previousStatus: row.previousStatus,
  newStatus: row.newStatus,
  changedByUser: /^\d+$/.test(row.changedByUser) ? Number(row.changedByUser) : row.changedByUser,
  comment: row.comment,
  createdAt: row.createdAt,
});

/** Renames the `statusHistory` relation to the public `orderStatusHistory`. */
const toOrder = <T extends Rec>(order: T) => {
  const { statusHistory, ...rest } = order as Rec;
  return statusHistory === undefined
    ? rest
    : { ...rest, orderStatusHistory: (statusHistory as any[]).map(toStatusHistory) };
};

// ── Internals ───────────────────────────────────────────────────────────────

/** Existence check that also hands back the two fields callers need. */
const findOrderOrThrow = async (id: number) => {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true },
  });
  if (!order) throw new HttpError(404, `Order not found ${id}`);
  return order;
};

const getOrderById = async (id: number) => {
  const order = await prisma.order.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!order) throw new HttpError(404, `Order not found ${id}`);
  return toOrder(order);
};

const statusName = (status: OrderStatus) => OrderStatus[status] ?? String(status);

/**
 * The **only** place `Order.status` is ever written. Validates the transition,
 * then updates the order and appends the history row in one transaction, so the
 * database can never hold a status without the matching audit entry.
 *
 * The update is conditional on the status we read (`where: { id, status: from }`),
 * which makes two concurrent transitions safe: the loser matches zero rows and
 * gets a 409 instead of silently overwriting the winner.
 */
const applyStatusChange = async (
  id: number,
  newStatus: OrderStatus,
  changedByUser: string,
  comment: string | null,
) => {
  const current = await findOrderOrThrow(id);
  const from = current.status as OrderStatus;

  // Re-requesting the current status is a no-op, not a duplicate history entry.
  if (from === newStatus) return getOrderById(id);

  const allowed = ORDER_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new HttpError(
      409,
      `Cannot change order ${id} from ${statusName(from)} (${from}) to ` +
        `${statusName(newStatus)} (${newStatus}). Allowed from ${statusName(from)}: ` +
        (allowed.length
          ? allowed.map((s) => `${statusName(s)} (${s})`).join(", ")
          : "nothing — this is a final status"),
    );
  }

  return prisma.$transaction(async (tx) => {
    const changed = await tx.order.updateMany({
      where: { id, status: from },
      data: { status: newStatus },
    });
    if (changed.count !== 1) {
      throw new HttpError(
        409,
        `Order ${id} changed status while this request was being processed. Retry.`,
      );
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: id,
        previousStatus: from,
        newStatus,
        changedByUser,
        comment,
      },
    });

    const order = await tx.order.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    return toOrder(order as Rec);
  });
};

export const orderService = {
  getOrders: async ({
    page,
    perPage,
    search,
    status,
    userId,
  }: {
    page: number;
    perPage: number;
    search?: string;
    status?: OrderStatus;
    userId?: number;
  }) => {
    const skip = (page - 1) * perPage;
    const where: Prisma.OrderWhereInput = {};
    if (userId !== undefined) where.userId = userId;
    if (status !== undefined) where.status = status;
    if (search) {
      const idMatch = /^\d+$/.test(search) ? Number(search) : null;
      where.OR = [
        ...(idMatch !== null ? [{ id: idMatch }] : []),
        { trackingNumber: { contains: search, mode: "insensitive" } },
        { paymentId: { contains: search, mode: "insensitive" } },
        { user: { fullName: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { phoneNumber: { contains: search, mode: "insensitive" } } },
      ];
    }
    const [results, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        orderBy: { id: "desc" },
        skip,
        take: perPage,
        include: LIST_INCLUDE,
      }),
      prisma.order.count({ where }),
    ]);
    return { results, total };
  },

  getOrderById,

  /**
   * History for one order, oldest → newest. Returns the owner id alongside it so
   * the controller can run the same ownership check it runs on the order itself
   * without a second round-trip.
   */
  getStatusHistory: async (id: number) => {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { userId: true, statusHistory: { orderBy: HISTORY_ORDER_BY } },
    });
    if (!order) throw new HttpError(404, `Order not found ${id}`);
    return {
      ownerUserId: order.userId,
      orderStatusHistory: order.statusHistory.map(toStatusHistory),
    };
  },

  /**
   * Creates the order at PENDING_PAYMENT together with its opening history
   * entry, atomically. The first entry has `previousStatus: null` — the order
   * did not come from another state, it started here.
   */
  createOrder: async (input: OrderInput) => {
    validateCreate(input);
    const normalized = normalizeCreate(input);
    await ensureUserExists(normalized.userId);

    return prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          ...normalized,
          status: OrderStatus.PENDING_PAYMENT,
          shippingAddress: normalized.shippingAddress ?? Prisma.JsonNull,
          items: { create: input.items.map(normalizeItem) },
        },
        select: { id: true },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: created.id,
          previousStatus: null,
          newStatus: OrderStatus.PENDING_PAYMENT,
          changedByUser: CHANGED_BY_SYSTEM,
          comment: "Order created.",
        },
      });

      const order = await tx.order.findUnique({
        where: { id: created.id },
        include: DETAIL_INCLUDE,
      });
      return toOrder(order as Rec);
    });
  },

  /**
   * Restricted update: only `shippingAddress`, `trackingNumber` and `notes`.
   * Everything else about an order is either historical record (amounts, items,
   * payment) or moves through its own operation (status).
   */
  updateOrder: async (id: number, input: OrderUpdateInput) => {
    const existing = await findOrderOrThrow(id);
    validateUpdate(input as Rec);

    const data: Prisma.OrderUpdateInput = {};

    if (Object.prototype.hasOwnProperty.call(input, "shippingAddress")) {
      if (existing.status >= ADDRESS_LOCKED_FROM) {
        throw new HttpError(
          409,
          `The shipping address of order ${id} can no longer be changed: it is already ` +
            `${statusName(existing.status as OrderStatus)}.`,
        );
      }
      data.shippingAddress = input.shippingAddress
        ? normalizeShippingAddress(input.shippingAddress)
        : Prisma.JsonNull;
    }
    if (Object.prototype.hasOwnProperty.call(input, "trackingNumber")) {
      data.trackingNumber = input.trackingNumber?.trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(input, "notes")) {
      data.notes = input.notes?.trim() || null;
    }

    if (Object.keys(data).length === 0) {
      throw new HttpError(
        400,
        `Nothing to update. Provide at least one of: shippingAddress, trackingNumber, notes.`,
      );
    }

    const order = await prisma.order.update({ where: { id }, data, include: DETAIL_INCLUDE });
    return toOrder(order);
  },

  /** PATCH /orders/:id/status — a staff member moves the order along. */
  updateStatus: async (id: number, input: OrderStatusChangeInput, changedByUserId: number) => {
    const { status, comment } = validateStatusChange(input as Rec);
    return applyStatusChange(id, status, String(changedByUserId), comment);
  },

  /**
   * Status change triggered by a payment event rather than a person.
   *
   * Stripe is not integrated yet: this is the seam the future webhook handler
   * calls once it has *verified* the event signature. The frontend must never
   * reach it — a successful payment is confirmed by the provider, not by the
   * browser.
   */
  recordPaymentStatusChange: async (
    id: number,
    newStatus: OrderStatus,
    comment: string | null = null,
    actor: string = CHANGED_BY_STRIPE_WEBHOOK,
  ) => applyStatusChange(id, newStatus, actor, comment),

  /**
   * Hard delete, restricted to orders that never took money. An order that ever
   * reached PAID or beyond is a financial record: it must be CANCELLED or
   * REFUNDED through the status endpoint instead. The audit trail — not just
   * the current status — is what decides, so an order that was paid and later
   * cancelled stays undeletable.
   */
  deleteOrder: async (id: number) => {
    const order = await findOrderOrThrow(id);

    const settled = await prisma.orderStatusHistory.findFirst({
      where: { orderId: id, newStatus: { in: SETTLED_STATUSES } },
      orderBy: HISTORY_ORDER_BY,
      select: { newStatus: true },
    });
    const reached = settled?.newStatus ?? (SETTLED_STATUSES.includes(order.status) ? order.status : null);

    if (reached !== null) {
      throw new HttpError(
        409,
        `Order ${id} cannot be deleted: it reached ${statusName(reached as OrderStatus)} ` +
          `(${reached}) and is a financial record. Cancel or refund it via ` +
          `PATCH /api/orders/${id}/status instead.`,
      );
    }

    await prisma.order.delete({ where: { id } });
  },
};
