from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

ROOT = Path(__file__).resolve().parents[3]
MAILBOX_DIR = ROOT / "tools" / "agent_mailbox"
if str(MAILBOX_DIR) not in sys.path:
    sys.path.insert(0, str(MAILBOX_DIR))

from models import AckEvent, MessageEvent


def test_message_and_ack_validate_against_json_schema() -> None:
    jsonschema = pytest.importorskip("jsonschema")
    schema_path = MAILBOX_DIR / "schema" / "message_v1.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))

    msg = MessageEvent(**{"from": "codex", "to": "claude", "thread_id": "general", "body_text": "hi"})
    ack = AckEvent(actor="claude", thread_id="general", target_id=msg.id)

    validator = jsonschema.Draft202012Validator(schema)
    validator.validate(msg.model_dump(by_alias=True, exclude_none=True, mode="json"))
    validator.validate(ack.model_dump(exclude_none=True, mode="json"))


def test_rejects_unsafe_agent_and_thread_ids() -> None:
    with pytest.raises(ValidationError):
        MessageEvent(**{"from": "../codex", "to": "claude", "thread_id": "general", "body_text": "hi"})

    with pytest.raises(ValidationError):
        MessageEvent(**{"from": "codex", "to": "claude", "thread_id": "../../etc", "body_text": "hi"})

    with pytest.raises(ValidationError):
        AckEvent(actor="claude", thread_id="bad/thread", target_id="m-123")
