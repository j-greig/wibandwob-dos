/*---------------------------------------------------------*/
/*                                                         */
/*   desktop_theme.h - Centralised desktop shell theme     */
/*   Single source of truth for all desktop colours,       */
/*   patterns, and icon styling. Change once, applies       */
/*   everywhere.                                           */
/*                                                         */
/*   E011 — easy to swap for future theme system.          */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef DESKTOP_THEME_H
#define DESKTOP_THEME_H

#define Uses_TView
#include <tvision/tv.h>

struct DesktopTheme
{
    // ── Desktop background ────────────────────────────────
    char bgPattern;          // fill character (░ ▒ ▓ etc)
    TColorAttr bgAttr;       // fg/bg colour for the pattern

    // ── Icons at rest (monochrome) ────────────────────────
    TColorAttr iconBorder;   // box-drawing border
    TColorAttr iconFill;     // interior background + label text
    TColorAttr iconArt;      // ASCII art glyph colour

    // ── Icons selected (colour pops) ──────────────────────
    TColorAttr selBorder;
    TColorAttr selFill;
    TColorAttr selArt;
};

// The current desktop theme — change this one struct to restyle everything.
const DesktopTheme& desktopTheme();

// Presets (call before first use of desktopTheme() to switch)
void setDesktopThemeMonochrome();   // default: grey dither, black icons
void setDesktopThemeDarkPastel();   // dark bg, pastel accent on select
void setDesktopThemeAmber();        // amber CRT look

#endif // DESKTOP_THEME_H
