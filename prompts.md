# `cart/validate` weird behavior

- The user is trying to finalize the purchase and the `cart/validate` request is returning a `PRICE_CHANGED` code issue, but the product has not changed price. Why is this happening?
- This is the payload:
  ```json
  {
    "items": [
      {
        "productId": 14,
        "productSlug": "majin-boo",
        "productName": "Majin Boo",
        "productImageUrl": "/uploads/products/1781046933967-xp42qto-boo.png.png",
        "variantId": 13,
        "width": 100,
        "height": 100,
        "sizeUnit": "cm",
        "originalUnitPrice": 749,
        "unitPrice": 749,
        "discountType": null,
        "discount": 0,
        "quantity": 5,
        "subtotalAmount": 3745,
        "dateAddedToCart": "2026-06-22T19:32:08.020Z"
      },
      {
        "productId": 13,
        "productSlug": "pikachu",
        "productName": "Pikachu",
        "productImageUrl": "/uploads/products/1780378326491-m0gvx1h-25.png",
        "variantId": 12,
        "width": 80,
        "height": 90,
        "sizeUnit": "cm",
        "originalUnitPrice": 1589,
        "unitPrice": 1587,
        "discountType": "amount",
        "discount": 0,
        "quantity": 7,
        "subtotalAmount": 11109,
        "dateAddedToCart": "2026-06-28T06:24:50.321Z"
      }
    ],
    "subtotalAmount": 14854,
    "shippingAmount": 0,
    "taxAmount": 0,
    "discountAmount": 0,
    "totalAmount": 14854
  }
  ```

  - This is the reponse:
  ```json
  {
    "success": 1,
    "status": 200,
    "data": {
      "isValid": false,
      "issues": [
        {
          "code": "PRICE_CHANGED",
          "message": "The price of product \"Pikachu\" has changed.",
          "productId": 13,
          "productName": "Pikachu",
          "variantId": 12,
          "previousUnitPrice": 1587,
          "currentUnitPrice": 1587
        }
      ],
      "items": [
        {
          "productId": 14,
          "productSlug": "majin-boo",
          "productName": "Majin Boo",
          "productImageUrl": "/uploads/products/1781046933967-xp42qto-boo.png.png",
          "variantId": 13,
          "width": 100,
          "height": 100,
          "sizeUnit": "cm",
          "originalUnitPrice": 749,
          "unitPrice": 749,
          "discountType": null,
          "discount": 0,
          "quantity": 5,
          "subtotalAmount": 3745,
          "dateAddedToCart": "2026-06-22T19:32:08.020Z"
        },
        {
          "productId": 13,
          "productSlug": "pikachu",
          "productName": "Pikachu",
          "productImageUrl": "/uploads/products/1780378326491-m0gvx1h-25.png",
          "variantId": 12,
          "width": 80,
          "height": 90,
          "sizeUnit": "cm",
          "originalUnitPrice": 1587,
          "unitPrice": 1587,
          "discountType": "amount",
          "discount": 0,
          "quantity": 7,
          "subtotalAmount": 11109,
          "dateAddedToCart": "2026-06-28T06:24:50.321Z"
        }
      ],
      "subtotalAmount": 14854,
      "shippingAmount": 0,
      "taxAmount": 0,
      "discountAmount": 0,
      "totalAmount": 14854
    }
  }
  ```

  - When I check the "Pikachu" product (GET "/api/products/pikachu"), this is what I get :
  ```json
  {
    "success": 1,
    "status": 200,
    "data": {
      "id": 13,
      "name": "Pikachu",
      "description": "Good ol' Pikachu!",
      "slug": "pikachu",
      "images": [
        "/uploads/products/1780378326491-m0gvx1h-25.png",
        "/uploads/products/1780378348583-ryszgwj-epqqi6excaivwcj.jpg",
        "/uploads/products/1780378353623-9vy3pxh-e399brjwuaqo1pb.jpg"
      ],
      "isActive": true,
      "discountType": "amount",
      "discount": 0,
      "createdAt": "2026-05-30T07:26:06.461Z",
      "updatedAt": "2026-06-16T17:33:31.917Z",
      "variants": [
        {
          "id": 12,
          "price": 1587,
          "width": 80,
          "height": 90,
          "sizeUnit": "cm",
          "stock": 7,
          "createdAt": "2026-06-02T05:36:03.498Z",
          "updatedAt": "2026-06-29T05:49:16.995Z",
          "productId": 13
        },
        {
          "id": 15,
          "price": 2129,
          "width": 120,
          "height": 160,
          "sizeUnit": "cm",
          "stock": 3,
          "createdAt": "2026-06-22T04:50:42.689Z",
          "updatedAt": "2026-06-29T05:53:01.070Z",
          "productId": 13
        }
      ],
      "colorOptions": [],
      "tags": []
    }
  }
  ```
