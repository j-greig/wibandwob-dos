/*---------------------------------------------------------*/
/*                                                         */
/*   rogue_view.h - WibWob Rogue dungeon crawler           */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef ROGUE_VIEW_H
#define ROGUE_VIEW_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TRect
#include <tvision/tv.h>
#include <vector>
#include <string>
#include <deque>
#include <cstdint>
#include <random>

// ── Map tiles ─────────────────────────────────────────────
enum class Tile : uint8_t {
    Wall = 0,
    Floor,
    Door,
    StairsDown,
    StairsUp,
    Water,
    Terminal,  // hackable terminal — opens tvterm window
};

// ── Items ─────────────────────────────────────────────────
enum class ItemKind : uint8_t {
    Potion = 0,
    Scroll,
    Key,
    Gold,
    Weapon,
    Armor,
    DataChip,  // used at terminals
};

struct Item {
    ItemKind kind;
    int x, y;
    std::string name;
    int value;  // healing amount, gold amount, damage bonus, etc.
};

// ── Creatures ─────────────────────────────────────────────
enum class CreatureKind : uint8_t {
    Rat = 0,
    Bat,
    Skeleton,
    Goblin,
    Glitch,   // digital creature near terminals
    Boss,
};

struct Creature {
    CreatureKind kind;
    int x, y;
    int hp, maxHp;
    int damage;
    bool alive;
    char glyph() const;
    const char* name() const;
};

// ── Player ────────────────────────────────────────────────
struct Player {
    int x {0}, y {0};
    int hp {20}, maxHp {20};
    int attack {3};
    int defense {1};
    int gold {0};
    int level {1};
    int xp {0};
    int xpNext {10};
    int floor {1};
    bool hasKey {false};
    int dataChips {0};
};

// ── Room structure for BSP generation ─────────────────────
struct Room {
    int x, y, w, h;
    int centerX() const { return x + w / 2; }
    int centerY() const { return y + h / 2; }
};

// ── Message log ───────────────────────────────────────────
struct LogMessage {
    std::string text;
    uint8_t color;  // 0=normal, 1=good, 2=bad, 3=info, 4=terminal
};

// Command broadcast: roguelike wants to spawn a hacking terminal
extern const ushort cmRogueHackTerminal;

// ── Main view ─────────────────────────────────────────────
class TRogueView : public TView {
public:
    static constexpr int MAP_W = 60;
    static constexpr int MAP_H = 30;
    static constexpr int LOG_LINES = 5;

    explicit TRogueView(const TRect &bounds);
    virtual ~TRogueView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

private:
    void generateLevel();
    void placePlayer();
    void spawnCreatures();
    void spawnItems();
    void placeTile(int x, int y, Tile t);
    Tile tileAt(int x, int y) const;
    bool isPassable(int x, int y) const;
    bool tryMove(int dx, int dy);
    void attackCreature(Creature& c);
    void pickupItems();
    void useStairs();
    void interactTerminal();
    void drinkPotion(const Item& it);
    void readScroll(const Item& it);
    void gainXp(int amount);
    void checkLevelUp();
    void addLog(const std::string& msg, uint8_t color = 0);
    void drawMap(int screenY, int mapY);
    void drawHUD(int screenY);
    void drawLog(int screenY, int logIdx);

    // BSP dungeon generation
    void generateBSP(int x, int y, int w, int h, int depth);
    void carveRoom(const Room& r);
    void carveCorridor(int x1, int y1, int x2, int y2);

    // State
    std::vector<Tile> map;  // MAP_W * MAP_H
    Player player;
    std::vector<Creature> creatures;
    std::vector<Item> items;
    std::vector<Room> rooms;
    std::deque<LogMessage> log;
    bool gameOver {false};
    bool victory {false};

    // Camera
    int camX {0}, camY {0};
    void updateCamera();

    // Random
    std::mt19937 rng;

    // Rendering
    std::vector<TScreenCell> lineBuf;

    // FOV — simple radius-based
    bool isVisible(int tx, int ty) const;
    std::vector<bool> seen;  // permanently revealed tiles
};

// Factory
class TWindow;
TWindow* createRogueWindow(const TRect &bounds);

#endif // ROGUE_VIEW_H
