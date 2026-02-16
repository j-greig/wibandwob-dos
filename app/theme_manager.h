#pragma once

#include <string>

#define Uses_TColorAttr
#include <tvision/tv.h>

// Theme modes: light or dark (auto mode deferred to future PR)
enum class ThemeMode {
    Light,
    Dark
};

// Theme variants: monochrome (default) or dark_pastel
enum class ThemeVariant {
    Monochrome,
    DarkPastel
};

// Semantic color roles for UI elements
enum class ThemeRole {
    Background,          // Main background
    Foreground,          // Primary text
    ForegroundSecondary, // Secondary/muted text
    AccentPrimary,       // Primary accent (blue in dark pastel)
    AccentSecondary,     // Secondary accent (pink in dark pastel)
    AccentTertiary,      // Tertiary accent (green in dark pastel)
    Frame,               // Window frames/borders
    Selection,           // Selected items
    Warning              // Warning/error states
};

// ThemeManager - Pure functional color lookup based on mode/variant/role
class ThemeManager {
public:
    // Get color for a specific role given current mode and variant
    static TColorAttr getColor(ThemeRole role, ThemeMode mode, ThemeVariant variant);

    // Parse mode from string ("light" or "dark")
    static ThemeMode parseModeString(const std::string& str);

    // Parse variant from string ("monochrome" or "dark_pastel")
    static ThemeVariant parseVariantString(const std::string& str);

    // Convert mode to string
    static std::string modeToString(ThemeMode mode);

    // Convert variant to string
    static std::string variantToString(ThemeVariant variant);
};
