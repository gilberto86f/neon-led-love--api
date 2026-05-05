import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";
import { productService } from "./product.service";

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export type TagInput = Omit<Tag, "id">;

const validate = (input: Partial<TagInput>) => {
  if (typeof input.name !== "string" || !input.name.trim())
    throw new HttpError(400, 'Field is required: "name"');
  if (typeof input.slug !== "string" || !input.slug.trim())
    throw new HttpError(400, 'Field is required: "slug"');
};

const normalize = (input: TagInput) => ({
  name: input.name.trim(),
  slug: input.slug.trim(),
});

const ensureUniqueSlug = async (productId: number, slug: string, excludeTagId?: number) => {
  const existing = await prisma.tag.findFirst({
    where: {
      productId,
      slug,
      ...(excludeTagId !== undefined ? { NOT: { id: excludeTagId } } : {}),
    },
  });
  if (existing)
    throw new HttpError(400, `Tag with slug "${slug}" already exists for this product`);
};

const getTagOrThrow = async (productId: number, tagId: number) => {
  const tag = await prisma.tag.findFirst({
    where: { id: tagId, productId },
  });
  if (!tag) throw new HttpError(404, `Tag ${tagId} not found for product ${productId}`);
  return tag;
};

export const tagService = {
  list: async (productId: number) => {
    await productService.getById(productId);
    return prisma.tag.findMany({
      where: { productId },
      orderBy: { id: "asc" },
    });
  },

  create: async (productId: number, input: TagInput) => {
    await productService.getById(productId);
    validate(input);
    const normalized = normalize(input);
    await ensureUniqueSlug(productId, normalized.slug);
    return prisma.tag.create({
      data: { ...normalized, productId },
    });
  },

  update: async (productId: number, tagId: number, input: TagInput) => {
    await getTagOrThrow(productId, tagId);
    validate(input);
    const normalized = normalize(input);
    await ensureUniqueSlug(productId, normalized.slug, tagId);
    return prisma.tag.update({
      where: { id: tagId },
      data: normalized,
    });
  },

  remove: async (productId: number, tagId: number) => {
    await getTagOrThrow(productId, tagId);
    await prisma.tag.delete({ where: { id: tagId } });
  },
};
