👨‍💻

# Improve `validate` request response

- Improve `validate` request response, specially messages:
- Right now `messages` is just an array of strings like this:

```
    "messages": [
      "The price of product \"Bulbasaur\" has changed.",
      "The product \"Pikachu\" only has 3 units available."
    ],
```

- Each "message" should specify the productId, variant, name and products available (and more helpful properties) in an object instead of a message.
- This should make it easier to create a better message for the end user (the message might need to be translated, instead of showing the message directly as the backend sends it)
- Maybe the current message string could still be added to this new object, if you think its a good idea.
- Rename `messages` to a more appropiate name, only if needed.

🤖

# Summary

Replaced the cart-validation messages: string[] with a structured issues: CartIssue[], so the frontend can build its own (translatable) copy instead of displaying the backend's English strings.

cart.service.ts — the core change:

- Added a CartIssueCode union (7 stable codes) and a CartIssue interface.
- Each issue carries: code, the identifying productId / productName / variantId, code-specific details, and the original English message (kept for convenience, per your suggestion).
- Renamed messages → issues throughout (CartValidationResult, validateCartItem, validateCart), and isValid now keys off issues.length.

The code-specific detail fields, by code:

- OUT_OF_STOCK / INSUFFICIENT_STOCK → availableStock + requestedQuantity
- PRICE_CHANGED → previousUnitPrice + currentUnitPrice
- SUBTOTAL_CHANGED → previousSubtotal + currentSubtotal

## Docs (same change, as required):

- swagger.ts — new CartIssue schema (with the code enum and per-field descriptions), CartValidationResult.issues now references it, and the path/response descriptions updated.
- README.md — added CartIssue / CartIssueCode TypeScript shapes, switched the "what gets checked" table to list codes, and rewrote the example response with two full issue objects.

npx tsc --noEmit passes clean.

A few decisions worth flagging:

1. Name: issues. Picked over messages/findings/problems as the conventional API term. The in-code comments still call them "findings" in prose, which reads fine.
2. Codes are now a contract. I documented them as "don't rename existing ones" in both the type and swagger, since the frontend switches on them.
3. VARIANT_UNAVAILABLE covers two cases — variant deleted and variant dimensions changed — keeping the exact original behavior/message. I considered splitting the dimension-mismatch case into its own VARIANT_CHANGED code (arguably more accurate, since the variant still exists), but held off to avoid changing semantics you may rely on. Say the word and I'll split it.
4. message kept in English. It's labeled convenience-only in every doc; the intended path is code + fields → localized text on the frontend.
