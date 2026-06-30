import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

/**
 * Cart validation lives in its own service, independent of Order creation.
 * Its job: take the cart the frontend currently holds (in LocalStorage) and
 * re-check every line against the live database immediately before checkout.
 *
 * It returns:
 *  - whether the cart is still valid,
 *  - a structured issue per problem found (a machine `code`, the product/variant
 *    it refers to, code-specific details, and a default English message),
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

// Stable machine codes for every problem the validator can report. The frontend
// switches on `code` to build its own (translatable) copy, so these strings are
// part of the API contract — add new ones, but don't rename existing ones.
export type CartIssueCode =
  | "PRODUCT_UNAVAILABLE"
  | "PRODUCT_INACTIVE"
  | "VARIANT_UNAVAILABLE"
  | "PRICE_CHANGED"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_STOCK"
  | "SUBTOTAL_CHANGED";

export interface CartIssue {
  /** Machine-readable code — switch on this to build localized copy. */
  code: CartIssueCode;
  /** Default English copy. Convenience only; prefer rendering from `code` + the
   *  fields below so the message can be translated. */
  message: string;
  /** The product the issue refers to. */
  productId: number;
  productName: string;
  /** The cart line's variant. */
  variantId: number;
  /** Units currently in stock. Present on OUT_OF_STOCK (0) and INSUFFICIENT_STOCK. */
  availableStock?: number;
  /** Units the cart line asked for. Present on OUT_OF_STOCK and INSUFFICIENT_STOCK. */
  requestedQuantity?: number;
  /** The unit price (after discount) the cart held vs. the live one. Present on PRICE_CHANGED. */
  previousUnitPrice?: number;
  currentUnitPrice?: number;
  /** The list price (before discount) the cart held vs. the live one. Present on PRICE_CHANGED. */
  previousOriginalUnitPrice?: number;
  currentOriginalUnitPrice?: number;
  /** The product discount the cart held vs. the live one. Present on PRICE_CHANGED. */
  previousDiscountType?: string | null;
  currentDiscountType?: string | null;
  previousDiscount?: number | null;
  currentDiscount?: number | null;
  /** The line subtotal the cart held vs. the recalculated one. Present on SUBTOTAL_CHANGED. */
  previousSubtotal?: number;
  currentSubtotal?: number;
}

export interface CartValidationResult {
  isValid: boolean;
  issues: CartIssue[];
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
// are reported back in `issues` with a 200 response.

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
  if (
    value !== undefined &&
    value !== null &&
    (typeof value !== "number" || !Number.isFinite(value))
  ) {
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
  requireFiniteNumber(
    item.originalUnitPrice,
    `items[${index}].originalUnitPrice`,
  );
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
  // Absolute (currency) discount. The storefront uses "amount"; "fixed" is
  // accepted as an alias so older/other data keeps working.
  if (discountType === "amount" || discountType === "fixed") {
    return Math.max(0, originalUnitPrice - discount);
  }
  // Unknown/absent discount type → no discount applied.
  return originalUnitPrice;
};

type ProductWithVariants = Awaited<ReturnType<typeof loadProducts>>[number];

const loadProducts = (ids: number[]) =>
  prisma.product.findMany({
    where: { id: { in: ids } },
    include: { variants: true },
  });

// Keep the originally-selected image if it still exists on the product,
// otherwise fall back to the product's first image (or null).
const pickImage = (
  product: { images: string[] },
  sentUrl?: string | null,
): string | null => {
  if (sentUrl && product.images.includes(sentUrl)) return sentUrl;
  return product.images[0] ?? null;
};

const validateCartItem = (
  item: CartItemInput,
  product: ProductWithVariants | undefined,
): { refreshed: CartItemInput; issues: CartIssue[] } => {
  const issues: CartIssue[] = [];
  // Start from the sent item so we preserve quantity / dateAddedToCart, then
  // overwrite the fields we can refresh from the database.
  const refreshed: CartItemInput = { ...item };

  // ── Product ───────────────────────────────────────────────────────────────
  if (!product) {
    issues.push({
      code: "PRODUCT_UNAVAILABLE",
      message: `The product "${item.productName}" is no longer available.`,
      productId: item.productId,
      productName: item.productName,
      variantId: item.variantId,
    });
    return { refreshed, issues };
  }

  refreshed.productName = product.name;
  refreshed.productSlug = product.slug;
  refreshed.productImageUrl = pickImage(product, item.productImageUrl);

  // Identity shared by every issue from here on (product is known).
  const ref = {
    productId: product.id,
    productName: product.name,
    variantId: item.variantId,
  };

  if (!product.isActive) {
    issues.push({
      code: "PRODUCT_INACTIVE",
      message: `The product "${product.name}" is inactive.`,
      ...ref,
    });
  }

  // ── Variant ─────────────────────────────────────────────────────────────--
  const variant = product.variants.find((v) => v.id === item.variantId);
  if (!variant) {
    issues.push({
      code: "VARIANT_UNAVAILABLE",
      message: `The selected variant for "${product.name}" is no longer available.`,
      ...ref,
    });
    return { refreshed, issues };
  }

  refreshed.width = variant.width;
  refreshed.height = variant.height;
  refreshed.sizeUnit = variant.sizeUnit;

  if (
    item.width !== variant.width ||
    item.height !== variant.height ||
    item.sizeUnit !== variant.sizeUnit
  ) {
    issues.push({
      code: "VARIANT_UNAVAILABLE",
      message: `The selected variant for "${product.name}" is no longer available.`,
      ...ref,
    });
  }

  // ── Pricing ─────────────────────────────────────────────────────────────--
  const originalUnitPrice = variant.price;
  const discountType = product.discountType;
  const discount = product.discount;
  const unitPrice = round2(
    computeUnitPrice(originalUnitPrice, discountType, discount),
  );

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
    issues.push({
      code: "PRICE_CHANGED",
      message: `The price of product "${product.name}" has changed.`,
      ...ref,
      previousUnitPrice: item.unitPrice,
      currentUnitPrice: unitPrice,
      previousOriginalUnitPrice: item.originalUnitPrice,
      currentOriginalUnitPrice: originalUnitPrice,
      previousDiscountType: item.discountType ?? null,
      currentDiscountType: discountType ?? null,
      previousDiscount: item.discount ?? null,
      currentDiscount: discount ?? null,
    });
  }

