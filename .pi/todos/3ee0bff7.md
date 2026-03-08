{
  "id": "3ee0bff7",
  "title": "W6: add verified windows/batch example with correct op format to docs",
  "tags": [
    "e021",
    "ax",
    "docs",
    "quick"
  ],
  "status": "open",
  "created_at": "2026-03-08T18:16:03.661Z",
  "assigned_to_session": "58932650-d8a2-4bd0-a71b-5eb633ecdd8a"
}

From GH#117 AX audit.\nwindows/batch op format is ambiguous in .agents/control-api.md. Agents use wrong field names.\n\nFix: add a concrete working example block to control-api.md showing a batch move+resize call with exact field names. Verify against actual implementation in control-api.ts before committing.
