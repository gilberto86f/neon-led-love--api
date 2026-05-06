const paginationParameters = [
  {
    name: "page",
    in: "query",
    description: "Page number (1-based). Defaults to 1.",
    schema: { type: "integer", default: 1, minimum: 1 },
  },
  {
    name: "perPage",
    in: "query",
    description: "Items per page. Defaults to 20, max 100.",
    schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
  },
];

const errorResponse = {
  description: "Error",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
};

export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Neon LED Love API",
    version: "0.1.0",
    description:
      "REST API for the Neon LED Love e-commerce platform. Sells LED neon signs.\n\n" +
      "Every response — success or error — uses the same `ApiNeonResponse` envelope:\n" +
      "- List endpoints return `results[]` + `total` + `page` + `perPage`.\n" +
      "- Single-item endpoints return `data`.\n" +
      "- Errors return `success: 0` + `error` message.",
  },
  servers: [{ url: "http://localhost:3000", description: "Local dev server" }],
  tags: [
    { name: "Health", description: "Server health check" },
    { name: "Products", description: "LED neon sign products" },
    { name: "Categories", description: "Product categories" },
    { name: "Product-Category", description: "Link and unlink products from categories" },
    { name: "Variants", description: "Size and price variants of a product" },
    { name: "Color Options", description: "Available color choices for a product" },
    { name: "Tags", description: "Tags belonging to a product" },
    { name: "Prices", description: "Pricing configuration for the Custom Neon builder" },
  ],
  components: {
    parameters: {
      productId: {
        name: "id",
        in: "path",
        required: true,
        description: "Numeric product ID",
        schema: { type: "integer", minimum: 1 },
      },
      productSlug: {
        name: "slug",
        in: "path",
        required: true,
        description: "URL-friendly product identifier (e.g. `neon-heart`)",
        schema: { type: "string" },
      },
      categoryId: {
        name: "id",
        in: "path",
        required: true,
        description: "Numeric category ID",
        schema: { type: "integer", minimum: 1 },
      },
      categorySlug: {
        name: "slug",
        in: "path",
        required: true,
        description: "URL-friendly category identifier (e.g. `outdoor-signs`)",
        schema: { type: "string" },
      },
      relationProductId: {
        name: "productId",
        in: "path",
        required: true,
        description: "Numeric product ID",
        schema: { type: "integer", minimum: 1 },
      },
      relationCategoryId: {
        name: "categoryId",
        in: "path",
        required: true,
        description: "Numeric category ID",
        schema: { type: "integer", minimum: 1 },
      },
      variantProductId: {
        name: "productId",
        in: "path",
        required: true,
        description: "Numeric product ID",
        schema: { type: "integer", minimum: 1 },
      },
      variantId: {
        name: "variantId",
        in: "path",
        required: true,
        description: "Numeric variant ID",
        schema: { type: "integer", minimum: 1 },
      },
      colorOptionProductId: {
        name: "productId",
        in: "path",
        required: true,
        description: "Numeric product ID",
        schema: { type: "integer", minimum: 1 },
      },
      colorOptionId: {
        name: "optionId",
        in: "path",
        required: true,
        description: "Numeric color option ID",
        schema: { type: "integer", minimum: 1 },
      },
      tagProductId: {
        name: "productId",
        in: "path",
        required: true,
        description: "Numeric product ID",
        schema: { type: "integer", minimum: 1 },
      },
      tagId: {
        name: "tagId",
        in: "path",
        required: true,
        description: "Numeric tag ID",
        schema: { type: "integer", minimum: 1 },
      },
    },
    schemas: {
      // ── Entities ──────────────────────────────────────────────────────────
      Product: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Neon Heart" },
          description: { type: "string", example: "Pink LED neon heart sign" },
          slug: { type: "string", example: "neon-heart" },
          discountType: {
            type: "string",
            nullable: true,
            example: "percentage",
          },
          discount: { type: "integer", nullable: true, example: 10 },
          variants: {
            type: "array",
            items: { $ref: "#/components/schemas/ProductVariant" },
            description:
              "Size/price variants for this product. Managed via the Variants endpoints.",
          },
          colorOptions: {
            type: "array",
            items: { $ref: "#/components/schemas/ProductColorOption" },
            description:
              "Available color choices for this product. Managed via the Color Options endpoints.",
          },
          tags: {
            type: "array",
            items: { $ref: "#/components/schemas/Tag" },
            description:
              "Tags belonging to this product. Managed via the Tags endpoints.",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Tag: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Outdoor" },
          slug: { type: "string", example: "outdoor" },
          productId: { type: "integer", example: 1 },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      TagInput: {
        type: "object",
        required: ["name", "slug"],
        description:
          "Fields accepted when creating or updating a tag. " +
          "`slug` must be unique per product (case-sensitive after trim).",
        properties: {
          name: { type: "string", example: "Outdoor" },
          slug: { type: "string", example: "outdoor" },
        },
      },
      Color: {
        type: "object",
        required: ["colorName", "label", "colorCode", "light", "simpleColor"],
        properties: {
          colorName: { type: "string", example: "warm-white" },
          label: { type: "string", example: "Warm White" },
          colorCode: { type: "string", example: "#FFE6B3" },
          light: { type: "boolean", example: true },
          simpleColor: { type: "boolean", example: false },
        },
      },
      ProductColorOption: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          description: { type: "string", example: "LED color" },
          colors: {
            type: "array",
            items: { $ref: "#/components/schemas/Color" },
          },
          defaultColor: { $ref: "#/components/schemas/Color" },
          productId: { type: "integer", example: 1 },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ProductColorOptionInput: {
        type: "object",
        required: ["description", "colors", "defaultColor"],
        description:
          "Fields accepted when creating or updating a color option. " +
          "`colors` must be a non-empty array; each color and `defaultColor` must be a full Color object.",
        properties: {
          description: { type: "string", example: "LED color" },
          colors: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/Color" },
          },
          defaultColor: { $ref: "#/components/schemas/Color" },
        },
      },
      ProductVariant: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          price: { type: "number", example: 29.99 },
          width: { type: "number", example: 30 },
          height: { type: "number", example: 15 },
          sizeUnit: { type: "string", enum: ["cm", "inch"], example: "cm" },
          productId: { type: "integer", example: 1 },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ProductVariantInput: {
        type: "object",
        required: ["price", "width", "height", "sizeUnit"],
        description:
          "Fields accepted when creating or updating a variant. " +
          "All four are required and must be positive numbers; `sizeUnit` must be `cm` or `inch`.",
        properties: {
          price: { type: "number", example: 29.99, description: "Must be > 0." },
          width: { type: "number", example: 30, description: "Must be > 0." },
          height: { type: "number", example: 15, description: "Must be > 0." },
          sizeUnit: { type: "string", enum: ["cm", "inch"], example: "cm" },
        },
      },
      ProductInput: {
        type: "object",
        required: ["name", "description", "slug"],
        properties: {
          name: { type: "string", example: "Neon Heart" },
          description: { type: "string", example: "Pink LED neon heart sign" },
          slug: {
            type: "string",
            example: "neon-heart",
            description:
              "Unique URL-friendly identifier. Trimmed before saving.",
          },
          discountType: {
            type: "string",
            example: "percentage",
            description:
              'Free-form discount label (e.g. "percentage", "fixed").',
          },
          discount: {
            type: "integer",
            example: 10,
            description: "Integer discount value (e.g. 10 for 10%).",
          },
        },
      },
      Category: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Outdoor Signs" },
          images: {
            type: "array",
            items: { type: "string" },
            example: ["https://cdn.example.com/outdoor.jpg"],
          },
          slug: { type: "string", example: "outdoor-signs" },
          description: {
            type: "string",
            example: "Signs designed for outdoor use.",
          },
          tagIds: {
            type: "array",
            items: { type: "integer" },
            example: [1, 2],
            description: "IDs of tags linked to this category. Managed by the Tag service (not yet implemented).",
          },
          isActive: { type: "boolean", example: true },
          notes: { type: "string", example: "Seasonal promotion applies." },
          productIds: {
            type: "array",
            items: { type: "integer" },
            example: [1, 2, 3],
            description: "IDs of products linked to this category. Managed by the Product-Category relation service (not yet implemented).",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CategoryPayload: {
        type: "object",
        required: ["name", "slug", "description", "isActive", "notes"],
        description:
          "Fields accepted when creating or updating a category. " +
          "images, tagIds, and productIds are managed by dedicated services and cannot be set here.",
        properties: {
          name: { type: "string", example: "Outdoor Signs" },
          slug: { type: "string", example: "outdoor-signs" },
          description: {
            type: "string",
            example: "Signs designed for outdoor use.",
          },
          isActive: { type: "boolean", example: true },
          notes: { type: "string", example: "Seasonal promotion applies." },
        },
      },
      ProductWithCategories: {
        type: "object",
        description: "A product including the IDs of its linked categories.",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Neon Heart" },
          description: { type: "string", example: "Pink LED neon heart sign" },
          slug: { type: "string", example: "neon-heart" },
          discountType: { type: "string", nullable: true, example: "percentage" },
          discount: { type: "integer", nullable: true, example: 10 },
          categoryIds: {
            type: "array",
            items: { type: "integer" },
            example: [1, 2],
            description: "IDs of categories this product is currently linked to.",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      // ── Response envelopes ────────────────────────────────────────────────
      ErrorResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [0], example: 0 },
          status: { type: "integer", example: 400 },
          error: { type: "string", example: 'Field is required: "name"' },
        },
      },
      DeletedResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: {
            type: "object",
            properties: {
              id: { type: "integer", example: 1 },
              deleted: { type: "boolean", example: true },
            },
          },
        },
      },
      ProductResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: { $ref: "#/components/schemas/Product" },
        },
      },
      ProductListResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          results: {
            type: "array",
            items: { $ref: "#/components/schemas/Product" },
          },
          total: { type: "integer", example: 45 },
          page: { type: "integer", example: 1 },
          perPage: { type: "integer", example: 20 },
        },
      },
      CategoryResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: { $ref: "#/components/schemas/Category" },
        },
      },
      ProductWithCategoriesResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: { $ref: "#/components/schemas/ProductWithCategories" },
        },
      },
      CategoryListResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          results: {
            type: "array",
            items: { $ref: "#/components/schemas/Category" },
          },
          total: { type: "integer", example: 12 },
          page: { type: "integer", example: 1 },
          perPage: { type: "integer", example: 20 },
        },
      },
      ProductVariantResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: { $ref: "#/components/schemas/ProductVariant" },
        },
      },
      ProductVariantListResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          results: {
            type: "array",
            items: { $ref: "#/components/schemas/ProductVariant" },
          },
          total: { type: "integer", example: 3 },
        },
      },
      ProductColorOptionResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: { $ref: "#/components/schemas/ProductColorOption" },
        },
      },
      ProductColorOptionListResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          results: {
            type: "array",
            items: { $ref: "#/components/schemas/ProductColorOption" },
          },
          total: { type: "integer", example: 2 },
        },
      },
      TagResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: { $ref: "#/components/schemas/Tag" },
        },
      },
      TagListResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          results: {
            type: "array",
            items: { $ref: "#/components/schemas/Tag" },
          },
          total: { type: "integer", example: 4 },
        },
      },
      CustomPrices: {
        type: "object",
        description:
          "Pricing configuration used by the Custom Neon builder to compute quotes. " +
          "All fields are required, numeric, and may include decimals. " +
          "The response also includes server-managed `id`, `createdAt` and `updatedAt` fields.",
        required: [
          "acrylicAreaMultiplier",
          "acrylicCostPerSquareFoot",
          "backboardColorPriceBlack",
          "backboardColorPriceClear",
          "backboardColorPriceGold",
          "backboardColorPriceSilver",
          "backboardColorPriceWhite",
          "backboardStyleBoxMin",
          "backboardStyleCutAround",
          "backboardStyleCutAroundMin",
          "backboardStyleInvisible",
          "backboardStyleInvisibleMin",
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
        ],
        properties: {
          acrylicAreaMultiplier: { type: "number", example: 1.25 },
          acrylicCostPerSquareFoot: { type: "number", example: 8.5 },
          backboardColorPriceBlack: { type: "number", example: 0 },
          backboardColorPriceClear: { type: "number", example: 0 },
          backboardColorPriceGold: { type: "number", example: 15 },
          backboardColorPriceSilver: { type: "number", example: 12 },
          backboardColorPriceWhite: { type: "number", example: 0 },
          backboardStyleBoxMin: { type: "number", example: 60 },
          backboardStyleCutAround: { type: "number", example: 1.1 },
          backboardStyleCutAroundMin: { type: "number", example: 35 },
          backboardStyleInvisible: { type: "number", example: 0 },
          backboardStyleInvisibleMin: { type: "number", example: 0 },
          backboardStyleRectangularMin: { type: "number", example: 30 },
          backboardStyleStand: { type: "number", example: 1.05 },
          backboardStyleStandMin: { type: "number", example: 50 },
          backboardStyleStroke: { type: "number", example: 1.15 },
          backboardStyleStrokeMin: { type: "number", example: 40 },
          dynamicSmartLed: { type: "number", example: 25 },
          eliminator: { type: "number", example: 9.99 },
          fontComplexityMultiplier: { type: "number", example: 1.2 },
          fontStyleMultiplier: { type: "number", example: 1.1 },
          lowerCaseCharacters: { type: "number", example: 8 },
          mockUp: { type: "number", example: 0 },
          remoteControlPrice: { type: "number", example: 12 },
          signMountingKitPrice: { type: "number", example: 7.5 },
          specialCharacters: { type: "number", example: 12 },
          upperCaseCharacters: { type: "number", example: 10 },
          wallMountingKitBlack: { type: "number", example: 5 },
          wallMountingKitGold: { type: "number", example: 8 },
          wallMountingKitSilver: { type: "number", example: 6 },
          waterproof: { type: "number", example: 1.2 },
          waterproofMin: { type: "number", example: 25 },
          id: { type: "integer", example: 1, readOnly: true },
          createdAt: { type: "string", format: "date-time", readOnly: true },
          updatedAt: { type: "string", format: "date-time", readOnly: true },
        },
      },
      CustomPricesResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: { $ref: "#/components/schemas/CustomPrices" },
        },
      },
    },
  },
  paths: {
    // ── Health ──────────────────────────────────────────────────────────────
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns `{ ok: true }` when the server is running.",
        responses: {
          200: {
            description: "Server is up",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "integer", example: 1 },
                    status: { type: "integer", example: 200 },
                    data: {
                      type: "object",
                      properties: { ok: { type: "boolean", example: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    // ── Products ────────────────────────────────────────────────────────────
    "/api/products": {
      get: {
        tags: ["Products"],
        summary: "List products",
        description:
          "Returns a paginated list of all products ordered by ID.\n\n" +
          "Pass `search` to filter by name/description, `categoryId` to filter by category, or both at once.",
        parameters: [
          ...paginationParameters,
          {
            name: "search",
            in: "query",
            description: "Filter to products whose name or description contains this string (case-insensitive).",
            schema: { type: "string" },
          },
          {
            name: "categoryId",
            in: "query",
            description: "Filter to products linked to this category ID.",
            schema: { type: "integer", minimum: 1 },
          },
          {
            name: "tagSlug",
            in: "query",
            description: "Filter to products that have a tag with this slug (case-sensitive).",
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Paginated product list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductListResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
      post: {
        tags: ["Products"],
        summary: "Create product",
        description:
          "Creates a new product. `name`, `description`, and `slug` are required and must be non-empty. `slug` must be unique.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProductInput" },
            },
          },
        },
        responses: {
          201: {
            description: "Product created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
    },
    "/api/products/{slug}": {
      get: {
        tags: ["Products"],
        summary: "Get product by slug",
        parameters: [{ $ref: "#/components/parameters/productSlug" }],
        responses: {
          200: {
            description: "Product found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductResponse" },
              },
            },
          },
          404: errorResponse,
        },
      },
    },
    "/api/products/{id}": {
      put: {
        tags: ["Products"],
        summary: "Update product",
        description:
          "Replaces all fields of an existing product. All required fields must be provided.",
        parameters: [{ $ref: "#/components/parameters/productId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProductInput" },
            },
          },
        },
        responses: {
          200: {
            description: "Product updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      delete: {
        tags: ["Products"],
        summary: "Delete product",
        parameters: [{ $ref: "#/components/parameters/productId" }],
        responses: {
          200: {
            description: "Product deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeletedResponse" },
              },
            },
          },
          404: errorResponse,
        },
      },
    },
    // ── Product-Category relations ──────────────────────────────────────────
    "/api/products/{productId}/categories/{categoryId}": {
      post: {
        tags: ["Product-Category"],
        summary: "Add category to product",
        description:
          "Links a category to a product. Both must exist or a 404 is returned.\n\n" +
          "The relationship is automatically bidirectional: the product appears in the " +
          "category's `productIds` and the category appears in the product's `categoryIds`.\n\n" +
          "Linking an already-linked pair is a no-op (safe to call multiple times).",
        parameters: [
          { $ref: "#/components/parameters/relationProductId" },
          { $ref: "#/components/parameters/relationCategoryId" },
        ],
        responses: {
          200: {
            description: "Category linked. Returns the updated product with its current categoryIds.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductWithCategoriesResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      delete: {
        tags: ["Product-Category"],
        summary: "Remove category from product",
        description:
          "Unlinks a category from a product. Both must exist or a 404 is returned.\n\n" +
          "If the pair was not linked, the operation is a no-op (no error).",
        parameters: [
          { $ref: "#/components/parameters/relationProductId" },
          { $ref: "#/components/parameters/relationCategoryId" },
        ],
        responses: {
          200: {
            description: "Category unlinked. Returns the updated product with its current categoryIds.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductWithCategoriesResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    // ── Product Variants ────────────────────────────────────────────────────
    "/api/products/{productId}/variants": {
      get: {
        tags: ["Variants"],
        summary: "List variants",
        description: "Returns all variants for the given product, ordered by ID. Returns 404 if the product does not exist.",
        parameters: [{ $ref: "#/components/parameters/variantProductId" }],
        responses: {
          200: {
            description: "Variant list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductVariantListResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      post: {
        tags: ["Variants"],
        summary: "Create variant",
        description:
          "Creates a new variant on the given product. All four fields are required and must be positive numbers; `sizeUnit` must be `cm` or `inch`.",
        parameters: [{ $ref: "#/components/parameters/variantProductId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProductVariantInput" },
            },
          },
        },
        responses: {
          201: {
            description: "Variant created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductVariantResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    "/api/products/{productId}/variants/{variantId}": {
      put: {
        tags: ["Variants"],
        summary: "Update variant",
        description:
          "Replaces all fields of an existing variant. Returns 404 if the variant does not exist or does not belong to the given product.",
        parameters: [
          { $ref: "#/components/parameters/variantProductId" },
          { $ref: "#/components/parameters/variantId" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProductVariantInput" },
            },
          },
        },
        responses: {
          200: {
            description: "Variant updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductVariantResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      delete: {
        tags: ["Variants"],
        summary: "Delete variant",
        description: "Deletes a variant. Returns 404 if the variant does not exist or does not belong to the given product.",
        parameters: [
          { $ref: "#/components/parameters/variantProductId" },
          { $ref: "#/components/parameters/variantId" },
        ],
        responses: {
          200: {
            description: "Variant deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeletedResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    // ── Product Color Options ───────────────────────────────────────────────
    "/api/products/{productId}/color-options": {
      get: {
        tags: ["Color Options"],
        summary: "List color options",
        description: "Returns all color options for the given product, ordered by ID. Returns 404 if the product does not exist.",
        parameters: [{ $ref: "#/components/parameters/colorOptionProductId" }],
        responses: {
          200: {
            description: "Color option list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductColorOptionListResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      post: {
        tags: ["Color Options"],
        summary: "Create color option",
        description:
          "Adds a new color option to the given product. `description` is required, `colors` must be a non-empty array, and `defaultColor` must be a full Color object.",
        parameters: [{ $ref: "#/components/parameters/colorOptionProductId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProductColorOptionInput" },
            },
          },
        },
        responses: {
          201: {
            description: "Color option created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductColorOptionResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    "/api/products/{productId}/color-options/{optionId}": {
      put: {
        tags: ["Color Options"],
        summary: "Update color option",
        description:
          "Replaces all fields of an existing color option. Returns 404 if the option does not exist or does not belong to the given product.",
        parameters: [
          { $ref: "#/components/parameters/colorOptionProductId" },
          { $ref: "#/components/parameters/colorOptionId" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProductColorOptionInput" },
            },
          },
        },
        responses: {
          200: {
            description: "Color option updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductColorOptionResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      delete: {
        tags: ["Color Options"],
        summary: "Delete color option",
        description: "Deletes a color option. Returns 404 if the option does not exist or does not belong to the given product.",
        parameters: [
          { $ref: "#/components/parameters/colorOptionProductId" },
          { $ref: "#/components/parameters/colorOptionId" },
        ],
        responses: {
          200: {
            description: "Color option deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeletedResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    // ── Product Tags ────────────────────────────────────────────────────────
    "/api/products/{productId}/tags": {
      get: {
        tags: ["Tags"],
        summary: "List tags",
        description: "Returns all tags for the given product, ordered by ID. Returns 404 if the product does not exist.",
        parameters: [{ $ref: "#/components/parameters/tagProductId" }],
        responses: {
          200: {
            description: "Tag list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TagListResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      post: {
        tags: ["Tags"],
        summary: "Create tag",
        description:
          "Adds a new tag to the given product. `name` and `slug` are required. `slug` must be unique within the product (returns 400 on duplicate).",
        parameters: [{ $ref: "#/components/parameters/tagProductId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TagInput" },
            },
          },
        },
        responses: {
          201: {
            description: "Tag created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TagResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    "/api/products/{productId}/tags/{tagId}": {
      put: {
        tags: ["Tags"],
        summary: "Update tag",
        description:
          "Replaces all fields of an existing tag. `slug` must remain unique within the product (returns 400 on duplicate). Returns 404 if the tag does not exist or does not belong to the given product.",
        parameters: [
          { $ref: "#/components/parameters/tagProductId" },
          { $ref: "#/components/parameters/tagId" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TagInput" },
            },
          },
        },
        responses: {
          200: {
            description: "Tag updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TagResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      delete: {
        tags: ["Tags"],
        summary: "Delete tag",
        description: "Deletes a tag. Returns 404 if the tag does not exist or does not belong to the given product.",
        parameters: [
          { $ref: "#/components/parameters/tagProductId" },
          { $ref: "#/components/parameters/tagId" },
        ],
        responses: {
          200: {
            description: "Tag deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeletedResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    // ── Categories ──────────────────────────────────────────────────────────
    "/api/categories": {
      get: {
        tags: ["Categories"],
        summary: "List categories",
        description:
          "Returns a paginated list of all categories ordered by ID. Each category includes its linked `productIds`.\n\n" +
          "Pass `productId` to filter to only categories linked to a specific product.",
        parameters: [
          ...paginationParameters,
          {
            name: "productId",
            in: "query",
            description: "Filter to categories linked to this product ID.",
            schema: { type: "integer", minimum: 1 },
          },
          {
            name: "search",
            in: "query",
            description: "Filter to categories whose name or description contains this string (case-insensitive).",
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Paginated category list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CategoryListResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
      post: {
        tags: ["Categories"],
        summary: "Create category",
        description:
          "Creates a new category. All fields except `productIds` are required.\n\n" +
          "`images` and `tags` can be empty arrays `[]`.\n\n" +
          "If `productIds` is provided, those products are linked to the category.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CategoryPayload" },
            },
          },
        },
        responses: {
          201: {
            description: "Category created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CategoryResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
    },
    "/api/categories/{slug}": {
      get: {
        tags: ["Categories"],
        summary: "Get category by slug",
        parameters: [{ $ref: "#/components/parameters/categorySlug" }],
        responses: {
          200: {
            description: "Category found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CategoryResponse" },
              },
            },
          },
          404: errorResponse,
        },
      },
    },
    // ── Prices (Custom Neon builder) ────────────────────────────────────────
    "/api/prices/custom": {
      get: {
        tags: ["Prices"],
        summary: "Get custom-neon pricing",
        description:
          "Returns the full pricing configuration used by the Custom Neon builder. " +
          "There is exactly one configuration row, shared by all clients. " +
          "If it has not been initialized yet, the server returns a row with every value defaulted to `0`.",
        responses: {
          200: {
            description: "Current pricing configuration",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CustomPricesResponse" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Prices"],
        summary: "Update custom-neon pricing",
        description:
          "Replaces the entire custom-neon pricing configuration. " +
          "**Every** field is required and must be a finite number (decimals allowed). " +
          "Returns `400` if any field is missing, null, or not a number. " +
          "Partial updates are not supported — send the full payload every time.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CustomPrices" },
            },
          },
        },
        responses: {
          200: {
            description: "Pricing configuration updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CustomPricesResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
    },
    "/api/categories/{id}": {
      put: {
        tags: ["Categories"],
        summary: "Update category",
        description:
          "Replaces all fields of an existing category.\n\n" +
          "`productIds` on PUT **replaces** the full list of linked products. " +
          "Omit or pass `[]` to remove all links.",
        parameters: [{ $ref: "#/components/parameters/categoryId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CategoryPayload" },
            },
          },
        },
        responses: {
          200: {
            description: "Category updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CategoryResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      delete: {
        tags: ["Categories"],
        summary: "Delete category",
        parameters: [{ $ref: "#/components/parameters/categoryId" }],
        responses: {
          200: {
            description: "Category deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeletedResponse" },
              },
            },
          },
          404: errorResponse,
        },
      },
    },
  },
};
