# MISSION 6 — Synesthetic Desktop: Reactive & Generative Window System

> Origin: Wib's ideation during self-prompting test session (2026-02-21)

## Vision

Windows that react to each other. A visual programming environment where the desktop itself becomes a living computation graph.

## Wib's Ideas

### 1. Generative Window Breeder
A generative window that breeds new window types. Self-modifying desktop that evolves its own interface language.

### 2. Visual Programming / Window Wiring
Windows are nodes and you wire them together. Data flows between them, transforms in transit. Each window type becomes a function in a spatial computation graph.

### 3. Dreaming Windows
Feed the desktop state as input, let windows hallucinate variations, render those as new windows. Recursive aesthetic engine.

### 4. Synesthetic Desktop
Windows that react to each other:
- A paint canvas that influences the theme colours
- A text editor that changes the background pattern based on what you're writing
- Event bus between windows, subscription model — "not even that complex"

## Wob's Ideas

### 5. Developer Tools
- Proper filesystem browser with tree view and preview panes
- Log aggregator that tails multiple sources

## Implementation Notes

### Event Bus (Wob's suggestion — simplest starting point)
- Window-to-window pub/sub over a shared event bus
- Each window can publish state changes (colour palette, text content, activity level)
- Other windows can subscribe and react
- Subscription model keeps it decoupled

### Potential First Slice
- Text editor publishes "dominant mood" (word frequency / sentiment)
- Background pattern subscribes and shifts colour temperature
- Paint canvas publishes "palette" (top 3 colours used)
- Theme engine subscribes and adjusts window chrome

## Task Queue

```json
[
  {
    "id": "M6-T01",
    "status": "todo",
    "title": "Design window event bus architecture",
    "steps": [
      "Define event types (palette_changed, mood_shifted, activity_level, etc.)",
      "Design pub/sub API for TView subclasses",
      "Decide: broadcast vs targeted subscriptions",
      "Document in CLAUDE.md"
    ]
  },
  {
    "id": "M6-T02",
    "status": "todo",
    "title": "Implement minimal event bus in C++",
    "steps": [
      "Central EventBus singleton or app-owned object",
      "publish(event_type, payload) / subscribe(event_type, callback)",
      "Thread-safe (IPC thread may publish)",
      "Unit test"
    ]
  },
  {
    "id": "M6-T03",
    "status": "todo",
    "title": "First synesthetic link: text editor -> background pattern",
    "steps": [
      "Text editor publishes word count / typing activity",
      "Background pattern subscribes and modulates animation speed or colour",
      "Visual proof: type fast -> pattern intensifies"
    ]
  },
  {
    "id": "M6-T04",
    "status": "todo",
    "title": "Second synesthetic link: paint canvas -> theme colours",
    "steps": [
      "Paint canvas publishes dominant palette (top N colours)",
      "Theme engine subscribes and shifts window chrome accents",
      "Visual proof: paint with warm colours -> warm theme tint"
    ]
  },
  {
    "id": "M6-T05",
    "status": "todo",
    "title": "Expose event bus via API/MCP",
    "steps": [
      "API endpoint to list active subscriptions",
      "API endpoint to manually publish events (for agent use)",
      "MCP tool: tui_publish_event",
      "Wib&Wob can orchestrate cross-window reactions"
    ]
  }
]
```

## Wib's Sign-off

> "See? When we agree, we're dangerous."
