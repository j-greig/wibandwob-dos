cmake_minimum_required(VERSION 3.10)
project(wibwob-dos CXX C)
enable_testing()

# Build Turbo Vision library from submodule
# Disable examples — we only need the library
set(TV_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
add_subdirectory(vendor/tvision)

# Build libvterm (C library used by tvterm-core for terminal emulation)
add_subdirectory(vendor/tvterm/deps/vterm EXCLUDE_FROM_ALL)

# Build tvterm-core library (terminal emulator widget for Turbo Vision)
# We build it ourselves rather than using tvterm's CMakeLists.txt to avoid
# a duplicate tvision target (tvterm bundles its own copy).
file(GLOB TVTERM_CORE_SRCS vendor/tvterm/source/tvterm-core/*.cc)
add_library(tvterm-core STATIC ${TVTERM_CORE_SRCS})
target_include_directories(tvterm-core PUBLIC
    ${CMAKE_SOURCE_DIR}/vendor/tvterm/include
)
target_link_libraries(tvterm-core PUBLIC tvision vterm)
if(NOT WIN32)
    find_library(UTIL_LIB util)
    if(UTIL_LIB)
        target_link_libraries(tvterm-core PUBLIC ${UTIL_LIB})
    endif()
    find_library(PTHREAD_LIB pthread)
    if(PTHREAD_LIB)
        target_link_libraries(tvterm-core PUBLIC ${PTHREAD_LIB})
    endif()
endif()

# Build wibwob-dos applications
add_subdirectory(app)
