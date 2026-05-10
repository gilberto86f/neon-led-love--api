import { prisma } from "../prisma/client";
import { HttpError } from "../utils/HttpError";

export interface CustomPrices {
  acrylicAreaMultiplier: number;
  acrylicCostPerSquareFoot: number;
  backboardColorPriceBlack: number;
  backboardColorPriceClear: number;
  backboardColorPriceGold: number;
  backboardColorPriceSilver: number;
  backboardColorPriceWhite: number;
  backboardStyleBox: number;
  backboardStyleBoxMin: number;
  backboardStyleCutAround: number;
  backboardStyleCutAroundMin: number;
  backboardStyleInvisible: number;
  backboardStyleInvisibleMin: number;
  backboardStyleRectangular: number;
  backboardStyleRectangularMin: number;
  backboardStyleStand: number;
  backboardStyleStandMin: number;
  backboardStyleStroke: number;
  backboardStyleStrokeMin: number;
  dynamicSmartLed: number;
  eliminator: number;
  fontComplexityMultiplier: number;
  fontStyleMultiplier: number;
  lowerCaseCharacters: number;
  mockUp: number;
  remoteControlPrice: number;
  signMountingKitPrice: number;
  specialCharacters: number;
  upperCaseCharacters: number;
  wallMountingKitBlack: number;
  wallMountingKitGold: number;
  wallMountingKitSilver: number;
  waterproof: number;
  waterproofMin: number;
}

const CUSTOM_PRICE_FIELDS = [
  "acrylicAreaMultiplier",
  "acrylicCostPerSquareFoot",
  "backboardColorPriceBlack",
  "backboardColorPriceClear",
  "backboardColorPriceGold",
  "backboardColorPriceSilver",
  "backboardColorPriceWhite",
  "backboardStyleBox",
  "backboardStyleBoxMin",
  "backboardStyleCutAround",
  "backboardStyleCutAroundMin",
  "backboardStyleInvisible",
  "backboardStyleInvisibleMin",
  "backboardStyleRectangular",
  "backboardStyleRectangularMin",
  "backboardStyleStand",
  "backboardStyleStandMin",
  "backboardStyleStroke",
  "backboardStyleStrokeMin",
  "dynamicSmartLed",
  "eliminator",
  "fontComplexityMultiplier",
  "fontStyleMultiplier",
  "lowerCaseCharacters",
  "mockUp",
  "remoteControlPrice",
  "signMountingKitPrice",
  "specialCharacters",
  "upperCaseCharacters",
  "wallMountingKitBlack",
  "wallMountingKitGold",
  "wallMountingKitSilver",
  "waterproof",
  "waterproofMin",
] as const satisfies readonly (keyof CustomPrices)[];

const SINGLETON_ID = 1;

const requireNumber = (input: Partial<CustomPrices>, field: keyof CustomPrices) => {
  const value = input[field];
  if (value === undefined || value === null) {
    throw new HttpError(400, `Field is required: "${field}"`);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HttpError(400, `Field must be a finite number: "${field}"`);
  }
};

const validate = (input: Partial<CustomPrices>) => {
  if (!input || typeof input !== "object") {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  for (const field of CUSTOM_PRICE_FIELDS) requireNumber(input, field);
};

const normalize = (input: CustomPrices): CustomPrices => {
  const out = {} as CustomPrices;
  for (const field of CUSTOM_PRICE_FIELDS) out[field] = input[field];
  return out;
};

export const pricesService = {
  getCustomPrices: async () => {
    return prisma.customPrices.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  },

  updateCustomPrices: async (input: CustomPrices) => {
    validate(input);
    const data = normalize(input);
    return prisma.customPrices.upsert({
      where: { id: SINGLETON_ID },
      update: data,
      create: { id: SINGLETON_ID, ...data },
    });
  },
};
