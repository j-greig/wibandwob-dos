from __future__ import annotations

import uvicorn

from .main import app


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8089, log_level="info")

