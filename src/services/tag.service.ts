import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

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

const ensureUniqueSlug = async (slug: string, excludeTagId?: number) => {
  const existing = await prisma.tag.findFirst({
    where: {
      slug,
      ...(excludeTagId !== undefined ? { NOT: { id: excludeTagId } } : {}),
    },
  });
  if (existing) throw new HttpError(400, `Tag with slug "${slug}" already exists`);
};

const getTagById = async (id: number) => {
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) throw new HttpError(404, `Tag not found ${id}`);
  return tag;
};

export const tagService = {
  getTags: async ({
    page,
    perPage,
    search,
  }: {
    page: number;
    perPage: number;
    search?: string;
  }) => {
    const skip = (page - 1) * perPage;
    const where: Prisma.TagWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }
    const [results, total] = await prisma.$transaction([
      prisma.tag.findMany({ where, orderBy: { id: "asc" }, skip, take: perPage }),
      prisma.tag.count({ where }),
    ]);
    return { results, total };
  },

  getTagBySlug: async (slug: string) => {
    const tag = await prisma.tag.findUnique({ where: { slug } });
    if (!tag) throw new HttpError(404, `Tag not found "${slug}"`);
    return tag;
  },

  getTagById,

  createTag: async (input: TagInput) => {
    validate(input);
    const normalized = normalize(input);
    await ensureUniqueSlug(normalized.slug);
    return prisma.tag.create({ data: normalized });
  },

  updateTag: async (id: number, input: TagInput) => {
    await getTagById(id);
    validate(input);
    const normalized = normalize(input);
    await ensureUniqueSlug(normalized.slug, id);
    return prisma.tag.update({ where: { id }, data: normalized });
  },

  deleteTag: async (id: number) => {
    await getTagById(id);
    await prisma.tag.delete({ where: { id } });
  },
};
