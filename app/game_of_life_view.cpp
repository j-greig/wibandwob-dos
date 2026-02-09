/*---------------------------------------------------------*/
/*                                                         */
/*   game_of_life_view.cpp - Conway's Game of Life View   */
/*                                                         */
/*---------------------------------------------------------*/

#include "game_of_life_view.h"

#define Uses_TWindow
#define Uses_TEvent
#include <tvision/tv.h>
#include <random>

TGameOfLifeView::TGameOfLifeView(const TRect &bounds, unsigned periodMs)
    : TView(bounds), periodMs(periodMs ? periodMs : 400)
{
    // Anchor to top-left and grow to the right and bottom like other views.
    growMode = gfGrowHiX | gfGrowHiY;
    // Receive timer expirations and mouse events
    eventMask |= evBroadcast | evMouseDown;
    
    initGrid();
    seedRandom(0.12f); // Start with 12% density - sweet spot for sustained patterns
}

TGameOfLifeView::~TGameOfLifeView() {
    stopTimer();
}

void TGameOfLifeView::initGrid() {
    gridWidth = size.x;
    gridHeight = size.y;
    
    if (gridWidth <= 0 || gridHeight <= 0) return;
    
    // Clear sparse grid containers
    livingCells.clear();
    activeCells.clear();
    cellAges.clear();
    
    generation = 0;
}

void TGameOfLifeView::setSpeed(unsigned periodMs_) {
    periodMs = periodMs_ ? periodMs_ : 1;
    if (timerId) {
        stopTimer();
        startTimer();
    }
}

void TGameOfLifeView::reset() {
    generation = 0;
    livingCells.clear();
    activeCells.clear();
    cellAges.clear();
}

void TGameOfLifeView::seedRandom(float density) {
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_real_distribution<> dis(0.0, 1.0);
    
    reset();
    
    // Only create living cells according to density
    for (int y = 0; y < gridHeight; ++y) {
        for (int x = 0; x < gridWidth; ++x) {
            if (dis(gen) < density) {
                CellCoord coord(x, y);
                livingCells.insert(coord);
                cellAges[coord] = 0;
            }
        }
    }
}

void TGameOfLifeView::loadGlider() {
    reset();
    // Place a glider in the center if there's room
    int centerX = gridWidth / 2;
    int centerY = gridHeight / 2;
    
    if (centerX > 2 && centerY > 2 && centerX < gridWidth - 2 && centerY < gridHeight - 2) {
        // Classic glider pattern - sparse representation
        std::vector<CellCoord> gliderCells = {
            {centerX, centerY-1},
            {centerX+1, centerY},
            {centerX-1, centerY+1},
            {centerX, centerY+1},
            {centerX+1, centerY+1}
        };
        
        for (const auto& coord : gliderCells) {
            livingCells.insert(coord);
            cellAges[coord] = 0;
        }
    }
}

void TGameOfLifeView::startTimer() {
    if (timerId == 0)
        timerId = setTimer(periodMs, (int)periodMs);
}

void TGameOfLifeView::stopTimer() {
    if (timerId != 0) {
        killTimer(timerId);
        timerId = 0;
    }
}

int TGameOfLifeView::countNeighbors(const CellCoord& coord) const {
    int count = 0;
    for (int dy = -1; dy <= 1; ++dy) {
        for (int dx = -1; dx <= 1; ++dx) {
            if (dx == 0 && dy == 0) continue; // Skip the cell itself
            
            CellCoord neighbor(coord.x + dx, coord.y + dy);
            
            // Toroidal topology (wrap around edges)
            if (neighbor.x < 0) neighbor.x = gridWidth - 1;
            if (neighbor.x >= gridWidth) neighbor.x = 0;
            if (neighbor.y < 0) neighbor.y = gridHeight - 1;
            if (neighbor.y >= gridHeight) neighbor.y = 0;
            
            if (isAlive(neighbor)) count++;
        }
    }
    return count;
}

void TGameOfLifeView::computeNextGeneration() {
    // Conway's Game of Life rules (sparse grid optimization):
    // 1. Any live cell with 2-3 live neighbors survives
    // 2. Any dead cell with exactly 3 live neighbors becomes alive
    // 3. All other live cells die, all other dead cells stay dead
    
    // Clear active cells and rebuild from current living cells
    activeCells.clear();
    
    // Add all living cells and their neighbors to the active set
    // Only these cells can possibly change state
    for (const auto& cell : livingCells) {
        addActiveNeighbors(cell);
    }
    
    // Evaluate only the active cells for state changes
    std::unordered_set<CellCoord, CellCoordHash> nextLivingCells;
    std::unordered_map<CellCoord, int, CellCoordHash> nextCellAges;
    
    for (const auto& cell : activeCells) {
        int neighbors = countNeighbors(cell);
        bool currentlyAlive = isAlive(cell);
        
        bool willBeAlive = false;
        if (currentlyAlive) {
            willBeAlive = (neighbors == 2 || neighbors == 3);
        } else {
            willBeAlive = (neighbors == 3);
        }
        
        if (willBeAlive) {
            nextLivingCells.insert(cell);
            // Age the cell or start at age 0 for new cells
            int age = currentlyAlive ? (cellAges[cell] + 1) : 0;
            nextCellAges[cell] = age;
        }
    }
    
    // Atomically update the living cells and ages
    livingCells = std::move(nextLivingCells);
    cellAges = std::move(nextCellAges);
    
    generation++;
}

