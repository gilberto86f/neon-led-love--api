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
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
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
        description: "Returns a paginated list of all products ordered by ID.",
        parameters: paginationParameters,
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
