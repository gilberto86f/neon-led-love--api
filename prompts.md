# Add a new optional `isActive` filter to the Products list endpoint.

Goal:

Allow filtering Products by active/inactive status while preserving current behavior.

---

## Endpoint behavior

Update Products list endpoint:

```http
GET /products
```

Add optional query param:

```http
?isActive=true
?isActive=false
```

---

## Filter behavior

### Active products only

```http
GET /products?isActive=true
```

Return only:

```TypeScript
product.isActive === true
```

---

### Inactive products only

```http
GET /products?isActive=false
```

Return only:

```TypeScript
product.isActive === false
```

---

### No filter

If:

```TypeScript
isActive
```

is missing:

Return all products.

Preserve existing behavior.

Keep consistency with current filter patterns.

---
