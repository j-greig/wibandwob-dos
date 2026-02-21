/*---------------------------------------------------------*/
/*                                                         */
/*   deep_signal_view.cpp - Deep Signal space scanner      */
/*                                                         */
/*---------------------------------------------------------*/

#define Uses_TWindow
#define Uses_TEvent
#define Uses_TKeys
#include <tvision/tv.h>
#include "deep_signal_view.h"

#include <algorithm>
#include <cmath>
#include <cstring>

// cmDeepSignalTerminal defined in test_pattern_app.cpp (= 220)

// ── ASCII Art Definitions ────────────────────────────────
// Art pieces embedded in the star field. Revealed through scanning.
// Each piece is stored as rows of characters. ' ' = transparent.
// Color index: 1=red, 2=blue, 3=purple, 4=cyan, 5=yellow, 6=green, 7=grey

struct ArtDef {
    const char* name;
    int w, h;
    const char* rows[16]; // max 16 rows
    uint8_t baseColor;    // default nebula color
};

static const ArtDef ART_PIECES[] = {
    // 0: Nebula Vortex — a spiral formation in red/orange
    {
        "Nebula Vortex", 19, 11,
        {
            "       .~~.        ",
            "     .~~~~*.       ",
            "   .~~~~~~*~.      ",
            "  ~~~~~~#*~~~.     ",
            " ~~~~~##**~~~~.    ",
            "~~~~~####*~~~~~    ",
            " ~~~~~##**~~~~.    ",
            "  ~~~~~~#*~~~.     ",
            "   .~~~~~~*~.      ",
            "     .~~~~*.       ",
            "       .~~.        ",
        },
        1 // red
    },
    // 1: Cosmic Eye — concentric rings in blue/purple
    {
        "Cosmic Eye", 17, 9,
        {
            "     .~~~~~.     ",
            "   .~~.....~~.   ",
            "  ~~..     ..~~  ",
            " ~~.    *    .~~ ",
            "~~.    ***    .~~",
            " ~~.    *    .~~ ",
            "  ~~..     ..~~  ",
            "   .~~.....~~.   ",
            "     .~~~~~.     ",
        },
        2 // blue
    },
    // 2: Derelict Fleet — destroyed ships in grey
    {
        "Derelict Fleet", 24, 8,
        {
            "  /==\\       /=\\       ",
            " /|  |\\     /| |\\      ",
            "< |==| >   < |=| >     ",
            " \\|  |/     \\| |/      ",
            "  \\==/       \\=/       ",
            "       /=\\              ",
            "      < * >    .  .     ",
            "       \\=/              ",
        },
        7 // grey
    },
    // 3: Crystal Array — geometric formation in cyan
    {
        "Crystal Array", 15, 9,
        {
            "       *       ",
            "      /|\\      ",
            "     / | \\     ",
            "    /  *  \\    ",
            "   /  /|\\  \\   ",
            "    \\  *  /    ",
            "     \\ | /     ",
            "      \\|/      ",
            "       *       ",
        },
        4 // cyan
    },
};
static constexpr int NUM_ART = 4;

// ── Color helpers ────────────────────────────────────────
static TColorRGB scaleRGB(uint8_t r, uint8_t g, uint8_t b, int pct) {
    return TColorRGB(r * pct / 100, g * pct / 100, b * pct / 100);
}

// Base foreground colors for art color indices
static void artBaseRGB(uint8_t idx, uint8_t &r, uint8_t &g, uint8_t &b) {
    switch (idx) {
        case 1: r=220; g=60;  b=30;  break; // red nebula
        case 2: r=50;  g=90;  b=220; break; // blue nebula
        case 3: r=160; g=50;  b=210; break; // purple
        case 4: r=40;  g=210; b=210; break; // cyan
        case 5: r=220; g=220; b=60;  break; // yellow/bright
        case 6: r=40;  g=200; b=60;  break; // green
        case 7: r=140; g=140; b=140; break; // grey
        default:r=180; g=180; b=180; break;
    }
}

