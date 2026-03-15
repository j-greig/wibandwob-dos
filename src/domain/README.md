# `src/domain`

Pure runtime models and rules.

Keep this layer free of:

- Blessed
- Bun server APIs
- filesystem and process side effects
- window/widget mutation

Initial candidates:

- instance descriptor
- command definition shapes
- runtime inspection shapes
- workspace snapshot schema
- window and layout models
