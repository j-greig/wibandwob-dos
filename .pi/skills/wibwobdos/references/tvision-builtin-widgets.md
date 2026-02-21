# Turbo Vision 2.0 Built-in Widgets Reference

> The modern tvision port (`vendor/tvision`) ships a full widget toolkit.
> **Check here before building custom views** — most common UI patterns already exist.

## Widget Inventory

### Views (base building blocks)

| Class | Header | What it does | Use for |
|---|---|---|---|
| `TView` | `views.h` | Base class for all visible elements | Custom views, overlays |
| `TFrame` | `views.h` | Window border/title bar with resize/close | Already used by TWindow |
| `TScrollBar` | `views.h` | Standalone scrollbar (horizontal or vertical) | Attach to any scrollable view |
| `TScroller` | `views.h` | View with built-in scroll + scrollbars + keyboard nav | **Map viewer, large content panes** |
| `TBackground` | `app.h` | Desktop background pattern, single char | **Subclass for wallpaper** — override `draw()` |

### List & Tree Views

| Class | Header | What it does | Use for |
|---|---|---|---|
| `TListViewer` | `views.h` | Scrollable list with focus/select, multi-column, keyboard nav (arrows, PgUp/PgDn, Home/End) | **Folder views, icon grids, mail list** — override `getText()` for content |
| `TListBox` | `dialogs.h` | `TListViewer` + `TCollection` data binding | Simpler version when items are just strings |
| `TSortedListBox` | `stddlg.h` | Sorted list box with incremental search | Sorted file/icon lists |
| `TOutlineViewer` | `outline.h` | Tree view with expand/collapse, graph lines | **Nested folder hierarchy, file tree** |

### Text Display

| Class | Header | What it does | Use for |
|---|---|---|---|
| `TStaticText` | `dialogs.h` | Simple non-editable text display | Labels, about text, status messages |
| `TParamText` | `dialogs.h` | `TStaticText` with printf-style formatting | Dynamic status text |
| `TTerminal` | `textview.h` | Scrollable text log (stream-based, append-only) | **Mail message body, log viewers, tape playback output** |
| `TTextDevice` | `textview.h` | Base for stream-to-view devices | Custom log outputs |

### Input Widgets

| Class | Header | What it does | Use for |
|---|---|---|---|
| `TInputLine` | `dialogs.h` | Single-line text input with history | **Mail compose subject/recipient, search** |
| `TButton` | `dialogs.h` | Push button with accelerator key | Dialog actions |
| `TCheckBoxes` | `dialogs.h` | Multi-select checkbox group | Settings dialogs |
| `TRadioButtons` | `dialogs.h` | Single-select radio group | Mode selection |
| `TCluster` | `dialogs.h` | Base for check/radio groups | Custom toggle groups |
| `TLabel` | `dialogs.h` | Clickable label that focuses another view | Form labels |

### Windows & Dialogs

| Class | Header | What it does | Use for |
|---|---|---|---|
| `TWindow` | `views.h` | Movable, resizable window with title and close | All app windows |
| `TDialog` | `dialogs.h` | Modal/modeless dialog with OK/Cancel | **Mail compose, settings, icon properties** |
| `TFileDialog` | `stddlg.h` | Complete file open/save dialog | Manifest loading, workspace files |
| `TChDirDialog` | `stddlg.h` | Change directory dialog | Navigation |

### File System

| Class | Header | What it does | Use for |
|---|---|---|---|
| `TFileList` | `stddlg.h` | Sorted file list with type/size info | File browsing |
| `TFileInputLine` | `stddlg.h` | Input line with file history | File path entry |
| `TDirListBox` | `stddlg.h` | Directory tree list | Folder navigation |
| `TFileInfoPane` | `stddlg.h` | File info display panel | File details |

### Application Level

| Class | Header | What it does | Use for |
|---|---|---|---|
| `TDeskTop` | `app.h` | Window manager with cascade/tile, holds `background` | Desktop shell — insert icon layer in front of background |
| `TProgram` | `app.h` | Event loop, menu bar, status line | Already our base |
| `TApplication` | `app.h` | `TProgram` + screen init | Already our base |
| `TMenuBar` / `TStatusLine` | `menus.h` / `app.h` | Menu and status bar | Already used |

### Collections (data containers)

| Class | Header | What it does | Use for |
|---|---|---|---|
| `TCollection` | `objects.h` | Dynamic array of `void*` items | Generic item lists |
| `TSortedCollection` | `objects.h` | Sorted collection with binary search | Sorted icon/file lists |
| `TStringCollection` | `tvobjs.h` | Collection of strings | Simple string lists for `TListBox` |

### Color

| Class | Header | What it does | Use for |
|---|---|---|---|
| `TColorSelector` | `colorsel.h` | Color picker dialog | Theme/icon color selection |
| `TColorDialog` | `colorsel.h` | Full color editing dialog | User customization |

## Key Patterns

### Using TListViewer for custom lists

Override `getText()` and `setRange()` — TV handles all keyboard/mouse/scroll:

```cpp
class MyListView : public TListViewer {
public:
    MyListView(const TRect& bounds, TScrollBar* sb)
        : TListViewer(bounds, 1, nullptr, sb)
    {
        setRange(items.size());
    }
    
    virtual void getText(char* dest, short item, short maxLen) override {
        strncpy(dest, items[item].c_str(), maxLen);
        dest[maxLen - 1] = '\0';
    }
    
    virtual void handleEvent(TEvent& ev) override {
        TListViewer::handleEvent(ev);
        if (ev.what == evKeyDown && ev.keyDown.keyCode == kbEnter) {
            // Launch focused item
            clearEvent(ev);
        }
    }
};
```

### Using TScroller for scrollable content

Built-in scroll + keyboard nav + scrollbar wiring:

```cpp
class MyScrollView : public TScroller {
public:
    MyScrollView(const TRect& bounds, TScrollBar* hsb, TScrollBar* vsb)
        : TScroller(bounds, hsb, vsb)
    {
        setLimit(contentWidth, contentHeight);
    }
    
    virtual void draw() override {
        // delta.x, delta.y = current scroll position
        // Draw visible portion of content offset by delta
    }
};
```

### Inserting behind windows on desktop

```cpp
// Icon layer goes in front of TBackground but behind all windows
desktopIcons->putInFrontOf((TView*)deskTop->background);
```

## Don't Reinvent

| If you need... | Use this, not custom code |
|---|---|
| Scrollable list with selection | `TListViewer` / `TListBox` |
| Scrollable large view | `TScroller` + scrollbars |
| Tree with expand/collapse | `TOutlineViewer` |
| Text log / message body | `TTerminal` |
| Form with inputs + buttons | `TDialog` + `TInputLine` + `TButton` |
| File picker | `TFileDialog` |
| Sorted items | `TSortedCollection` + `TSortedListBox` |

## Source Locations

- Headers: `vendor/tvision/include/tvision/`
- Source: `vendor/tvision/source/tvision/`
- Examples: `vendor/tvision/examples/` (if present)
- Borland docs (original): search "Turbo Vision Programming Guide" PDF — still the best reference
