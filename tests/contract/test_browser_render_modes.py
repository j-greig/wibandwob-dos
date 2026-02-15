from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from tools.api_server.browser_pipeline import render_markdown


def test_heading_and_image_modes_affect_render() -> None:
    md = "# H1\n## H2\n### H3\nbody"
    plain = render_markdown(md, headings="plain", images="none")
    styled = render_markdown(md, headings="figlet_all", images="key-inline")
    assert plain != styled
    assert "[H1]" in styled
    assert "[images mode=key-inline]" in styled
