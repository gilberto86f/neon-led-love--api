import { prisma } from '../prisma/client';
import { HttpError } from '../utils/HttpError';

export type ProductInput = {
  name: string;
  description: string;
};

const validate = (input: Partial<ProductInput>) => {
  if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
    throw new HttpError(400, 'Field "name" is required');
  }
  if (
    !input.description ||
    typeof input.description !== 'string' ||
    !input.description.trim()
  ) {
    throw new HttpError(400, 'Field "description" is required');
  }
};

export const productService = {
  list: () => prisma.product.findMany({ orderBy: { id: 'asc' } }),

  getById: async (id: number) => {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new HttpError(404, `Product ${id} not found`);
    return product;
  },

  create: async (input: ProductInput) => {
    validate(input);
    return prisma.product.create({
      data: { name: input.name.trim(), description: input.description.trim() },
    });
  },

  update: async (id: number, input: ProductInput) => {
    validate(input);
    await productService.getById(id);
    return prisma.product.update({
      where: { id },
      data: { name: input.name.trim(), description: input.description.trim() },
    });
  },

  remove: async (id: number) => {
    await productService.getById(id);
    await prisma.product.delete({ where: { id } });
  },
};