  // ── Stock ───────────────────────────────────────────────────────────────--
  if (variant.stock <= 0) {
    issues.push({
      code: "OUT_OF_STOCK",
      message: `The product "${product.name}" is out of stock.`,
      ...ref,
      availableStock: Math.max(0, variant.stock),
      requestedQuantity: item.quantity,
    });
  } else if (item.quantity > variant.stock) {
    issues.push({
      code: "INSUFFICIENT_STOCK",
      message: `The product "${product.name}" only has ${variant.stock} unit${variant.stock === 1 ? "" : "s"} available.`,
      ...ref,
      availableStock: variant.stock,
      requestedQuantity: item.quantity,
    });
  }

  // ── Totals (per item) ───────────────────────────────────────────────────--
  const subtotalAmount = round2(unitPrice * item.quantity);
  refreshed.subtotalAmount = subtotalAmount;
  if (!approxEqual(item.subtotalAmount, subtotalAmount)) {
    issues.push({
      code: "SUBTOTAL_CHANGED",
      message: `The subtotal for "${product.name}" has changed.`,
      ...ref,
      previousSubtotal: item.subtotalAmount,
      currentSubtotal: subtotalAmount,
    });
  }

  return { refreshed, issues };
};

export const cartService = {
  validateCart: async (input: CartInput): Promise<CartValidationResult> => {
    validate(input);

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await loadProducts(productIds);
    const byId = new Map(products.map((p) => [p.id, p]));

    const issues: CartIssue[] = [];
    const items: CartItemInput[] = [];

    for (const item of input.items) {
      const { refreshed, issues: itemIssues } = validateCartItem(
        item,
        byId.get(item.productId),
      );
      items.push(refreshed);
      issues.push(...itemIssues);
    }

    // Recalculate cart totals from the refreshed line subtotals.
    const subtotalAmount = round2(
      items.reduce((sum, i) => sum + i.subtotalAmount, 0),
    );

    // Shipping, tax, and coupon-based discounts are not computed yet — pass
    // through what the frontend sent (defaulting to 0). When coupons, shipping
    // rules, etc. are implemented, derive these here instead.
    // `input.couponCode` is accepted now to keep the contract stable but is not
    // yet applied (no coupon validation / discount calculation).
    const shippingAmount = input.shippingAmount ?? 0;
    const taxAmount = input.taxAmount ?? 0;
    const discountAmount = input.discountAmount ?? 0;
    const totalAmount = round2(
      subtotalAmount + shippingAmount + taxAmount - discountAmount,
    );

    return {
      isValid: issues.length === 0,
      issues,
      items,
      subtotalAmount,
      shippingAmount,
      taxAmount,
      discountAmount,
      totalAmount,
    };
  },
};
