## Peer Provenance Follow-On

Status: parked
GitHub issue: —
PR: —

## Why This Exists

The runtime refactor established:

- canonical runtime-node identity via `instanceId`
- shared command / inspection / window / workspace seams
- a clear distinction between runtime identity and future actor identity

What it did not implement is provenance for persistent changes made by:

- a human peer
- an agent peer
- a system-maintenance peer

That work is intentionally parked until the runtime state, document persistence,
and workspace model settle further.

## Follow-On Scope

First pass only:

1. define a lightweight peer descriptor separate from runtime `instanceId`
2. allow append-only provenance metadata on:
   - workspace saves
   - document edits
   - persistent history logs
3. prefer event metadata over Google-Docs-style history or CRDT sync

## Early Shape

Suggested peer descriptor:

```ts
type PeerKind = "human" | "agent" | "system";

interface PeerDescriptor {
  peerId: string;
  peerKind: PeerKind;
  displayName?: string;
  instanceId?: string;
}
```

Suggested append-only event envelope:

```ts
interface ProvenanceEvent {
  eventId: string;
  timestamp: string;
  peer?: PeerDescriptor;
  action: string;
  targetType: string;
  targetId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}
```

## Activation Conditions

Start this only when:

- workspace persistence is stable enough to add metadata without churn
- document/history storage seams are explicit owners
- multi-peer work is active enough that provenance creates real value

## References

- `X-CODEX-REFACTOR/wibwob_refactor_plan_v1.3.md`
- `X-CODEX-REFACTOR/wibwob_refactor_checklist_v1.3.md`
- `AGENTS.md` parking-lot note: event/persistence/multi-instance model
