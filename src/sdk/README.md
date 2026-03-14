# `src/sdk`

Internal home for the microapp SDK implementation.

Pass 1 rule:

- keep `src/services/microapp-sdk.ts` as the stable public import path
- move real SDK ownership here gradually
- avoid exposing Blessed or unrelated internal helpers directly

Current ownership anchors:

- `microapp-host.ts` — public host/window/chat contract for module authors
- `runtime-helpers.ts` — reusable SDK helpers that do not belong in host-internal services
- `runtime-client.ts` — read-only runtime API helpers for SDK consumers
- `index.ts` — internal aggregation point for SDK-owned exports
