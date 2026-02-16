#include "theme_manager.h"

#include <algorithm>
#include <cctype>

// Dark pastel palette (v1 - single blue only)
// Background: #000000
// Primary text: #d0d0d0
// Secondary text: #cfcfcf
// Blue accent: #57c7ff (ONLY blue - excludes #66e0ff)
// Pink accent: #f07f8f
// Green accent: #b7ff3c

// Helper to create RGB color from hex
static TColorRGB hexToRGB(uint32_t hex) {
    return TColorRGB((hex >> 16) & 0xFF, (hex >> 8) & 0xFF, hex & 0xFF);
}

TColorAttr ThemeManager::getColor(ThemeRole role, ThemeMode mode, ThemeVariant variant) {
    // Monochrome variant uses default Turbo Vision palette indices
    if (variant == ThemeVariant::Monochrome) {
        switch (role) {
            case ThemeRole::Background:
                return TColorAttr(0x07); // Light gray on black
            case ThemeRole::Foreground:
                return TColorAttr(0x07); // Light gray
            case ThemeRole::ForegroundSecondary:
                return TColorAttr(0x08); // Dark gray
            case ThemeRole::AccentPrimary:
                return TColorAttr(0x0F); // Bright white
            case ThemeRole::AccentSecondary:
                return TColorAttr(0x0E); // Yellow
            case ThemeRole::AccentTertiary:
                return TColorAttr(0x0A); // Light green
            case ThemeRole::Frame:
                return TColorAttr(0x07); // Light gray
            case ThemeRole::Selection:
                return TColorAttr(0x70); // Inverse: black on light gray
            case ThemeRole::Warning:
                return TColorAttr(0x0C); // Light red
        }
    }

    // Dark pastel variant
    if (variant == ThemeVariant::DarkPastel) {
        TColorRGB black = hexToRGB(0x000000);
        TColorRGB lightText = hexToRGB(0xd0d0d0);
        TColorRGB secondaryText = hexToRGB(0xcfcfcf);
        TColorRGB blue = hexToRGB(0x57c7ff);    // Single blue only
        TColorRGB pink = hexToRGB(0xf07f8f);
        TColorRGB green = hexToRGB(0xb7ff3c);

        switch (role) {
            case ThemeRole::Background:
                return TColorAttr(lightText, black);
            case ThemeRole::Foreground:
                return TColorAttr(lightText, black);
            case ThemeRole::ForegroundSecondary:
                return TColorAttr(secondaryText, black);
            case ThemeRole::AccentPrimary:
                return TColorAttr(blue, black);
            case ThemeRole::AccentSecondary:
                return TColorAttr(pink, black);
            case ThemeRole::AccentTertiary:
                return TColorAttr(green, black);
            case ThemeRole::Frame:
                return TColorAttr(secondaryText, black);
            case ThemeRole::Selection:
                return TColorAttr(black, blue);  // Inverse: black on blue
            case ThemeRole::Warning:
                return TColorAttr(pink, black);
        }
    }

    // Fallback
    return TColorAttr(0x07);
}

ThemeMode ThemeManager::parseModeString(const std::string& str) {
    std::string lower = str;
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char c){ return std::tolower(c); });

    if (lower == "dark") return ThemeMode::Dark;
    return ThemeMode::Light;  // Default to light
}

ThemeVariant ThemeManager::parseVariantString(const std::string& str) {
    std::string lower = str;
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char c){ return std::tolower(c); });

    if (lower == "dark_pastel") return ThemeVariant::DarkPastel;
    return ThemeVariant::Monochrome;  // Default to monochrome
}

std::string ThemeManager::modeToString(ThemeMode mode) {
    switch (mode) {
        case ThemeMode::Light: return "light";
        case ThemeMode::Dark: return "dark";
    }
    return "light";
}

std::string ThemeManager::variantToString(ThemeVariant variant) {
    switch (variant) {
        case ThemeVariant::Monochrome: return "monochrome";
        case ThemeVariant::DarkPastel: return "dark_pastel";
    }
    return "monochrome";
}
