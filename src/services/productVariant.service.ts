import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";
import { productService } from "./product.service";

export interface ProductVariant {
  id: number;
  price: number;
  width: number;
  height: number;
  sizeUnit: string;
}

export type ProductVariantInput = Omit<ProductVariant, "id">;

const getVariantOrThrow = async (productId: number, variantId: number) => {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
  });
  if (!variant) throw new HttpError(404, `Variant ${variantId} not found for product ${productId}`);
  return variant;
};

const validate = (input: Partial<ProductVariantInput>) => {
  if (typeof input.price !== "number" || input.price <= 0)
    throw new HttpError(400, 'Field must be a positive number: "price"');
  if (typeof input.width !== "number" || input.width <= 0)
    throw new HttpError(400, 'Field must be a positive number: "width"');
  if (typeof input.height !== "number" || input.height <= 0)
    throw new HttpError(400, 'Field must be a positive number: "height"');
  if (!input.sizeUnit || !["cm", "inch"].includes(String(input.sizeUnit).trim()))
    throw new HttpError(400, 'Field "sizeUnit" must be "cm" or "inch"');
};

const normalize = (input: ProductVariantInput) => ({
  price: input.price,
  width: input.width,
  height: input.height,
  sizeUnit: String(input.sizeUnit).trim(),
});

export const productVariantService = {
  list: async (productId: number) => {
    await productService.getById(productId);
    return prisma.productVariant.findMany({
      where: { productId },
      orderBy: { id: "asc" },
    });
  },

  create: async (productId: number, input: ProductVariantInput) => {
    await productService.getById(productId);
    validate(input);
    return prisma.productVariant.create({
      data: { ...normalize(input), productId },
    });
  },

  update: async (productId: number, variantId: number, input: ProductVariantInput) => {
    await getVariantOrThrow(productId, variantId);
    validate(input);
    return prisma.productVariant.update({
      where: { id: variantId },
      data: normalize(input),
    });
  },

  remove: async (productId: number, variantId: number) => {
    await getVariantOrThrow(productId, variantId);
    await prisma.productVariant.delete({ where: { id: variantId } });
  },
};
