import { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";
import { productService } from "./product.service";

export type Color = {
  colorName: string;
  label: string;
  colorCode: string;
  light: boolean;
  simpleColor: boolean;
};

export interface ProductColorOption {
  id: number;
  description: string;
  colors: Color[];
  defaultColor: Color;
}

export type ProductColorOptionInput = Omit<ProductColorOption, "id">;

const validateColor = (raw: unknown, path: string): Color => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new HttpError(400, `Field "${path}" must be a Color object`);
  const c = raw as Record<string, unknown>;
  const stringFields: (keyof Color)[] = ["colorName", "label", "colorCode"];
  for (const f of stringFields) {
    const v = c[f];
    if (typeof v !== "string" || !v.trim())
      throw new HttpError(400, `Field is required: "${path}.${f}"`);
  }
  if (typeof c.light !== "boolean")
    throw new HttpError(400, `Field "${path}.light" must be a boolean`);
  if (typeof c.simpleColor !== "boolean")
    throw new HttpError(400, `Field "${path}.simpleColor" must be a boolean`);
  return {
    colorName: (c.colorName as string).trim(),
    label: (c.label as string).trim(),
    colorCode: (c.colorCode as string).trim(),
    light: c.light,
    simpleColor: c.simpleColor,
  };
};

const validate = (input: Partial<ProductColorOptionInput>) => {
  if (typeof input.description !== "string" || !input.description.trim())
    throw new HttpError(400, 'Field is required: "description"');
  if (!Array.isArray(input.colors) || input.colors.length === 0)
    throw new HttpError(400, 'Field "colors" must be a non-empty array');
  input.colors.forEach((c, i) => validateColor(c, `colors[${i}]`));
  if (!input.defaultColor)
    throw new HttpError(400, 'Field is required: "defaultColor"');
  validateColor(input.defaultColor, "defaultColor");
};

const normalize = (input: ProductColorOptionInput) => ({
  description: input.description.trim(),
  colors: input.colors.map((c, i) => validateColor(c, `colors[${i}]`)) as unknown as Prisma.InputJsonValue,
  defaultColor: validateColor(input.defaultColor, "defaultColor") as unknown as Prisma.InputJsonValue,
});

const cast = <T extends { colors: Prisma.JsonValue; defaultColor: Prisma.JsonValue }>(row: T) => ({
  ...row,
  colors: row.colors as unknown as Color[],
  defaultColor: row.defaultColor as unknown as Color,
});

const getOptionOrThrow = async (productId: number, optionId: number) => {
  const option = await prisma.productColorOption.findFirst({
    where: { id: optionId, productId },
  });
  if (!option) throw new HttpError(404, `Color option ${optionId} not found for product ${productId}`);
  return option;
};

export const productColorOptionService = {
  list: async (productId: number) => {
    await productService.getById(productId);
    const rows = await prisma.productColorOption.findMany({
      where: { productId },
      orderBy: { id: "asc" },
    });
    return rows.map(cast);
  },

  create: async (productId: number, input: ProductColorOptionInput) => {
    await productService.getById(productId);
    validate(input);
    const row = await prisma.productColorOption.create({
      data: { ...normalize(input), productId },
    });
    return cast(row);
  },

  update: async (productId: number, optionId: number, input: ProductColorOptionInput) => {
    await getOptionOrThrow(productId, optionId);
    validate(input);
    const row = await prisma.productColorOption.update({
      where: { id: optionId },
      data: normalize(input),
    });
    return cast(row);
  },

  remove: async (productId: number, optionId: number) => {
    await getOptionOrThrow(productId, optionId);
    await prisma.productColorOption.delete({ where: { id: optionId } });
  },
};