// Brightness levels: 0=black, 1=25%, 2=50%, 3=75%, 4=100%
static int scanBrightness(int lastScan, int curTurn) {
    if (lastScan <= 0) return 0;
    int delta = curTurn - lastScan;
    if (delta <= 0)  return 4; // in scanner cone now
    if (delta <= 12) return 3; // recent memory
    if (delta <= 25) return 2; // fading
    return 1;                  // very dim
}

static const TColorAttr C_BLACK = TColorAttr(TColorRGB(0,0,0), TColorRGB(0,0,0));

// ── Constructor ──────────────────────────────────────────
TDeepSignalView::TDeepSignalView(const TRect &bounds)
    : TView(bounds)
{
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable | ofFirstClick;
    eventMask |= evBroadcast | evKeyDown;

    rng.seed(std::random_device{}());
    generateMap();
    updateScan();
    addLog("Deep Signal v1.0 — Probe deployed", 3);
    addLog("Arrow keys: move | Q/E: rotate scanner", 3);
    addLog("D: deep scan (3 fuel) | F: refuel at depot", 3);
    addLog("Find and decode all 5 signal sources!", 4);
}

TDeepSignalView::~TDeepSignalView() {}

// ── Map Generation ───────────────────────────────────────
void TDeepSignalView::generateMap() {
    map.assign(MAP_W * MAP_H, SpaceTile::Empty);
    lastScanned.assign(MAP_W * MAP_H, 0);
    artChars.assign(MAP_W * MAP_H, '\0');
    artColorIdx.assign(MAP_W * MAP_H, 0);

    placeStars();

    // Embed ASCII art nebulae/structures at specific locations
    embedArt(0, 10, 5);   // Nebula Vortex — upper left
    embedArt(1, 55, 3);   // Cosmic Eye — upper right
    embedArt(2, 15, 28);  // Derelict Fleet — lower left
    embedArt(3, 60, 30);  // Crystal Array — lower right

    // Asteroid fields (block scanner, create navigation puzzles)
    placeAsteroidField(35, 12, 25);
    placeAsteroidField(50, 25, 20);
    placeAsteroidField(25, 20, 15);

    placeSignals();
    placeFuel();
    placeAnomalies();

    // Ensure starting position is clear
    setTile(probe.x, probe.y, SpaceTile::Empty);
    for (int dy = -1; dy <= 1; dy++)
        for (int dx = -1; dx <= 1; dx++)
            if (probe.x+dx >= 0 && probe.x+dx < MAP_W &&
                probe.y+dy >= 0 && probe.y+dy < MAP_H)
                setTile(probe.x+dx, probe.y+dy, SpaceTile::Empty);

    updateCamera();
}

void TDeepSignalView::placeStars() {
    for (int i = 0; i < MAP_W * MAP_H; i++) {
        int r = std::uniform_int_distribution<int>(0, 100)(rng);
        if (r < 8)       map[i] = SpaceTile::Star1; // dim .
        else if (r < 12) map[i] = SpaceTile::Star2; // bright *
        else if (r < 14) map[i] = SpaceTile::Star3; // large +
    }
}

void TDeepSignalView::placeAsteroidField(int cx, int cy, int count) {
    int ax = cx, ay = cy;
    for (int i = 0; i < count; i++) {
        if (ax >= 0 && ax < MAP_W && ay >= 0 && ay < MAP_H) {
            // Don't overwrite art or special tiles
            int idx = ay * MAP_W + ax;
            if (artChars[idx] == '\0' && map[idx] != SpaceTile::FuelDepot &&
                map[idx] != SpaceTile::SignalSource) {
                map[idx] = SpaceTile::Asteroid;
            }
        }
        // Random walk
        int dir = std::uniform_int_distribution<int>(0, 3)(rng);
        if (dir == 0) ax++;
        else if (dir == 1) ax--;
        else if (dir == 2) ay++;
        else ay--;
        ax = std::max(1, std::min(ax, MAP_W - 2));
        ay = std::max(1, std::min(ay, MAP_H - 2));
    }
}

