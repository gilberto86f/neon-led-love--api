import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { productService } from "./product.service";
import { categoryService } from "./category.service";

const withCategories = {
  include: { categories: { select: { id: true } } },
} as const;

type ProductWithCategories = Prisma.ProductGetPayload<typeof withCategories>;

const toResponse = (product: ProductWithCategories) => {
  const { categories, ...rest } = product;
  return { ...rest, categoryIds: categories.map((c) => c.id) };
};

export const productCategoryService = {
  addCategory: async (productId: number, categoryId: number) => {
    await productService.getById(productId);
    await categoryService.getCategoryById(categoryId);
    const product = await prisma.product.update({
      where: { id: productId },
      data: { categories: { connect: { id: categoryId } } },
      ...withCategories,
    });
    return toResponse(product);
  },

  removeCategory: async (productId: number, categoryId: number) => {
    await productService.getById(productId);
    await categoryService.getCategoryById(categoryId);
    const product = await prisma.product.update({
      where: { id: productId },
      data: { categories: { disconnect: { id: categoryId } } },
      ...withCategories,
    });
    return toResponse(product);
  },
};
