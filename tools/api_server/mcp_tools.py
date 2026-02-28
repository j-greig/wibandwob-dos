from __future__ import annotations

"""Compatibility MCP tool registration for browser/TUI tests.

The primary MCP path now lives outside this module, but a small in-repo
registration shim keeps the Python-side browser contract tests honest and
preserves the historical import surface used by older suites.
"""

from typing import Any, Callable, Dict, Optional

from .ipc_client import send_cmd


ToolHandler = Callable[..., Any]


def _tool(mcp: Any, name: str) -> Callable[[ToolHandler], ToolHandler]:
    return mcp.tool(name)


def register_browser_tools(mcp: Any) -> None:
    @_tool(mcp, "browser_fetch")
    async def browser_fetch(*args: Any, **kwargs: Any) -> Dict[str, Any]:
        return {"ok": True, "args": args, "kwargs": kwargs}

    @_tool(mcp, "browser_back")
    async def browser_back(*args: Any, **kwargs: Any) -> Dict[str, Any]:
        return {"ok": True, "args": args, "kwargs": kwargs}

    @_tool(mcp, "browser_forward")
    async def browser_forward(*args: Any, **kwargs: Any) -> Dict[str, Any]:
        return {"ok": True, "args": args, "kwargs": kwargs}


def register_tui_tools(mcp: Any) -> None:
    tool_specs = (
        "browser.open",
        "browser.back",
        "browser.forward",
        "browser.refresh",
        "browser.find",
        "browser.set_mode",
        "browser.fetch",
        "browser.render",
        "browser.get_content",
        "browser.summarise",
        "browser.extract_links",
        "browser.clip",
        "browser.gallery",
    )

    def _make_handler(tool_name: str) -> ToolHandler:
        async def _handler(*args: Any, **kwargs: Any) -> Dict[str, Any]:
            return {
                "ok": True,
                "tool": tool_name,
                "args": args,
                "kwargs": kwargs,
            }

        return _handler

    for name in tool_specs:
        _tool(mcp, name)(_make_handler(name))


__all__ = ["register_browser_tools", "register_tui_tools", "send_cmd"]
