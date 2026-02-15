from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


class RectModel(BaseModel):
    x: int
    y: int
    w: int
    h: int


class WindowCreate(BaseModel):
    type: Literal[
        "test_pattern",
        "gradient",
        "frame_player",
        "text_view",
        "text_editor",
        "browser",
        "wallpaper",
        "browser",
    ]
    title: Optional[str] = None
    rect: Optional[RectModel] = None
    props: Dict[str, Any] = Field(default_factory=dict)


class WindowRef(BaseModel):
    id: str


class WindowMoveResize(BaseModel):
    x: Optional[int] = None
    y: Optional[int] = None
    w: Optional[int] = None
    h: Optional[int] = None


class WindowPropsUpdate(BaseModel):
    props: Dict[str, Any]


class MenuCommand(BaseModel):
    command: str
    args: Dict[str, Any] = Field(default_factory=dict)
    actor: Optional[str] = "api"


class PatternMode(BaseModel):
    mode: Literal["continuous", "tiled"]


class ThemeMode(BaseModel):
    mode: Literal["light", "dark"]


class ThemeVariant(BaseModel):
    variant: Literal["monochrome", "dark_pastel"]


class MonodrawLoadRequest(BaseModel):
    file_path: str
    scale: float = 1.0
    offset_x: int = 0
    offset_y: int = 0
    window_types: Optional[Dict[str, str]] = None

    # NEW: Target destination for imported content
    target: Literal["windows", "text_editor"] = "windows"

    # NEW: Layer filtering (for text_editor target)
    layers: Optional[List[str]] = None  # Layer names to import, None = all

    # NEW: Text editor behaviour
    mode: Literal["replace", "append", "insert"] = "replace"
    flatten: bool = True  # Merge multiple layers into single document
    insert_position: Literal["start", "end", "cursor"] = "end"
    insert_header: bool = True  # Add "// Imported from {filename}" comment


class MonodrawParseRequest(BaseModel):
    file_path: str


class WorkspaceSave(BaseModel):
    path: str


class WorkspaceOpen(BaseModel):
    path: str


class StateExportReq(BaseModel):
    path: str
    format: Literal["json", "ndjson"] = "json"


class StateImportReq(BaseModel):
    path: str
    mode: Literal["replace", "merge"] = "replace"


class ScreenshotReq(BaseModel):
    path: Optional[str] = None


class SendTextReq(BaseModel):
    content: str
    mode: Literal["append", "replace", "insert"] = "append"
    position: Literal["cursor", "start", "end"] = "end"


class SendFigletReq(BaseModel):
    text: str
    font: str = "standard"
    width: Optional[int] = None
    mode: Literal["append", "replace"] = "append"


class FigletSegment(BaseModel):
    text: str
    font: str


class SendMultiFigletReq(BaseModel):
    segments: List[FigletSegment]
    separator: str = "\n"
    mode: Literal["append", "replace"] = "replace"


class Capabilities(BaseModel):
    version: str
    window_types: List[str]
    commands: List[str]
    properties: Dict[str, Any]


class WindowState(BaseModel):
    id: str
    type: str
    title: str
    rect: RectModel
    z: int
    focused: bool
    zoomed: bool
    props: Dict[str, Any]


class CanvasInfo(BaseModel):
    width: int
    height: int
    cols: int
    rows: int


class AppStateModel(BaseModel):
    pattern_mode: str
    theme_mode: str
    theme_variant: str
    windows: List[WindowState]
    canvas: CanvasInfo
    last_workspace: Optional[str] = None
    last_screenshot: Optional[str] = None
    uptime_sec: float


class BrowserOpenReq(BaseModel):
    url: str
    window_id: Optional[str] = None
    mode: Literal["same", "new"] = "new"


class BrowserWindowReq(BaseModel):
    window_id: str


class BrowserFindReq(BaseModel):
    window_id: str
    query: str
    direction: Literal["next", "prev"] = "next"


class BrowserSetModeReq(BaseModel):
    window_id: str
    headings: Optional[str] = None
    images: Optional[str] = None


class BrowserFetchReq(BaseModel):
    url: str
    reader: Literal["readability", "trafilatura", "raw"] = "readability"
    format: Literal["markdown", "tui_bundle"] = "tui_bundle"


class BrowserRenderReq(BaseModel):
    markdown: str
    headings: Optional[str] = "plain"
    images: Optional[str] = "none"
    width: Optional[int] = 80


