/*---------------------------------------------------------*/
/*                                                         */
/*   desktop_folder.h - Folder view window for desktop     */
/*   shell. Uses TListViewer for scrollable icon grid.     */
/*   E011 Phase 1: F02 S06-S07                             */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef DESKTOP_FOLDER_H
#define DESKTOP_FOLDER_H

#define Uses_TView
#define Uses_TWindow
#define Uses_TListViewer
#define Uses_TScrollBar
#define Uses_TRect
#define Uses_TEvent
#define Uses_TKeys
#include <tvision/tv.h>

#include "desktop_icon.h"
#include <string>
#include <vector>

/*---------------------------------------------------------*/
/* TFolderListView - TListViewer showing icons from a      */
/* category. TV handles scroll, keyboard, selection.        */
/*---------------------------------------------------------*/

class TFolderListView : public TListViewer
{
public:
    TFolderListView(const TRect &bounds,
                    TScrollBar *aScrollBar,
                    const std::string &category,
                    const std::vector<DesktopIcon> &allIcons);

    virtual void getText(char *dest, short item, short maxLen) override;
    virtual void handleEvent(TEvent &ev) override;

private:
    std::vector<DesktopIcon> items_;
    void launchFocused();
};

/*---------------------------------------------------------*/
/* TFolderWindow - Window wrapper for the folder list      */
/*---------------------------------------------------------*/

class TFolderWindow : public TWindow
{
public:
    TFolderWindow(const TRect &bounds,
                  const std::string &title,
                  const std::string &category,
                  const std::vector<DesktopIcon> &allIcons);
};

/*---------------------------------------------------------*/
/* Built-in folder definitions                              */
/*---------------------------------------------------------*/

struct FolderDef
{
    const char *category;
    const char *title;
};

const std::vector<FolderDef>& builtinFolders();

TFolderWindow* createFolderWindow(const TRect &bounds,
                                  const std::string &category,
                                  const std::vector<DesktopIcon> &allIcons);

#endif // DESKTOP_FOLDER_H
