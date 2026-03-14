# `src/sdk`

Internal home for the microapp SDK implementation.

Pass 1 rule:

- keep `src/services/microapp-sdk.ts` as the stable public import path
- move real SDK ownership here gradually
- avoid exposing Blessed or unrelated internal helpers directly
