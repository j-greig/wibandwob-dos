from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .controller import Controller
from .events import EventHub
from .models import Rect, WindowType

# MCP Integration
try:
    from fastapi_mcp import FastApiMCP
    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False

from .schemas import (
    AppStateModel,
    BatchLayoutRequest,
    BatchLayoutResponse,
    BatchPrimersRequest,
    BatchPrimersResponse,
    CanvasInfo,
    Capabilities,
    MenuCommand,
    MonodrawLoadRequest,
    MonodrawParseRequest,
    PatternMode,
    PrimerInfo,
    PrimersListResponse,
    ScreenshotReq,
    SendTextReq,
    SendFigletReq,
    SendMultiFigletReq,
    WindowCreate,
    WindowMoveResize,
    WindowPropsUpdate,
    WindowState,
    WorkspaceOpen,
    WorkspaceSave,
    RectModel,
)
from pydantic import BaseModel


def make_app() -> FastAPI:
    app = FastAPI(title="Test Pattern Control API", version="v1")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost", "http://127.0.0.1", "*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    events = EventHub()
    ctl = Controller(events)

    # ----- Helpers -----
    def to_state_model() -> AppStateModel:
        st = asyncio.get_event_loop().run_until_complete(ctl.get_state())
        return AppStateModel(
            pattern_mode=st.pattern_mode,
            windows=[
                WindowState(
                    id=w.id,
                    type=w.type.value,
                    title=w.title,
                    rect=RectModel(x=w.rect.x, y=w.rect.y, w=w.rect.w, h=w.rect.h),
                    z=w.z,
                    focused=w.focused,
                    zoomed=w.zoomed,
                    props=w.props,
                )
                for w in st.windows
            ],
            last_workspace=st.last_workspace,
            last_screenshot=st.last_screenshot,
            uptime_sec=time.time() - st.started_at,
        )

    # ----- Routes -----
    @app.get("/health")
    async def health() -> Dict[str, Any]:
        return {"ok": True}

    @app.get("/capabilities", response_model=Capabilities)
    async def capabilities() -> Capabilities:
        return Capabilities(
            version="v1",
            window_types=[t.value for t in WindowType],
            commands=[
                "cascade",
                "tile",
                "close_all",
                "save_workspace",
                "open_workspace",
                "screenshot",
            ],
            properties={
                "frame_player": {"fps": {"type": "number", "min": 1, "max": 120}},
                "test_pattern": {"variant": {"type": "string"}},
            },
        )

    @app.get("/state", response_model=AppStateModel)
    async def state() -> AppStateModel:
        st = await ctl.get_state()
        return AppStateModel(
            pattern_mode=st.pattern_mode,
            windows=[
                WindowState(
                    id=w.id,
                    type=w.type.value,
                    title=w.title,
                    rect=RectModel(x=w.rect.x, y=w.rect.y, w=w.rect.w, h=w.rect.h),
                    z=w.z,
                    focused=w.focused,
                    zoomed=w.zoomed,
                    props=w.props,
                )
                for w in st.windows
            ],
            canvas=CanvasInfo(
                width=st.canvas_width,
                height=st.canvas_height,
                cols=st.canvas_width,
                rows=st.canvas_height
            ),
            last_workspace=st.last_workspace,
            last_screenshot=st.last_screenshot,
            uptime_sec=time.time() - st.started_at,
        )

    @app.post("/windows", response_model=WindowState)
    async def create_window(payload: WindowCreate) -> WindowState:
        try:
            wtype = WindowType(payload.type)
        except ValueError:
            raise HTTPException(status_code=400, detail="unknown window type")
        rect = Rect(**payload.rect.model_dump()) if payload.rect else None
        win = await ctl.create_window(wtype, title=payload.title, rect=rect, props=payload.props)
        return WindowState(
            id=win.id,
            type=win.type.value,
            title=win.title,
            rect=RectModel(x=win.rect.x, y=win.rect.y, w=win.rect.w, h=win.rect.h),
            z=win.z,
            focused=win.focused,
            zoomed=win.zoomed,
            props=win.props,
        )

    @app.post("/windows/{win_id}/move", response_model=WindowState)
    async def move(win_id: str, payload: WindowMoveResize) -> WindowState:
        try:
            win = await ctl.move_resize(win_id, x=payload.x, y=payload.y, w=payload.w, h=payload.h)
        except KeyError:
            raise HTTPException(status_code=404, detail="window not found")
        return WindowState(
            id=win.id,
            type=win.type.value,
            title=win.title,
            rect=RectModel(x=win.rect.x, y=win.rect.y, w=win.rect.w, h=win.rect.h),
            z=win.z,
            focused=win.focused,
            zoomed=win.zoomed,
            props=win.props,
        )

    @app.post("/windows/{win_id}/focus", response_model=WindowState)
    async def focus(win_id: str) -> WindowState:
        try:
            win = await ctl.focus(win_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="window not found")
        return WindowState(
            id=win.id,
            type=win.type.value,
            title=win.title,
            rect=RectModel(x=win.rect.x, y=win.rect.y, w=win.rect.w, h=win.rect.h),
            z=win.z,
            focused=win.focused,
            zoomed=win.zoomed,
            props=win.props,
        )

    @app.post("/windows/{win_id}/clone", response_model=WindowState)
    async def clone(win_id: str) -> WindowState:
        try:
            win = await ctl.clone(win_id)
        except KeyError:
            raise HTTPException(status_code=404, detail="window not found")
        return WindowState(
            id=win.id,
            type=win.type.value,
            title=win.title,
            rect=RectModel(x=win.rect.x, y=win.rect.y, w=win.rect.w, h=win.rect.h),
            z=win.z,
            focused=win.focused,
            zoomed=win.zoomed,
            props=win.props,
        )

    @app.post("/windows/{win_id}/close")
    async def close(win_id: str) -> Dict[str, Any]:
        await ctl.close(win_id)
        return {"ok": True}

    @app.post("/windows/{win_id}/send_text")
    async def send_text(win_id: str, payload: SendTextReq) -> Dict[str, Any]:
        res = await ctl.send_text(win_id, payload.content, payload.mode, payload.position)
        if not res.get("ok"):
            raise HTTPException(status_code=502, detail=res.get("error", "ipc_send_text_failed"))
        return res

    @app.post("/text_editor/send_text")
    async def send_text_auto(payload: SendTextReq) -> Dict[str, Any]:
        """Send text to any text editor window, creating one if none exists"""
        res = await ctl.send_text("auto", payload.content, payload.mode, payload.position)
        if not res.get("ok"):
            raise HTTPException(status_code=502, detail=res.get("error", "ipc_send_text_failed"))
        return res

    @app.post("/windows/{win_id}/send_figlet")
    async def send_figlet(win_id: str, payload: SendFigletReq) -> Dict[str, Any]:
        res = await ctl.send_figlet(win_id, payload.text, payload.font, payload.width or 0, payload.mode)
        if not res.get("ok"):
            raise HTTPException(status_code=502, detail=res.get("error", "ipc_send_figlet_failed"))
        return res

    @app.post("/text_editor/send_figlet")
    async def send_figlet_auto(payload: SendFigletReq) -> Dict[str, Any]:
        """Send figlet ASCII art to any text editor window, creating one if none exists"""
        res = await ctl.send_figlet("auto", payload.text, payload.font, payload.width or 0, payload.mode)
        if not res.get("ok"):
            raise HTTPException(status_code=502, detail=res.get("error", "ipc_send_figlet_failed"))
        return res

    @app.post("/windows/{win_id}/send_multi_figlet")
    async def send_multi_figlet(win_id: str, payload: SendMultiFigletReq) -> Dict[str, Any]:
        """Send multiple figlet segments with different fonts"""
        # For now, concatenate all segments - can be enhanced later for true multi-segment support
        combined_text = ""
        for segment in payload.segments:
            combined_text += f"[Font: {segment.font}] {segment.text}{payload.separator}"
        
        # Use the first font as default for the combined text
        first_font = payload.segments[0].font if payload.segments else "standard"
        return await ctl.send_figlet(win_id, combined_text, first_font, 0, payload.mode)

    @app.post("/windows/cascade")
    async def cascade() -> Dict[str, Any]:
        await ctl.cascade()
        return {"ok": True}

    @app.post("/windows/tile")
    async def tile(payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        cols = (payload or {}).get("cols", 2)
        await ctl.tile(cols)
        return {"ok": True}

    @app.post("/windows/close_all")
    async def close_all() -> Dict[str, Any]:
        await ctl.close_all()
        return {"ok": True}

    @app.post("/props/{win_id}")
    async def set_props(win_id: str, payload: WindowPropsUpdate) -> Dict[str, Any]:
        try:
            await ctl.set_props(win_id, payload.props)
        except KeyError:
            raise HTTPException(status_code=404, detail="window not found")
        return {"ok": True}

    @app.post("/menu/command")
    async def menu_command(payload: MenuCommand) -> Dict[str, Any]:
        res = await ctl.exec_command(payload.command, payload.args)
        if not res.get("ok"):
            raise HTTPException(status_code=400, detail=res.get("error", "command_failed"))
        return res

    @app.post("/pattern_mode")
    async def pattern_mode(payload: PatternMode) -> Dict[str, Any]:
        await ctl.set_pattern_mode(payload.mode)
        return {"ok": True}

    @app.post("/workspace/save")
    async def workspace_save(payload: WorkspaceSave) -> Dict[str, Any]:
        await ctl.save_workspace(payload.path)
        return {"ok": True, "path": payload.path}

    @app.post("/workspace/open")
    async def workspace_open(payload: WorkspaceOpen) -> Dict[str, Any]:
        await ctl.open_workspace(payload.path)
        return {"ok": True, "path": payload.path}

    @app.post("/screenshot")
    async def screenshot(payload: Optional[ScreenshotReq] = None) -> Dict[str, Any]:
        target = await ctl.screenshot((payload or ScreenshotReq()).path)
        return {"ok": True, "path": target}

    @app.post("/windows/batch_layout", response_model=BatchLayoutResponse)
    async def windows_batch_layout(payload: BatchLayoutRequest) -> BatchLayoutResponse:
        return await ctl.batch_layout(payload)

    @app.post("/primers/batch", response_model=BatchPrimersResponse)
    async def batch_primers(payload: BatchPrimersRequest) -> BatchPrimersResponse:
        """Spawn up to 20 primer windows at specified positions"""
        windows = []
        skipped = []
        
        for primer_spec in payload.primers:
            try:
                # Create text_view window with primer path
                # Let text_view auto-size by only specifying position, not dimensions
                win = await ctl.create_window(
                    WindowType.text_view,
                    title=primer_spec.title or primer_spec.primer_path.split('/')[-1].replace('.txt', ''),
                    rect=Rect(x=primer_spec.x, y=primer_spec.y, w=-1, h=-1),  # -1 = auto-size
                    props={"path": primer_spec.primer_path}
                )
                windows.append(WindowState(
                    id=win.id,
                    type=win.type.value,
                    title=win.title,
                    rect=RectModel(x=win.rect.x, y=win.rect.y, w=win.rect.w, h=win.rect.h),
                    z=win.z,
                    focused=win.focused,
                    zoomed=win.zoomed,
                    props=win.props,
                ))
            except Exception as e:
                skipped.append(f"{primer_spec.primer_path}: {str(e)}")
                
        return BatchPrimersResponse(windows=windows, skipped=skipped)

    @app.get("/primers/list", response_model=PrimersListResponse)
    async def list_primers() -> PrimersListResponse:
        """List all available primer files across module directories"""
        import os
        import glob

        primers = []
        seen = set()

        # Scan module dirs: modules-private/*/primers/ then modules/*/primers/
        # Also check legacy app/primers/ as fallback
        search_bases = ["modules-private", "modules"]
        for base in search_bases:
            if not os.path.isdir(base):
                continue
            for module_name in sorted(os.listdir(base)):
                primers_dir = os.path.join(base, module_name, "primers")
                if not os.path.isdir(primers_dir):
                    continue
                for primer_path in sorted(glob.glob(os.path.join(primers_dir, "*.txt"))):
                    try:
                        basename = os.path.basename(primer_path)
                        if basename in seen:
                            continue
                        seen.add(basename)
                        stat = os.stat(primer_path)
                        name = basename.replace('.txt', '')
                        primers.append(PrimerInfo(
                            name=name,
                            path=primer_path,
                            size_kb=round(stat.st_size / 1024, 1)
                        ))
                    except Exception:
                        continue

        # Legacy fallback
        for legacy_dir in ["app/primers"]:
            if not os.path.isdir(legacy_dir):
                continue
            for primer_path in sorted(glob.glob(os.path.join(legacy_dir, "*.txt"))):
                try:
                    basename = os.path.basename(primer_path)
                    if basename in seen:
                        continue
                    seen.add(basename)
                    stat = os.stat(primer_path)
                    name = basename.replace('.txt', '')
                    primers.append(PrimerInfo(
                        name=name,
                        path=primer_path,
                        size_kb=round(stat.st_size / 1024, 1)
                    ))
                except Exception:
                    continue

        return PrimersListResponse(primers=primers, count=len(primers))

    @app.post("/timeline/cancel")
    async def timeline_cancel(body: Dict[str, Any]) -> Dict[str, Any]:
        gid = str((body or {}).get("group_id", ""))
        if not gid:
            raise HTTPException(status_code=400, detail="missing group_id")
        return await ctl.cancel_timeline(gid)

    @app.get("/timeline/status")
    async def timeline_status(group_id: str) -> Dict[str, Any]:
        return await ctl.get_timeline_status(group_id)

    # ----- Monodraw Integration -----

    @app.post("/monodraw/load")
    async def monodraw_load(payload: MonodrawLoadRequest) -> Dict[str, Any]:
        """Load Monodraw JSON file and spawn windows OR import to text editor."""
        return await ctl.load_monodraw_file(
            file_path=payload.file_path,
            scale=payload.scale,
            offset_x=payload.offset_x,
            offset_y=payload.offset_y,
            window_types=payload.window_types,
            target=payload.target,
            layers_filter=payload.layers,
            mode=payload.mode,
            flatten=payload.flatten,
            insert_position=payload.insert_position,
            insert_header=payload.insert_header
        )

    @app.post("/monodraw/parse")
    async def monodraw_parse(payload: MonodrawParseRequest) -> Dict[str, Any]:
        """Parse Monodraw file without creating windows (preview mode)."""
        return await ctl.parse_monodraw_file(payload.file_path)

    @app.websocket("/ws")
    async def ws(websocket: WebSocket) -> None:
        await websocket.accept()
        await events.add(websocket)
        try:
            while True:
                # Keep connection alive; ignore client messages for now
                await websocket.receive_text()
        except WebSocketDisconnect:
            await events.remove(websocket)

    # MCP Integration
    if MCP_AVAILABLE:
        mcp = FastApiMCP(app)
        mcp.mount_http()  # Mounts MCP server at /mcp with HTTP transport
        print("✅ MCP server mounted at /mcp")
        print("🔗 MCP URL: http://127.0.0.1:8089/mcp")
    else:
        print("⚠️  MCP not available - install 'fastapi-mcp' for MCP support")

    return app


app = make_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8089, log_level="info")
