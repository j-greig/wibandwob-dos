/*---------------------------------------------------------*/
/*                                                         */
/*   desktop_icon.h - Desktop icon data model, renderer,   */
/*   and icon layer for WibWobDOS desktop shell (E011)     */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef DESKTOP_ICON_H
#define DESKTOP_ICON_H

#define Uses_TView
#define Uses_TDeskTop
#define Uses_TDrawBuffer
#define Uses_TRect
#define Uses_TEvent
#define Uses_TKeys
#include <tvision/tv.h>

#include <string>
#include <vector>

// Command constant for desktop icon launch
const ushort cmDesktopLaunch = 0xE011;

/*---------------------------------------------------------*/
/* DesktopIcon - Data model for a single desktop icon      */
/*---------------------------------------------------------*/

struct DesktopIcon
{
    std::string id;          // unique identifier
    std::string label;       // display text below glyph art
    // Multi-line ASCII art glyph — each entry is one row of art.
    // Rendered centered inside the icon border.
    // Example: { "┌───┐", "│>_ │", "└───┘" }
    std::vector<std::string> art;
    std::string command;     // command registry name to execute on launch
    std::string category;    // folder/group: "apps", "games", "scripts", ""=desktop
    TPoint position;         // desktop coordinates (column, row)
    TColorAttr color;        // foreground/background colour
    TColorAttr artColor;     // colour for the ASCII art glyph
    bool selected;           // currently highlighted

    DesktopIcon() :
        position({0, 0}),
        color(TColorAttr(TColorRGB(200, 200, 200), TColorRGB(0, 0, 80))),
        artColor(TColorAttr(TColorRGB(255, 255, 255), TColorRGB(0, 0, 80))),
        selected(false)
    {
    }
};

/*---------------------------------------------------------*/
/* TDesktopIconView - Transparent overlay on desktop that   */
/* renders and handles interaction with desktop icons       */
/*---------------------------------------------------------*/

class TDesktopIconView : public TView
{
public:
    TDesktopIconView(const TRect &bounds);
    virtual ~TDesktopIconView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;

    // Icon management
    void addIcon(const DesktopIcon &icon);
    void removeIcon(const std::string &id);
    void clearIcons();
    DesktopIcon* findIcon(const std::string &id);
    const std::vector<DesktopIcon>& icons() const { return icons_; }

    // Navigation
    void selectNext();
    void selectPrev();
    void selectNone();
    int selectedIndex() const { return selectedIdx_; }
    DesktopIcon* selectedIcon();

    // Launch the currently selected icon's command
    void launchSelected();

    // Auto-arrange icons in a grid
    void arrangeIcons();

    // Persistence
    bool saveState(const std::string &path) const;
    bool loadState(const std::string &path);

private:
    std::vector<DesktopIcon> icons_;
    int selectedIdx_;
    std::string pendingLaunchCmd_;

    // Icon cell dimensions — Lisa-style bordered boxes, big enough
    // for multi-line ASCII art glyphs to breathe.
    //
    // ┌────────────────┐
    // │                │
    // │     ┌───┐      │
    // │     │>_ │      │
    // │     └───┘      │
    // │                │
    // │    Terminal    │
    // └────────────────┘
    //
    static const int ICON_WIDTH = 18;
    static const int ICON_HEIGHT = 8;
    static const int ICON_PADDING = 1; // gap between icons
    static const int GLYPH_AREA_TOP = 1;    // first row of glyph area
    static const int GLYPH_AREA_H = 4;      // rows for glyph art
    static const int LABEL_ROW = 6;          // row for label text

    // Grid layout
    int gridCols() const;
    int gridRows() const;
    TPoint gridToScreen(int col, int row) const;
    int iconAtPoint(TPoint p) const;

    void drawIcon(TDrawBuffer &buf, const DesktopIcon &icon,
                  int x, int y, bool selected) const;
};

/*---------------------------------------------------------*/
/* Factory / helpers                                        */
/*---------------------------------------------------------*/

// Create the icon view sized to fill the desktop.
TDesktopIconView* createDesktopIconView(const TRect &desktopBounds);

// Populate with default icons from the window type registry.
void populateDefaultIcons(TDesktopIconView *view);

#endif // DESKTOP_ICON_H
