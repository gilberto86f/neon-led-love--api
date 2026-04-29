import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

// Placeholder until Tag model is implemented
interface Tag {
  id: number;
}

export interface Category {
  id: number;
  name: string;
  images: string[];
  slug: string;
  description: string;
  tagIds: Tag["id"][];
  isActive: boolean;
  notes: string;
  productIds: number[];
}

export type CategoryPayload = Pick<
  Category,
  "id" | "name" | "slug" | "description" | "isActive" | "notes"
>;

const withProducts = {
  include: { products: { select: { id: true } } },
} as const;

type CategoryWithProducts = Prisma.CategoryGetPayload<typeof withProducts>;

const toResponse = (cat: CategoryWithProducts) => {
  const { products, ...rest } = cat;
  return {
    ...rest,
    tagIds: [] as Tag["id"][], // populated once Tag relation is implemented
    productIds: products.map((p) => p.id),
  };
};

const requireString = (input: Partial<CategoryPayload>, field: keyof CategoryPayload) => {
  const value = input[field];
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `Field is required: "${field}"`);
  }
};

const requireBoolean = (input: Partial<CategoryPayload>, field: keyof CategoryPayload) => {
  if (typeof input[field] !== "boolean") {
    throw new HttpError(400, `Field must be a boolean: "${field}"`);
  }
};

const validate = (input: Partial<CategoryPayload>) => {
  requireString(input, "name");
  requireString(input, "slug");
  requireString(input, "description");
  requireBoolean(input, "isActive");
  requireString(input, "notes");
};

const normalize = (input: CategoryPayload) => ({
  name: input.name.trim(),
  slug: input.slug.trim(),
  description: input.description.trim(),
  isActive: input.isActive,
  notes: input.notes.trim(),
});

export const categoryService = {
  getCategories: async ({
    page,
    perPage,
    productId,
  }: {
    page: number;
    perPage: number;
    productId?: number;
  }) => {
    const skip = (page - 1) * perPage;
    const where = productId !== undefined ? { products: { some: { id: productId } } } : undefined;
    const [categories, total] = await prisma.$transaction([
      prisma.category.findMany({ where, orderBy: { id: "asc" }, skip, take: perPage, ...withProducts }),
      prisma.category.count({ where }),
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

  createCategory: async (input: CategoryPayload) => {
    validate(input);
    const category = await prisma.category.create({
      data: { images: [], tags: [], ...normalize(input) },
      ...withProducts,
    });
    return toResponse(category);
  },

  updateCategory: async (id: number, input: CategoryPayload) => {
    validate(input);
    await categoryService.getCategoryById(id);
    const category = await prisma.category.update({
      where: { id },
      data: normalize(input),
      ...withProducts,
    });
    return toResponse(category);
  },

  deleteCategory: async (id: number) => {
    await categoryService.getCategoryById(id);
    await prisma.category.delete({ where: { id } });
  },
};
