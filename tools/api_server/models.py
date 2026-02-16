from __future__ import annotations

import enum
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


class WindowType(str, enum.Enum):
    test_pattern = "test_pattern"
    gradient = "gradient"
    frame_player = "frame_player"
    text_view = "text_view"
    text_editor = "text_editor"
    browser = "browser"
    wallpaper = "wallpaper"


@dataclass
class Rect:
    x: int
    y: int
    w: int
    h: int


@dataclass
class Window:
    id: str
    type: WindowType
    title: str
    rect: Rect
    z: int = 0
    focused: bool = False
    zoomed: bool = False
    props: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AppState:
    pattern_mode: str = "continuous"  # or "tiled"
    theme_mode: str = "light"  # or "dark"
    theme_variant: str = "monochrome"  # or "dark_pastel"
    windows: List[Window] = field(default_factory=list)
    next_z: int = 1
    last_workspace: Optional[str] = None
    last_screenshot: Optional[str] = None
    started_at: float = field(default_factory=lambda: time.time())
    canvas_width: int = 80
    canvas_height: int = 25


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"
