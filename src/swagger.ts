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
    {
      name: "Product-Category",
      description: "Link and unlink products from categories",
    },
    { name: "Variants", description: "Size and price variants of a product" },
    {
      name: "Color Options",
      description: "Available color choices for a product",
    },
    {
      name: "Tags",
      description:
        "Standalone tags. Managed independently and linked to products via the Product-Tag endpoints.",
    },
    {
      name: "Product-Tag",
      description: "Link and unlink existing tags to/from products",
    },
    {
      name: "Prices",
      description: "Pricing configuration for the Custom Neon builder",
    },
    {
      name: "Slides",
      description:
        "Homepage carousel slides. Ordered by position. Use the reorder endpoint to change order; use isActive to show/hide without deleting.",
    },
    {
      name: "Images",
      description:
        "File upload and deletion. Uploaded files are served as static assets under /uploads/.",
    },
    {
      name: "Users",
      description:
        "Customer and admin accounts. Read and write by numeric ID. Email is unique.",
    },
    {
      name: "Orders",
      description:
        "Customer orders. Each order owns its `items[]` and stores a snapshot of product data (name, slug, image, price) at purchase time so historical records survive product changes.",
    },
    {
      name: "Auth",
      description:
        "Authentication endpoints. Register users, log in to obtain JWT access + refresh tokens, refresh them, log out, verify accounts, and read the currently-authenticated user. " +
        "Send the access token as `Authorization: Bearer <token>` on protected endpoints.",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "JWT access token. Obtain it from POST /api/auth/login and send it as `Authorization: Bearer <token>`. Access tokens expire after 30 minutes — call POST /api/auth/refresh to get a new one.",
      },
    },
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
      tagId: {
        name: "id",
        in: "path",
        required: true,
        description: "Numeric tag ID",
        schema: { type: "integer", minimum: 1 },
      },
      tagSlug: {
        name: "slug",
        in: "path",
        required: true,
        description: "URL-friendly tag identifier (e.g. `outdoor`)",
        schema: { type: "string" },
      },
      userId: {
        name: "id",
        in: "path",
        required: true,
        description: "Numeric user ID",
        schema: { type: "integer", minimum: 1 },
      },
      orderId: {
        name: "id",
        in: "path",
        required: true,
        description: "Numeric order ID",
        schema: { type: "integer", minimum: 1 },
      },
      productTagProductId: {
        name: "productId",
        in: "path",
        required: true,
        description: "Numeric product ID",
        schema: { type: "integer", minimum: 1 },
      },
      productTagTagId: {
        name: "tagId",
        in: "path",
        required: true,
        description: "Numeric tag ID",
        schema: { type: "integer", minimum: 1 },
      },
      slideId: {
        name: "id",
        in: "path",
        required: true,
        description: "Numeric slide ID",
        schema: { type: "integer", minimum: 1 },
      },
      uploadType: {
        name: "type",
        in: "path",
        required: true,
        description: "Upload context. Determines the storage folder.",
        schema: {
          type: "string",
          enum: ["products", "quotes", "categories", "slides"],
        },
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
          isActive: {
            type: "boolean",
            example: true,
            description: "Whether the product is visible to shoppers. Defaults to true.",
          },
          images: {
            type: "array",
            items: { type: "string" },
            example: [
              "/uploads/products/1778311202127-hdjrg5c-bulbasaur.jpg",
              "/uploads/products/1778311648058-h2znywa-bulbasaur.png",
            ],
            description:
              "Image URLs for this product. Array order is the display order. " +
              "Upload files via POST /api/images/upload/products to obtain the URLs.",
          },
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
              "Tags currently linked to this product. The Tag entities are managed via the Tags endpoints; the link is managed via the Product-Tag endpoints.",
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
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      TagInput: {
        type: "object",
        required: ["name", "slug"],
        description:
          "Fields accepted when creating or updating a tag. " +
          "`slug` must be globally unique (case-sensitive after trim).",
        properties: {
          name: { type: "string", example: "Outdoor" },
          slug: { type: "string", example: "outdoor" },
        },
      },
      ProductWithTags: {
        type: "object",
        description: "A product including the IDs of its linked tags.",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Neon Heart" },
          description: { type: "string", example: "Pink LED neon heart sign" },
          slug: { type: "string", example: "neon-heart" },
          isActive: { type: "boolean", example: true },
          images: {
            type: "array",
            items: { type: "string" },
            example: [
              "/uploads/products/1778311202127-hdjrg5c-bulbasaur.jpg",
              "/uploads/products/1778311648058-h2znywa-bulbasaur.png",
            ],
          },
          discountType: {
            type: "string",
            nullable: true,
            example: "percentage",
          },
          discount: { type: "integer", nullable: true, example: 10 },
          tagIds: {
            type: "array",
            items: { type: "integer" },
            example: [1, 2],
            description: "IDs of tags this product is currently linked to.",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
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
          stock: {
            type: "integer",
            minimum: 0,
            example: 12,
            description: "Available inventory for this variant. Non-negative integer.",
          },
          productId: { type: "integer", example: 1 },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ProductVariantInput: {
        type: "object",
        required: ["price", "width", "height", "sizeUnit", "stock"],
        description:
          "Fields accepted when creating or updating a variant. " +
          "`price`, `width`, and `height` must be positive numbers; `sizeUnit` must be `cm` or `inch`; " +
          "`stock` must be a non-negative integer.",
        properties: {
          price: {
            type: "number",
            example: 29.99,
            description: "Must be > 0.",
          },
          width: { type: "number", example: 30, description: "Must be > 0." },
          height: { type: "number", example: 15, description: "Must be > 0." },
          sizeUnit: { type: "string", enum: ["cm", "inch"], example: "cm" },
          stock: {
            type: "integer",
            minimum: 0,
            example: 12,
            description: "Available inventory. Must be ≥ 0.",
          },
        },
      },
      ProductInput: {
        type: "object",
        required: ["name", "description", "slug", "isActive"],
        properties: {
          name: { type: "string", example: "Neon Heart" },
          description: { type: "string", example: "Pink LED neon heart sign" },
          slug: {
            type: "string",
            example: "neon-heart",
            description:
              "Unique URL-friendly identifier. Trimmed before saving.",
          },
          isActive: {
            type: "boolean",
            example: true,
            description:
              "Whether the product is visible to shoppers. Set to false to deactivate without deleting.",
          },
          images: {
            type: "array",
            items: { type: "string" },
            example: [
              "/uploads/products/1778311202127-hdjrg5c-bulbasaur.jpg",
              "/uploads/products/1778311648058-h2znywa-bulbasaur.png",
            ],
            description:
              "Ordered list of image URLs for the product. The array order is the display order; " +
              "to add, remove, or reorder, send the full updated array. " +
              "Upload files via POST /api/images/upload/products to obtain URLs. " +
              "Removing a URL here does not delete the underlying file — call DELETE /api/images separately if you want to free disk space. " +
              "Optional; defaults to [] when omitted.",
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
            description:
              "IDs of tags linked to this category. Managed by the Tag service (not yet implemented).",
          },
          isActive: { type: "boolean", example: true },
          notes: { type: "string", example: "Seasonal promotion applies." },
          productIds: {
            type: "array",
            items: { type: "integer" },
            example: [1, 2, 3],
            description:
              "IDs of products linked to this category. Managed by the Product-Category relation service (not yet implemented).",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CategoryPayload: {
        type: "object",
        required: ["name", "slug", "description", "isActive"],
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
          notes: {
            type: "string",
            example: "Seasonal promotion applies.",
            description:
              "Internal notes. Optional — defaults to empty string if omitted.",
          },
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
          discountType: {
            type: "string",
            nullable: true,
            example: "percentage",
          },
          discount: { type: "integer", nullable: true, example: 10 },
          categoryIds: {
            type: "array",
            items: { type: "integer" },
            example: [1, 2],
            description:
              "IDs of categories this product is currently linked to.",
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
          page: { type: "integer", example: 1 },
          perPage: { type: "integer", example: 20 },
        },
      },
      ProductWithTagsResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: { $ref: "#/components/schemas/ProductWithTags" },
        },
      },
      User: {
        type: "object",
        description:
          "A user account. `status`: 0 = INACTIVE, 1 = ACTIVE. " +
          "`notificationPreferences`: 1 = EMAIL, 2 = SMS, 3 = WHATS_APP.",
        properties: {
          id: { type: "integer", example: 1 },
          fullName: { type: "string", example: "Ada Lovelace Byron" },
          email: { type: "string", format: "email", example: "ada@example.com" },
          phoneNumber: {
            type: "string",
            nullable: true,
            maxLength: 20,
            example: "+52 55 1234 5678",
          },
          role: { type: "string", enum: ["admin", "client", "super"], example: "client" },
          status: { type: "integer", enum: [0, 1], example: 1 },
          notificationPreferences: {
            type: "integer",
            enum: [1, 2, 3],
            nullable: true,
            example: 1,
          },
          dateOfBirth: {
            type: "string",
            nullable: true,
            description: "YYYY-MM-DD",
            example: "1990-12-10",
          },
          isVerified: {
            type: "boolean",
            example: false,
            description:
              "Whether the user's email has been verified via POST /api/auth/verify-account. " +
              "Login is rejected for unverified accounts.",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UserInput: {
        type: "object",
        required: ["fullName", "email", "role"],
        description:
          "Fields accepted when creating or updating a user. " +
          "`email` must be a valid, globally-unique address (returns 400 on duplicate). " +
          "`phoneNumber` is optional, max 20 characters. " +
          "`status` defaults to 1 (ACTIVE) when omitted.",
        properties: {
          fullName: { type: "string", example: "Ada Lovelace Byron" },
          email: { type: "string", format: "email", example: "ada@example.com" },
          phoneNumber: {
            type: "string",
            nullable: true,
            maxLength: 20,
            example: "+52 55 1234 5678",
          },
          role: { type: "string", enum: ["admin", "client", "super"], example: "client" },
          status: { type: "integer", enum: [0, 1], default: 1, example: 1 },
          notificationPreferences: {
            type: "integer",
            enum: [1, 2, 3],
            nullable: true,
            example: 1,
          },
          dateOfBirth: {
            type: "string",
            nullable: true,
            description: "YYYY-MM-DD",
            example: "1990-12-10",
          },
        },
      },
      UserResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: { $ref: "#/components/schemas/User" },
        },
      },
      UserListResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          results: {
            type: "array",
            items: { $ref: "#/components/schemas/User" },
          },
          total: { type: "integer", example: 1 },
          page: { type: "integer", example: 1 },
          perPage: { type: "integer", example: 20 },
        },
      },
      ShippingAddress: {
        type: "object",
        required: [
          "address",
          "city",
          "state",
          "postalCode",
          "country",
          "fullName",
          "phoneNumber",
        ],
        properties: {
          address: { type: "string", example: "Av. Insurgentes Sur 1234" },
          city: { type: "string", example: "Ciudad de México" },
          state: { type: "string", example: "CDMX" },
          postalCode: { type: "string", example: "03100" },
          country: { type: "string", example: "MX" },
          fullName: { type: "string", example: "Ada Lovelace Byron" },
          phoneNumber: { type: "string", example: "+52 55 1234 5678" },
        },
      },
      OrderItemInput: {
        type: "object",
        required: [
          "productId",
          "productName",
          "productSlug",
          "unitPrice",
          "quantity",
          "totalAmount",
        ],
        description:
          "An order line. `productName`, `productSlug`, `productImageUrl`, and `unitPrice` are snapshots of the product at purchase time — they are NOT looked up from the live Product. `totalAmount` must equal `unitPrice * quantity`.",
        properties: {
          productId: { type: "integer", example: 1 },
          productName: { type: "string", example: "Neon Heart" },
          productSlug: { type: "string", example: "neon-heart" },
          productImageUrl: {
            type: "string",
            nullable: true,
            example: "/uploads/products/1715000000000-abc-neon-heart.png",
          },
          unitPrice: { type: "number", example: 49.99 },
          quantity: { type: "integer", minimum: 1, example: 2 },
          totalAmount: { type: "number", example: 99.98 },
        },
      },
      OrderItem: {
        allOf: [
          { $ref: "#/components/schemas/OrderItemInput" },
          {
            type: "object",
            properties: {
              id: { type: "integer", example: 1 },
              orderId: { type: "integer", example: 1 },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        ],
      },
      OrderInput: {
        type: "object",
        required: [
          "userId",
          "currency",
          "subtotalAmount",
          "shippingAmount",
          "taxAmount",
          "totalAmount",
          "items",
        ],
        description:
          "Payload for creating or replacing an order. `totalAmount` must equal `subtotalAmount + shippingAmount + taxAmount`. " +
          "`items` must contain at least one line. PUT **replaces** all fields including the full items array.",
        properties: {
          userId: { type: "integer", example: 1 },
          status: {
            type: "string",
            enum: [
              "pending",
              "paid",
              "processing",
              "shipped",
              "delivered",
              "cancelled",
              "refunded",
            ],
            default: "pending",
            example: "pending",
          },
          currency: { type: "string", example: "MXN" },
          subtotalAmount: { type: "number", example: 99.98 },
          shippingAmount: { type: "number", example: 10.0 },
          taxAmount: { type: "number", example: 16.0 },
          totalAmount: { type: "number", example: 125.98 },
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/OrderItemInput" },
          },
          shippingAddress: {
            allOf: [{ $ref: "#/components/schemas/ShippingAddress" }],
            nullable: true,
          },
          paymentId: { type: "string", nullable: true, example: "stripe_pi_3OabCdEfGhIjKlMn" },
          trackingNumber: { type: "string", nullable: true, example: "1Z999AA10123456784" },
          notes: { type: "string", nullable: true, example: "Leave at the front desk." },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          userId: { type: "integer", example: 1 },
          status: {
            type: "string",
            enum: [
              "pending",
              "paid",
              "processing",
              "shipped",
              "delivered",
              "cancelled",
              "refunded",
            ],
            example: "pending",
          },
          currency: { type: "string", example: "MXN" },
          subtotalAmount: { type: "number", example: 99.98 },
          shippingAmount: { type: "number", example: 10.0 },
          taxAmount: { type: "number", example: 16.0 },
          totalAmount: { type: "number", example: 125.98 },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/OrderItem" },
          },
          shippingAddress: {
            allOf: [{ $ref: "#/components/schemas/ShippingAddress" }],
            nullable: true,
          },
          paymentId: { type: "string", nullable: true, example: "stripe_pi_3OabCdEfGhIjKlMn" },
          trackingNumber: { type: "string", nullable: true, example: "1Z999AA10123456784" },
          notes: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      OrderResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: { $ref: "#/components/schemas/Order" },
        },
      },
      OrderListResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          results: {
            type: "array",
            items: { $ref: "#/components/schemas/Order" },
          },
          total: { type: "integer", example: 1 },
          page: { type: "integer", example: 1 },
          perPage: { type: "integer", example: 20 },
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
        ],
        properties: {
          acrylicAreaMultiplier: { type: "number", example: 1.25 },
          acrylicCostPerSquareFoot: { type: "number", example: 8.5 },
          backboardColorPriceBlack: { type: "number", example: 0 },
          backboardColorPriceClear: { type: "number", example: 0 },
          backboardColorPriceGold: { type: "number", example: 15 },
          backboardColorPriceSilver: { type: "number", example: 12 },
          backboardColorPriceWhite: { type: "number", example: 0 },
          backboardStyleBox: { type: "number", example: 1.1 },
          backboardStyleBoxMin: { type: "number", example: 60 },
          backboardStyleCutAround: { type: "number", example: 1.1 },
          backboardStyleCutAroundMin: { type: "number", example: 35 },
          backboardStyleInvisible: { type: "number", example: 0 },
          backboardStyleInvisibleMin: { type: "number", example: 0 },
          backboardStyleRectangular: { type: "number", example: 1.05 },
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
      Slide: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          isActive: { type: "boolean", example: true },
          position: {
            type: "integer",
            example: 1,
            description: "1-based display order. Unique across all slides.",
          },
          imageUrl: {
            type: "string",
            nullable: true,
            example: "https://cdn.example.com/banner.jpg",
          },
          styleClass: { type: "string", nullable: true, example: "hero-dark" },
          title: {
            type: "string",
            nullable: true,
            example: "Custom Neon Signs",
          },
          description: {
            type: "string",
            nullable: true,
            example: "Made to order, ships in 3 days.",
          },
          buttonLabel: { type: "string", nullable: true, example: "Shop Now" },
          route: { type: "string", nullable: true, example: "/products" },
          innerHtml: {
            type: "string",
            nullable: true,
            example: "<strong>Limited offer</strong>",
          },
          justifyContent: { type: "string", nullable: true, example: "center" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      SlideInput: {
        type: "object",
        required: ["isActive"],
        description:
          "Fields accepted when creating or updating a slide. `isActive` is the only required field. " +
          "All string fields are optional and default to null if omitted or blank. " +
          "`position` is auto-assigned on create and changed only via the reorder endpoint.",
        properties: {
          isActive: { type: "boolean", example: true },
          imageUrl: {
            type: "string",
            example: "https://cdn.example.com/banner.jpg",
          },
          styleClass: { type: "string", example: "hero-dark" },
          title: { type: "string", example: "Custom Neon Signs" },
          description: {
            type: "string",
            example: "Made to order, ships in 3 days.",
          },
          buttonLabel: { type: "string", example: "Shop Now" },
          route: { type: "string", example: "/products" },
          innerHtml: {
            type: "string",
            example: "<strong>Limited offer</strong>",
          },
          justifyContent: { type: "string", example: "center" },
        },
      },
      SlideReorderInput: {
        type: "object",
        required: ["slideId", "newPosition"],
        description:
          "Moves a slide to a new position, shifting other slides to keep positions sequential and unique.",
        properties: {
          slideId: {
            type: "integer",
            example: 3,
            description: "ID of the slide to move.",
          },
          newPosition: {
            type: "integer",
            example: 1,
            description:
              "Target position (1-based). Must be between 1 and the total number of slides.",
          },
        },
      },
      SlideResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: { $ref: "#/components/schemas/Slide" },
        },
      },
      SlideListResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          results: {
            type: "array",
            items: { $ref: "#/components/schemas/Slide" },
          },
          total: { type: "integer", example: 5 },
          page: { type: "integer", example: 1 },
          perPage: { type: "integer", example: 20 },
        },
      },
      RegisterInput: {
        type: "object",
        required: ["fullName", "email", "password"],
        description:
          "Fields accepted by POST /api/auth/register. The user is created with `isVerified=false` and `status=1` (ACTIVE). " +
          "A `verificationToken` is returned in the response — submit it to POST /api/auth/verify-account to verify the email. " +
          "Email sending is not implemented yet; the token is returned directly for now.",
        properties: {
          fullName: { type: "string", example: "Juan Pérez" },
          email: { type: "string", format: "email", example: "juan@example.com" },
          password: {
            type: "string",
            format: "password",
            minLength: 8,
            example: "supersecret",
            description: "Minimum 8 characters. Stored as a bcrypt hash.",
          },
          phoneNumber: {
            type: "string",
            nullable: true,
            maxLength: 20,
            example: "+52 55 1234 5678",
          },
          role: {
            type: "string",
            enum: ["admin", "client", "super"],
            default: "client",
            example: "client",
            description: "Optional. Defaults to `client` when omitted.",
          },
        },
      },
      LoginInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "juan@example.com" },
          password: { type: "string", format: "password", example: "supersecret" },
        },
      },
      RefreshInput: {
        type: "object",
        required: ["refreshToken"],
        properties: {
          refreshToken: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            description: "The refresh token returned by POST /api/auth/login.",
          },
        },
      },
      VerifyAccountInput: {
        type: "object",
        required: ["token"],
        properties: {
          token: {
            type: "string",
            example: "f1c8a9b2e6d04a3f8c4d5e6f7a8b9c0d",
            description: "The `verificationToken` returned by POST /api/auth/register.",
          },
        },
      },
      AuthTokens: {
        type: "object",
        properties: {
          accessToken: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            description: "JWT access token. Lifetime: 30 minutes.",
          },
          refreshToken: {
            type: "string",
            example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            description:
              "JWT refresh token. Lifetime: 30 days. Hashed (sha256) and stored on the user. " +
              "Issuing a new pair (refresh or re-login) rotates and invalidates the previous refresh token.",
          },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      RegisterResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 201 },
          data: {
            type: "object",
            properties: {
              user: { $ref: "#/components/schemas/User" },
              verificationToken: {
                type: "string",
                example: "f1c8a9b2e6d04a3f8c4d5e6f7a8b9c0d",
                description:
                  "Hex token to be sent to POST /api/auth/verify-account. " +
                  "Exposed in the response for now because email sending is not implemented yet.",
              },
            },
          },
        },
      },
      AuthTokensResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: { $ref: "#/components/schemas/AuthTokens" },
        },
      },
      LogoutResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: {
            type: "object",
            properties: { loggedOut: { type: "boolean", example: true } },
          },
        },
      },
      ImageUploadResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 201 },
          data: {
            type: "object",
            properties: {
              imageUrl: {
                type: "string",
                example:
                  "/uploads/products/1715000000000-ab3c7d1-neon-sign.png",
                description:
                  "Relative URL of the uploaded file. Accessible at http://localhost:3000{imageUrl}.",
              },
            },
          },
        },
      },
      ImageDeleteResponse: {
        type: "object",
        properties: {
          success: { type: "integer", enum: [1], example: 1 },
          status: { type: "integer", example: 200 },
          data: {
            type: "object",
            properties: {
              deleted: { type: "boolean", example: true },
              imageUrl: {
                type: "string",
                example:
                  "/uploads/products/1715000000000-ab3c7d1-neon-sign.png",
              },
            },
          },
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
          "Pass `search` to filter by name/description, `categoryId` to filter by category, `tagSlug` to filter by tag, `isActive` to filter by active/inactive — or any combination.",
        parameters: [
          ...paginationParameters,
          {
            name: "search",
            in: "query",
            description:
              "Filter to products whose name or description contains this string (case-insensitive).",
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
            description:
              "Filter to products that have a tag with this slug (case-sensitive).",
            schema: { type: "string" },
          },
          {
            name: "isActive",
            in: "query",
            description:
              "Filter by active status. `true` → only active, `false` → only inactive. Omit to return both.",
            schema: { type: "boolean" },
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
    "/api/products/related": {
      get: {
        tags: ["Products"],
        summary: "Get random products",
        description:
          "Returns a list of random products. Useful for generic discovery surfaces (e.g. homepage recommendations) " +
          "where there is no source product to anchor relevance.\n\n" +
          "The list is **not** paginated.",
        parameters: [
          {
            name: "limit",
            in: "query",
            description:
              "Maximum number of products to return. Defaults to 8. Must be a positive integer ≤ 100.",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 8 },
          },
        ],
        responses: {
          200: {
            description: "Random product list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductListResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
    },
    "/api/products/{productId}/related": {
      get: {
        tags: ["Products"],
        summary: "Get related products",
        description:
          "Returns products related to the given product, ordered by relevance.\n\n" +
          "Scoring weights: **+5** per shared category, **+3** per shared tag, **+1** per shared keyword in name/description " +
          "(case-insensitive, tokens of length ≥ 3). Only candidates that share at least one category or tag with the " +
          "source product are scored.\n\n" +
          "If fewer than `limit` related products are found, the remaining slots are filled with random products " +
          "(excluding the source product and any already-included results). The list is **not** paginated.",
        parameters: [
          { $ref: "#/components/parameters/relationProductId" },
          {
            name: "limit",
            in: "query",
            description:
              "Maximum number of products to return. Defaults to 8. Must be a positive integer ≤ 100.",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 8 },
          },
        ],
        responses: {
          200: {
            description: "Related products list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProductListResponse" },
              },
            },
          },
          400: errorResponse,
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
            description:
              "Category linked. Returns the updated product with its current categoryIds.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ProductWithCategoriesResponse",
                },
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
            description:
              "Category unlinked. Returns the updated product with its current categoryIds.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ProductWithCategoriesResponse",
                },
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
        description:
          "Returns all variants for the given product, ordered by ID. Returns 404 if the product does not exist.",
        parameters: [{ $ref: "#/components/parameters/variantProductId" }],
        responses: {
          200: {
            description: "Variant list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ProductVariantListResponse",
                },
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
          "Creates a new variant on the given product. `price`, `width`, and `height` must be positive numbers; `sizeUnit` must be `cm` or `inch`; `stock` must be a non-negative integer.",
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
        description:
          "Deletes a variant. Returns 404 if the variant does not exist or does not belong to the given product.",
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
        description:
          "Returns all color options for the given product, ordered by ID. Returns 404 if the product does not exist.",
        parameters: [{ $ref: "#/components/parameters/colorOptionProductId" }],
        responses: {
          200: {
            description: "Color option list",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ProductColorOptionListResponse",
                },
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
                schema: {
                  $ref: "#/components/schemas/ProductColorOptionResponse",
                },
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
                schema: {
                  $ref: "#/components/schemas/ProductColorOptionResponse",
                },
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
        description:
          "Deletes a color option. Returns 404 if the option does not exist or does not belong to the given product.",
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
    // ── Tags (standalone) ───────────────────────────────────────────────────
    "/api/tags": {
      get: {
        tags: ["Tags"],
        summary: "List tags",
        description:
          "Returns a paginated list of all tags ordered by ID.\n\n" +
          "Pass `search` to filter by name or slug (case-insensitive substring match).",
        parameters: [
          ...paginationParameters,
          {
            name: "search",
            in: "query",
            description:
              "Filter to tags whose name or slug contains this string (case-insensitive).",
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Paginated tag list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TagListResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
      post: {
        tags: ["Tags"],
        summary: "Create tag",
        description:
          "Creates a new standalone tag. `name` and `slug` are required. `slug` must be globally unique (returns 400 on duplicate).",
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
        },
      },
    },
    "/api/tags/{slug}": {
      get: {
        tags: ["Tags"],
        summary: "Get tag by slug",
        parameters: [{ $ref: "#/components/parameters/tagSlug" }],
        responses: {
          200: {
            description: "Tag found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TagResponse" },
              },
            },
          },
          404: errorResponse,
        },
      },
    },
    "/api/tags/{id}": {
      put: {
        tags: ["Tags"],
        summary: "Update tag",
        description:
          "Replaces all fields of an existing tag. `slug` must remain globally unique (returns 400 on duplicate).",
        parameters: [{ $ref: "#/components/parameters/tagId" }],
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
        description:
          "Deletes a tag. The tag is also removed from any products it was linked to.",
        parameters: [{ $ref: "#/components/parameters/tagId" }],
        responses: {
          200: {
            description: "Tag deleted",
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
    // ── Product-Tag relations ───────────────────────────────────────────────
    "/api/products/{productId}/tags": {
      get: {
        tags: ["Product-Tag"],
        summary: "List product tags",
        description:
          "Returns all tags currently linked to the given product, ordered by ID. Returns 404 if the product does not exist.",
        parameters: [{ $ref: "#/components/parameters/productTagProductId" }],
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
    },
    "/api/products/{productId}/tags/{tagId}": {
      post: {
        tags: ["Product-Tag"],
        summary: "Add tag to product",
        description:
          "Links an existing tag to a product. Both must exist or a 404 is returned.\n\n" +
          "The relationship is automatically bidirectional: the tag appears in the product's `tagIds` and the product appears in the tag's linked products.\n\n" +
          "Linking an already-linked pair is a no-op (safe to call multiple times). Tags are not created here — use `POST /api/tags` first.",
        parameters: [
          { $ref: "#/components/parameters/productTagProductId" },
          { $ref: "#/components/parameters/productTagTagId" },
        ],
        responses: {
          200: {
            description:
              "Tag linked. Returns the updated product with its current tagIds.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ProductWithTagsResponse",
                },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      delete: {
        tags: ["Product-Tag"],
        summary: "Remove tag from product",
        description:
          "Unlinks a tag from a product. Both must exist or a 404 is returned.\n\n" +
          "If the pair was not linked, the operation is a no-op (no error). The Tag entity is **not** deleted — only the link is removed.",
        parameters: [
          { $ref: "#/components/parameters/productTagProductId" },
          { $ref: "#/components/parameters/productTagTagId" },
        ],
        responses: {
          200: {
            description:
              "Tag unlinked. Returns the updated product with its current tagIds.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ProductWithTagsResponse",
                },
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
            description:
              "Filter to categories whose name or description contains this string (case-insensitive).",
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
    // ── Images ──────────────────────────────────────────────────────────────
    "/api/images/upload/{type}": {
      post: {
        tags: ["Images"],
        summary: "Upload a file",
        description:
          "Uploads a single file and stores it under `/uploads/{type}/`. " +
          "Returns the relative URL of the saved file.\n\n" +
          "**Allowed types:** `products`, `quotes`, `categories`, `slides`\n\n" +
          "**Allowed file formats:** png, jpeg, jpg, gif, pdf, ai\n\n" +
          "**Maximum file size:** 20 MB\n\n" +
          "Send the file as `multipart/form-data` with the field name `file`.\n\n" +
          "The returned `imageUrl` is accessible at `http://localhost:3000{imageUrl}`.",
        parameters: [{ $ref: "#/components/parameters/uploadType" }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "The file to upload.",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "File uploaded",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ImageUploadResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
    },
    "/api/images": {
      delete: {
        tags: ["Images"],
        summary: "Delete a file",
        description:
          "Deletes a previously uploaded file from disk. " +
          "Pass the `imageUrl` exactly as returned by the upload endpoint (e.g. `/uploads/products/filename.png`).",
        parameters: [
          {
            name: "imageUrl",
            in: "query",
            required: true,
            description:
              "Relative URL of the file to delete, as returned by the upload endpoint.",
            schema: {
              type: "string",
              example: "/uploads/products/1715000000000-ab3c7d1-neon-sign.png",
            },
          },
        ],
        responses: {
          200: {
            description: "File deleted",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ImageDeleteResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    // ── Slides ──────────────────────────────────────────────────────────────
    "/api/slides": {
      get: {
        tags: ["Slides"],
        summary: "List slides",
        description:
          "Returns slides ordered by `position` ascending.\n\n" +
          "Pass `isActive=true` to get only active slides, `isActive=false` for inactive only, or omit it to get all.",
        parameters: [
          ...paginationParameters,
          {
            name: "isActive",
            in: "query",
            description: "Filter by active state. Omit to return all slides.",
            schema: { type: "boolean" },
          },
        ],
        responses: {
          200: {
            description: "Slide list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SlideListResponse" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Slides"],
        summary: "Create slide",
        description:
          "Creates a new slide. `isActive` is the only required field. " +
          "The slide is appended at the end (highest position + 1). Use the reorder endpoint to change its position.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SlideInput" },
            },
          },
        },
        responses: {
          201: {
            description: "Slide created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SlideResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
    },
    "/api/slides/reorder": {
      put: {
        tags: ["Slides"],
        summary: "Reorder slide",
        description:
          "Moves a slide to a new position. All slides between the old and new position are shifted by one to keep positions sequential and unique.\n\n" +
          "`newPosition` must be between 1 and the total number of slides.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SlideReorderInput" },
            },
          },
        },
        responses: {
          200: {
            description: "Slide moved. Returns the updated slide.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SlideResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    "/api/slides/{id}": {
      get: {
        tags: ["Slides"],
        summary: "Get slide by ID",
        parameters: [{ $ref: "#/components/parameters/slideId" }],
        responses: {
          200: {
            description: "Slide found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SlideResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      put: {
        tags: ["Slides"],
        summary: "Update slide",
        description:
          "Updates a slide's content and active state. `isActive` is required. " +
          "To change position, use the reorder endpoint instead.",
        parameters: [{ $ref: "#/components/parameters/slideId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SlideInput" },
            },
          },
        },
        responses: {
          200: {
            description: "Slide updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SlideResponse" },
              },
            },
          },
          400: errorResponse,
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
    // ── Users ───────────────────────────────────────────────────────────────
    "/api/users": {
      get: {
        tags: ["Users"],
        summary: "List users",
        description:
          "Returns a paginated list of users ordered by ID.\n\n" +
          "Pass `search` to filter by full name, email, or phone number " +
          "(case-insensitive substring match).\n\n" +
          "Pass `role` and/or `status` to filter. When omitted, all roles / statuses are returned.",
        parameters: [
          ...paginationParameters,
          {
            name: "search",
            in: "query",
            description:
              "Filter by name, email, or phone number (case-insensitive substring).",
            schema: { type: "string" },
          },
          {
            name: "role",
            in: "query",
            description: "Filter to a single role.",
            schema: { type: "string", enum: ["admin", "client", "super"] },
          },
          {
            name: "status",
            in: "query",
            description: "Filter by account status: 0 = INACTIVE, 1 = ACTIVE.",
            schema: { type: "integer", enum: [0, 1] },
          },
        ],
        responses: {
          200: {
            description: "Paginated user list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserListResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
      post: {
        tags: ["Users"],
        summary: "Create user",
        description:
          "Creates a new user. `email` must be a valid, globally-unique address (returns 400 on duplicate).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UserInput" },
            },
          },
        },
        responses: {
          201: {
            description: "User created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
    },
    "/api/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Get user by ID",
        parameters: [{ $ref: "#/components/parameters/userId" }],
        responses: {
          200: {
            description: "User found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update user",
        description:
          "Replaces all fields of an existing user. `email` must remain globally unique (returns 400 on duplicate).",
        parameters: [{ $ref: "#/components/parameters/userId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UserInput" },
            },
          },
        },
        responses: {
          200: {
            description: "User updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete user",
        description:
          "Deletes a user. Returns `400` if the user has any orders — delete the user's orders first.",
        parameters: [{ $ref: "#/components/parameters/userId" }],
        responses: {
          200: {
            description: "User deleted",
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
    // ── Orders ──────────────────────────────────────────────────────────────
    "/api/orders": {
      get: {
        tags: ["Orders"],
        summary: "List orders",
        description:
          "Returns a paginated list of orders ordered by ID (newest first).\n\n" +
          "Pass `search` to filter by order ID (exact numeric match), tracking number, payment ID, " +
          "or the related user's full name, email, or phone number (case-insensitive substring).\n\n" +
          "Pass `status` to filter by order status. Omit to return all statuses.",
        parameters: [
          ...paginationParameters,
          {
            name: "search",
            in: "query",
            description:
              "Filter by order ID, tracking number, payment ID, or related user info.",
            schema: { type: "string" },
          },
          {
            name: "status",
            in: "query",
            description: "Filter by order status.",
            schema: {
              type: "string",
              enum: [
                "pending",
                "paid",
                "processing",
                "shipped",
                "delivered",
                "cancelled",
                "refunded",
              ],
            },
          },
        ],
        responses: {
          200: {
            description: "Paginated order list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderListResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
      post: {
        tags: ["Orders"],
        summary: "Create order",
        description:
          "Creates a new order. The `userId` must reference an existing user. " +
          "`items[]` must contain at least one line and each line's `totalAmount` must equal `unitPrice * quantity`. " +
          "Order `totalAmount` must equal `subtotalAmount + shippingAmount + taxAmount`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OrderInput" },
            },
          },
        },
        responses: {
          201: {
            description: "Order created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
    },
    "/api/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Get order by ID",
        parameters: [{ $ref: "#/components/parameters/orderId" }],
        responses: {
          200: {
            description: "Order found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      put: {
        tags: ["Orders"],
        summary: "Update order",
        description:
          "Replaces all fields of an existing order, including the full `items[]` array. " +
          "Existing items are deleted and the provided ones are created in a single transaction. " +
          "The same amount-consistency rules as create apply.",
        parameters: [{ $ref: "#/components/parameters/orderId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OrderInput" },
            },
          },
        },
        responses: {
          200: {
            description: "Order updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderResponse" },
              },
            },
          },
          400: errorResponse,
          404: errorResponse,
        },
      },
      delete: {
        tags: ["Orders"],
        summary: "Delete order",
        description: "Deletes an order and all of its items (cascade).",
        parameters: [{ $ref: "#/components/parameters/orderId" }],
        responses: {
          200: {
            description: "Order deleted",
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
    // ── Auth ────────────────────────────────────────────────────────────────
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a new user",
        description:
          "Creates a new user with `isVerified=false`. Returns the user and a one-time `verificationToken` " +
          "that must be sent to POST /api/auth/verify-account before the user can log in.\n\n" +
          "Email sending is **not** implemented yet — the token is returned directly in the response so a " +
          "frontend or test client can complete the flow manually.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterInput" },
            },
          },
        },
        responses: {
          201: {
            description: "User registered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegisterResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        description:
          "Validates credentials and returns an access token (30 min) + refresh token (30 days).\n\n" +
          "Returns `401` for unknown email or wrong password, `403` if the account is inactive " +
          "(`status=0`) or not verified (`isVerified=false`).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginInput" },
            },
          },
        },
        responses: {
          200: {
            description: "Login successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthTokensResponse" },
              },
            },
          },
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Refresh access token",
        description:
          "Exchanges a valid refresh token for a brand-new access + refresh token pair. " +
          "The previous refresh token is invalidated (rotation). " +
          "Returns `401` if the token is missing, malformed, expired, or does not match the stored hash for the user.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RefreshInput" },
            },
          },
        },
        responses: {
          200: {
            description: "New tokens issued",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthTokensResponse" },
              },
            },
          },
          400: errorResponse,
          401: errorResponse,
        },
      },
    },
    "/api/auth/verify-account": {
      post: {
        tags: ["Auth"],
        summary: "Verify a user's email",
        description:
          "Marks the user matching `token` as verified and clears the stored verification token. " +
          "Idempotent: calling it for an already-verified user returns the user unchanged.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VerifyAccountInput" },
            },
          },
        },
        responses: {
          200: {
            description: "Account verified",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          400: errorResponse,
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out",
        description:
          "Invalidates the refresh token stored on the user (clears `refreshTokenHash` and `refreshTokenExpiresAt`). " +
          "The access token itself is **not** invalidated server-side — it will keep working until it expires (max 30 min). " +
          "The frontend should also discard the access token on logout.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Logout successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LogoutResponse" },
              },
            },
          },
          401: errorResponse,
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get the authenticated user",
        description: "Returns the user matching the access token's `sub` claim.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Current user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UserResponse" },
              },
            },
          },
          401: errorResponse,
          404: errorResponse,
        },
      },
    },
  },
};