void TDeepSignalView::embedArt(int artIdx, int ox, int oy) {
    if (artIdx < 0 || artIdx >= NUM_ART) return;
    const ArtDef &art = ART_PIECES[artIdx];
    for (int row = 0; row < art.h; row++) {
        const char* line = art.rows[row];
        int len = (int)strlen(line);
        for (int col = 0; col < len && col < art.w; col++) {
            char ch = line[col];
            if (ch == ' ') continue; // transparent
            int mx = ox + col, my = oy + row;
            if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) continue;
            int idx = my * MAP_W + mx;
            map[idx] = SpaceTile::Nebula;
            artChars[idx] = ch;
            // Determine color: * and # are bright, . is dim, others use base
            if (ch == '*' || ch == '#')
                artColorIdx[idx] = 5; // bright yellow/white
            else if (ch == '.')
                artColorIdx[idx] = art.baseColor; // same but will be dimmer
            else
                artColorIdx[idx] = art.baseColor;
        }
    }
}

void TDeepSignalView::placeSignals() {
    signals.clear();
    // 5 signals spread across map quadrants + center
    struct { int x, y; } positions[] = {
        {18, 10}, {65, 8}, {12, 35}, {68, 34}, {55, 15}
    };
    for (int i = 0; i < 5; i++) {
        int sx = positions[i].x, sy = positions[i].y;
        // Find a clear spot near the target
        for (int tries = 0; tries < 20; tries++) {
            if (sx >= 0 && sx < MAP_W && sy >= 0 && sy < MAP_H) {
                int idx = sy * MAP_W + sx;
                if (map[idx] != SpaceTile::Asteroid && artChars[idx] == '\0') {
                    map[idx] = SpaceTile::SignalSource;
                    signals.push_back({sx, sy, false, i});
                    break;
                }
            }
            sx += std::uniform_int_distribution<int>(-2, 2)(rng);
            sy += std::uniform_int_distribution<int>(-2, 2)(rng);
            sx = std::max(1, std::min(sx, MAP_W - 2));
            sy = std::max(1, std::min(sy, MAP_H - 2));
        }
    }
}

void TDeepSignalView::placeFuel() {
    fuelStations.clear();
    struct { int x, y; } positions[] = {
        {30, 8}, {55, 20}, {20, 32}, {65, 38}
    };
    for (int i = 0; i < 4; i++) {
        int fx = positions[i].x, fy = positions[i].y;
        for (int tries = 0; tries < 20; tries++) {
            if (fx >= 0 && fx < MAP_W && fy >= 0 && fy < MAP_H) {
                int idx = fy * MAP_W + fx;
                if (map[idx] != SpaceTile::Asteroid && map[idx] != SpaceTile::SignalSource &&
                    artChars[idx] == '\0') {
                    map[idx] = SpaceTile::FuelDepot;
                    fuelStations.push_back({fx, fy, false});
                    break;
                }
            }
            fx += std::uniform_int_distribution<int>(-2, 2)(rng);
            fy += std::uniform_int_distribution<int>(-2, 2)(rng);
            fx = std::max(1, std::min(fx, MAP_W - 2));
            fy = std::max(1, std::min(fy, MAP_H - 2));
        }
    }
}

void TDeepSignalView::placeAnomalies() {
    anomalies.clear();
    struct { int x, y; } positions[] = {
        {45, 10}, {25, 25}, {60, 28}
    };
    for (int i = 0; i < 3; i++) {
        int ax = positions[i].x, ay = positions[i].y;
        for (int tries = 0; tries < 20; tries++) {
            if (ax >= 0 && ax < MAP_W && ay >= 0 && ay < MAP_H) {
                int idx = ay * MAP_W + ax;
                if (map[idx] != SpaceTile::Asteroid && map[idx] != SpaceTile::SignalSource &&
                    map[idx] != SpaceTile::FuelDepot && artChars[idx] == '\0') {
                    map[idx] = SpaceTile::Anomaly;
                    anomalies.push_back({ax, ay, false, i});
                    break;
                }
            }
            ax += std::uniform_int_distribution<int>(-2, 2)(rng);
            ay += std::uniform_int_distribution<int>(-2, 2)(rng);
            ax = std::max(1, std::min(ax, MAP_W - 2));
            ay = std::max(1, std::min(ay, MAP_H - 2));
        }
    }
}

