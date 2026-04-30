import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

export interface Product {
  name: string;
  description: string;
  slug: string;
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

const validate = (input: Partial<ProductInput>) => {
  requireString(input, "name");
  requireString(input, "description");
  requireString(input, "slug");
  optionalString(input, "discountType");
  optionalNumber(input, "discount");
};

const normalize = (input: ProductInput) => ({
  name: input.name.trim(),
  description: input.description.trim(),
  slug: input.slug.trim(),
  discountType: input.discountType?.trim() || null,
  discount: input.discount ?? null,
});

export const productService = {
  list: async ({
    page,
    perPage,
    search,
    categoryId,
  }: {
    page: number;
    perPage: number;
    search?: string;
    categoryId?: number;
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
    const [results, total] = await prisma.$transaction([
      prisma.product.findMany({ where, orderBy: { id: "asc" }, skip, take: perPage }),
      prisma.product.count({ where }),
    ]);
    return { results, total };
  },

  getBySlug: async (slug: string) => {
    const product = await prisma.product.findUnique({ where: { slug } });
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
    return prisma.product.create({ data: normalize(input) });
  },

  update: async (id: number, input: ProductInput) => {
    validate(input);
    await productService.getById(id);
    return prisma.product.update({
      where: { id },
      data: normalize(input),
    });
  },

  remove: async (id: number) => {
    await productService.getById(id);
    await prisma.product.delete({ where: { id } });
  },
};
