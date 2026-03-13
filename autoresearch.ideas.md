# Autoresearch Ideas

## Completed Apps
- LLM Orch Studio: 3.6 → 8.0
- Antopolis: 5.4 → 9.0+
- File Manager: 4.4 → 10.0
- Terrain Lab: 4.8 → 8.0
- Plasma: 5.4 → 8.0

## Paused Apps
- Music Player: 4.2 → 7.4 (4 viz modes, idle animations)
- TR-808: 5.4 → 6.4 (ANSI colours, preset loading fixed)

## Pattern: ANSI Sidebar Enhancement
Proven recipe for any window with a 3fr:1fr split + createTextBlock sidebar:
1. Add ANSI colour constants (A.cyn, A.yel, A.gry, A.wht, A.r, etc.)
2. Use (infoBlock.node as any).setContent() to bypass wrapIndentedText
3. Section headers: label(icon, "TITLE") in cyan
4. Active item lists with ▶ marker in colour, others in gray
5. Value bars using ▮/▯ in cyan/gray
6. Key shortcuts in yellow with gray descriptions
7. Horizontal separators in gray
8. Status bar right with pipe-separated summary
9. Fill remaining vertical space with ABOUT/LEGEND section

This pattern takes ~15 mins to apply and reliably jumps score from 5→8.

## Next Targets (sidebar pattern candidates)
- Contour Studio: triptych mode, status bar but no sidebar — needs different approach
- Primer Gallery: list+preview, could add colour to list items and header tabs
- Code Editor (slap-editor): empty state needs work, but it's a different pattern

## Future Ideas (non-sidebar)
- Generative art windows: could add subtle frame/border info
- Backrooms Log Browser: readability improvements
- WibWobWorld chat: sidebar for room info, online presence
