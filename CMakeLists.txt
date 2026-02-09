cmake_minimum_required(VERSION 3.10)
project(wibwob-dos CXX)

# Build Turbo Vision library from submodule
# Disable examples — we only need the library
set(TV_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
add_subdirectory(vendor/tvision)

# Build wibwob-dos applications
add_subdirectory(app)
