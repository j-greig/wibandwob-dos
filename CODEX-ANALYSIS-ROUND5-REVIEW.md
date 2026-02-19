# Codex Round-5 Review: Verification Pass

**Raw log**: `codex-review-round5-20260218-202312.log`
**Model**: gpt-5.3-codex

## Context

Verification pass after round-4 fixes (stale test assertions + lock init). Focused on:
- api_get_state completeness
- windowTypeName coverage
- apply_delta_to_ipc correctness
- chat relay routing

## Findings

| # | Severity | Finding |
|---|----------|---------|
| 1 | High | `api_get_state` missing `path` for file-backed windows — remote `create_window type=text_view path=...` fails with "err missing path" |
| 2 | Info | `windowTypeName()` fully comprehensive — all 15 types covered |
| 3 | Info | `WindowTypeRegistry` k_specs table correct and complete |
| 4 | Info | apply_delta_to_ipc correctly routes add/remove/update |

## Fixes Applied (this session)

### Fix 1: Emit `path` in api_get_state for file-backed windows

**Root cause**: `api_get_state` loop emitted only `id/type/x/y/w/h/title`. Windows backed
by files (`text_view` = TTransparentTextWindow, `frame_player` = TFrameAnimationWindow)
also need their file path for remote `create_window` to succeed.

**Changes**:
- `TTransparentTextView`: added `getFileName()` public getter (was private `fileName`)
- `TTransparentTextWindow`: added `getFilePath()` declaration in header, implemented via `textView->getFileName()`
- `TFrameAnimationWindow`: added `std::string filePath_` private member + `getFilePath()` accessor
- `api_get_state`: after title emission, dynamic-cast to TTransparentTextWindow / TFrameAnimationWindow and emit `,"path":"..."` when non-empty
- `apply_delta_to_ipc`: forward `path` from delta dict to `create_window` params when present
- Added 2 tests: `test_add_file_backed_window_forwards_path`, `test_add_no_path_key_when_missing`

## Test Status

**154 passed, 1 skipped** across all `tests/room/` tests.

## Remaining Work (not critical)

- E008 F05 stretch: Cursor overlay
- P3 JSON dual-stack IPC — eliminates key-name drift permanently (large scope)
- Fix pre-existing `command_registry_test` linker error (api_chat_receive symbol missing)
