# PRD: Wordle — TUI Edition

## Overview
Guess a 5-letter word in 6 attempts. After each guess, letters are colored: green (correct position), yellow (wrong position), gray (not in word). The most viral word game of the decade, running natively in a terminal.

## Why Build It
- Most viral game of the 2020s — instant recognition
- Color feedback maps perfectly to TUI color attributes
- Turn-based = no timer complexity
- Daily word rotation possible
- Keyboard heatmap showing used/unused letters is visually striking
- Screenshot-ready: colored grid is the universal Wordle share format

## Gameplay Spec

### Board
- 6 rows x 5 columns grid (one row per guess)
- Each cell: letter + color state (empty/green/yellow/gray)
- Cell rendering: `[A]` with background color

### Controls
- A-Z: type letter into current guess
- Backspace: delete last letter
- Enter: submit guess (must be 5 letters, must be valid word)
- R: new game (after win/loss)
- Ctrl-H: toggle hard mode

### Word List
- Target words: curated list of ~2300 common 5-letter words
- Valid guesses: larger list of ~10000 valid 5-letter words
- Daily mode: word selected by day-of-year (deterministic)
- Random mode: random word each game

### Feedback Algorithm
1. First pass: mark exact matches as GREEN
2. Second pass: for remaining letters, mark as YELLOW if letter exists in remaining target letters (consume each target letter once)
3. All others: GRAY

### Rendering
```
  W O R D L E
  ___________

  [S] [T] [A] [R] [E]    <- gray/yellow/green backgrounds
  [C] [L] [O] [U] [D]
  [_] [_] [_] [_] [_]    <- current input
  [ ] [ ] [ ] [ ] [ ]    <- empty rows
  [ ] [ ] [ ] [ ] [ ]
  [ ] [ ] [ ] [ ] [ ]

  QWERTYUIOP              <- keyboard with color state
   ASDFGHJKL
    ZXCVBNM
```

### Colors
| State | BG Color | FG |
|-------|----------|----|
| Green (correct) | #538D4E | white |
| Yellow (present) | #B59F3B | white |
| Gray (absent) | #3A3A3C | white |
| Empty | #121213 | gray |
| Input cursor | #818384 | white |

### HUD
- Game number / streak
- Win message with guess count
- "Not in word list" error shake
- Statistics: games played, win %, guess distribution bar chart

### Hard Mode
- Green letters must stay in position
- Yellow letters must be reused in subsequent guesses

## Architecture
- `TWordleView` : TView subclass
- No timer needed (turn-based)
- Word lists as static arrays or embedded resource
- Board state: 6x5 array of {letter, color_state}
- Keyboard state: 26-letter array of best known color
- Command: `open_wordle`

## Word List Strategy
- Embed ~2300 target words + ~10000 valid words as static const arrays
- Or load from bundled text file at startup
- Keep it simple: static arrays compiled in

## Acceptance Criteria
- [ ] 6x5 grid renders with colored letter tiles
- [ ] Keyboard input fills current row
- [ ] Enter validates guess against word list
- [ ] Green/yellow/gray feedback is correct per Wordle algorithm
- [ ] On-screen keyboard shows letter states
- [ ] Win detection (all green) with celebration
- [ ] Loss after 6 guesses reveals answer
- [ ] R starts new game
- [ ] Hard mode enforces constraints
- [ ] Command registry + menu wired
