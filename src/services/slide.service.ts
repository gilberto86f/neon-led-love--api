import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

export interface Slide {
  id: number;
  isActive: boolean;
  position: number;
  imageUrl?: string;
  styleClass?: string;
  title?: string;
  description?: string;
  buttonLabel?: string;
  route?: string;
  innerHtml?: string;
  justifyContent?: string;
}

export type SlideInput = Omit<Slide, "id" | "position">;

const ns = (v?: string | null) => v?.trim() || null;

const validate = (input: Partial<SlideInput>) => {
  if (typeof input.isActive !== "boolean") {
    throw new HttpError(400, 'Field must be a boolean: "isActive"');
  }
};

const normalize = (input: SlideInput) => ({
  isActive: input.isActive,
  imageUrl: ns(input.imageUrl),
  styleClass: ns(input.styleClass),
  title: ns(input.title),
  description: ns(input.description),
  buttonLabel: ns(input.buttonLabel),
  route: ns(input.route),
  innerHtml: ns(input.innerHtml),
  justifyContent: ns(input.justifyContent),
});

const getSlideById = async (id: number) => {
  const slide = await prisma.slide.findUnique({ where: { id } });
  if (!slide) throw new HttpError(404, `Slide not found ${id}`);
  return slide;
};

export const slideService = {
  getSlides: async ({
    page,
    perPage,
    isActive,
  }: {
    page: number;
    perPage: number;
    isActive?: boolean;
  }) => {
    const skip = (page - 1) * perPage;
    const where: Prisma.SlideWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;
    const [results, total] = await prisma.$transaction([
      prisma.slide.findMany({
        where,
        orderBy: { position: "asc" },
        skip,
        take: perPage,
      }),
      prisma.slide.count({ where }),
    ]);
    return { results, total };
  },

  getSlideById: async (id: number) => getSlideById(id),

  createSlide: async (input: SlideInput) => {
    validate(input);
    const normalized = normalize(input);
    const maxSlide = await prisma.slide.findFirst({
      orderBy: { position: "desc" },
    });
    const position = (maxSlide?.position ?? 0) + 1;
    return prisma.slide.create({ data: { ...normalized, position } });
  },

  updateSlide: async (id: number, input: SlideInput) => {
    await getSlideById(id);
    validate(input);
    const normalized = normalize(input);
    return prisma.slide.update({ where: { id }, data: normalized });
  },

  reorderSlide: async (slideId: number, newPosition: number) => {
    const slide = await getSlideById(slideId);
    const oldPos = slide.position;

    const total = await prisma.slide.count();
    if (newPosition > total) {
      throw new HttpError(
        400,
        `newPosition ${newPosition} exceeds total slides (${total})`,
      );
    }

    if (oldPos === newPosition) return slide;

    return prisma.$transaction(async (tx) => {
      // Move to a safe out-of-range temp position to free the current slot.
      // PostgreSQL checks @unique after EACH individual row update (non-deferrable constraint),
      // so we must process the shift in an order where each target slot is already free.
      await tx.slide.update({
        where: { id: slideId },
        data: { position: total + 1000 },
      });

      if (newPosition > oldPos) {
        // Moving down: decrement [oldPos+1 … newPos].
        // Process lowest-first so each slot is free before the next row needs it.
        const affected = await tx.slide.findMany({
          where: { position: { gt: oldPos, lte: newPosition } },
          orderBy: { position: "asc" },
        });
        for (const s of affected) {
          await tx.slide.update({
            where: { id: s.id },
            data: { position: s.position - 1 },
          });
        }
      } else {
        // Moving up: increment [newPos … oldPos-1].
        // Process highest-first so each slot is free before the next row needs it.
        const affected = await tx.slide.findMany({
          where: { position: { gte: newPosition, lt: oldPos } },
          orderBy: { position: "desc" },
        });
        for (const s of affected) {
          await tx.slide.update({
            where: { id: s.id },
            data: { position: s.position + 1 },
          });
        }
      }

      return tx.slide.update({
        where: { id: slideId },
        data: { position: newPosition },
      });
    });
  },
};
