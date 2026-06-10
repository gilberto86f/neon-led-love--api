import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

export interface Product {
  name: string;
  description: string;
  slug: string;
  isActive: boolean;
  images?: string[];
  discountType?: string;
  discount?: number;
}

export type ProductInput = Product;

export const PRODUCT_SORT_FIELDS = ["id", "name", "createdAt", "updatedAt"] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const requireString = (input: Partial<ProductInput>, field: keyof Product) => {
  const value = input[field];
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `Field is required: "${field}"`);
  }
};

const optionalString = (input: Partial<ProductInput>, field: keyof Product) => {
  const value = input[field];
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new HttpError(400, `Field must be a string: "${field}"`);
  }
};

const optionalNumber = (input: Partial<ProductInput>, field: keyof Product) => {
  const value = input[field];
  if (value !== undefined && value !== null && typeof value !== "number") {
    throw new HttpError(400, `Field must be a number: "${field}"`);
  }
};

const optionalImages = (input: Partial<ProductInput>) => {
  const value = input.images;
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) {
    throw new HttpError(400, `Field must be an array of strings: "images"`);
  }
  for (const url of value) {
    if (typeof url !== "string" || !url.trim()) {
      throw new HttpError(400, `Field "images" must contain non-empty strings`);
    }
  }
  if (new Set(value.map((u) => u.trim())).size !== value.length) {
    throw new HttpError(400, `Field "images" must not contain duplicates`);
  }
};

const requireBoolean = (input: Partial<ProductInput>, field: keyof Product) => {
  if (typeof input[field] !== "boolean") {
    throw new HttpError(400, `Field must be a boolean: "${field}"`);
  }
};

const validate = (input: Partial<ProductInput>) => {
  requireString(input, "name");
  requireString(input, "description");
  requireString(input, "slug");
  requireBoolean(input, "isActive");
  optionalString(input, "discountType");
  optionalNumber(input, "discount");
  optionalImages(input);
};

const RELATED_DEFAULT_LIMIT = 8;
const TOKEN_MIN_LENGTH = 3;

const tokenize = (text: string): Set<string> => {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= TOKEN_MIN_LENGTH);
  return new Set(tokens);
};

const shuffle = <T>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const normalize = (input: ProductInput) => ({
  name: input.name.trim(),
  description: input.description.trim(),
  slug: input.slug.trim(),
  isActive: input.isActive,
  images: input.images?.map((u) => u.trim()) ?? [],
  discountType: input.discountType?.trim() || null,
  discount: input.discount ?? null,
});

export const productService = {
  list: async ({
    page,
    perPage,
    search,
    categoryId,
    tagSlug,
    isActive,
    sortBy = "updatedAt",
    sortDirection = "desc",
  }: {
    page: number;
    perPage: number;
    search?: string;
    categoryId?: number;
    tagSlug?: string;
    isActive?: boolean;
    sortBy?: ProductSortField;
    sortDirection?: SortDirection;
  }) => {
    const skip = (page - 1) * perPage;
    const where: Prisma.ProductWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }
    if (categoryId !== undefined) {
      where.categories = { some: { id: categoryId } };
    }
    if (tagSlug) {
      where.tags = { some: { slug: tagSlug } };
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    const orderBy: Prisma.ProductOrderByWithRelationInput = { [sortBy]: sortDirection };
    const [results, total] = await prisma.$transaction([
      prisma.product.findMany({ where, orderBy, skip, take: perPage, include: { variants: true, colorOptions: true, tags: true } }),
      prisma.product.count({ where }),
    ]);
    return { results, total };
  },

  getBySlug: async (slug: string) => {
    const product = await prisma.product.findUnique({ where: { slug }, include: { variants: true, colorOptions: true, tags: true } });
    if (!product) throw new HttpError(404, `Product not found "${slug}"`);
    return product;
  },

  getById: async (id: number) => {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new HttpError(404, `Product not found ${id}`);
    return product;
  },

  create: async (input: ProductInput) => {
    validate(input);
    return prisma.product.create({ data: normalize(input), include: { variants: true, colorOptions: true, tags: true } });
  },

  update: async (id: number, input: ProductInput) => {
    validate(input);
    await productService.getById(id);
    return prisma.product.update({
      where: { id },
      data: normalize(input),
      include: { variants: true, colorOptions: true, tags: true },
    });
  },

  remove: async (id: number) => {
    await productService.getById(id);
    await prisma.product.delete({ where: { id } });
  },

  getRelatedProducts: async (productId: number | undefined, limit: number = RELATED_DEFAULT_LIMIT) => {
    if (productId === undefined) {
      const pool = await prisma.product.findMany({ select: { id: true } });
      const pickedIds = shuffle(pool.map((p) => p.id)).slice(0, limit);
      if (!pickedIds.length) return [];
      const products = await prisma.product.findMany({
        where: { id: { in: pickedIds } },
        include: { variants: true, colorOptions: true, tags: true },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      return pickedIds.map((id) => byId.get(id)!).filter(Boolean);
    }

    const source = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        categories: { select: { id: true } },
        tags: { select: { id: true } },
      },
    });
    if (!source) throw new HttpError(404, `Product not found ${productId}`);

    const categoryIds = source.categories.map((c) => c.id);
    const tagIds = source.tags.map((t) => t.id);
    const sourceTokens = tokenize(`${source.name} ${source.description}`);

    const orClauses: Prisma.ProductWhereInput[] = [];
    if (categoryIds.length) orClauses.push({ categories: { some: { id: { in: categoryIds } } } });
    if (tagIds.length) orClauses.push({ tags: { some: { id: { in: tagIds } } } });

    const candidates = orClauses.length
      ? await prisma.product.findMany({
          where: { id: { not: productId }, OR: orClauses },
          include: {
            variants: true,
            colorOptions: true,
            tags: true,
            categories: { select: { id: true } },
          },
        })
      : [];

    const scored = candidates
      .map((p) => {
        const sharedCats = p.categories.filter((c) => categoryIds.includes(c.id)).length;
        const sharedTags = p.tags.filter((t) => tagIds.includes(t.id)).length;
        const candTokens = tokenize(`${p.name} ${p.description}`);
        let sharedTokens = 0;
        for (const t of candTokens) if (sourceTokens.has(t)) sharedTokens++;
        const score = sharedCats * 5 + sharedTags * 3 + sharedTokens;
        return { product: p, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.product.id - b.product.id);

    const related = scored.slice(0, limit).map(({ product }) => {
      const { categories: _categories, ...rest } = product;
      return rest;
    });

    if (related.length < limit) {
      const taken = new Set<number>([productId, ...related.map((r) => r.id)]);
      const pool = await prisma.product.findMany({
        where: { id: { notIn: [...taken] } },
        select: { id: true },
      });
      const fillerIds = shuffle(pool.map((p) => p.id)).slice(0, limit - related.length);
      if (fillerIds.length) {
        const fillers = await prisma.product.findMany({
          where: { id: { in: fillerIds } },
          include: { variants: true, colorOptions: true, tags: true },
        });
        const byId = new Map(fillers.map((f) => [f.id, f]));
        for (const id of fillerIds) {
          const f = byId.get(id);
          if (f) related.push(f);
        }
      }
    }

    return related;
  },
};