class BrowserGetContentReq(BaseModel):
    window_id: str
    format: Literal["text", "markdown", "links"] = "text"


class BrowserClipReq(BaseModel):
    window_id: str
    path: Optional[str] = None
    include_images: bool = False


# ----- Batch Layout Models -----

class ScheduleModel(BaseModel):
    at_ms: Optional[int] = None
    delay_ms: Optional[int] = None
    stagger_ms: Optional[int] = None
    duration_ms: Optional[int] = None
    easing: Optional[Literal["linear", "ease_in", "ease_out", "ease_in_out"]] = "linear"


class BoundsModel(BaseModel):
    x: int
    y: int
    w: int
    h: int


class GridMacro(BaseModel):
    cols: int
    rows: int
    cell_w: int
    cell_h: int
    gap_x: int = 0
    gap_y: int = 0
    origin: BoundsModel = Field(default_factory=lambda: BoundsModel(x=1, y=1, w=0, h=0))
    order: Literal["row_major", "col_major"] = "row_major"


class RingMacro(BaseModel):
    cx: int
    cy: int
    radius: int
    count: int
    w: int
    h: int
    rotate: bool = False
    jitter: int = 0


class BatchOp(BaseModel):
    op: Literal["create", "move_resize", "close", "zorder", "macro.create_grid", "macro.create_ring"]
    window_id: Optional[str] = None
    view_type: Optional[str] = None
    title: Optional[str] = None
    bounds: Optional[BoundsModel] = None
    z: Optional[Union[int, Literal["raise", "lower", "topmost"]]] = None
    options: Dict[str, Any] = Field(default_factory=dict)
    schedule: Optional[ScheduleModel] = None
    grid: Optional[GridMacro] = None
    ring: Optional[RingMacro] = None


class BatchDefaults(BaseModel):
    view_type: Optional[str] = None
    z: Optional[Union[int, Literal["raise", "lower", "topmost"]]] = None
    easing: Optional[str] = "linear"
    duration_ms: Optional[int] = 0


class BatchLayoutRequest(BaseModel):
    request_id: str
    dry_run: bool = False
    group_id: Optional[str] = None
    clock: Literal["monotonic", "wall"] = "monotonic"
    start_at_ms: Optional[int] = None
    defaults: Optional[BatchDefaults] = None
    ops: List[BatchOp]


class BatchOpResult(BaseModel):
    status: Literal["scheduled", "applied", "rejected"]
    reason: Optional[str] = None
    window_id: Optional[str] = None
    effective_time_ms: Optional[int] = None
    final_bounds: Optional[BoundsModel] = None


class TimelineSummary(BaseModel):
    t0_ms: Optional[int] = None
    t1_ms: Optional[int] = None
    counts: Dict[str, int] = Field(default_factory=dict)


class BatchLayoutResponse(BaseModel):
    dry_run: bool
    applied: bool
    group_id: Optional[str]
    op_results: List[BatchOpResult]
    warnings: List[str] = Field(default_factory=list)
    timeline_summary: Optional[TimelineSummary] = None


# ----- Batch Primer Models -----

class PrimerWindow(BaseModel):
    primer_path: str
    title: Optional[str] = None
    x: int
    y: int
    # No w/h needed - windows auto-size based on primer content


class BatchPrimersRequest(BaseModel):
    primers: List[PrimerWindow] = Field(..., max_length=20, description="Up to 20 primer windows to spawn")
    

class BatchPrimersResponse(BaseModel):
    windows: List[WindowState]
    skipped: List[str] = Field(default_factory=list, description="Primer paths that couldn't be loaded")


class PrimerInfo(BaseModel):
    name: str
    path: str
    size_kb: float
    

class PrimersListResponse(BaseModel):
    primers: List[PrimerInfo]
    count: int


# ----- Browser Models -----

class BrowserFetchRequest(BaseModel):
    url: str


class BrowserLink(BaseModel):
    id: int
    text: str
    url: str


class BrowserMeta(BaseModel):
    fetched_at: str
    cache: str
    source_bytes: int


class RenderBundle(BaseModel):
    url: str
    title: str
    markdown: str
    tui_text: str
    links: List[BrowserLink]
    assets: List[Any] = Field(default_factory=list)
    meta: BrowserMeta
