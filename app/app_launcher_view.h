/*---------------------------------------------------------*/
/*   app_launcher_view.h — Applications folder browser     */
/*   macOS Finder-style app launcher for WibWob-DOS        */
/*   E011 — Desktop Shell                                  */
/*---------------------------------------------------------*/

#ifndef APP_LAUNCHER_VIEW_H
#define APP_LAUNCHER_VIEW_H

#define Uses_TWindow
#define Uses_TView
#define Uses_TScrollBar
#define Uses_TDrawBuffer
#define Uses_TKeys
#include <tvision/tv.h>

#include <string>
#include <vector>

// An app entry in the launcher
struct AppEntry {
    std::string id;          // command registry name (e.g. "open_snake")
    std::string name;        // display name (e.g. "Snake")
    std::string icon;        // 2-char icon glyph
    std::string category;    // "games", "tools", "creative", "demos"
    std::string description; // one-line description
    ushort command;          // TV command to fire (e.g. cmSnake)
};

// The icon grid view — shows apps as icon + name in a grid
class TAppGridView : public TView {
public:
    TAppGridView(const TRect& bounds, TScrollBar* aVScrollBar);
    virtual void draw() override;
    virtual void handleEvent(TEvent& event) override;
    virtual TPalette& getPalette() const override;

    void setFilter(const std::string& category); // "" = show all
    int focusedIndex() const { return focused; }
    const AppEntry* focusedApp() const;

    std::vector<AppEntry> allApps;

private:
    std::vector<int> filtered; // indices into allApps matching current filter
    int focused;
    int scrollOffset;
    TScrollBar* vScrollBar;
    std::string currentFilter;

    static const int CELL_W = 20;  // width of each icon cell
    static const int CELL_H = 4;   // height of each icon cell

    int cols() const;
    int rows() const;
    int visibleRows() const;
    void rebuildFilter();
    friend class TAppLauncherWindow;
    void adjustScrollBar();
    void ensureFocusVisible();
};

// Category tab bar across the top
class TCategoryBar : public TView {
public:
    TCategoryBar(const TRect& bounds);
    virtual void draw() override;
    virtual void handleEvent(TEvent& event) override;

    int selected;  // 0=All, 1=Games, 2=Tools, 3=Creative, 4=Demos
    static constexpr const char* categories[] = {
        "All", "Games", "Tools", "Creative", "Demos"
    };
    static const int NUM_CATEGORIES = 5;
};

// The window wrapping it all
class TAppLauncherWindow : public TWindow {
public:
    TAppLauncherWindow(const TRect& bounds);
    virtual void handleEvent(TEvent& event) override;

private:
    TAppGridView* grid;
    TCategoryBar* categoryBar;
    void populateApps();
};

TWindow* createAppLauncherWindow(const TRect& bounds);

#endif // APP_LAUNCHER_VIEW_H
