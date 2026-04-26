import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

export interface CategoryInput {
  name: string;
  images: string[];
  slug: string;
  description: string;
  tags: string[];
  isActive: boolean;
  notes: string;
  productIds?: number[];
}

const withProducts = {
  include: { products: { select: { id: true } } },
} as const;

type CategoryWithProducts = Prisma.CategoryGetPayload<typeof withProducts>;

const toResponse = (cat: CategoryWithProducts) => {
  const { products, ...rest } = cat;
  return { ...rest, productIds: products.map((p) => p.id) };
};

const requireString = (input: Partial<CategoryInput>, field: keyof CategoryInput) => {
  const value = input[field];
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `Field is required: "${field}"`);
  }
};

const requireStringArray = (input: Partial<CategoryInput>, field: keyof CategoryInput) => {
  const value = input[field];
  if (!Array.isArray(value) || (value as unknown[]).some((v) => typeof v !== "string")) {
    throw new HttpError(400, `Field must be an array of strings: "${field}"`);
  }
};

const requireBoolean = (input: Partial<CategoryInput>, field: keyof CategoryInput) => {
  if (typeof input[field] !== "boolean") {
    throw new HttpError(400, `Field must be a boolean: "${field}"`);
  }
};

const optionalNumberArray = (input: Partial<CategoryInput>, field: keyof CategoryInput) => {
  const value = input[field];
  if (value === undefined || value === null) return;
  if (
    !Array.isArray(value) ||
    (value as unknown[]).some((v) => !Number.isInteger(v) || (v as number) <= 0)
  ) {
    throw new HttpError(400, `Field must be an array of positive integers: "${field}"`);
  }
};

const validate = (input: Partial<CategoryInput>) => {
  requireString(input, "name");
  requireStringArray(input, "images");
  requireString(input, "slug");
  requireString(input, "description");
  requireStringArray(input, "tags");
  requireBoolean(input, "isActive");
  requireString(input, "notes");
  optionalNumberArray(input, "productIds");
};

const normalize = (input: CategoryInput) => ({
  name: input.name.trim(),
  images: input.images.map((s) => s.trim()),
  slug: input.slug.trim(),
  description: input.description.trim(),
  tags: input.tags.map((s) => s.trim()),
  isActive: input.isActive,
  notes: input.notes.trim(),
});

export const categoryService = {
  getCategories: async ({ page, perPage }: { page: number; perPage: number }) => {
    const skip = (page - 1) * perPage;
    const [categories, total] = await prisma.$transaction([
      prisma.category.findMany({ orderBy: { id: "asc" }, skip, take: perPage, ...withProducts }),
      prisma.category.count(),
    ]);
    return { results: categories.map(toResponse), total };
  },

  getCategoryById: async (id: number) => {
    const category = await prisma.category.findUnique({ where: { id }, ...withProducts });
    if (!category) throw new HttpError(404, `Category not found ${id}`);
    return toResponse(category);
  },

  getCategoryBySlug: async (slug: string) => {
    const category = await prisma.category.findUnique({ where: { slug }, ...withProducts });
    if (!category) throw new HttpError(404, `Category not found "${slug}"`);
    return toResponse(category);
  },

  createCategory: async (input: CategoryInput) => {
    validate(input);
    const category = await prisma.category.create({
      data: {
        ...normalize(input),
        ...(input.productIds?.length
          ? { products: { connect: input.productIds.map((id) => ({ id })) } }
          : {}),
      },
      ...withProducts,
    });
    return toResponse(category);
  },

  updateCategory: async (id: number, input: CategoryInput) => {
    validate(input);
    await categoryService.getCategoryById(id);
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...normalize(input),
        products: { set: (input.productIds ?? []).map((pid) => ({ id: pid })) },
      },
      ...withProducts,
    });
    return toResponse(category);
  },

  deleteCategory: async (id: number) => {
    await categoryService.getCategoryById(id);
    await prisma.category.delete({ where: { id } });
  },
};