// ── Tile queries ─────────────────────────────────────────
SpaceTile TDeepSignalView::tileAt(int x, int y) const {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H)
        return SpaceTile::Asteroid; // edges block
    return map[y * MAP_W + x];
}

void TDeepSignalView::setTile(int x, int y, SpaceTile t) {
    if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H)
        map[y * MAP_W + x] = t;
}

bool TDeepSignalView::isPassable(int x, int y) const {
    SpaceTile t = tileAt(x, y);
    return t != SpaceTile::Asteroid;
}

bool TDeepSignalView::blocksScanner(int x, int y) const {
    return tileAt(x, y) == SpaceTile::Asteroid;
}

// ── Scanner ──────────────────────────────────────────────
bool TDeepSignalView::isInCone(int tx, int ty) const {
    return isInConeEx(tx, ty, SCAN_RANGE);
}

bool TDeepSignalView::isInConeEx(int tx, int ty, int range) const {
    int dx = tx - probe.x;
    int dy = ty - probe.y;
    if (dx == 0 && dy == 0) return true; // probe position always visible

    // Distance check
    double dist = std::sqrt((double)(dx*dx + dy*dy));
    if (dist > range) return false;

    // 90-degree cone in facing direction
    switch (probe.facing) {
        case ScanDir::North: // dy < 0, |dx| <= |dy|
            if (dy >= 0) return false;
            if (std::abs(dx) > std::abs(dy)) return false;
            break;
        case ScanDir::South: // dy > 0, |dx| <= |dy|
            if (dy <= 0) return false;
            if (std::abs(dx) > std::abs(dy)) return false;
            break;
        case ScanDir::East: // dx > 0, |dy| <= dx
            if (dx <= 0) return false;
            if (std::abs(dy) > dx) return false;
            break;
        case ScanDir::West: // dx < 0, |dy| <= |dx|
            if (dx >= 0) return false;
            if (std::abs(dy) > std::abs(dx)) return false;
            break;
    }

    // Line of sight check
    return hasLineOfSight(probe.x, probe.y, tx, ty);
}

bool TDeepSignalView::hasLineOfSight(int fx, int fy, int tx, int ty) const {
    int dx = std::abs(tx - fx), dy = std::abs(ty - fy);
    int sx = fx < tx ? 1 : -1;
    int sy = fy < ty ? 1 : -1;
    int err = dx - dy;
    int cx = fx, cy = fy;

    while (cx != tx || cy != ty) {
        int e2 = 2 * err;
        if (e2 > -dy) { err -= dy; cx += sx; }
        if (e2 < dx)  { err += dx; cy += sy; }
        if (cx == tx && cy == ty) return true;
        if (blocksScanner(cx, cy)) return false;
    }
    return true;
}

void TDeepSignalView::updateScan() {
    int range = deepScanActive ? DEEP_SCAN_RANGE : SCAN_RANGE;
    for (int y = std::max(0, probe.y - range);
         y <= std::min(MAP_H - 1, probe.y + range); y++) {
        for (int x = std::max(0, probe.x - range);
             x <= std::min(MAP_W - 1, probe.x + range); x++) {
            if (isInConeEx(x, y, range)) {
                lastScanned[y * MAP_W + x] = turn;
            }
        }
    }
    // Probe's own cell always scanned
    lastScanned[probe.y * MAP_W + probe.x] = turn;
    deepScanActive = false;
}