bool TGameOfLifeView::isAlive(const CellCoord& coord) const {
    return livingCells.count(coord) > 0;
}

void TGameOfLifeView::setAlive(const CellCoord& coord, bool alive) {
    if (alive) {
        livingCells.insert(coord);
        if (cellAges.find(coord) == cellAges.end()) {
            cellAges[coord] = 0;
        }
    } else {
        livingCells.erase(coord);
        cellAges.erase(coord);
    }
}

void TGameOfLifeView::addActiveNeighbors(const CellCoord& coord) {
    // Add all neighbors of this cell to the active list for evaluation
    for (int dy = -1; dy <= 1; ++dy) {
        for (int dx = -1; dx <= 1; ++dx) {
            CellCoord neighbor(coord.x + dx, coord.y + dy);
            // Keep within bounds (toroidal wrapping)
            if (neighbor.x < 0) neighbor.x = gridWidth - 1;
            if (neighbor.x >= gridWidth) neighbor.x = 0;
            if (neighbor.y < 0) neighbor.y = gridHeight - 1;
            if (neighbor.y >= gridHeight) neighbor.y = 0;
            
            activeCells.insert(neighbor);
        }
    }
}

void TGameOfLifeView::advance() {
    computeNextGeneration();
}

void TGameOfLifeView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    // Ensure line buffer fits the current width (avoids TDrawBuffer 132-col cap).
    if ((int)lineBuf.size() < W)
        lineBuf.resize(W);

    // Update grid size if window was resized
    if (gridWidth != W || gridHeight != H) {
        initGrid();
        seedRandom(0.12f); // Re-seed after resize with balanced density
    }

    // Characters for different cell states - subtle Unicode box drawing
    const char deadChar = '\xB0';   // Light shade ░
    const char aliveChar = '\xDB';  // Full block █

    for (int y = 0; y < H; ++y) {
        for (int x = 0; x < W; ++x) {
            char ch = deadChar;
            TColorAttr attr(0x08); // Dark grey for dead cells
            
            CellCoord coord(x, y);
            if (isAlive(coord)) {
                ch = aliveChar;
                attr = TColorAttr(0x0F); // Bright white for living cells
            }
            
            setCell(lineBuf[x], ch, attr);
        }
        writeLine(0, y, W, 1, lineBuf.data());
    }
}

void TGameOfLifeView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);
    
    // Handle mouse clicks for reset with new random config
    if (ev.what == evMouseDown) {
        seedRandom(0.12f); // Reset with new random 12% density
        generation = 0;
        drawView();
        clearEvent(ev);
        return;
    }
    
    // Handle timer events for animation
    if (ev.what == evBroadcast && ev.message.command == cmTimerExpired) {
        if (timerId != 0 && ev.message.infoPtr == timerId) {
            advance();
            drawView();
            clearEvent(ev);
        }
    }
}

void TGameOfLifeView::setState(ushort aState, Boolean enable) {
    TView::setState(aState, enable);
    if ((aState & sfExposed) != 0) {
        if (enable) {
            startTimer();
            drawView();
        } else {
            stopTimer();
        }
    }
}

void TGameOfLifeView::changeBounds(const TRect& bounds)
{
    TView::changeBounds(bounds);
    // Re-render immediately to cover any newly exposed area.
    drawView();
}

// A wrapper window to ensure proper redraws on resize/tile.
class TGameOfLifeWindow : public TWindow {
public:
    explicit TGameOfLifeWindow(const TRect &bounds)
        : TWindow(bounds, "Game of Life", wnNoNumber)
        , TWindowInit(&TGameOfLifeWindow::initFrame) {}

    void setup()
    {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);
        insert(new TGameOfLifeView(c, /*periodMs=*/400)); // 2.5 FPS - slower for better observation
    }

    virtual void changeBounds(const TRect& b) override
    {
        TWindow::changeBounds(b);
        // Force a full redraw after tiling/resizing operations
        setState(sfExposed, True);
        redraw();
    }
};

// Factory helper; creates a tileable window hosting the Game of Life view.
TWindow* createGameOfLifeWindow(const TRect &bounds)
{
    auto *w = new TGameOfLifeWindow(bounds);
    w->setup();
    return w;
}