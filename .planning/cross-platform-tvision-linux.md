# Cross-Platform Tvision: macOS → Linux Porting Notes

**Created:** 2026-02-19 (Epic 004, ARM64 Docker build)
**Status:** Proven — ARM64 ELF binary builds and runs in Ubuntu 22.04 container

## Context

wibandwob-dos was developed exclusively on macOS (Apple Silicon, clang).
First Linux build attempted in Docker on `linux/arm64` (Ubuntu 22.04, GCC 11.4).

## Issues Found & Fixes

### 1. Missing `<cstring>` — `std::strlen` not found

**File:** `generative_mycelium_view.cpp`
**Error:** `'strlen' is not a member of 'std'; did you mean 'mbrlen'?`
**Root cause:** macOS clang transitively includes `<cstring>` via other headers. GCC on Linux does not.
**Fix:** Add `#include <cstring>` explicitly.

### 2. Missing `<tuple>` — `std::tuple`, `std::tie` not found

**File:** `generative_cube_view.cpp`
**Error:** `invalid use of incomplete type 'class std::tuple<int, int, float>'` and `'tie' is not a member of 'std'`
**Root cause:** Same transitive include issue. macOS clang pulls in `<tuple>` via other standard headers.
**Fix:** Add `#include <tuple>` explicitly.

### 3. OpenSSL linking — `EVP_sha256` / `HMAC` undefined

**File:** `api_ipc.cpp` (uses `#ifdef __APPLE__` → CommonCrypto, else → OpenSSL)
**Error:** `undefined reference to 'EVP_sha256'` / `undefined reference to 'HMAC'`
**Root cause:** macOS uses `CommonCrypto` (system framework, no explicit link needed). Linux uses `<openssl/hmac.h>` which requires linking `-lcrypto`. The CMakeLists.txt only linked `tvision`.
**Fix in `app/CMakeLists.txt`:**
```cmake
if(NOT APPLE)
    find_package(OpenSSL REQUIRED)
    target_link_libraries(test_pattern PRIVATE OpenSSL::Crypto)
endif()
```
**Dockerfile dep:** `libssl-dev`

### 4. Mach-O vs ELF binary detection

**Issue:** Host macOS `build/` dir contains Mach-O binaries → `Exec format error` on Linux.
**Fix:** Build into `build-linux/` on Linux, use `file` command to detect format.

## Preventive Rules for New Code

### Rule 1: Always include what you use (IWYU)

GCC is strict about transitive includes. Never rely on headers pulled in by other headers.

**Common offenders on macOS → Linux:**
| Symbol | Required header |
|---|---|
| `std::strlen`, `std::memcpy` | `<cstring>` |
| `std::tuple`, `std::tie`, `std::get` | `<tuple>` |
| `std::move`, `std::forward` | `<utility>` |
| `std::unique_ptr`, `std::shared_ptr` | `<memory>` |
| `std::function` | `<functional>` |
| `std::sort`, `std::min`, `std::max` | `<algorithm>` |
| `std::setw`, `std::setprecision` | `<iomanip>` |
| `std::filesystem::*` | `<filesystem>` |
| `std::optional` | `<optional>` |
| `std::variant` | `<variant>` |

### Rule 2: Platform-conditional linking in CMake

Any time you use `#ifdef __APPLE__` / `#else` for different platform libraries, the CMakeLists.txt **must** have corresponding conditional `target_link_libraries`. Pattern:

```cmake
if(APPLE)
    # CommonCrypto, Security.framework, etc. — usually no explicit link needed
    # target_link_libraries(myapp PRIVATE "-framework Security")
else()
    find_package(OpenSSL REQUIRED)
    target_link_libraries(myapp PRIVATE OpenSSL::Crypto)
endif()
```

### Rule 3: Tvision-specific Linux deps

Tvision on Linux needs these `-dev` packages:
- `libncursesw5-dev` — wide-character ncurses (tvision's terminal backend)
- `libgpm-dev` — mouse support in Linux console (optional but tvision warns without it)
- `cmake`, `build-essential` — standard build toolchain

### Rule 4: Headless / PTY considerations

Tvision TUI apps expect a terminal. In Docker:
- Set `tty: true` in docker-compose
- Set `TERM=dumb` if no real terminal attached
- The app renders to its internal screen buffer regardless — IPC/API still works
- No `DISPLAY` or X11 needed (this is a terminal TUI, not a GUI)

### Rule 5: ARM64 specifics

- `stb_image.h` handles ARM64 NEON vs x86 SSE automatically (well-tested header)
- No ARM64-specific issues found with tvision itself
- Build is ~2-3 minutes on ARM64 Docker (Apple Silicon host), mostly tvision library

## Build Requirements Summary

### Dockerfile packages
```
cmake build-essential libncursesw5-dev libgpm-dev libssl-dev
```

### CMake configure + build
```bash
cmake . -B build-linux -DCMAKE_BUILD_TYPE=Release
cmake --build build-linux -j$(nproc)
```

### Runtime test
```bash
WIBWOB_INSTANCE=1 TERM=dumb ./build-linux/app/test_pattern &
sleep 3
ls -la /tmp/wibwob_1.sock  # should exist
```