// ── Actions ──────────────────────────────────────────────
bool TDeepSignalView::tryMove(int dx, int dy) {
    int nx = probe.x + dx, ny = probe.y + dy;
    if (!isPassable(nx, ny)) {
        addLog("Asteroid blocks path!", 2);
        return false;
    }
    if (probe.fuel <= 0) {
        addLog("OUT OF FUEL! Probe is stranded.", 2);
        gameOver = true;
        return false;
    }

    // Nebula costs 2 fuel, everything else costs 1
    SpaceTile dest = tileAt(nx, ny);
    int cost = (dest == SpaceTile::Nebula) ? 2 : 1;
    probe.fuel -= cost;
    probe.x = nx;
    probe.y = ny;
    turn++;

    updateCamera();
    updateScan();
    checkDiscoveries();

    // Auto-pickup fuel
    if (dest == SpaceTile::FuelDepot) {
        interactFuel();
    }

    if (probe.fuel <= 0 && !victory) {
        addLog("FUEL EXHAUSTED! Probe lost in deep space.", 2);
        gameOver = true;
    } else if (probe.fuel <= 20) {
        addLog("WARNING: Fuel critically low! (" + std::to_string(probe.fuel) + ")", 2);
    }

    return true;
}

void TDeepSignalView::rotateCW() {
    int d = (int)probe.facing;
    probe.facing = (ScanDir)((d + 1) % 4);
    turn++;
    updateScan();
    checkDiscoveries();
    const char* dirs[] = {"North", "East", "South", "West"};
    addLog(std::string("Scanner facing ") + dirs[(int)probe.facing], 3);
}

void TDeepSignalView::rotateCCW() {
    int d = (int)probe.facing;
    probe.facing = (ScanDir)((d + 3) % 4);
    turn++;
    updateScan();
    checkDiscoveries();
    const char* dirs[] = {"North", "East", "South", "West"};
    addLog(std::string("Scanner facing ") + dirs[(int)probe.facing], 3);
}

void TDeepSignalView::deepScan() {
    if (probe.fuel < 3) {
        addLog("Not enough fuel for deep scan! (need 3)", 2);
        return;
    }
    probe.fuel -= 3;
    deepScanActive = true;
    turn++;
    updateScan();
    checkDiscoveries();
    addLog("DEEP SCAN: Extended range pulse!", 4);
}

void TDeepSignalView::interactFuel() {
    for (auto &fs : fuelStations) {
        if (fs.x == probe.x && fs.y == probe.y && !fs.used) {
            int refuel = std::min(50, probe.maxFuel - probe.fuel);
            probe.fuel += refuel;
            fs.used = true;
            addLog("Fuel depot: +" + std::to_string(refuel) +
                   " fuel (now " + std::to_string(probe.fuel) + ")", 1);
            return;
        }
    }
}

void TDeepSignalView::checkDiscoveries() {
    // Check signals in scanner cone
    for (auto &sig : signals) {
        if (sig.decoded) continue;
        if (lastScanned[sig.y * MAP_W + sig.x] == turn) {
            sig.decoded = true;
            signalsDecoded++;
            addLog("SIGNAL DECODED! (" + std::to_string(signalsDecoded) +
                   "/5 total) Spawning analyzer...", 4);

            // Broadcast to app: spawn terminal with signal analysis
            TEvent termEvent;
            termEvent.what = evCommand;
            termEvent.message.command = cmDeepSignalTerminal;
            termEvent.message.infoInt = sig.signalId; // 0-4
            termEvent.message.infoPtr = nullptr;
            putEvent(termEvent);

            if (signalsDecoded >= 5) {
                victory = true;
                addLog("=== ALL SIGNALS DECODED! MISSION COMPLETE! ===", 1);
            }
        }
    }

    // Check anomalies in scanner cone
    for (auto &anom : anomalies) {
        if (anom.scanned) continue;
        if (lastScanned[anom.y * MAP_W + anom.x] == turn) {
            anom.scanned = true;
            addLog("Anomaly detected! Analyzing...", 4);

            TEvent termEvent;
            termEvent.what = evCommand;
            termEvent.message.command = cmDeepSignalTerminal;
            termEvent.message.infoInt = 10 + anom.anomalyId; // 10-12
            termEvent.message.infoPtr = nullptr;
            putEvent(termEvent);
        }
    }
}

