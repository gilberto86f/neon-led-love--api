import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

/**
 * Lifecycle of a quote. Numeric enum shared with the frontend: the API stores
 * and returns the number, not the name. New requests start at SUBMITTED.
 */
export enum QuoteStatus {
  DRAFT,
  SUBMITTED,
  UNDER_REVIEW,
  WAITING_FOR_CUSTOMER,
  QUOTED,
  ACCEPTED,
  CONVERTED_TO_ORDER,
  REJECTED,
  CANCELLED,
  EXPIRED,
}

// Valid numeric status values (0..9), derived from the enum so the two can't drift.
export const QUOTE_STATUS_VALUES = Object.values(QuoteStatus).filter(
  (v): v is number => typeof v === "number",
);

export const QUOTE_SORT_FIELDS = [
  "price",
  "status",
  "createdAt",
  "updatedAt",
  "fullName",
] as const;
export type QuoteSortField = (typeof QUOTE_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

// ── Domain types (mirror the frontend contract) ────────────────────────────

export interface Font {
  class: string;
  complexity: number;
  name: string;
  upperDiffersFromLowercase: number;
}

export interface NeonTextConfig {
  text: string;
  color: unknown; // Color — opaque object owned by the frontend
  font: Font;
  size?: string;
  letterSpacing?: number;
  lineHeight?: number;
  italics?: boolean;
  uppercase?: boolean;
  horizontalPosition?: number;
  verticalPosition?: number;
}

export interface NeonSize {
  width: number;
  maxCharacters: number;
  default?: boolean;
}

/** Payload guests/clients submit — the request half of a quote. */
export interface QuoteRequestInput {
  isCustom?: boolean;
  fullName: string;
  email: string;
  phoneNumber: string;
  clientId?: number | null;
  width?: number | null;
  height?: number | null;
  images?: string[];
  sizeUnit?: string | null;
  // CustomNeon configuration
  neonTexts?: NeonTextConfig[];
  alignment?: string | null;
  size?: NeonSize | null;
  notes?: string | null;
  waterproof?: boolean | null;
  backboardStyle?: string | null;
  backboardColor?: string | null;
  wallMountingKit?: string | null;
  signMountingKit?: boolean | null;
  remoteControl?: boolean | null;
}

/** Full Quote payload accepted by PUT — request half + staff-filled quote half. */
export interface QuoteUpdateInput extends QuoteRequestInput {
  price?: number;
  status?: number;
  descriptionQuote?: string | null;
  descriptionPrice?: number | null;
  descriptionSuggestedPrice?: number | null;
  widthQuote?: number | null;
  heightQuote?: number | null;
  sizePrice?: number | null;
  sizeSuggestedPrice?: number | null;
  waterproofQuote?: boolean | null;
  waterproofPrice?: number | null;
  waterproofSuggestedPrice?: number | null;
  backboardStyleQuote?: string | null;
  backboardStylePrice?: number | null;
  backboardStyleSuggestedPrice?: number | null;
  backboardColorQuote?: string | null;
  backboardColorPrice?: number | null;
  backboardColorSuggestedPrice?: number | null;
  mockUpQuote?: string[];
  mockUpPrice?: number | null;
  mockUpSuggestedPrice?: number | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Rec = Record<string, any>;

// ── Field validators ────────────────────────────────────────────────────────

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

const optionalBoolean = (input: Rec, field: string) => {
  const value = input[field];
  if (value !== undefined && value !== null && typeof value !== "boolean") {
    throw new HttpError(400, `Field must be a boolean: "${field}"`);
  }
};

const optionalNumber = (input: Rec, field: string) => {
  const value = input[field];
  if (value !== undefined && value !== null) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new HttpError(400, `Field must be a number: "${field}"`);
    }
  }
};

const optionalNonNegativeNumber = (input: Rec, field: string) => {
  const value = input[field];
  if (value !== undefined && value !== null) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new HttpError(400, `Field must be a non-negative number: "${field}"`);
    }
  }
};

const optionalStringArray = (input: Rec, field: string) => {
  const value = input[field];
  if (value === undefined || value === null) return;
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new HttpError(400, `Field must be an array of strings: "${field}"`);
  }
};

const validateFont = (font: any, index: number) => {
  if (typeof font !== "object" || font === null || Array.isArray(font)) {
    throw new HttpError(400, `neonTexts[${index}].font must be an object`);
  }
  if (typeof font.class !== "string" || !font.class.trim()) {
    throw new HttpError(400, `neonTexts[${index}].font.class is required`);
  }
  if (typeof font.name !== "string" || !font.name.trim()) {
    throw new HttpError(400, `neonTexts[${index}].font.name is required`);
  }
  if (typeof font.complexity !== "number" || !Number.isFinite(font.complexity)) {
    throw new HttpError(400, `neonTexts[${index}].font.complexity must be a number`);
  }
  if (
    typeof font.upperDiffersFromLowercase !== "number" ||
    !Number.isFinite(font.upperDiffersFromLowercase)
  ) {
    throw new HttpError(
      400,
      `neonTexts[${index}].font.upperDiffersFromLowercase must be a number`,
    );
  }
};

