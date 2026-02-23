/*---------------------------------------------------------*/
/*   drum_machine_view.h — TR-808 Drum Machine TUI        */
/*   16-step sequencer grid with live audio output         */
/*---------------------------------------------------------*/

#ifndef DRUM_MACHINE_VIEW_H
#define DRUM_MACHINE_VIEW_H

#define Uses_TWindow
#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TKeys
#define Uses_TEvent
#define Uses_TRect
#include <tvision/tv.h>

#include "drum808/drum_engine.h"
#include "drum808/audio_output.h"

// ── Step grid view ──────────────────────────────────────
class TDrumGridView : public TView {
public:
    TDrumGridView(const TRect& bounds, drum808::DrumEngine& engine);
    virtual void draw() override;
    virtual void handleEvent(TEvent& event) override;

private:
    drum808::DrumEngine& engine;
    int cursorRow;
    int cursorCol;
};

// ── Drum machine window ─────────────────────────────────
class TDrumMachineWindow : public TWindow {
public:
    TDrumMachineWindow(const TRect& bounds);
    virtual ~TDrumMachineWindow();
    virtual void handleEvent(TEvent& event) override;

private:
    drum808::DrumEngine engine;
    drum808::AudioOutput audio;
    TDrumGridView* grid;
    int lastPlayPos;
};

TWindow* createDrumMachineWindow(const TRect& bounds);

#endif
