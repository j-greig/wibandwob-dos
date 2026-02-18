# Codex Architecture Review: WibWob-DOS Robustness & JS/TS Connectivity

**Raw log**: `codex-architecture-review-20260218-194638.log`
**Context log**: `codex-window-types-20260218-193804.log`
**Token cost**: ~86,400
**Model**: gpt-5.3-codex

## Background

This review was triggered by the E008 multiplayer sync work, specifically the window type
mismatch problem documented in the window-types log. The core fragility identified: window
type identification, IPC dispatch, and state sync all involve repetitive manual wiring that
breaks silently when new window types are added.

## Confirmed Bottlenecks

1. **Type inference is heavy**: `windowTypeName()` uses dynamic_cast chains + child view inspection
2. **State sync is poll-based**: Python bridge polls every 500ms, diffs, pushes — fragile and laggy
3. **IPC is ad-hoc key=value**: no schema, hard for JS/TS to consume cleanly
4. **`create_window` is a long if-else chain**: adding a new type requires changes in 3+ places
5. **Command registry exists for commands but not window types**: incomplete parity

## Priority-Ranked Recommendations

| # | Approach | Complexity (1-5) | Maintenance benefit | Breaking risk | Priority |
|---|----------|-----------------|---------------------|---------------|----------|
| D | Data-driven window type registry | 2 | Very High | Low | **P0** |
| B | Event push from C++ over existing socket | 3 | Very High | Low | **P1** |
| A | `IWindowTyped` interface mixin (NOT TWindow fork) | 2 | High | Low | **P2** |
| C | JSON IPC protocol upgrade (dual-stack) | 3 | High | Medium | **P3** |
| E | Native C++ WebSocket server | 5 | Medium | High | **P4 (skip)** |

---

## Code Sketches

### P0: Data-driven `WindowTypeRegistry` (D)

One place to register type slug, spawn function, match function, and props serializer.
Eliminates the dynamic_cast chain in `windowTypeName`, the if-else chain in `create_window`,
and the fragility of "add new type in 3 places".

```cpp
// app/window_types.h
struct WindowSnapshot {
    std::string id, type, title;
    int x, y, w, h;
    std::map<std::string, std::string> props;
};

struct CreateWindowArgs {
    TRect* bounds;
    std::map<std::string, std::string> kv;
};

struct WindowTypeSpec {
    const char* type;
    bool creatable;
    bool requires_path;
    TWindow* (*create)(TTestPatternApp&, const CreateWindowArgs&);
    bool (*matches)(TWindow*);
    void (*serialize_props)(TWindow*, WindowSnapshot&);
};

const WindowTypeSpec* find_window_type_by_name(const std::string&);
const WindowTypeSpec* find_window_type_for_window(TWindow*);
const std::vector<WindowTypeSpec>& window_type_specs();
```

Usage after migration:
```cpp
// windowTypeName becomes trivial:
static const char* windowTypeName(TWindow* w) {
    const WindowTypeSpec* spec = find_window_type_for_window(w);
    return spec ? spec->type : "unknown";
}

// create_window dispatch becomes trivial:
const WindowTypeSpec* spec = find_window_type_by_name(type);
if (!spec || !spec->creatable) resp = "err unknown type\n";
else {
    CreateWindowArgs args{bounds, kv};
    TWindow* w = spec->create(*app_, args);
    if (!w) resp = "err create failed\n";
}
```

Adding a new window type then requires adding ONE entry to the registry, nothing else.

### P1: Event Push over Existing Unix Socket (B)

Replace poll-then-diff with server-initiated push. `subscribe_events` keeps the fd open
and pushes newline-delimited JSON events. The Python bridge can drop the poll loop
and react to events instead.

```cpp
// app/api_ipc.h additions:
class ApiIpcServer {
public:
    void publish_event(const char* event_type, const std::string& payload_json);
private:
    std::vector<int> subscribers_;
    uint64_t next_seq_ = 1;
};
```

```cpp
// app/api_ipc.cpp:
if (cmd == "subscribe_events") {
    ::fcntl(fd, F_SETFL, ::fcntl(fd, F_GETFL, 0) | O_NONBLOCK);
    subscribers_.push_back(fd);
    return; // keep fd open — do NOT close
}

void ApiIpcServer::publish_event(const char* event_type, const std::string& payload) {
    std::string msg = "{\"type\":\"event\",\"seq\":" + std::to_string(next_seq_++) +
                      ",\"event\":\"" + std::string(event_type) +
                      "\",\"payload\":" + payload + "}\n";
    for (auto it = subscribers_.begin(); it != subscribers_.end();) {
        if (::write(*it, msg.c_str(), msg.size()) < 0) {
            ::close(*it);
            it = subscribers_.erase(it);
        } else { ++it; }
    }
}
```

Then call `ipcServer->publish_event("window_opened", ...)` from `registerWindow`, and
`"window_moved"` from `api_move_window`. The Python bridge subscribes once and reacts.

### P3: Dual-Stack JSON/Legacy IPC Parser (C)

Accept both formats — JSON for new JS/TS clients, key=value for backward compat:

```cpp
struct IpcRequest {
    std::string cmd;
    std::map<std::string, std::string> kv;
    int version = 1;
};

static bool parse_request(const std::string& line, IpcRequest& out) {
    if (!line.empty() && line[0] == '{') {
        // {"v":2,"cmd":"create_window","args":{"type":"verse","x":"10"}}
        return parse_json_envelope_minimal(line, out);
    }
    return parse_legacy_kv(line, out); // current cmd:... key=...
}
```

---

## Game Engine Patterns That Apply

- **Authoritative state + replicated deltas**: C++ is source of truth; external clients consume snapshots + deltas
- **Entity-component model**: treat each window as entity; components = transform, identity, content, capabilities
- **Event bus with monotonic sequence numbers**: enables replay, sync from any point
- **Dirty-bit replication**: only emit changed components, not full window lists every tick
- **Schema-versioned contracts**: explicit message versions + capability advertisement per window type

---

## What NOT To Do (E008 Scope)

**Text editor content sync** is explicitly out of scope for E008 and should be a separate epic.
This would require CRDTs or operational transforms, conflict resolution at the character level,
and a completely different sync model. State-level sync (window positions, what windows exist)
is all E008 addresses.

---

## Recommended Next Epic

Create **E009: IPC Architecture Hardening** with features:
- `WindowTypeRegistry` replacing dynamic_cast chains (P0)
- Event push via `subscribe_events` (P1)
- JSON dual-stack IPC parser (P3)
- Keep Python bridge as gateway; skip native C++ WebSocket (P4)
