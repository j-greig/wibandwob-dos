# Cross-Platform C++ Build Guide

## Linux build deps

```bash
apt-get install -y cmake build-essential libncursesw5-dev libgpm-dev libssl-dev
```

| Package | Why |
|---|---|
| `libncursesw5-dev` | tvision terminal backend (wide char) |
| `libgpm-dev` | Mouse in Linux console (tvision warns without) |
| `libssl-dev` | OpenSSL for HMAC auth in `api_ipc.cpp` |

## Build commands

```bash
cmake . -B build-linux -DCMAKE_BUILD_TYPE=Release
cmake --build build-linux -j$(nproc)
file build-linux/app/test_pattern   # must say ELF, not Mach-O
```

Always use `build-linux/` — never share build dirs with macOS `build/`.

## Transitive include gotchas

macOS clang silently includes standard headers via other headers. GCC does NOT. If you use `std::whatever`, you need the explicit `#include`.

| Symbol | Required `#include` |
|---|---|
| `std::strlen`, `std::memcpy` | `<cstring>` |
| `std::tuple`, `std::tie` | `<tuple>` |
| `std::move`, `std::forward` | `<utility>` |
| `std::unique_ptr`, `std::shared_ptr` | `<memory>` |
| `std::function` | `<functional>` |
| `std::sort`, `std::min`, `std::max` | `<algorithm>` |
| `std::optional` | `<optional>` |
| `std::variant` | `<variant>` |
| `std::array` | `<array>` |

## Platform-conditional linking

Every `#ifdef __APPLE__` that touches a library needs matching CMake:

```cmake
if(NOT APPLE)
    find_package(OpenSSL REQUIRED)
    target_link_libraries(myapp PRIVATE OpenSSL::Crypto)
endif()
```

## Checklist for new .cpp files

- [ ] Every `std::` symbol has an explicit `#include`
- [ ] No `#ifdef __APPLE__` without matching CMake conditional
- [ ] Test with `cmake --build build-linux` in Docker before merging
- [ ] New system lib deps added to both CMakeLists.txt AND Dockerfile