const validateNeonText = (item: any, index: number) => {
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    throw new HttpError(400, `neonTexts[${index}] must be an object`);
  }
  if (typeof item.text !== "string" || !item.text.trim()) {
    throw new HttpError(400, `neonTexts[${index}].text is required`);
  }
  if (typeof item.color !== "object" || item.color === null || Array.isArray(item.color)) {
    throw new HttpError(400, `neonTexts[${index}].color must be an object`);
  }
  validateFont(item.font, index);
  optionalString(item, "size");
  optionalNumber(item, "letterSpacing");
  optionalNumber(item, "lineHeight");
  optionalNumber(item, "horizontalPosition");
  optionalNumber(item, "verticalPosition");
  optionalBoolean(item, "italics");
  optionalBoolean(item, "uppercase");
};

const validateNeonTexts = (input: Rec) => {
  const value = input.neonTexts;
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) {
    throw new HttpError(400, `Field "neonTexts" must be an array`);
  }
  value.forEach((item, i) => validateNeonText(item, i));
};

const validateSize = (input: Rec) => {
  const size = input.size;
  if (size === undefined || size === null) return;
  if (typeof size !== "object" || Array.isArray(size)) {
    throw new HttpError(400, `Field "size" must be an object`);
  }
  if (typeof size.width !== "number" || !Number.isFinite(size.width)) {
    throw new HttpError(400, `Field "size.width" must be a number`);
  }
  if (typeof size.maxCharacters !== "number" || !Number.isFinite(size.maxCharacters)) {
    throw new HttpError(400, `Field "size.maxCharacters" must be a number`);
  }
  if (size.default !== undefined && typeof size.default !== "boolean") {
    throw new HttpError(400, `Field "size.default" must be a boolean`);
  }
};

/** Validates the request half — shared by create and update. */
const validateRequest = (input: Rec) => {
  requireString(input, "fullName");

  requireString(input, "email");
  if (!EMAIL_RE.test(String(input.email).trim())) {
    throw new HttpError(400, `Field must be a valid email: "email"`);
  }

  requireString(input, "phoneNumber");

  if (input.clientId !== undefined && input.clientId !== null) {
    if (!Number.isInteger(input.clientId) || input.clientId <= 0) {
      throw new HttpError(400, `Field "clientId" must be a positive integer`);
    }
  }

  optionalBoolean(input, "isCustom");
  optionalNonNegativeNumber(input, "width");
  optionalNonNegativeNumber(input, "height");
  optionalStringArray(input, "images");
  optionalString(input, "sizeUnit");

  optionalString(input, "alignment");
  optionalString(input, "notes");
  optionalString(input, "backboardStyle");
  optionalString(input, "backboardColor");
  optionalString(input, "wallMountingKit");
  optionalBoolean(input, "waterproof");
  optionalBoolean(input, "signMountingKit");
  optionalBoolean(input, "remoteControl");

  validateNeonTexts(input);
  validateSize(input);
};

/** Validates the staff-filled quote half (PUT only). */
const validateQuoteHalf = (input: Rec) => {
  if (input.status !== undefined && input.status !== null) {
    if (!QUOTE_STATUS_VALUES.includes(input.status)) {
      throw new HttpError(
        400,
        `Field "status" must be one of: ${QUOTE_STATUS_VALUES.join(", ")}`,
      );
    }
  }

  optionalNonNegativeNumber(input, "price");

  optionalString(input, "descriptionQuote");
  optionalNumber(input, "descriptionPrice");
  optionalNumber(input, "descriptionSuggestedPrice");
  optionalNonNegativeNumber(input, "widthQuote");
  optionalNonNegativeNumber(input, "heightQuote");
  optionalNumber(input, "sizePrice");
  optionalNumber(input, "sizeSuggestedPrice");
  optionalBoolean(input, "waterproofQuote");
  optionalNumber(input, "waterproofPrice");
  optionalNumber(input, "waterproofSuggestedPrice");
  optionalString(input, "backboardStyleQuote");
  optionalNumber(input, "backboardStylePrice");
  optionalNumber(input, "backboardStyleSuggestedPrice");
  optionalString(input, "backboardColorQuote");
  optionalNumber(input, "backboardColorPrice");
  optionalNumber(input, "backboardColorSuggestedPrice");
  optionalStringArray(input, "mockUpQuote");
  optionalNumber(input, "mockUpPrice");
  optionalNumber(input, "mockUpSuggestedPrice");
};

// ── Normalization ────────────────────────────────────────────────────────────

const trimOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** Shapes the request half into Prisma-ready columns (JSON/array fallbacks). */
const normalizeRequest = (input: QuoteRequestInput) => ({
  fullName: input.fullName.trim(),
  email: input.email.trim().toLowerCase(),
  phoneNumber: input.phoneNumber.trim(),
  isCustom: input.isCustom ?? false,
  clientId: input.clientId ?? null,
  width: input.width ?? null,
  height: input.height ?? null,
  images: input.images ?? [],
  sizeUnit: trimOrNull(input.sizeUnit),
  neonTexts:
    input.neonTexts !== undefined && input.neonTexts !== null
      ? (input.neonTexts as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  alignment: trimOrNull(input.alignment),
  size:
    input.size !== undefined && input.size !== null
      ? (input.size as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
  notes: trimOrNull(input.notes),
  waterproof: input.waterproof ?? null,
  backboardStyle: trimOrNull(input.backboardStyle),
  backboardColor: trimOrNull(input.backboardColor),
  wallMountingKit: trimOrNull(input.wallMountingKit),
  signMountingKit: input.signMountingKit ?? null,
  remoteControl: input.remoteControl ?? null,
});

const normalizeQuoteHalf = (input: QuoteUpdateInput) => ({
  price: input.price ?? 0,
  descriptionQuote: trimOrNull(input.descriptionQuote),
  descriptionPrice: input.descriptionPrice ?? null,
  descriptionSuggestedPrice: input.descriptionSuggestedPrice ?? null,
  widthQuote: input.widthQuote ?? null,
  heightQuote: input.heightQuote ?? null,
  sizePrice: input.sizePrice ?? null,
  sizeSuggestedPrice: input.sizeSuggestedPrice ?? null,
  waterproofQuote: input.waterproofQuote ?? null,
  waterproofPrice: input.waterproofPrice ?? null,
  waterproofSuggestedPrice: input.waterproofSuggestedPrice ?? null,
  backboardStyleQuote: trimOrNull(input.backboardStyleQuote),
  backboardStylePrice: input.backboardStylePrice ?? null,
  backboardStyleSuggestedPrice: input.backboardStyleSuggestedPrice ?? null,
  backboardColorQuote: trimOrNull(input.backboardColorQuote),
  backboardColorPrice: input.backboardColorPrice ?? null,
  backboardColorSuggestedPrice: input.backboardColorSuggestedPrice ?? null,
  mockUpQuote: input.mockUpQuote ?? [],
  mockUpPrice: input.mockUpPrice ?? null,
  mockUpSuggestedPrice: input.mockUpSuggestedPrice ?? null,
});

const ensureClientExists = async (clientId: number) => {
  const user = await prisma.user.findUnique({ where: { id: clientId } });
  if (!user) throw new HttpError(400, `User not found ${clientId}`);
};

const getQuoteById = async (id: number) => {
  const quote = await prisma.quote.findUnique({ where: { id } });
  if (!quote) throw new HttpError(404, `Quote not found ${id}`);
  return quote;
};

// Compact projection for the list endpoint (spec-defined shape + id for navigation).
const LIST_SELECT = {
  id: true,
  status: true,
  clientId: true,
  fullName: true,
  email: true,
  phoneNumber: true,
  isCustom: true,
  price: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const quoteService = {
  getQuotes: async ({
    page,
    perPage,
    search,
    status,
    clientId,
    sortBy = "createdAt",
    sortDirection = "desc",
  }: {
    page: number;
    perPage: number;
    search?: string;
    status?: number;
    clientId?: number;
    sortBy?: QuoteSortField;
    sortDirection?: SortDirection;
  }) => {
    const skip = (page - 1) * perPage;
    const where: Prisma.QuoteWhereInput = {};
    if (clientId !== undefined) where.clientId = clientId;
    if (status !== undefined) where.status = status;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }
    const orderBy: Prisma.QuoteOrderByWithRelationInput = { [sortBy]: sortDirection };
    const [results, total] = await prisma.$transaction([
      prisma.quote.findMany({ where, orderBy, skip, take: perPage, select: LIST_SELECT }),
      prisma.quote.count({ where }),
    ]);
    return { results, total };
  },

  getQuoteById,

  createQuote: async (input: QuoteRequestInput) => {
    validateRequest(input);
    const normalized = normalizeRequest(input);
    if (normalized.clientId !== null) await ensureClientExists(normalized.clientId);
    return prisma.quote.create({
      data: {
        ...normalized,
        // Fields outside CustomQuoteRequestData stay empty; the DB defaults handle
        // price (0) and the staff-filled quote half (null / empty arrays).
        status: QuoteStatus.SUBMITTED,
      },
    });
  },

  updateQuote: async (id: number, input: QuoteUpdateInput) => {
    const existing = await getQuoteById(id);
    validateRequest(input);
    validateQuoteHalf(input);
    const normalized = normalizeRequest(input);
    if (normalized.clientId !== null) await ensureClientExists(normalized.clientId);
    return prisma.quote.update({
      where: { id },
      data: {
        ...normalized,
        ...normalizeQuoteHalf(input),
        status: input.status ?? existing.status,
      },
    });
  },

  deleteQuote: async (id: number) => {
    await getQuoteById(id);
    await prisma.quote.delete({ where: { id } });
  },
};
