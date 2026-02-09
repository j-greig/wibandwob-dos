from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Set

from starlette.websockets import WebSocket


class EventHub:
    """Simple broadcast hub for WebSocket clients."""

    def __init__(self) -> None:
        self._clients: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def add(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.add(ws)

    async def remove(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)

    async def emit(self, event: str, data: Dict[str, Any]) -> None:
        payload = json.dumps({"event": event, "data": data})
        async with self._lock:
            targets = list(self._clients)
        # send outside the lock
        coros = [c.send_text(payload) for c in targets]
        if coros:
            await asyncio.gather(*coros, return_exceptions=True)