void TDeepSignalView::addLog(const std::string &msg, uint8_t color) {
    logMessages.push_back({msg, color});
    while ((int)logMessages.size() > LOG_LINES * 2)
        logMessages.pop_front();
}

void TDeepSignalView::updateCamera() {
    int viewW = size.x;
    int viewH = size.y - LOG_LINES - 2; // leave room for HUD + log
    camX = probe.x - viewW / 2;
    camY = probe.y - viewH / 2;
    camX = std::max(0, std::min(camX, MAP_W - viewW));
    camY = std::max(0, std::min(camY, MAP_H - viewH));
}

// ── Drawing ──────────────────────────────────────────────
void TDeepSignalView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    if ((int)lineBuf.size() < W)
        lineBuf.resize(W);

    int mapRows = H - LOG_LINES - 2; // map area
    int hudRow = mapRows;             // HUD separator
    int logStart = mapRows + 2;       // log area

    for (int screenY = 0; screenY < H; screenY++) {
        // Clear line
        for (int sx = 0; sx < W; sx++)
            setCell(lineBuf[sx], ' ', C_BLACK);

        if (screenY < mapRows) {
            drawMapLine(screenY, camY + screenY);
        } else if (screenY == hudRow) {
            drawHUD(screenY);
        } else if (screenY == hudRow + 1) {
            // Separator line
            TColorAttr sepColor = TColorAttr(TColorRGB(0,0,0), TColorRGB(60,60,80));
            for (int sx = 0; sx < W; sx++)
                setCell(lineBuf[sx], '-', sepColor);
        } else if (screenY >= logStart) {
            int logIdx = screenY - logStart;
            drawLog(screenY, logIdx);
        }

        writeLine(0, screenY, W, 1, lineBuf.data());
    }
}

