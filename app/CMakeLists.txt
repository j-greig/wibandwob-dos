cmake_minimum_required(VERSION 3.10)
project(wibwob-dos-app CXX)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Common sources used by multiple apps
set(TV_COMMON_SOURCES
    test_pattern.cpp
    gradient.cpp
    glitch_engine.cpp
    frame_capture.cpp
    api_ipc.cpp
    command_registry.cpp
    window_type_registry.cpp
    theme_manager.cpp
    wibwob_view.cpp
    wibwob_engine.cpp
    llm/base/llm_config.cpp
    llm/base/llm_provider_factory.cpp
    llm/base/tool_executor.cpp
    llm/providers/claude_code_provider.cpp
    llm/providers/claude_code_sdk_provider.cpp
    llm/providers/anthropic_api_provider.cpp
    llm/tools/time_tools.cpp
    llm/tools/tui_tools.cpp
)

# test_pattern app (primary playground)
add_executable(test_pattern
    test_pattern_app.cpp
    ${TV_COMMON_SOURCES}
    ascii_grid_view.cpp
    ascii_image_view.cpp
    frame_file_player_view.cpp
    animated_blocks_view.cpp
    animated_gradient_view.cpp
    animated_score_view.cpp
    animated_ascii_view.cpp
    game_of_life_view.cpp
    generative_verse_view.cpp
    generative_orbit_view.cpp
    generative_mycelium_view.cpp
    generative_torus_view.cpp
    generative_monster_portal_view.cpp
    generative_cube_view.cpp
    generative_monster_verse_view.cpp
    generative_monster_cam_view.cpp
    # DISABLED: generative_ascii_cam_view.cpp
    text_editor_view.cpp
    browser_view.cpp
    transparent_text_view.cpp
    ansi_view.cpp
    wibwob_scroll_test.cpp
    scramble_view.cpp
    scramble_engine.cpp
)
target_link_libraries(test_pattern PRIVATE tvision)

# simple_tui (minimal reference app)
add_executable(simple_tui
    simple_tui.cpp
)
target_link_libraries(simple_tui PRIVATE tvision)

# frame_file_player (CLI player for frame-delimited text)
add_executable(frame_file_player
    frame_file_player_main.cpp
    frame_file_player_view.cpp
)
target_link_libraries(frame_file_player PRIVATE tvision)

# ansi_viewer (optional demo; only if main exists)
if (EXISTS ${CMAKE_CURRENT_LIST_DIR}/ansi_viewer_main.cpp)
    add_executable(ansi_viewer
        ansi_viewer_main.cpp
        ansi_view.cpp
    )
    target_link_libraries(ansi_viewer PRIVATE tvision)
endif()

# paint_tui (painting MVP)
add_executable(paint_tui
    paint/paint_app.cpp
    paint/paint_canvas.cpp
    paint/paint_palette.cpp
    paint/paint_status.cpp
    paint/paint_tools.cpp
)
target_link_libraries(paint_tui PRIVATE tvision)

# tv_ascii_view (POC: Turbo Vision image→ASCII viewer)
add_executable(tv_ascii_view
    tvision_ascii_view_poc.cpp
)
target_compile_definitions(tv_ascii_view PRIVATE TVISION_AVAILABLE)
target_include_directories(tv_ascii_view PRIVATE ${CMAKE_CURRENT_LIST_DIR})
target_link_libraries(tv_ascii_view PRIVATE tvision)

# ascii_dump (POC fallback: stdout-only)
add_executable(ascii_dump
    tvision_ascii_view_poc.cpp
)
target_include_directories(ascii_dump PRIVATE ${CMAKE_CURRENT_LIST_DIR})

# command_registry_test (native ctest coverage for registry capability payload)
add_executable(command_registry_test
    command_registry_test.cpp
    command_registry.cpp
)

add_test(NAME command_registry COMMAND command_registry_test)

# scramble_engine_test (KB queries, rate limiter, engine integration)
add_executable(scramble_engine_test
    scramble_engine_test.cpp
    scramble_engine.cpp
    command_registry.cpp
)

add_test(NAME scramble_engine COMMAND scramble_engine_test)
