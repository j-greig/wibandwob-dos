#ifndef NOTITLE_FRAME_H
#define NOTITLE_FRAME_H

#define Uses_TFrame
#define Uses_TDrawBuffer
#include <tvision/tv.h>

// For windows without titles, just use regular TFrame.
// The title gap isn't noticeable since we pass "" as the title.
typedef TFrame TNoTitleFrame;

// TGhostFrame — a completely invisible frame for frameless gallery windows.
//
// draw() writes nothing, so the 1-char border area is transparent (shows
// the desktop pattern behind it). The content view should be positioned
// with grow(0, 0) — i.e. at the full window bounds — so that art fills
// edge-to-edge. Window focus/move/resize still work normally because the
// frame view still exists and occupies the expected area; it's just silent.
class TGhostFrame : public TFrame
{
public:
    TGhostFrame(const TRect& r) : TFrame(r) {}

    virtual void draw() override
    {
        // Draw nothing — content bleeds to the edge, no chrome visible.
    }
};

#endif