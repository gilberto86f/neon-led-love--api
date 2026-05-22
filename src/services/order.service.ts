import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

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

export interface OrderInput {
  userId: number;
  status?: OrderStatus;
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

const requireNonNegativeNumber = (
  input: Partial<OrderInput>,
  field: keyof OrderInput,
) => {
  const value = input[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new HttpError(400, `Field must be a non-negative number: "${field}"`);
  }
};

const requireString = (
  input: Partial<OrderInput>,
  field: keyof OrderInput,
) => {
  const value = input[field];
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `Field is required: "${field}"`);
  }
};

const optionalString = (
  input: Partial<OrderInput>,
  field: keyof OrderInput,
) => {
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

const validate = (input: Partial<OrderInput>) => {
  if (!Number.isInteger(input.userId) || (input.userId as number) <= 0) {
    throw new HttpError(400, `Field "userId" must be a positive integer`);
  }

  requireString(input, "currency");

  if (input.status !== undefined && input.status !== null) {
    if (!ORDER_STATUSES.includes(input.status as OrderStatus)) {
      throw new HttpError(400, `Field "status" must be one of: ${ORDER_STATUSES.join(", ")}`);
    }
  }

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
  input.items.forEach((item, i) => validateItem(item, i));

  if (input.shippingAddress !== undefined && input.shippingAddress !== null) {
    validateShippingAddress(input.shippingAddress);
  }

  optionalString(input, "paymentId");
  optionalString(input, "trackingNumber");
  optionalString(input, "notes");
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

const normalize = (input: OrderInput) => ({
  userId: input.userId,
  status: (input.status ?? "pending") as OrderStatus,
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

const withItems = { include: { items: true } } as const;

const getOrderById = async (id: number) => {
  const order = await prisma.order.findUnique({ where: { id }, ...withItems });
  if (!order) throw new HttpError(404, `Order not found ${id}`);
  return order;
};

export const orderService = {
  getOrders: async ({
    page,
    perPage,
    search,
    status,
  }: {
    page: number;
    perPage: number;
    search?: string;
    status?: OrderStatus;
  }) => {
    const skip = (page - 1) * perPage;
    const where: Prisma.OrderWhereInput = {};
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
        ...withItems,
      }),
      prisma.order.count({ where }),
    ]);
    return { results, total };
  },

  getOrderById,

  createOrder: async (input: OrderInput) => {
    validate(input);
    const normalized = normalize(input);
    await ensureUserExists(normalized.userId);
    return prisma.order.create({
      data: {
        userId: normalized.userId,
        status: normalized.status,
        currency: normalized.currency,
        subtotalAmount: normalized.subtotalAmount,
        shippingAmount: normalized.shippingAmount,
        taxAmount: normalized.taxAmount,
        totalAmount: normalized.totalAmount,
        shippingAddress: normalized.shippingAddress ?? Prisma.JsonNull,
        paymentId: normalized.paymentId,
        trackingNumber: normalized.trackingNumber,
        notes: normalized.notes,
        items: { create: input.items.map(normalizeItem) },
      },
      ...withItems,
    });
  },

  updateOrder: async (id: number, input: OrderInput) => {
    await getOrderById(id);
    validate(input);
    const normalized = normalize(input);
    await ensureUserExists(normalized.userId);
    return prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      return tx.order.update({
        where: { id },
        data: {
          userId: normalized.userId,
          status: normalized.status,
          currency: normalized.currency,
          subtotalAmount: normalized.subtotalAmount,
          shippingAmount: normalized.shippingAmount,
          taxAmount: normalized.taxAmount,
          totalAmount: normalized.totalAmount,
          shippingAddress: normalized.shippingAddress ?? Prisma.JsonNull,
          paymentId: normalized.paymentId,
          trackingNumber: normalized.trackingNumber,
          notes: normalized.notes,
          items: { create: input.items.map(normalizeItem) },
        },
        include: { items: true },
      });
    });
  },

  deleteOrder: async (id: number) => {
    await getOrderById(id);
    await prisma.order.delete({ where: { id } });
  },
};
