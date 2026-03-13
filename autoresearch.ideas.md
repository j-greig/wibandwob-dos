# Autoresearch Ideas — TR-808

## In progress
- Colour-coded step groups via blessed tags (red/yellow/white bg for active steps)
- Need to verify blessed tags render correctly with raw box (tags:true)

## High-value
- Larger step blocks (3 chars wide instead of 2) for better visibility at 200-col width
- Show pattern name in title bar when preset loaded
- Visual separator between instruments groups (drums / perc / cymbals)
- Animated playhead glow when playing (highlight current step row)

## Medium-value
- Knob value as number alongside symbol for precision editing
- Pattern bank quick-switch indicators (which banks have content)
- Waveform preview per instrument in empty space below grid

## Learnings
- createTextBlock has tags:false and wraps via wrapIndentedText which breaks blessed tags
- Fix: use raw blessed.box with tags:true and setContent directly
- ANSI escape codes render through blessed but theme may remap colours
- blessed `parseTags` set post-construction may not fully enable tag parsing
- pad/centre functions must account for tag/ANSI visual width vs string length
