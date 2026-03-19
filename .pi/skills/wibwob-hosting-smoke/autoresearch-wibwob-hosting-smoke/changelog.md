## Experiment 0 — baseline

**Score:** 7/8 (87.5%)  
**Change:** None (baseline clone of current hosting skill).  
**Reasoning:** Establish measurable starting point before mutations.  
**Result:** Strong hosting-agnostic structure already; one gap: missing explicit Fly (`FLY_APP_NAME`) and npm prepublish prerequisite callouts in the skill text.  
**Failing outputs:** Prerequisites not explicit enough for first-run success.

## Experiment 1 — keep

**Score:** 8/8 (100.0%)  
**Change:** Added adapter-specific preconditions section including Fly env setup, npm prepublish flow, and `WIBWOB_DATA_DIR` expectation.  
**Reasoning:** Most failures in first-run operation come from missing prerequisites rather than broken checks.  
**Result:** Closed the only failing eval; full pass achieved.  
**Failing outputs:** None in current suite.

## Experiment 2 — discard

**Score:** 8/8 (100.0%)  
**Change:** Added an adapter quick-map table (runner + capture prefix).  
**Reasoning:** Hypothesis was that discoverability might improve onboarding clarity.  
**Result:** Score unchanged; no measurable gain versus current evals.  
**Failing outputs:** None; reverted to keep file concise.

## Experiment 3 — discard

**Score:** 8/8 (100.0%)  
**Change:** Added an anti-pattern section for common mistakes.  
**Reasoning:** Hypothesis was that stronger negative guidance would reduce operator error.  
**Result:** Score unchanged under binary evals; dropped to avoid unnecessary bulk.  
**Failing outputs:** None; reverted to the kept version.

## Experiment 4 — baseline (eval suite v2)

**Score:** 9/10 (90.0%)  
**Change:** No prompt mutation; expanded eval suite to include persistent-history contract.  
**Reasoning:** User requested durable non-dashboard logging guarantees.  
**Result:** One missing criterion: skill text didn’t explicitly enumerate persistent run-history files.  
**Failing outputs:** `persistent_history_mentions`.

## Experiment 5 — keep

**Score:** 10/10 (100.0%)  
**Change:** Added “Persistent run history (outside dashboard)” section with explicit file contract (`results.tsv`, `results.json`, `experiments.jsonl`, `SESSION_LOG.md`).  
**Reasoning:** Make durability requirements explicit to future operators/agents.  
**Result:** Closed final gap in eval-suite v2.  
**Failing outputs:** None.

## Experiment 6 — baseline (eval suite v3)

**Score:** 10/13 (76.9%)  
**Change:** No prompt mutation; expanded eval suite to require failure taxonomy/remediation/dynamic-port guidance.  
**Reasoning:** Align skill guidance with in-flight runtime hardening plan while keeping this loop prompt-focused.  
**Result:** Missing explicit taxonomy enum + remediation metadata contract + dynamic tunnel guidance.  
**Failing outputs:** `failure_taxonomy_enum`, `remediation_event_contract`, `dynamic_tunnel_ports_guidance`.

## Experiment 7 — keep

**Score:** 13/13 (100.0%)  
**Change:** Added “Failure taxonomy + remediation event contract” section with enum, `remediation_attempted`, and collision-safe dynamic tunnel-port guidance.  
**Reasoning:** Raise operator consistency and make code-level hardening expectations explicit without implementing runtime fixes in this loop.  
**Result:** Closed all eval-suite v3 gaps.  
**Failing outputs:** None.
