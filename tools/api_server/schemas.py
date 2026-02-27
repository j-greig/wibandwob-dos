from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field


class RectModel(BaseModel):
    x: int
    y: int
    w: int
    h: int


class WindowCreate(BaseModel):
    # Spawnable window types — must match k_specs[] entries with non-null spawn fn
    # in app/window_type_registry.cpp. Parity enforced by tests/contract/test_window_type_parity.py.
    type: Literal[
        "test_pattern",
        "gradient",
        "frame_player",
        "text_view",
        "text_editor",
        "browser",
        "verse",
        "mycelium",
        "orbit",
        "torus",
        "cube",
        "life",
        "blocks",
        "score",
        "ascii",
        "animated_gradient",
        "monster_cam",
        "monster_verse",
        "contour_map",
        "generative_lab",
        "monster_portal",
        "paint",
        "micropolis_ascii",
        "terminal",
        "room_chat",
        "wibwob",
        "quadra",
        "snake",
        "rogue",
        "deep_signal",
        "app_launcher",
        "gallery",
        "figlet_text",
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


class PaintCellRequest(BaseModel):
    win_id: str
    x: int
    y: int
    fg: int = 15
    bg: int = 0


class PaintLineRequest(BaseModel):
    win_id: str
    x0: int
    y0: int
    x1: int
    y1: int
    fg: int = 15
    bg: int = 0


class PaintRectRequest(BaseModel):
    win_id: str
    x0: int
    y0: int
    x1: int
    y1: int
    fg: int = 15
    bg: int = 0
    fill: bool = False


class PaintClearRequest(BaseModel):
    win_id: str


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


class DesktopInfo(BaseModel):
    w: int
    h: int
    cell_aspect: float = 2.0


class AppStateModel(BaseModel):
    pattern_mode: str
    theme_mode: str
    theme_variant: str
    windows: List[WindowState]
    canvas: CanvasInfo
    desktop: DesktopInfo
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
    images: Optional[Literal["none", "key-inline", "all-inline", "gallery"]] = "all-inline"
    width: Optional[int] = 80


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


class BrowserCopyReq(BaseModel):
    format: Literal["plain", "markdown", "tui"] = "plain"
    include_image_urls: bool = False
    image_url_mode: Literal["full"] = "full"


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
    aspect: Optional[str] = None  # e.g. "16:9", "square", "golden" — applied to bounds.w/h
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
    width: int = 0        # Intrinsic character width of first frame (0 = unmeasured)
    height: int = 0       # Intrinsic line count of first frame (0 = unmeasured)
    aspect_ratio: float = 0.0  # width / height (0.0 = unmeasured)


class PrimerMetadata(BaseModel):
    filename: str
    width: int
    height: int
    aspect_ratio: float
    line_count: int
    max_line_width: int
    size_kb: float


class PrimersListResponse(BaseModel):
    primers: List[PrimerInfo]
    count: int


class GalleryArrangement(BaseModel):
    filename: str
    x: int
    y: int
    width: int
    height: int
    window_id: Optional[str] = None


class GalleryArrangeRequest(BaseModel):
    filenames: List[str] = Field(..., description="List of primer filenames to arrange (just basenames, e.g. 'foo.txt')")
    algorithm: str = Field("masonry", description=(
        "Layout algorithm: "
        "'masonry' (vertical columns, shortest-first) | "
        "'fit_rows' (L→R rows, wrap on overflow) | "
        "'masonry_horizontal' (horizontal masonry, shortest-row-first) | "
        "'packery' (2D guillotine bin-pack, fills gaps) | "
        "'cells_by_row' (uniform grid cells) | "
        "'poetry' (packery + breathing room + wide/tall interleave) | "
        "'cluster' (rectpack MaxRects → centred bbox, organic, no fixed rows/cols) | "
        "'stamp' (repeat one primer as a stamp on a pattern — text/grid/wave/spiral/cross/border/diagonal)"
    ))
    padding: int = Field(2, description="Character gap between windows")
    margin: int = Field(1, description=(
        "Gap (chars) between the window shadow edge and the canvas edge on all sides. "
        "Default 1 aligns left edge with the 'F' of the File menu. "
        "0 = flush to canvas, 2 = spacious, etc. "
        "Shadow offsets (TV fixed): right +2 cols, bottom +1 row — these are added automatically."
    ))
    canvas_width: int = Field(0, description="Override canvas width (0 = auto-query from TUI state)")
    canvas_height: int = Field(0, description="Override canvas height (0 = auto-query from TUI state)")
    preview: bool = Field(False, description="If true, return the plan without applying it")
    show_title: bool = Field(False, description=(
        "Show the primer filename (without .txt) in the window title bar. "
        "Off by default — primers are often narrower than their filename. "
        "No-op on frameless windows (no frame = nowhere to render the title)."
    ))
    force_open: bool = Field(False, description=(
        "Always open a fresh window for every placement, even if a window with "
        "that filename is already open. Required when calling gallery/arrange "
        "multiple times to place the same primer with different display modes."
    ))
    frameless: bool = Field(False, description=(
        "Open primers as ghost-frame windows — no visible border chrome. "
        "Content fills the full window bounds. Automatically implies shadowless=true. "
        "Best combined with tight padding (0-1) for a pure art-installation look."
    ))
    shadowless: bool = Field(False, description=(
        "Remove the Turbo Vision drop shadow (2-col right, 1-row bottom). "
        "Use with frameless=true for completely chromeless primers that tile "
        "seamlessly edge-to-edge with no visual artefacts between windows."
    ))
    options: Dict[str, Any] = Field(default_factory=dict, description=(
        "Per-algorithm options dict. Keys vary by algorithm:\n"
        "  masonry / masonry_horizontal:\n"
        "    clamp (bool, default false) — true: columns sized to median width, items cropped\n"
        "    n_cols / n_rows (int) — override auto column/row count\n"
        "  cluster:\n"
        "    anchor (str) — canvas position: center|tl|tr|bl|br|top|bottom|left|right\n"
        "    inner_algo (str) — maxrects_bssf|maxrects_bl|skyline_bl|guillotine\n"
        "    margin (int) — breathing room around cluster (overrides top-level margin)\n"
        "  stamp:\n"
        "    pattern (str) — text|grid|wave|diagonal|cross|border|spiral\n"
        "    text (str) — text to render in 3x5 pixel font, '|' for multi-line\n"
        "    cols (int) — grid columns, or stamp count for wave/spiral\n"
        "    rows (int) — grid rows\n"
        "    turns (float) — spiral turns (default 3.0)\n"
        "    anchor (str) — same 9-position system as cluster"
    ))


class GalleryArrangeResponse(BaseModel):
    ok: bool
    algorithm: str
    arrangement: List[GalleryArrangement]
    canvas_width: int
    canvas_height: int
    canvas_utilization: float
    overlaps: int
    out_of_bounds: int = 0
    applied: bool
    preview: bool


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
