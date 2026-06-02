import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

/**
 * Cart validation lives in its own service, independent of Order creation.
 * Its job: take the cart the frontend currently holds (in LocalStorage) and
 * re-check every line against the live database immediately before checkout.
 *
 * It returns:
 *  - whether the cart is still valid,
 *  - a human-readable message per problem found,
 *  - a refreshed copy of every item with the newest product data, and
 *  - recalculated totals,
 * so the frontend can sync its cart without making extra requests.
 *
 * This is intended to become the single source of truth in the flow:
 *   Cart → Validate Cart → Checkout → Create Order.
 */

export interface CartItemInput {
  productId: number;
  productSlug: string;
  productName: string;
  productImageUrl?: string | null;
  variantId: number;
  width: number;
  height: number;
  sizeUnit: string;
  originalUnitPrice: number;
  unitPrice: number;
  discountType?: string | null;
  discount?: number | null;
  quantity: number;
  subtotalAmount: number;
  dateAddedToCart?: string | null;
}

export interface CartInput {
  items: CartItemInput[];
  subtotalAmount?: number;
  shippingAmount?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  couponCode?: string | null;
}

export interface CartValidationResult {
  isValid: boolean;
  messages: string[];
  items: CartItemInput[];
  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
}

// Tolerance for floating-point money comparisons, matching order.service.
const AMOUNT_EPSILON = 0.01;

const round2 = (n: number) => Math.round(n * 100) / 100;

const approxEqual = (a: number, b: number) => Math.abs(a - b) <= AMOUNT_EPSILON;

// ── Input validation (structural only) ──────────────────────────────────────
// These throw HttpError(400) for a malformed request body. Business problems
// (inactive product, stale price, low stock, etc.) are NOT errors here — they
// are reported back in `messages` with a 200 response.

const requirePositiveInt = (value: unknown, label: string) => {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new HttpError(400, `${label} must be a positive integer`);
  }
};

const requireFiniteNumber = (value: unknown, label: string) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HttpError(400, `${label} must be a number`);
  }
};

