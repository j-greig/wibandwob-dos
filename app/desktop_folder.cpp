/*---------------------------------------------------------*/
/*                                                         */
/*   desktop_folder.cpp - Folder view using TListViewer    */
/*   E011 Phase 1: F02 S06-S07                             */
/*                                                         */
/*---------------------------------------------------------*/

#define Uses_TView
#define Uses_TWindow
#define Uses_TListViewer
#define Uses_TScrollBar
#define Uses_TRect
#define Uses_TEvent
#define Uses_TKeys
#include <tvision/tv.h>

#include "desktop_folder.h"

#include <cstring>
#include <algorithm>

/*---------------------------------------------------------*/
/* TFolderListView                                         */
/*---------------------------------------------------------*/

TFolderListView::TFolderListView(const TRect &bounds,
                                 TScrollBar *aScrollBar,
                                 const std::string &category,
                                 const std::vector<DesktopIcon> &allIcons) :
    TListViewer(bounds, 1, nullptr, aScrollBar)
{
    // Filter icons matching this category
    for (const auto &ic : allIcons)
        if (ic.category == category)
            items_.push_back(ic);

    setRange((short)items_.size());
    if (!items_.empty())
        focusItem(0);
}

void TFolderListView::getText(char *dest, short item, short maxLen)
{
    if (item >= 0 && item < (short)items_.size())
    {
        // Show art glyph (first line) + label, like:  [>_]  Terminal
        std::string line;
        if (!items_[item].art.empty())
            line = items_[item].art[0];
        // Pad/truncate art to 12 chars for alignment
        while ((int)line.size() < 12)
            line += ' ';
        if ((int)line.size() > 12)
            line = line.substr(0, 12);
        line += items_[item].label;

        strncpy(dest, line.c_str(), maxLen);
        dest[maxLen - 1] = '\0';
    }
    else
    {
        dest[0] = '\0';
    }
}

void TFolderListView::handleEvent(TEvent &ev)
{
    TListViewer::handleEvent(ev);

    if (ev.what == evKeyDown && ev.keyDown.keyCode == kbEnter)
    {
        launchFocused();
        clearEvent(ev);
    }
    else if (ev.what == evMouseDown && (ev.mouse.eventFlags & meDoubleClick))
    {
        // TListViewer already focused the item on first click;
        // double-click launches it
        launchFocused();
        clearEvent(ev);
    }
}

void TFolderListView::launchFocused()
{
    if (focused < 0 || focused >= (short)items_.size())
        return;
    const std::string &cmd = items_[focused].command;
    if (cmd.empty()) return;

    TEvent ev;
    ev.what = evCommand;
    ev.message.command = cmDesktopLaunch;
    ev.message.infoPtr = (void *)items_[focused].command.c_str();
    putEvent(ev);
}

/*---------------------------------------------------------*/
/* TFolderWindow                                           */
/*---------------------------------------------------------*/

TFolderWindow::TFolderWindow(const TRect &bounds,
                             const std::string &title,
                             const std::string &category,
                             const std::vector<DesktopIcon> &allIcons) :
    TWindowInit(&TFolderWindow::initFrame),
    TWindow(bounds, title.c_str(), wnNoNumber)
{
    TRect r = getExtent();
    r.grow(-1, -1);

    // Vertical scrollbar on the right
    TRect sbRect(r.b.x - 1, r.a.y, r.b.x, r.b.y);
    TScrollBar *sb = new TScrollBar(sbRect);
    insert(sb);

    // List view fills the rest
    TRect lvRect(r.a.x, r.a.y, r.b.x - 1, r.b.y);
    insert(new TFolderListView(lvRect, sb, category, allIcons));
}

/*---------------------------------------------------------*/
/* Built-in folder definitions                              */
/*---------------------------------------------------------*/

const std::vector<FolderDef>& builtinFolders()
{
    static const std::vector<FolderDef> folders = {
        { "apps",  "Applications" },
        { "games", "Games" },
        { "art",   "Generative Art" },
    };
    return folders;
}

TFolderWindow* createFolderWindow(const TRect &bounds,
                                  const std::string &category,
                                  const std::vector<DesktopIcon> &allIcons)
{
    std::string title = category;
    for (const auto &f : builtinFolders())
        if (category == f.category)
        { title = f.title; break; }

    return new TFolderWindow(bounds, title, category, allIcons);
}