void TDeepSignalView::drawMapLine(int screenY, int mapY) {
    const int W = size.x;
    if (mapY < 0 || mapY >= MAP_H) return;

    for (int sx = 0; sx < W; sx++) {
        int mapX = camX + sx;
        if (mapX < 0 || mapX >= MAP_W) continue;

        int idx = mapY * MAP_W + mapX;
        int ls = lastScanned[idx];

        // Brightness based on scan recency
        int bright = scanBrightness(ls, turn);
        bool inConeNow = isInCone(mapX, mapY);
        if (inConeNow) bright = 4;

        if (bright == 0) continue; // never scanned — stay black

        // Percentage for color scaling
        int pct;
        switch (bright) {
            case 1: pct = 20; break;
            case 2: pct = 45; break;
            case 3: pct = 70; break;
            default: pct = 100; break;
        }

        // Determine glyph and foreground color
        char ch = ' ';
        uint8_t fr = 180, fg = 180, fb = 180; // default dim white

        // Check for player probe
        if (mapX == probe.x && mapY == probe.y) {
            const char dirGlyphs[] = {'^', '>', 'v', '<'};
            ch = dirGlyphs[(int)probe.facing];
            fr = 0; fg = 255; fb = 0; // bright green
            pct = 100; // always full brightness
        }
        // Check for signal source
        else if (map[idx] == SpaceTile::SignalSource) {
            // Check if decoded
            bool decoded = false;
            for (const auto &sig : signals)
                if (sig.x == mapX && sig.y == mapY && sig.decoded)
                    decoded = true;
            if (decoded) {
                ch = 'S';
                fr = 60; fg = 60; fb = 60; // dim — already decoded
            } else {
                // Pulsing beacon: alternate character based on turn
                ch = (turn % 2 == 0) ? 'S' : '*';
                fr = 220; fg = 220; fb = 0; // yellow
                if (turn % 2 == 1) { fr = 0; fg = 220; fb = 0; } // green
            }
        }
        // Check for anomaly
        else if (map[idx] == SpaceTile::Anomaly) {
            bool scanned = false;
            for (const auto &a : anomalies)
                if (a.x == mapX && a.y == mapY && a.scanned)
                    scanned = true;
            ch = '?';
            if (scanned) {
                fr = 80; fg = 40; fb = 100;
            } else {
                // Pulsing purple
                int pulse = (turn % 3 == 0) ? 220 : 160;
                fr = pulse; fg = 50; fb = 220;
            }
        }
        // Fuel depot
        else if (map[idx] == SpaceTile::FuelDepot) {
            bool used = false;
            for (const auto &fs : fuelStations)
                if (fs.x == mapX && fs.y == mapY && fs.used)
                    used = true;
            ch = 'F';
            if (used) {
                fr = 60; fg = 60; fb = 60;
            } else {
                fr = 0; fg = 220; fb = 220; // cyan
            }
        }
        // Art overlay (nebula, derelict, crystal)
        else if (artChars[idx] != '\0') {
            ch = artChars[idx];
            artBaseRGB(artColorIdx[idx], fr, fg, fb);
            // Brighten stars/highlights within art
            if (ch == '*' || ch == '#') {
                fr = 255; fg = 255; fb = 200;
            }
        }
        // Asteroid
        else if (map[idx] == SpaceTile::Asteroid) {
            ch = 'o';
            fr = 130; fg = 120; fb = 100;
        }
        // Stars
        else if (map[idx] == SpaceTile::Star1) {
            ch = '.';
            fr = 100; fg = 100; fb = 120;
        }
        else if (map[idx] == SpaceTile::Star2) {
            ch = '*';
            fr = 200; fg = 200; fb = 220;
        }
        else if (map[idx] == SpaceTile::Star3) {
            ch = '+';
            fr = 200; fg = 200; fb = 120;
        }
        // Empty space — just show darkness
        else {
            if (inConeNow) {
                // Show faint scan pattern in cone
                ch = '.';
                fr = 20; fg = 25; fb = 40;
                pct = 100;
            } else {
                continue; // nothing to draw
            }
        }

        // Apply brightness scaling (except player — always full)
        TColorRGB fgc = (mapX == probe.x && mapY == probe.y)
            ? TColorRGB(fr, fg, fb)
            : scaleRGB(fr, fg, fb, pct);

        // Scanner cone edge highlight
        TColorRGB bgc = TColorRGB(0, 0, 0);
        if (inConeNow) {
            bgc = TColorRGB(5, 8, 15); // very subtle blue tint in cone
        }

        setCell(lineBuf[sx], ch, TColorAttr(bgc, fgc));
    }
}

void TDeepSignalView::drawHUD(int screenY) {
    const int W = size.x;
    const char* dirNames[] = {"N", "E", "S", "W"};

    // Build HUD string
    std::string hud;

    // Fuel gauge
    hud += " FUEL:[";
    int barW = 15;
    int filled = probe.fuel * barW / probe.maxFuel;
    for (int i = 0; i < barW; i++)
        hud += (i < filled) ? '=' : ' ';
    hud += "] " + std::to_string(probe.fuel) + "/" + std::to_string(probe.maxFuel);

    // Direction
    hud += "  DIR:" + std::string(dirNames[(int)probe.facing]);

    // Signals decoded
    hud += "  SIG:" + std::to_string(signalsDecoded) + "/5";

    // Turn
    hud += "  T:" + std::to_string(turn);

    // Position
    hud += "  [" + std::to_string(probe.x) + "," + std::to_string(probe.y) + "]";

    // Game state
    if (victory) hud += "  ** MISSION COMPLETE **";
    else if (gameOver) hud += "  ** GAME OVER — R to restart **";

    // Render
    for (int i = 0; i < W && i < (int)hud.size(); i++) {
        TColorRGB fgc;
        // Color fuel gauge based on level
        if (i >= 7 && i < 7 + barW + 2) {
            if (probe.fuel > 100)      fgc = TColorRGB(0, 200, 100);
            else if (probe.fuel > 40)  fgc = TColorRGB(200, 200, 0);
            else                        fgc = TColorRGB(220, 50, 30);
        } else if (victory) {
            fgc = TColorRGB(0, 255, 100);
        } else if (gameOver) {
            fgc = TColorRGB(255, 60, 40);
        } else {
            fgc = TColorRGB(140, 160, 200);
        }
        setCell(lineBuf[i], hud[i], TColorAttr(TColorRGB(10, 10, 20), fgc));
    }
}

