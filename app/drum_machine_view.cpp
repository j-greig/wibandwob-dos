/*---------------------------------------------------------*/
/*   drum_machine_view.cpp — TR-808 Drum Machine TUI      */
/*---------------------------------------------------------*/

#define Uses_TWindow
#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TKeys
#define Uses_TEvent
#define Uses_TRect
#define Uses_TProgram
#include <tvision/tv.h>

#include "drum_machine_view.h"
#include <cstdio>
#include <cstring>

static const int STEPS = 16;
static const int LABEL_WIDTH = 10;  // "Kick      " etc.
static const int CELL_WIDTH = 3;    // " X " or " · "

// ═══════════════════════════════════════════════════
//  TDrumGridView
// ═══════════════════════════════════════════════════

TDrumGridView::TDrumGridView(const TRect& bounds, drum808::DrumEngine& eng)
    : TView(bounds), engine(eng), cursorRow(0), cursorCol(0)
{
    options |= ofSelectable | ofFirstClick;
    eventMask |= evKeyDown | evMouseDown;
    growMode = gfGrowHiX | gfGrowHiY;
}

void TDrumGridView::draw()
{
    int numInst = engine.getInstrumentCount();
    int playPos = engine.isPlaying() ? engine.getPosition() : -1;
    bool playing = engine.isPlaying();

    // Colours
    TColorAttr labelAttr  = {TColorRGB(0xFF, 0xFF, 0x00), TColorRGB(0x10, 0x10, 0x10)};
    TColorAttr emptyAttr  = {TColorRGB(0x50, 0x50, 0x50), TColorRGB(0x10, 0x10, 0x10)};
    TColorAttr noteAttr   = {TColorRGB(0xFF, 0x60, 0x00), TColorRGB(0x10, 0x10, 0x10)};
    TColorAttr cursorAttr = {TColorRGB(0x00, 0x00, 0x00), TColorRGB(0x00, 0xCC, 0xCC)};
    TColorAttr playAttr   = {TColorRGB(0xFF, 0xFF, 0xFF), TColorRGB(0x00, 0x60, 0x00)};
    TColorAttr headerAttr = {TColorRGB(0xAA, 0xAA, 0xAA), TColorRGB(0x10, 0x10, 0x10)};
    TColorAttr tempoAttr  = {TColorRGB(0x00, 0xFF, 0x00), TColorRGB(0x10, 0x10, 0x10)};
    TColorAttr bgAttr     = {TColorRGB(0x80, 0x80, 0x80), TColorRGB(0x10, 0x10, 0x10)};

    int y = 0;

    // Row 0: Header (step numbers)
    {
        TDrawBuffer b;
        b.moveChar(0, ' ', headerAttr, size.x);
        // Label area
        b.moveStr(1, "TR-808", tempoAttr);
        // Step numbers
        for (int s = 0; s < STEPS && (LABEL_WIDTH + s * CELL_WIDTH + CELL_WIDTH) <= size.x; s++) {
            int x = LABEL_WIDTH + s * CELL_WIDTH;
            char num[4];
            snprintf(num, sizeof(num), "%2d", s + 1);
            TColorAttr attr = (s == playPos) ? playAttr : headerAttr;
            b.moveStr(x, num, attr);
        }
        writeLine(0, y, size.x, 1, b);
        y++;
    }

    // Instrument rows
    for (int inst = 0; inst < numInst && y < size.y; inst++, y++) {
        TDrawBuffer b;
        b.moveChar(0, ' ', emptyAttr, size.x);

        // Instrument label
        const char* name = engine.getInstrumentName(inst);
        char label[LABEL_WIDTH + 1];
        snprintf(label, sizeof(label), "%-9s", name ? name : "???");
        b.moveStr(1, label, labelAttr);

        // Step cells
        for (int s = 0; s < STEPS; s++) {
            int x = LABEL_WIDTH + s * CELL_WIDTH;
            if (x + CELL_WIDTH > size.x) break;

            bool active = engine.getNoteState(inst, s);
            bool isCursor = (inst == cursorRow && s == cursorCol);
            bool isPlayhead = (s == playPos && playing);

            TColorAttr attr;
            if (isCursor)
                attr = cursorAttr;
            else if (isPlayhead && active)
                attr = playAttr;
            else if (active)
                attr = noteAttr;
            else if (isPlayhead)
                attr = {TColorRGB(0x80, 0x80, 0x80), TColorRGB(0x00, 0x30, 0x00)};
            else
                attr = (s % 4 == 0) ? bgAttr : emptyAttr;

            const char* cell = active ? " X " : " \xFA ";  // · middle dot
            b.moveStr(x, cell, attr);
        }
        writeLine(0, y, size.x, 1, b);
    }

    // Status row
    if (y < size.y) {
        TDrawBuffer b;
        b.moveChar(0, ' ', headerAttr, size.x);
        char status[80];
        snprintf(status, sizeof(status), " %s  BPM:%.0f  [Space]=Play/Stop [+/-]=Tempo [Enter]=Toggle",
                 playing ? ">> PLAYING" : "|| STOPPED",
                 engine.getTempo());
        b.moveStr(0, status, playing ? tempoAttr : headerAttr);
        writeLine(0, y, size.x, 1, b);
    }

    // Fill remaining rows
    for (int r = y + 1; r < size.y; r++) {
        TDrawBuffer b;
        b.moveChar(0, ' ', emptyAttr, size.x);
        writeLine(0, r, size.x, 1, b);
    }
}

