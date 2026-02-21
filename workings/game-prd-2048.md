# PRD: 2048 — TUI Edition

## Overview
Sliding number tile puzzle. Merge matching tiles to reach 2048+. Played on a 4x4 grid with arrow keys. Each move slides all tiles in one direction; matching adjacent tiles merge and double. A new tile (2 or 4) spawns after each move.

## Why Build It
- Perfectly grid-based = natural TUI fit
- "One more try" addiction loop is legendary
- Beautiful with progressive tile colors (2=grey, 4=beige, 8=orange... 2048=gold)
- Each tile is 6 chars wide x 3 rows tall = gorgeous in terminal
- Simple rules, deep emergent strategy
- Screenshot-friendly: colorful grid is instantly recognizable

## Gameplay Spec

### Board
- 4x4 grid of cells
- Each cell: empty or power-of-2 tile (2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048+)
- Start: 2 random tiles (each is 2 or 4, weighted 90%/10%)

### Controls
- Arrow keys: slide all tiles in direction
- R: restart
- U: undo last move (single undo)
- P: pause (hide board for competitive play)

### Move Logic
1. Slide all tiles in the chosen direction (compact toward edge)
2. Merge adjacent same-value tiles (each pair merges once per move)
3. Score += merged tile value
4. Spawn one new tile (2 at 90%, 4 at 10%) in random empty cell
5. If no valid moves remain -> game over

### Tile Rendering (per cell: 6w x 3h characters)
```
+------+------+------+------+
|      |      |      |      |
|   2  |   4  |   8  |  16  |
|      |      |      |      |
+------+------+------+------+
```

### Tile Colors (TColorRGB background)
| Value | BG Color | FG |
|-------|----------|----|
| 2     | #EEE4DA  | dark |
| 4     | #EDE0C8  | dark |
| 8     | #F2B179  | white |
| 16    | #F59563  | white |
| 32    | #F67C5F  | white |
| 64    | #F65E3B  | white |
| 128   | #EDCF72  | white |
| 256   | #EDCC61  | white |
| 512   | #EDC850  | white |
| 1024  | #EDC53F  | white |
| 2048  | #EDC22E  | white |
| 4096+ | #3C3A32  | white |

### HUD
- Score + best score
- Current tile count
- "You Win!" overlay at 2048 (continue playing option)
- Game over overlay when no moves

### Scoring
- Score += value of each merged tile
- Track best score in session

## Architecture
- `TGameView2048` : TView subclass
- 4x4 int array for board state
- Timer: not needed (turn-based), but brief slide animation possible
- Window: `createGame2048Window()` factory
- Command: `open_2048`

## Acceptance Criteria
- [ ] 4x4 grid renders with colored tiles
- [ ] Arrow keys slide + merge correctly
- [ ] New tile spawns after each valid move
- [ ] Score tracks correctly
- [ ] Game over detection when no moves
- [ ] Win detection at 2048
- [ ] R resets, U undoes
- [ ] Command registry + menu wired
