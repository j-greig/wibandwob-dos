/*---------------------------------------------------------*/
/*                                                         */
/*   deep_signal_view.h - Deep Signal space scanner game   */
/*                                                         */
/*   Explore deep space with a directional scanner cone.   */
/*   Reveal ASCII art nebulae, decode alien signals,       */
/*   manage fuel. FOV is a 90-degree cone you rotate.      */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef DEEP_SIGNAL_VIEW_H
#define DEEP_SIGNAL_VIEW_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TRect
#include <tvision/tv.h>
#include <vector>
#include <string>
#include <deque>
#include <cstdint>
#include <random>

// ── Space tiles ──────────────────────────────────────────
enum class SpaceTile : uint8_t {
    Empty = 0,
    Star1,          // dim .
    Star2,          // bright *
    Star3,          // large +
    Nebula,         // colored art character
    Asteroid,       // o — blocks scanner
    FuelDepot,      // F
    SignalSource,   // S — pulsing beacon
    Anomaly,        // ? — mysterious
};

// ── Scanner direction ────────────────────────────────────
enum class ScanDir : uint8_t {
    North = 0,
    East,
    South,
    West,
};

// ── Signal beacon ────────────────────────────────────────
struct SignalBeacon {
    int x, y;
    bool decoded;
    int signalId;   // 0-4
};

// ── Fuel station ─────────────────────────────────────────
struct FuelStation {
    int x, y;
    bool used;
};

// ── Anomaly point ────────────────────────────────────────
struct AnomalyPoint {
    int x, y;
    bool scanned;
    int anomalyId;  // 0-2
};

// ── Log message ──────────────────────────────────────────
struct SignalLog {
    std::string text;
    uint8_t color;  // 0=normal, 1=good, 2=bad, 3=info, 4=signal
};

// Command: deep signal spawns terminal for analysis
extern const ushort cmDeepSignalTerminal;

// ── Main view ────────────────────────────────────────────
class TDeepSignalView : public TView {
public:
    static constexpr int MAP_W = 80;
    static constexpr int MAP_H = 40;
    static constexpr int SCAN_RANGE = 12;
    static constexpr int DEEP_SCAN_RANGE = 20;
    static constexpr int LOG_LINES = 4;

    explicit TDeepSignalView(const TRect &bounds);
    virtual ~TDeepSignalView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect &bounds) override;

private:
    // Map generation
    void generateMap();
    void placeStars();
    void placeAsteroidField(int cx, int cy, int count);
    void embedArt(int artIdx, int ox, int oy);
    void placeSignals();
    void placeFuel();
    void placeAnomalies();

    // Tile queries
    SpaceTile tileAt(int x, int y) const;
    void setTile(int x, int y, SpaceTile t);
    bool isPassable(int x, int y) const;
    bool blocksScanner(int x, int y) const;

    // Scanner
    bool isInCone(int tx, int ty) const;
    bool isInConeEx(int tx, int ty, int range) const;
    bool hasLineOfSight(int fx, int fy, int tx, int ty) const;
    void updateScan();

    // Actions
    bool tryMove(int dx, int dy);
    void rotateCW();
    void rotateCCW();
    void deepScan();
    void interactFuel();
    void checkDiscoveries();

    // Logging
    void addLog(const std::string &msg, uint8_t color = 0);

    // Drawing
    void drawMapLine(int screenY, int mapY);
    void drawHUD(int screenY);
    void drawLog(int screenY, int logIdx);

    // Camera
    int camX{0}, camY{0};
    void updateCamera();

    // ── State ────────────────────────────────────────────
    std::vector<SpaceTile> map;         // MAP_W * MAP_H
    std::vector<int> lastScanned;       // turn when last scanned (0=never)
    std::vector<char> artChars;         // per-cell art overlay char ('\0'=none)
    std::vector<uint8_t> artColorIdx;   // per-cell art color index

    // Probe
    struct {
        int x{40}, y{20};
        int fuel{150};
        int maxFuel{200};
        ScanDir facing{ScanDir::East};
    } probe;

    // Objects
    std::vector<SignalBeacon> signals;
    std::vector<FuelStation> fuelStations;
    std::vector<AnomalyPoint> anomalies;

    int signalsDecoded{0};
    int turn{1};
    bool gameOver{false};
    bool victory{false};
    bool deepScanActive{false};

    std::deque<SignalLog> logMessages;

    // Random
    std::mt19937 rng;

    // Rendering
    std::vector<TScreenCell> lineBuf;
};

// Factory
class TWindow;
TWindow* createDeepSignalWindow(const TRect &bounds);

#endif // DEEP_SIGNAL_VIEW_H
