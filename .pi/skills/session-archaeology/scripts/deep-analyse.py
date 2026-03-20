#!/usr/bin/env python3
"""Deep-analyse top trouble sessions using an LLM subagent.

Takes the output of confusion-scan.py (--json) and sends the worst
sessions to claude -p for semantic analysis that regex can't catch:
  - Agent going in circles (trying same fix repeatedly)
  - Silent approach abandonment (giving up without saying so)
  - Contradicting itself across turns
  - Producing code that conflicts with stated intent
  - Missing the actual root cause despite finding symptoms
  - Re-deriving knowledge that should have been in a spec

Usage:
    # Pipe from confusion-scan
    python3 confusion-scan.py <slug> --json | python3 deep-analyse.py

    # Or from a saved JSON file
    python3 deep-analyse.py --input scan-results.json

    # Analyse top N sessions
    python3 deep-analyse.py --input scan-results.json --top 5

    # Custom project slug (for reading raw JSONL)
    python3 deep-analyse.py --input scan-results.json --project <slug> --top 3

Output: markdown report with per-session analysis and cross-session patterns.
"""

import argparse
import json
import os
import subprocess
import sys
import textwrap


ANALYSIS_PROMPT = textwrap.dedent("""\
    You are analysing a Claude Code session log to identify agent confusion
    patterns. This is NOT a conversation to continue — it is a transcript
    to review.

    Look for these specific failure modes:

    1. CIRCULAR ATTEMPTS: Agent tries the same fix 2+ times, or tries
       variations of the same wrong approach without stepping back.

    2. SILENT ABANDONMENT: Agent drops an approach without explaining why,
       moves to something else, leaves the original problem unsolved.

    3. SELF-CONTRADICTION: Agent says X, then later does or says not-X
       without acknowledging the change.

    4. SYMPTOM FIXATION: Agent fixes surface symptoms but misses the
       actual root cause. The real bug is in a different subsystem.

    5. KNOWLEDGE RE-DERIVATION: Agent spends many turns figuring out
       something that should have been documented (conventions, patterns,
       API contracts, known failure modes).

    6. WRONG MENTAL MODEL: Agent operates with incorrect assumptions
       about how a subsystem works, leading to wrong fixes.

    7. HUMAN CORRECTION IGNORED: Human corrects the agent, but the agent
       continues with the wrong approach anyway.

    For each failure mode found, cite the specific turns/messages involved.

    Also identify: which SUBSYSTEMS were involved, what KNOWLEDGE would
    have prevented the confusion (a spec, a convention, a known failure
    mode), and whether the confusion was eventually resolved or abandoned.

    Output format — plain text, no markdown formatting:

    SESSION SUMMARY
    [1-2 sentence description of what the session was trying to do]

    FAILURE MODES FOUND
    [numbered list with turn citations]

    SUBSYSTEMS INVOLVED
    [list with brief description of each subsystem's role in the confusion]

    MISSING KNOWLEDGE
    [what specs/conventions/docs would have prevented this confusion]

    RESOLUTION
    [was the problem solved, worked around, or abandoned?]

    SEVERITY: [low/medium/high/critical]
    [high = multiple failure modes, human corrections needed, core subsystem]

    --- SESSION TRANSCRIPT ---

    {transcript}
""")

SYNTHESIS_PROMPT = textwrap.dedent("""\
    You have analysed {n} Claude Code sessions for agent confusion patterns.
    Here are the individual analyses:

    {analyses}

    Now synthesise across ALL sessions. Identify:

    1. RECURRING PATTERNS: Which failure modes appear in multiple sessions?
       Which subsystems keep causing trouble?

    2. MISSING SPECS: What knowledge is repeatedly re-derived or missing?
       Rank by how many sessions would have benefited.

    3. SPEC CANDIDATES: For each piece of missing knowledge, describe what
       a machine-readable spec should contain (key files, invariants,
       failure modes, do/don't rules).

    4. SEVERITY RANKING: Which subsystems need specs FIRST based on
       confusion frequency, correction rate, and blast radius?

    5. TRIGGER TABLE CANDIDATES: Which file patterns should trigger which
       specialist review, based on observed confusion?

    Output format — plain text, no markdown formatting:

    CROSS-SESSION PATTERNS
    [findings]

    TOP 5 MISSING SPECS (ranked by impact)
    [for each: name, what it should contain, which sessions needed it]

    RECOMMENDED TRIGGER TABLE
    [file pattern -> specialist/spec, with rationale]

    OVERALL ASSESSMENT
    [1 paragraph summary of the project's knowledge health]
""")


