from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


SAFE_ID_PATTERN = r"^[A-Za-z0-9._-]+$"


class MessageEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    event: Literal["message"] = "message"
    version: Literal["v1"] = "v1"
    id: str = Field(default_factory=lambda: str(uuid4()))
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    from_agent: str = Field(alias="from", min_length=1)
    to_agent: str = Field(alias="to", min_length=1)
    thread_id: str = Field(default="general", min_length=1)
    subject: str = ""
    body_text: Optional[str] = None
    body_path: Optional[str] = None
    priority: Literal["low", "medium", "high"] = "medium"
    ref: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _validate_body(self) -> "MessageEvent":
        if not self.body_text and not self.body_path:
            raise ValueError("either body_text or body_path is required")
        return self

    @field_validator("from_agent", "to_agent", "thread_id")
    @classmethod
    def _validate_safe_ids(cls, v: str) -> str:
        import re

        if not re.match(SAFE_ID_PATTERN, v):
            raise ValueError("must match ^[A-Za-z0-9._-]+$")
        return v


class AckEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: Literal["ack"] = "ack"
    version: Literal["v1"] = "v1"
    id: str = Field(default_factory=lambda: str(uuid4()))
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    actor: str = Field(min_length=1)
    thread_id: str = Field(default="general", min_length=1)
    target_id: str = Field(min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("actor", "thread_id")
    @classmethod
    def _validate_safe_ids(cls, v: str) -> str:
        import re

        if not re.match(SAFE_ID_PATTERN, v):
            raise ValueError("must match ^[A-Za-z0-9._-]+$")
        return v


Record = MessageEvent | AckEvent


def parse_record(raw: dict[str, Any]) -> Record:
    event_type = raw.get("event")
    if event_type == "message":
        return MessageEvent.model_validate(raw)
    if event_type == "ack":
        return AckEvent.model_validate(raw)
    raise ValueError(f"unknown event type: {event_type}")