const requireNonEmptyString = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${label} is required`);
  }
};

const optionalString = (value: unknown, label: string) => {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new HttpError(400, `${label} must be a string when provided`);
  }
};

const optionalNumber = (value: unknown, label: string) => {
  if (value !== undefined && value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new HttpError(400, `${label} must be a number when provided`);
  }
};

const validateItem = (item: CartItemInput, index: number) => {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    throw new HttpError(400, `items[${index}] must be an object`);
  }
  requirePositiveInt(item.productId, `items[${index}].productId`);
  requirePositiveInt(item.variantId, `items[${index}].variantId`);
  requirePositiveInt(item.quantity, `items[${index}].quantity`);
  requireNonEmptyString(item.productName, `items[${index}].productName`);
  requireNonEmptyString(item.productSlug, `items[${index}].productSlug`);
  requireNonEmptyString(item.sizeUnit, `items[${index}].sizeUnit`);
  requireFiniteNumber(item.width, `items[${index}].width`);
  requireFiniteNumber(item.height, `items[${index}].height`);
  requireFiniteNumber(item.originalUnitPrice, `items[${index}].originalUnitPrice`);
  requireFiniteNumber(item.unitPrice, `items[${index}].unitPrice`);
  requireFiniteNumber(item.subtotalAmount, `items[${index}].subtotalAmount`);
  optionalString(item.productImageUrl, `items[${index}].productImageUrl`);
  optionalString(item.discountType, `items[${index}].discountType`);
  optionalNumber(item.discount, `items[${index}].discount`);
  optionalString(item.dateAddedToCart, `items[${index}].dateAddedToCart`);
};

const validate = (input: CartInput) => {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new HttpError(400, `Field "items" must be a non-empty array`);
  }
  input.items.forEach(validateItem);
  optionalNumber(input.subtotalAmount, `"subtotalAmount"`);
  optionalNumber(input.shippingAmount, `"shippingAmount"`);
  optionalNumber(input.taxAmount, `"taxAmount"`);
  optionalNumber(input.discountAmount, `"discountAmount"`);
  optionalNumber(input.totalAmount, `"totalAmount"`);
  optionalString(input.couponCode, `"couponCode"`);
};

// ── Pricing ─────────────────────────────────────────────────────────────────
// Mirrors how the frontend derives unitPrice from a variant's price plus the
// product-level discount. Keep this in sync with the storefront's pricing.

const computeUnitPrice = (
  originalUnitPrice: number,
  discountType: string | null,
  discount: number | null,
): number => {
  if (!discount || discount <= 0) return originalUnitPrice;
  if (discountType === "percentage") {
    return originalUnitPrice * (1 - discount / 100);
  }
  if (discountType === "fixed") {
    return Math.max(0, originalUnitPrice - discount);
  }
  // Unknown/absent discount type → no discount applied.
  return originalUnitPrice;
};

type ProductWithVariants = Awaited<ReturnType<typeof loadProducts>>[number];

const loadProducts = (ids: number[]) =>
  prisma.product.findMany({ where: { id: { in: ids } }, include: { variants: true } });

// Keep the originally-selected image if it still exists on the product,
// otherwise fall back to the product's first image (or null).
const pickImage = (product: { images: string[] }, sentUrl?: string | null): string | null => {
  if (sentUrl && product.images.includes(sentUrl)) return sentUrl;
  return product.images[0] ?? null;
};

const validateCartItem = (
  item: CartItemInput,
  product: ProductWithVariants | undefined,
): { refreshed: CartItemInput; messages: string[] } => {
  const messages: string[] = [];
  // Start from the sent item so we preserve quantity / dateAddedToCart, then
  // overwrite the fields we can refresh from the database.
  const refreshed: CartItemInput = { ...item };

  // ── Product ───────────────────────────────────────────────────────────────
  if (!product) {
    messages.push(`The product "${item.productName}" is no longer available.`);
    return { refreshed, messages };
  }

  refreshed.productName = product.name;
  refreshed.productSlug = product.slug;
  refreshed.productImageUrl = pickImage(product, item.productImageUrl);

  if (!product.isActive) {
    messages.push(`The product "${product.name}" is inactive.`);
  }

  // ── Variant ─────────────────────────────────────────────────────────────--
  const variant = product.variants.find((v) => v.id === item.variantId);
  if (!variant) {
    messages.push(`The selected variant for "${product.name}" is no longer available.`);
    return { refreshed, messages };
  }

  refreshed.width = variant.width;
  refreshed.height = variant.height;
  refreshed.sizeUnit = variant.sizeUnit;

  if (
    item.width !== variant.width ||
    item.height !== variant.height ||
    item.sizeUnit !== variant.sizeUnit
  ) {
    messages.push(`The selected variant for "${product.name}" is no longer available.`);
  }

  // ── Pricing ─────────────────────────────────────────────────────────────--
  const originalUnitPrice = variant.price;
  const discountType = product.discountType;
  const discount = product.discount;
  const unitPrice = round2(computeUnitPrice(originalUnitPrice, discountType, discount));

  refreshed.originalUnitPrice = originalUnitPrice;
  refreshed.discountType = discountType;
  refreshed.discount = discount;
  refreshed.unitPrice = unitPrice;

  if (
    !approxEqual(item.originalUnitPrice, originalUnitPrice) ||
    !approxEqual(item.unitPrice, unitPrice) ||
    (item.discountType ?? null) !== (discountType ?? null) ||
    (item.discount ?? null) !== (discount ?? null)
  ) {
    messages.push(`The price of product "${product.name}" has changed.`);
  }

  // ── Stock ───────────────────────────────────────────────────────────────--
  if (variant.stock <= 0) {
    messages.push(`The product "${product.name}" is out of stock.`);
  } else if (item.quantity > variant.stock) {
    messages.push(`The product "${product.name}" only has ${variant.stock} units available.`);
  }

  // ── Totals (per item) ───────────────────────────────────────────────────--
  const subtotalAmount = round2(unitPrice * item.quantity);
  refreshed.subtotalAmount = subtotalAmount;
  if (!approxEqual(item.subtotalAmount, subtotalAmount)) {
    messages.push(`The subtotal for "${product.name}" has changed.`);
  }

  return { refreshed, messages };
};

export const cartService = {
  validateCart: async (input: CartInput): Promise<CartValidationResult> => {
    validate(input);

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await loadProducts(productIds);
    const byId = new Map(products.map((p) => [p.id, p]));

    const messages: string[] = [];
    const items: CartItemInput[] = [];

    for (const item of input.items) {
      const { refreshed, messages: itemMessages } = validateCartItem(item, byId.get(item.productId));
      items.push(refreshed);
      messages.push(...itemMessages);
    }

    // Recalculate cart totals from the refreshed line subtotals.
    const subtotalAmount = round2(items.reduce((sum, i) => sum + i.subtotalAmount, 0));

    // Shipping, tax, and coupon-based discounts are not computed yet — pass
    // through what the frontend sent (defaulting to 0). When coupons, shipping
    // rules, etc. are implemented, derive these here instead.
    // `input.couponCode` is accepted now to keep the contract stable but is not
    // yet applied (no coupon validation / discount calculation).
    const shippingAmount = input.shippingAmount ?? 0;
    const taxAmount = input.taxAmount ?? 0;
    const discountAmount = input.discountAmount ?? 0;
    const totalAmount = round2(subtotalAmount + shippingAmount + taxAmount - discountAmount);

    return {
      isValid: messages.length === 0,
      messages,
      items,
      subtotalAmount,
      shippingAmount,
      taxAmount,
      discountAmount,
      totalAmount,
    };
  },
};
