/*---------------------------------------------------------*/
/*                                                         */
/*   desktop_theme.cpp - Desktop shell theme presets       */
/*                                                         */
/*---------------------------------------------------------*/

#define Uses_TView
#include <tvision/tv.h>

#include "desktop_theme.h"

static DesktopTheme currentTheme;
static bool themeInitialised = false;

static void ensureInit()
{
    if (!themeInitialised)
        setDesktopThemeMonochrome();
}

const DesktopTheme& desktopTheme()
{
    ensureInit();
    return currentTheme;
}

/*---------------------------------------------------------*/
/* Monochrome (default) — classic TV grey dither            */
/* Grey ▒ checkerboard, black icons, blue highlight         */
/*---------------------------------------------------------*/

void setDesktopThemeMonochrome()
{
    currentTheme.bgPattern = '\xB1'; // ▒ medium shade checkerboard

    currentTheme.bgAttr    = TColorAttr(TColorRGB(100, 100, 100),
                                        TColorRGB(0, 0, 0));

    currentTheme.iconBorder = TColorAttr(TColorRGB(170, 170, 170),
                                         TColorRGB(0, 0, 0));
    currentTheme.iconFill   = TColorAttr(TColorRGB(170, 170, 170),
                                         TColorRGB(0, 0, 0));
    currentTheme.iconArt    = TColorAttr(TColorRGB(210, 210, 210),
                                         TColorRGB(0, 0, 0));

    currentTheme.selBorder  = TColorAttr(TColorRGB(255, 255, 255),
                                         TColorRGB(0, 0, 128));
    currentTheme.selFill    = TColorAttr(TColorRGB(255, 255, 255),
                                         TColorRGB(0, 0, 128));
    currentTheme.selArt     = TColorAttr(TColorRGB(255, 255, 255),
                                         TColorRGB(0, 0, 128));
    themeInitialised = true;
}

/*---------------------------------------------------------*/
/* Dark Pastel — dark bg, soft colour accent                */
/*---------------------------------------------------------*/

void setDesktopThemeDarkPastel()
{
    currentTheme.bgPattern = '\xB0'; // ░ light shade

    currentTheme.bgAttr    = TColorAttr(TColorRGB(40, 40, 50),
                                        TColorRGB(0, 0, 0));

    currentTheme.iconBorder = TColorAttr(TColorRGB(120, 120, 130),
                                         TColorRGB(20, 20, 30));
    currentTheme.iconFill   = TColorAttr(TColorRGB(180, 180, 190),
                                         TColorRGB(20, 20, 30));
    currentTheme.iconArt    = TColorAttr(TColorRGB(210, 210, 220),
                                         TColorRGB(20, 20, 30));

    currentTheme.selBorder  = TColorAttr(TColorRGB(87, 199, 255),
                                         TColorRGB(30, 30, 50));
    currentTheme.selFill    = TColorAttr(TColorRGB(255, 255, 255),
                                         TColorRGB(30, 30, 70));
    currentTheme.selArt     = TColorAttr(TColorRGB(87, 199, 255),
                                         TColorRGB(30, 30, 70));
    themeInitialised = true;
}

/*---------------------------------------------------------*/
/* Amber CRT — warm monochrome terminal look                */
/*---------------------------------------------------------*/

void setDesktopThemeAmber()
{
    currentTheme.bgPattern = '\xB1'; // ▒ medium shade

    currentTheme.bgAttr    = TColorAttr(TColorRGB(60, 40, 0),
                                        TColorRGB(0, 0, 0));

    currentTheme.iconBorder = TColorAttr(TColorRGB(200, 150, 50),
                                         TColorRGB(10, 5, 0));
    currentTheme.iconFill   = TColorAttr(TColorRGB(200, 150, 50),
                                         TColorRGB(10, 5, 0));
    currentTheme.iconArt    = TColorAttr(TColorRGB(255, 190, 80),
                                         TColorRGB(10, 5, 0));

    currentTheme.selBorder  = TColorAttr(TColorRGB(255, 220, 100),
                                         TColorRGB(80, 50, 0));
    currentTheme.selFill    = TColorAttr(TColorRGB(255, 240, 150),
                                         TColorRGB(80, 50, 0));
    currentTheme.selArt     = TColorAttr(TColorRGB(255, 255, 200),
                                         TColorRGB(80, 50, 0));
    themeInitialised = true;
}
