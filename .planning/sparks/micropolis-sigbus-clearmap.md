# Spark: Micropolis SIGBUS crash in clearMap during init

Status: spark
Origin: SPK-03 smoke parade, 2026-02-27
Severity: high (crashes entire TUI process)

## Bug

Spawning a micropolis_ascii window via API causes a SIGBUS
(EXC_BAD_ACCESS, KERN_PROTECTION_FAILURE) in Micropolis::clearMap().

## Crash stack (from macOS .ips report)

  Micropolis::clearMap()           generate.cpp:181
  Micropolis::simInit()            micropolis.cpp:740
  Micropolis::init()               micropolis.cpp:674
  MicropolisBridge::initialize_new_city()  micropolis_bridge.cpp:87
  TMicropolisAsciiView::TMicropolisAsciiView()  micropolis_ascii_view.cpp:107

## Signal

  EXC_BAD_ACCESS (SIGBUS)
  KERN_PROTECTION_FAILURE at 0x2000002400001c00
  Possible pointer authentication failure

## Reproducer

  curl -X POST http://127.0.0.1:8089/windows \
    -H "Content-Type: application/json" \
    -d '{"type": "micropolis_ascii"}'

Crashes TUI process immediately. 100% reproducible.

## Notes

- The pointer authentication failure hint suggests a corrupted
  function pointer or vtable, not just a null deref.
- clearMap() writes to the Micropolis map arrays. If the engine
  object is not properly allocated or the map buffer is undersized,
  this would SIGBUS.
- MicropolisBridge::initialize_new_city is called in the
  TMicropolisAsciiView constructor (line 107). If the bridge
  object is stack/member allocated and Micropolis expects heap
  allocation with specific alignment, that could cause this.
- This may be an ARM64/Apple Silicon issue with the Micropolis
  engine port. The emscripten compat shim may not handle memory
  layout correctly on native ARM.

## Workaround

micropolis_ascii is skipped in smoke_parade.py.

## Investigation path

1. Check MicropolisBridge memory layout and allocation
2. Check if Micropolis engine expects specific alignment
3. Run under AddressSanitizer to get exact bad write location
4. Compare with working Micropolis in other contexts (web, x86)