void TDeepSignalView::drawLog(int screenY, int logIdx) {
    const int W = size.x;
    int total = (int)logMessages.size();
    int startIdx = std::max(0, total - LOG_LINES);
    int actualIdx = startIdx + logIdx;
    if (actualIdx < 0 || actualIdx >= total) return;

    const SignalLog &entry = logMessages[actualIdx];

    TColorRGB fgc;
    switch (entry.color) {
        case 1: fgc = TColorRGB(60, 220, 80);  break; // good
        case 2: fgc = TColorRGB(220, 60, 40);  break; // bad
        case 3: fgc = TColorRGB(80, 120, 200);  break; // info
        case 4: fgc = TColorRGB(220, 200, 40);  break; // signal
        default: fgc = TColorRGB(140, 140, 140); break; // normal
    }

    TColorAttr attr = TColorAttr(TColorRGB(0, 0, 0), fgc);
    for (int i = 0; i < W && i < (int)entry.text.size(); i++)
        setCell(lineBuf[i], entry.text[i], attr);
}

// ── Input ────────────────────────────────────────────────
void TDeepSignalView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);

    if (ev.what != evKeyDown) return;

    const ushort key = ev.keyDown.keyCode;
    const uchar ch = ev.keyDown.charScan.charCode;

    if (gameOver || victory) {
        if (ch == 'r' || ch == 'R') {
            probe = {40, 20, 150, 200, ScanDir::East};
            signalsDecoded = 0;
            turn = 1;
            gameOver = false;
            victory = false;
            logMessages.clear();
            generateMap();
            updateScan();
            addLog("Probe redeployed. Find all 5 signals!", 3);
            drawView();
            clearEvent(ev);
        }
        return;
    }

    bool moved = false;

    if (key == kbUp)         moved = tryMove(0, -1);
    else if (key == kbDown)  moved = tryMove(0, 1);
    else if (key == kbLeft)  moved = tryMove(-1, 0);
    else if (key == kbRight) moved = tryMove(1, 0);
    else if (ch == 'q' || ch == 'Q') { rotateCCW(); moved = true; }
    else if (ch == 'e' || ch == 'E') { rotateCW();  moved = true; }
    else if (ch == 'd' || ch == 'D') { deepScan();  moved = true; }
    else return; // unhandled key

    if (moved) drawView();
    clearEvent(ev);
}

// ── State management ─────────────────────────────────────
void TDeepSignalView::setState(ushort aState, Boolean enable) {
    TView::setState(aState, enable);
}

void TDeepSignalView::changeBounds(const TRect &bounds) {
    TView::changeBounds(bounds);
    updateCamera();
    if ((int)lineBuf.size() < size.x)
        lineBuf.resize(size.x);
}

// ── Window wrapper ───────────────────────────────────────
class TDeepSignalWindow : public TWindow {
public:
    explicit TDeepSignalWindow(const TRect &bounds)
        : TWindow(bounds, "Deep Signal", wnNoNumber)
        , TWindowInit(&TDeepSignalWindow::initFrame) {}

    void setup() {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);
        insert(new TDeepSignalView(c));
    }

    virtual void changeBounds(const TRect &b) override {
        TWindow::changeBounds(b);
        setState(sfExposed, True);
        redraw();
    }
};

TWindow* createDeepSignalWindow(const TRect &bounds) {
    auto *w = new TDeepSignalWindow(bounds);
    w->setup();
    return w;
}
