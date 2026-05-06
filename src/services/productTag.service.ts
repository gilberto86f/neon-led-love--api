import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { productService } from "./product.service";
import { tagService } from "./tag.service";

const withTags = {
  include: { tags: { select: { id: true } } },
} as const;

type ProductWithTags = Prisma.ProductGetPayload<typeof withTags>;

const toResponse = (product: ProductWithTags) => {
  const { tags, ...rest } = product;
  return { ...rest, tagIds: tags.map((t) => t.id) };
};

export const productTagService = {
  list: async (productId: number) => {
    await productService.getById(productId);
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { tags: { orderBy: { id: "asc" } } },
    });
    return product?.tags ?? [];
  },

  addTag: async (productId: number, tagId: number) => {
    await productService.getById(productId);
    await tagService.getTagById(tagId);
    const product = await prisma.product.update({
      where: { id: productId },
      data: { tags: { connect: { id: tagId } } },
      ...withTags,
    });
    return toResponse(product);
  },

  removeTag: async (productId: number, tagId: number) => {
    await productService.getById(productId);
    await tagService.getTagById(tagId);
    const product = await prisma.product.update({
      where: { id: productId },
      data: { tags: { disconnect: { id: tagId } } },
      ...withTags,
    });
    return toResponse(product);
  },
};