void TDrumGridView::handleEvent(TEvent& event)
{
    TView::handleEvent(event);

    int numInst = engine.getInstrumentCount();

    if (event.what == evMouseDown) {
        select();
        TPoint local = makeLocal(event.mouse.where);
        int col = (local.x - LABEL_WIDTH) / CELL_WIDTH;
        int row = local.y - 1; // subtract header row
        if (col >= 0 && col < STEPS && row >= 0 && row < numInst) {
            cursorRow = row;
            cursorCol = col;
            if (event.mouse.eventFlags & meDoubleClick) {
                engine.toggleNote(cursorRow, cursorCol);
            }
            drawView();
        }
        clearEvent(event);
        return;
    }

    if (event.what == evKeyDown) {
        switch (event.keyDown.keyCode) {
            case kbUp:
                cursorRow = (cursorRow > 0) ? cursorRow - 1 : numInst - 1;
                drawView();
                clearEvent(event);
                break;
            case kbDown:
                cursorRow = (cursorRow < numInst - 1) ? cursorRow + 1 : 0;
                drawView();
                clearEvent(event);
                break;
            case kbLeft:
                cursorCol = (cursorCol > 0) ? cursorCol - 1 : STEPS - 1;
                drawView();
                clearEvent(event);
                break;
            case kbRight:
                cursorCol = (cursorCol < STEPS - 1) ? cursorCol + 1 : 0;
                drawView();
                clearEvent(event);
                break;
            case kbEnter:
                engine.toggleNote(cursorRow, cursorCol);
                drawView();
                clearEvent(event);
                break;
            default:
                break;
        }

        // Char-based keys
        char ch = event.keyDown.charScan.charCode;
        if (ch == '+' || ch == '=') {
            engine.setTempo(engine.getTempo() + 5);
            drawView();
            clearEvent(event);
        } else if (ch == '-' || ch == '_') {
            double t = engine.getTempo() - 5;
            if (t >= 30) engine.setTempo(t);
            drawView();
            clearEvent(event);
        }
    }
}

// ═══════════════════════════════════════════════════
//  TDrumMachineWindow
// ═══════════════════════════════════════════════════

TDrumMachineWindow::TDrumMachineWindow(const TRect& bounds)
    : TWindowInit(&TWindow::initFrame),
      TWindow(bounds, "TR-808 Drum Machine", wnNoNumber),
      audio(engine),
      lastPlayPos(-1)
{
    options |= ofTileable;

    TRect interior = getExtent();
    interior.grow(-1, -1);

    grid = new TDrumGridView(interior, engine);
    insert(grid);
    grid->select();

    // Load a default four-on-the-floor pattern
    // Kick on 1, 2, 3, 4
    engine.toggleNote(0, 0);
    engine.toggleNote(0, 4);
    engine.toggleNote(0, 8);
    engine.toggleNote(0, 12);
    // Snare on 2, 4
    engine.toggleNote(1, 4);
    engine.toggleNote(1, 12);
    // Closed hat on every other
    for (int i = 0; i < 16; i += 2)
        engine.toggleNote(3, i);
}

TDrumMachineWindow::~TDrumMachineWindow()
{
    audio.stop();
}

void TDrumMachineWindow::handleEvent(TEvent& event)
{
    // Window-level keys intercepted BEFORE subview dispatch
    if (event.what == evKeyDown) {
        char ch = event.keyDown.charScan.charCode;
        // Space = play/stop (never reaches grid)
        if (ch == ' ') {
            if (engine.isPlaying()) {
                audio.stop();
                engine.stop();
            } else {
                audio.start();
                engine.start();
            }
            grid->drawView();
            clearEvent(event);
            return;
        }
        // +/- = tempo (window-level so it works regardless of focus)
        if (ch == '+' || ch == '=') {
            engine.setTempo(engine.getTempo() + 5);
            grid->drawView();
            clearEvent(event);
            return;
        }
        if (ch == '-' || ch == '_') {
            double t = engine.getTempo() - 5;
            if (t >= 30) engine.setTempo(t);
            grid->drawView();
            clearEvent(event);
            return;
        }
    }

    TWindow::handleEvent(event);

    // Poll playhead position on any event to animate
    if (engine.isPlaying()) {
        int pos = engine.getPosition();
        if (pos != lastPlayPos) {
            lastPlayPos = pos;
            grid->drawView();
        }
    }
}

// Playhead redraws on every handleEvent cycle when playing

// ═══════════════════════════════════════════════════
//  Factory
// ═══════════════════════════════════════════════════

TWindow* createDrumMachineWindow(const TRect& bounds)
{
    return new TDrumMachineWindow(bounds);
}
