import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

export interface Product {
  name: string;
  description: string;
  slug: string;
  images?: string[];
  discountType?: string;
  discount?: number;
}

export type ProductInput = Product;

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

const validate = (input: Partial<ProductInput>) => {
  requireString(input, "name");
  requireString(input, "description");
  requireString(input, "slug");
  optionalString(input, "discountType");
  optionalNumber(input, "discount");
  optionalImages(input);
};

const normalize = (input: ProductInput) => ({
  name: input.name.trim(),
  description: input.description.trim(),
  slug: input.slug.trim(),
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
  }: {
    page: number;
    perPage: number;
    search?: string;
    categoryId?: number;
    tagSlug?: string;
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
    const [results, total] = await prisma.$transaction([
      prisma.product.findMany({ where, orderBy: { id: "asc" }, skip, take: perPage, include: { variants: true, colorOptions: true, tags: true } }),
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
};
