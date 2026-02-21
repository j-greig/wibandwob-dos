# PRD: Snake — TUI Edition

## Overview
Classic snake game. Control a growing snake that eats food and avoids hitting walls or itself. Speed increases as snake grows.

## Why Build It
- Universal nostalgia (Nokia 3310 energy)
- Simplest game loop imaginable
- TUI-native aesthetic: snake body = block chars, food = special char
- Satisfying growth mechanic
- Easy to understand from a single screenshot

## Gameplay Spec

### Board
- Dynamic size based on window (fill available space)
- Border walls
- Snake starts at center, length 3, moving right

### Controls
- Arrow keys or WASD: change direction
- P: pause
- R: restart
- 1/2/3: speed presets (slow/medium/fast)

### Game Loop (timer-driven)
1. Move snake head one cell in current direction
2. If head hits food: grow by 1, spawn new food, score += 10
3. If head hits wall or self: game over
4. Tail follows (remove last segment unless growing)

### Rendering
- Snake head: `@` or `O` (bright green)
- Snake body: `#` (green, fade to dark green for tail)
- Food: `*` (bright red/yellow, alternating)
- Walls: `+`, `-`, `|` (border)
- Empty: `.` (dark)

### HUD (right side or top)
- Score
- Length
- Speed level
- High score (session)

### Difficulty Progression
- Every 5 food eaten: speed increases (timer period decreases)
- Starting speed: 150ms, minimum: 50ms

## Architecture
- `TSnakeView` : TView subclass
- Timer-driven game loop
- `std::deque<Point>` for snake body
- Direction enum, food position
- Command: `open_snake`

## Acceptance Criteria
- [ ] Snake moves continuously via timer
- [ ] Arrow keys change direction (no 180-degree reversal)
- [ ] Food spawns randomly, snake grows on eat
- [ ] Wall and self-collision = game over
- [ ] Score and length displayed
- [ ] Speed increases with length
- [ ] R resets game