def read_session_transcript(project_slug, session_id, max_chars=30000):
    """Read raw JSONL and produce a readable transcript."""
    log_dir = os.path.expanduser(f"~/.claude/projects/{project_slug}/")
    path = os.path.join(log_dir, f"{session_id}.jsonl")
    if not os.path.exists(path):
        return None

    lines = []
    total_chars = 0
    with open(path) as f:
        for line in f:
            try:
                obj = json.loads(line)
                msg = obj.get("message", {})
                if not isinstance(msg, dict):
                    continue
                content = msg.get("content", [])
                if not isinstance(content, list):
                    continue

                role = obj.get("type", "")
                if role not in ("user", "assistant"):
                    continue

                parts = []
                for p in content:
                    if not isinstance(p, dict):
                        continue
                    if p.get("type") == "text" and p.get("text"):
                        parts.append(p["text"])
                    elif p.get("type") == "tool_use":
                        name = p.get("name", "?")
                        inp = p.get("input", {})
                        if isinstance(inp, dict):
                            args = ", ".join(
                                f"{k}={str(v)[:60]}"
                                for k, v in list(inp.items())[:3]
                            )
                            parts.append(f"[TOOL: {name}({args})]")

                text = " ".join(parts).strip()
                if not text:
                    continue

                label = "HUMAN" if role == "user" else "AGENT"
                entry = f"{label}: {text}\n"

                if total_chars + len(entry) > max_chars:
                    lines.append(f"\n[...transcript truncated at {max_chars} chars...]\n")
                    break

                lines.append(entry)
                total_chars += len(entry)

            except Exception:
                continue

    return "\n".join(lines)


def call_claude(prompt, timeout=120):
    """Call claude -p with a prompt and return the response."""
    try:
        result = subprocess.run(
            ["claude", "-p", prompt],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode != 0:
            return f"[claude error: {result.stderr[:200]}]"
        return result.stdout.strip()
    except subprocess.TimeoutExpired:
        return "[claude timed out]"
    except FileNotFoundError:
        return "[claude CLI not found — install Claude Code]"


def main():
    parser = argparse.ArgumentParser(
        description="Deep-analyse trouble sessions using LLM subagent"
    )
    parser.add_argument(
        "--input",
        default=None,
        help="JSON file from confusion-scan.py --json (or stdin)"
    )
    parser.add_argument(
        "--project",
        default=None,
        help="Project slug for reading raw JSONL (overrides scan data)"
    )
    parser.add_argument(
        "--top",
        type=int,
        default=5,
        help="Analyse top N trouble sessions (default: 5)"
    )
    parser.add_argument(
        "--max-transcript",
        type=int,
        default=30000,
        help="Max chars per session transcript (default: 30000)"
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Write report to file (default: stdout)"
    )
    parser.add_argument(
        "--skip-synthesis",
        action="store_true",
        help="Skip the cross-session synthesis step"
    )
    args = parser.parse_args()

    # Load scan data
    if args.input:
        with open(args.input) as f:
            scan_data = json.load(f)
    elif not sys.stdin.isatty():
        scan_data = json.load(sys.stdin)
    else:
        print("Error: provide --input FILE or pipe from confusion-scan.py --json", file=sys.stderr)
        sys.exit(1)

    # Find project slug
    project_slug = args.project
    if not project_slug:
        # Try to infer from scan data session paths
        print("Warning: --project not specified, will skip raw transcript reading", file=sys.stderr)

    hotspots = scan_data.get("session_hotspots", [])[:args.top]
    if not hotspots:
        print("No trouble sessions found in scan data", file=sys.stderr)
        sys.exit(0)

    print(f"Analysing {len(hotspots)} sessions...", file=sys.stderr)

    analyses = []
    for i, session in enumerate(hotspots):
        sid = session["session_id"]
        print(f"  [{i+1}/{len(hotspots)}] {sid[:8]} (score={session['score']})...", file=sys.stderr)

        transcript = None
        if project_slug:
            transcript = read_session_transcript(
                project_slug, sid, max_chars=args.max_transcript
            )

        if not transcript:
            print(f"    Skipping (no transcript found)", file=sys.stderr)
            continue

        prompt = ANALYSIS_PROMPT.format(transcript=transcript)
        analysis = call_claude(prompt, timeout=180)
        analyses.append({
            "session_id": sid[:8],
            "date": session.get("date", "unknown"),
            "branch": session.get("branch", "unknown"),
            "score": session["score"],
            "analysis": analysis,
        })
        print(f"    Done ({len(analysis)} chars)", file=sys.stderr)

    # Build report
    report = []
    report.append("SESSION ARCHAEOLOGY — DEEP ANALYSIS REPORT")
    report.append("=" * 50)
    report.append(f"Sessions analysed: {len(analyses)}")
    report.append(f"Total sessions scanned: {scan_data.get('sessions_scanned', '?')}")
    report.append("")

    for a in analyses:
        report.append(f"\n{'='*50}")
        report.append(f"SESSION {a['session_id']} ({a['date']}, {a['branch']}, score={a['score']})")
        report.append(f"{'='*50}\n")
        report.append(a["analysis"])
        report.append("")

    # Synthesis pass
    if not args.skip_synthesis and len(analyses) > 1:
        print(f"  Running cross-session synthesis...", file=sys.stderr)
        all_analyses = "\n\n---\n\n".join(
            f"Session {a['session_id']} (score={a['score']}):\n{a['analysis']}"
            for a in analyses
        )
        synthesis_prompt = SYNTHESIS_PROMPT.format(
            n=len(analyses), analyses=all_analyses
        )
        synthesis = call_claude(synthesis_prompt, timeout=180)
        report.append(f"\n{'='*50}")
        report.append("CROSS-SESSION SYNTHESIS")
        report.append(f"{'='*50}\n")
        report.append(synthesis)

    full_report = "\n".join(report)

    if args.output:
        with open(args.output, "w") as f:
            f.write(full_report)
        print(f"Report written to {args.output}", file=sys.stderr)
    else:
        print(full_report)


if __name__ == "__main__":
    main()
