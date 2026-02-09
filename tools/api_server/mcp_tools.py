"""MCP Tools for TUI Application Control

This module defines MCP (Model Context Protocol) tools that enable AI agents
like Claude Code to programmatically control TUI applications via standardized
tool interfaces.
"""

from typing import Optional, Dict, Any, List
from .controller import Controller
from .models import WindowType, Rect


# Note: Controller instance will be passed from main.py
_controller: Optional[Controller] = None

def set_controller(controller: Controller) -> None:
    """Set the controller instance (called from main.py)"""
    global _controller
    _controller = controller

def get_controller() -> Controller:
    """Get the controller instance"""
    if _controller is None:
        raise RuntimeError("Controller not initialized - call set_controller() first")
    return _controller

def serialize_window(window) -> Dict[str, Any]:
    """Serialize window object for MCP responses"""
    return {
        "id": window.id,
        "type": window.type.value,
        "title": window.title,
        "rect": {
            "x": window.rect.x,
            "y": window.rect.y, 
            "width": window.rect.w,
            "height": window.rect.h
        },
        "z": window.z,
        "focused": window.focused,
        "props": dict(window.props)
    }

def register_tui_tools(mcp):
    """Register all TUI control tools with the MCP server"""
    
    @mcp.tool("tui_get_state")
    async def get_tui_state() -> Dict[str, Any]:
        """Get current TUI application state and window list
        
        Returns:
            Dictionary containing current windows, pattern mode, and uptime
        """
        controller = get_controller()
        state = await controller.get_state()
        return {
            "windows": [serialize_window(w) for w in state.windows],
            "pattern_mode": state.pattern_mode,
            "uptime_sec": state.uptime_sec,
            "last_workspace": state.last_workspace,
            "last_screenshot": state.last_screenshot
        }
    
    @mcp.tool("tui_create_window")
    async def create_tui_window(
        window_type: str,
        title: Optional[str] = None,
        x: Optional[int] = None,
        y: Optional[int] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        **props
    ) -> Dict[str, Any]:
        """Create a new TUI window
        
        Args:
            window_type: Type of window ('test_pattern', 'gradient', 'frame_player', 'text_view')
            title: Optional window title
            x, y: Optional position (defaults to cascade)
            width, height: Optional size (defaults to window type default)
            **props: Additional properties (e.g., gradient='radial', path='file.txt')
            
        Returns:
            Dictionary containing created window details
        """
        controller = get_controller()
        
        try:
            wtype = WindowType(window_type)
        except ValueError:
            return {
                "success": False,
                "error": f"Invalid window type: {window_type}",
                "valid_types": [t.value for t in WindowType]
            }
        
        rect = None
        if x is not None and y is not None:
            w = width or 40
            h = height or 12
            rect = Rect(x, y, w, h)
            
        try:
            window = await controller.create_window(wtype, title, rect, props)
            return {
                "success": True,
                "window": serialize_window(window)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @mcp.tool("tui_move_window")
    async def move_tui_window(
        window_id: str,
        x: Optional[int] = None,
        y: Optional[int] = None,
        width: Optional[int] = None,
        height: Optional[int] = None
    ) -> Dict[str, Any]:
        """Move or resize a TUI window
        
        Args:
            window_id: ID of window to move/resize
            x, y: New position (optional, keeps current if not specified)
            width, height: New size (optional, keeps current if not specified)
            
        Returns:
            Dictionary containing success status and updated window details
        """
        controller = get_controller()
        
        try:
            window = await controller.move_resize(
                window_id, x=x, y=y, w=width, h=height
            )
            return {
                "success": True,
                "window": serialize_window(window)
            }
        except KeyError:
            return {
                "success": False,
                "error": f"Window not found: {window_id}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @mcp.tool("tui_focus_window")
    async def focus_tui_window(window_id: str) -> Dict[str, Any]:
        """Focus a TUI window (bring to front)
        
        Args:
            window_id: ID of window to focus
            
        Returns:
            Dictionary containing success status and focused window details
        """
        controller = get_controller()
        
        try:
            window = await controller.focus(window_id)
            return {
                "success": True,
                "window": serialize_window(window)
            }
        except KeyError:
            return {
                "success": False,
                "error": f"Window not found: {window_id}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @mcp.tool("tui_close_window")
    async def close_tui_window(window_id: str) -> Dict[str, Any]:
        """Close a specific TUI window
        
        Args:
            window_id: ID of window to close
            
        Returns:
            Dictionary containing success status
        """
        controller = get_controller()
        
        try:
            await controller.close(window_id)
            return {
                "success": True,
                "message": f"Window {window_id} closed"
            }
        except KeyError:
            return {
                "success": False,
                "error": f"Window not found: {window_id}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @mcp.tool("tui_cascade_windows")
    async def cascade_tui_windows() -> Dict[str, Any]:
        """Arrange all windows in cascade layout
        
        Returns:
            Dictionary containing success status
        """
        controller = get_controller()
        
        try:
            await controller.cascade()
            return {
                "success": True,
                "message": "Windows arranged in cascade layout"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @mcp.tool("tui_tile_windows")
    async def tile_tui_windows(columns: Optional[int] = 2) -> Dict[str, Any]:
        """Arrange all windows in tiled layout
        
        Args:
            columns: Number of columns for tiling (default: 2)
            
        Returns:
            Dictionary containing success status
        """
        controller = get_controller()
        
        try:
            await controller.tile(columns)
            return {
                "success": True,
                "message": f"Windows tiled in {columns} columns"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @mcp.tool("tui_close_all_windows")
    async def close_all_tui_windows() -> Dict[str, Any]:
        """Close all TUI windows
        
        Returns:
            Dictionary containing success status
        """
        controller = get_controller()
        
        try:
            await controller.close_all()
            return {
                "success": True,
                "message": "All windows closed"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @mcp.tool("tui_set_pattern_mode")
    async def set_tui_pattern_mode(mode: str) -> Dict[str, Any]:
        """Set the test pattern display mode
        
        Args:
            mode: Pattern mode ('continuous' or 'tiled')
            
        Returns:
            Dictionary containing success status
        """
        controller = get_controller()
        
        if mode not in ['continuous', 'tiled']:
            return {
                "success": False,
                "error": f"Invalid mode: {mode}",
                "valid_modes": ["continuous", "tiled"]
            }
        
        try:
            await controller.set_pattern_mode(mode)
            return {
                "success": True,
                "message": f"Pattern mode set to {mode}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @mcp.tool("tui_screenshot")
    async def take_tui_screenshot(path: Optional[str] = None) -> Dict[str, Any]:
        """Take a screenshot of the TUI application
        
        Args:
            path: Optional screenshot file path
            
        Returns:
            Dictionary containing success status and screenshot path
        """
        controller = get_controller()
        
        try:
            screenshot_path = await controller.screenshot(path)
            return {
                "success": True,
                "screenshot_path": screenshot_path
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @mcp.tool("tui_batch_layout")
    async def batch_layout_windows(request: Dict[str, Any]) -> Dict[str, Any]:
        """Batch create/move/close windows with macro expansion
        
        This is the main LLM-friendly tool for creating complex window layouts
        in a single operation. Supports grid macros and precise positioning.
        
        Args:
            request: BatchLayoutRequest dict with:
                - request_id: Unique ID for idempotency
                - dry_run: If true, simulate without applying (optional)
                - group_id: Group identifier for timeline operations (optional)
                - defaults: Default values for ops (optional)
                - ops: List of operations (create, move_resize, close, macro.create_grid)
                
        Example creating a 3x2 grid of test patterns:
            {
                "request_id": "grid-001",
                "defaults": {"view_type": "test_pattern"},
                "ops": [{
                    "op": "macro.create_grid",
                    "grid": {
                        "cols": 3, "rows": 2, 
                        "cell_w": 30, "cell_h": 10,
                        "gap_x": 2, "gap_y": 1,
                        "origin": {"x": 1, "y": 1, "w": 0, "h": 0}
                    }
                }]
            }
        
        Returns:
            Dictionary containing success status and batch operation results
        """
        controller = get_controller()
        try:
            from .schemas import BatchLayoutRequest
            model = BatchLayoutRequest(**request)
            resp = await controller.batch_layout(model)
            return {
                "success": True,
                "result": resp.dict()
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @mcp.tool("tui_timeline_cancel")
    async def cancel_timeline_operations(group_id: str) -> Dict[str, Any]:
        """Cancel scheduled timeline operations (MVP stub)
        
        Args:
            group_id: Group identifier for timeline operations to cancel
            
        Returns:
            Dictionary containing success status and cancellation details
        """
        controller = get_controller()
        try:
            res = await controller.cancel_timeline(group_id)
            return {
                "success": True,
                **res
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @mcp.tool("tui_timeline_status")
    async def get_timeline_status(group_id: str) -> Dict[str, Any]:
        """Get status of timeline operations (MVP stub)
        
        Args:
            group_id: Group identifier for timeline operations to check
            
        Returns:
            Dictionary containing success status and timeline status details
        """
        controller = get_controller()
        try:
            res = await controller.get_timeline_status(group_id)
            return {
                "success": True,
                **res
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    @mcp.tool("tui_send_text")
    async def send_text_to_window(
        window_id: str,
        content: str,
        mode: str = "append",
        position: str = "end"
    ) -> Dict[str, Any]:
        """Send text content to a text editor window
        
        This tool enables dynamic text/ASCII art delivery to text editor windows
        in the TUI application. Perfect for real-time content streaming.
        
        Args:
            window_id: ID of the text editor window to send content to
            content: Text content to send (can include ASCII art, multiple lines)
            mode: How to add the content - "append" (add to end), "replace" (replace all), "insert" (insert at position)  
            position: Where to insert (when mode="insert") - "cursor", "start", "end"
            
        Example sending ASCII art header:
            window_id="win_abc123"
            content="\\n  ╔══════════════╗\\n  ║  TURBO TEXT  ║\\n  ╚══════════════╝\\n\\n"
            mode="replace"
            
        Returns:
            Dictionary containing success status and operation details
        """
        controller = get_controller()
        try:
            result = await controller.send_text(window_id, content, mode, position)
            return {
                "success": result.get("ok", False),
                "window_id": window_id,
                "content_length": len(content),
                "mode": mode,
                "position": position,
                "result": result
            }
        except KeyError:
            return {
                "success": False,
                "error": f"Text editor window not found: {window_id}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }    
    @mcp.tool("tui_send_figlet")
    async def send_figlet_to_window(
        window_id: str,
        text: str,
        font: str = "standard",
        width: Optional[int] = None,
        mode: str = "append"
    ) -> Dict[str, Any]:
        """Generate and send FIGlet ASCII art to a text editor window
        
        Creates beautiful ASCII art banners using FIGlet fonts and sends them
        to text editor windows. Perfect for headers, titles, and decorative text.
        
        Args:
            window_id: ID of text editor window ("auto" creates one if needed)
            text: Text to convert to ASCII art (keep short for best results)
            font: FIGlet font name - popular options:
                  - "standard": Classic block letters
                  - "slant": Slanted italic style  
                  - "big": Large bold letters
                  - "small": Compact letters
                  - "banner": Wide banner style
                  - "doom": Doom-style letters
                  - "starwars": Star Wars style
                  - "bubble": Bubble letters
            width: Maximum width in characters (auto-detects from window if not set)
            mode: "append" (add to end) or "replace" (replace all content)
            
        Example creating a title:
            window_id="auto"
            text="TURBO TEXT"
            font="slant"
            mode="replace"
            
        Returns:
            Dictionary with success status and figlet generation details
        """
        controller = get_controller()
        try:
            result = await controller.send_figlet(window_id, text, font, width or 0, mode)
            return {
                "success": result.get("ok", False),
                "window_id": result.get("window_id"),
                "text": text,
                "font": font,
                "mode": mode,
                "result": result
            }
        except KeyError:
            return {
                "success": False,
                "error": f"Text editor window not found: {window_id}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
