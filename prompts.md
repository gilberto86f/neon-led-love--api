# Refactor the `Product` type to add:

```TypeScript
isActive: boolean;
```

This property should be:

- required
- supported across all Product-related services and flows

Goal:

Allow Products to be activated/deactivated while preserving existing Product behavior.
