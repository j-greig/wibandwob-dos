/*---------------------------------------------------------*/
/*                                                         */
/*   rogue_view.cpp - WibWob Rogue dungeon crawler         */
/*                                                         */
/*---------------------------------------------------------*/

#include "rogue_view.h"

#define Uses_TWindow
#define Uses_TEvent
#define Uses_TKeys
#include <tvision/tv.h>

#include <algorithm>
#include <cstring>
#include <cstdio>
#include <cmath>

// Forward: spawn terminal window (defined in test_pattern_app.cpp)
class TTestPatternApp;
extern void api_spawn_terminal(TTestPatternApp& app, const TRect* bounds);

// ── Creature data ─────────────────────────────────────────

char Creature::glyph() const {
    switch (kind) {
        case CreatureKind::Rat:      return 'r';
        case CreatureKind::Bat:      return 'b';
        case CreatureKind::Skeleton: return 's';
        case CreatureKind::Goblin:   return 'g';
        case CreatureKind::Glitch:   return 'G';
        case CreatureKind::Boss:     return 'D';
        default: return '?';
    }
}

const char* Creature::name() const {
    switch (kind) {
        case CreatureKind::Rat:      return "rat";
        case CreatureKind::Bat:      return "bat";
        case CreatureKind::Skeleton: return "skeleton";
        case CreatureKind::Goblin:   return "goblin";
        case CreatureKind::Glitch:   return "glitch";
        case CreatureKind::Boss:     return "DATA_WORM";
        default: return "thing";
    }
}

// ── Colors ────────────────────────────────────────────────

static const TColorAttr C_WALL      = TColorAttr(TColorRGB(0x30, 0x30, 0x40), TColorRGB(0x60, 0x60, 0x70));
static const TColorAttr C_FLOOR     = TColorAttr(TColorRGB(0x10, 0x10, 0x10), TColorRGB(0x40, 0x40, 0x40));
static const TColorAttr C_DOOR      = TColorAttr(TColorRGB(0x60, 0x40, 0x00), TColorRGB(0xCC, 0x88, 0x00));
static const TColorAttr C_STAIRS    = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xFF, 0xFF, 0xFF));
static const TColorAttr C_WATER     = TColorAttr(TColorRGB(0x00, 0x00, 0x40), TColorRGB(0x40, 0x80, 0xFF));
static const TColorAttr C_TERMINAL  = TColorAttr(TColorRGB(0x00, 0x20, 0x00), TColorRGB(0x00, 0xFF, 0x00));
static const TColorAttr C_PLAYER    = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xFF, 0xFF, 0x00));
static const TColorAttr C_ITEM      = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0x00, 0xFF, 0xFF));
static const TColorAttr C_GOLD      = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xFF, 0xD7, 0x00));
static const TColorAttr C_POTION    = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xFF, 0x00, 0xFF));
static const TColorAttr C_RAT       = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xAA, 0x77, 0x44));
static const TColorAttr C_BAT       = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0x88, 0x88, 0xAA));
static const TColorAttr C_SKELETON  = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xDD, 0xDD, 0xDD));
static const TColorAttr C_GOBLIN    = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0x00, 0xAA, 0x00));
static const TColorAttr C_GLITCH    = TColorAttr(TColorRGB(0x00, 0xFF, 0x00), TColorRGB(0x00, 0x00, 0x00));
static const TColorAttr C_BOSS      = TColorAttr(TColorRGB(0xFF, 0x00, 0x00), TColorRGB(0xFF, 0xFF, 0x00));
static const TColorAttr C_FOG       = TColorAttr(TColorRGB(0x08, 0x08, 0x08), TColorRGB(0x20, 0x20, 0x20));
static const TColorAttr C_SEEN      = TColorAttr(TColorRGB(0x08, 0x08, 0x08), TColorRGB(0x30, 0x30, 0x30));
static const TColorAttr C_HUD       = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xAA, 0xAA, 0xAA));
static const TColorAttr C_HPGOOD    = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0x00, 0xFF, 0x00));
static const TColorAttr C_HPBAD     = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xFF, 0x00, 0x00));
static const TColorAttr C_LOG_NORM  = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0x99, 0x99, 0x99));
static const TColorAttr C_LOG_GOOD  = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0x00, 0xFF, 0x00));
static const TColorAttr C_LOG_BAD   = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0xFF, 0x44, 0x44));
static const TColorAttr C_LOG_INFO  = TColorAttr(TColorRGB(0x00, 0x00, 0x00), TColorRGB(0x88, 0x88, 0xFF));
static const TColorAttr C_LOG_TERM  = TColorAttr(TColorRGB(0x00, 0x20, 0x00), TColorRGB(0x00, 0xFF, 0x00));
static const TColorAttr C_BG        = TColorAttr(TColorRGB(0x08, 0x08, 0x08), TColorRGB(0x08, 0x08, 0x08));
static const TColorAttr C_DEAD      = TColorAttr(TColorRGB(0x40, 0x00, 0x00), TColorRGB(0xFF, 0x00, 0x00));
static const TColorAttr C_WIN       = TColorAttr(TColorRGB(0x00, 0x40, 0x00), TColorRGB(0xFF, 0xFF, 0x00));

static TColorAttr creatureColor(CreatureKind k) {
    switch (k) {
        case CreatureKind::Rat:      return C_RAT;
        case CreatureKind::Bat:      return C_BAT;
        case CreatureKind::Skeleton: return C_SKELETON;
        case CreatureKind::Goblin:   return C_GOBLIN;
        case CreatureKind::Glitch:   return C_GLITCH;
        case CreatureKind::Boss:     return C_BOSS;
        default: return C_HUD;
    }
}

static TColorAttr itemColor(ItemKind k) {
    switch (k) {
        case ItemKind::Potion:   return C_POTION;
        case ItemKind::Gold:     return C_GOLD;
        case ItemKind::Key:      return C_GOLD;
        case ItemKind::DataChip: return C_TERMINAL;
        default: return C_ITEM;
    }
}

static char itemGlyph(ItemKind k) {
    switch (k) {
        case ItemKind::Potion:   return '!';
        case ItemKind::Scroll:   return '?';
        case ItemKind::Key:      return 'k';
        case ItemKind::Gold:     return '$';
        case ItemKind::Weapon:   return '/';
        case ItemKind::Armor:    return '[';
        case ItemKind::DataChip: return 'd';
        default: return '*';
    }
}

// ── TRogueView ────────────────────────────────────────────

TRogueView::TRogueView(const TRect &bounds)
    : TView(bounds), rng(std::random_device{}())
{
    growMode = gfGrowHiX | gfGrowHiY;
    options |= ofSelectable | ofFirstClick;
    eventMask |= evBroadcast | evKeyDown;
    map.resize(MAP_W * MAP_H, Tile::Wall);
    seen.resize(MAP_W * MAP_H, false);
    generateLevel();
    addLog("Welcome to WibWob Rogue!", 3);
    addLog("Find the stairs down. Reach floor 5.", 3);
    addLog("Press 'T' at terminals to hack.", 4);
}

TRogueView::~TRogueView() {}

// ── Map access ────────────────────────────────────────────

void TRogueView::placeTile(int x, int y, Tile t) {
    if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H)
        map[y * MAP_W + x] = t;
}

Tile TRogueView::tileAt(int x, int y) const {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H)
        return Tile::Wall;
    return map[y * MAP_W + x];
}

bool TRogueView::isPassable(int x, int y) const {
    Tile t = tileAt(x, y);
    return t != Tile::Wall;
}

// ── FOV ───────────────────────────────────────────────────

bool TRogueView::isVisible(int tx, int ty) const {
    int dx = tx - player.x;
    int dy = ty - player.y;
    float dist = std::sqrt((float)(dx * dx + dy * dy));
    if (dist > 8.0f) return false;

    // Simple ray march for LOS
    int steps = std::max(std::abs(dx), std::abs(dy));
    if (steps == 0) return true;
    float sx = (float)dx / steps;
    float sy = (float)dy / steps;
    float cx = (float)player.x + 0.5f;
    float cy = (float)player.y + 0.5f;
    for (int i = 0; i < steps; ++i) {
        cx += sx;
        cy += sy;
        int mx = (int)cx;
        int my = (int)cy;
        if (mx == tx && my == ty) return true;
        if (tileAt(mx, my) == Tile::Wall) return false;
    }
    return true;
}

// ── BSP dungeon generation ────────────────────────────────

void TRogueView::carveRoom(const Room& r) {
    for (int y = r.y; y < r.y + r.h; ++y)
        for (int x = r.x; x < r.x + r.w; ++x)
            placeTile(x, y, Tile::Floor);
}

void TRogueView::carveCorridor(int x1, int y1, int x2, int y2) {
    int x = x1, y = y1;
    while (x != x2) {
        placeTile(x, y, Tile::Floor);
        x += (x2 > x) ? 1 : -1;
    }
    while (y != y2) {
        placeTile(x, y, Tile::Floor);
        y += (y2 > y) ? 1 : -1;
    }
    placeTile(x, y, Tile::Floor);
}

void TRogueView::generateBSP(int x, int y, int w, int h, int depth) {
    // Minimum partition that can hold a room (3x3 room + 1 border each side)
    if (w < 6 || h < 5) return;  // too small, skip

    if (depth <= 0 || w < 12 || h < 10) {
        // Leaf: create a room
        int maxRW = std::min(w - 2, 10);
        int maxRH = std::min(h - 2, 8);
        int minRW = std::min(3, maxRW);
        int minRH = std::min(3, maxRH);
        if (maxRW < minRW || maxRH < minRH) return;

        std::uniform_int_distribution<int> rw(minRW, maxRW);
        std::uniform_int_distribution<int> rh(minRH, maxRH);
        int roomW = rw(rng);
        int roomH = rh(rng);
        int rxMax = std::max(x + 1, x + w - roomW - 1);
        int ryMax = std::max(y + 1, y + h - roomH - 1);
        std::uniform_int_distribution<int> rx(x + 1, rxMax);
        std::uniform_int_distribution<int> ry(y + 1, ryMax);
        Room room {rx(rng), ry(rng), roomW, roomH};
        carveRoom(room);
        rooms.push_back(room);
        return;
    }

    // Split — ensure each half gets at least 6 wide or 5 tall
    bool splitH = (w > h) ? true : (h > w) ? false : (rng() % 2 == 0);
    if (splitH) {
        int minSplit = x + 6;
        int maxSplit = x + w - 6;
        if (minSplit > maxSplit) { minSplit = maxSplit = x + w / 2; }
        std::uniform_int_distribution<int> sd(minSplit, maxSplit);
        int split = sd(rng);
        generateBSP(x, y, split - x, h, depth - 1);
        generateBSP(split, y, x + w - split, h, depth - 1);
    } else {
        int minSplit = y + 5;
        int maxSplit = y + h - 5;
        if (minSplit > maxSplit) { minSplit = maxSplit = y + h / 2; }
        std::uniform_int_distribution<int> sd(minSplit, maxSplit);
        int split = sd(rng);
        generateBSP(x, y, w, split - y, depth - 1);
        generateBSP(x, split, w, y + h - split, depth - 1);
    }
}

void TRogueView::generateLevel() {
    // Clear map
    std::fill(map.begin(), map.end(), Tile::Wall);
    rooms.clear();
    creatures.clear();
    items.clear();

    // Generate rooms via BSP
    generateBSP(0, 0, MAP_W, MAP_H, 4);

    // Connect rooms with corridors
    for (size_t i = 1; i < rooms.size(); ++i) {
        carveCorridor(rooms[i-1].centerX(), rooms[i-1].centerY(),
                      rooms[i].centerX(), rooms[i].centerY());
    }

    // Place doors at corridor-room boundaries
    for (int y = 1; y < MAP_H - 1; ++y) {
        for (int x = 1; x < MAP_W - 1; ++x) {
            if (tileAt(x, y) != Tile::Floor) continue;
            // Door: floor cell with walls on two opposite sides and floor on the other two
            bool wallLR = (tileAt(x-1, y) == Tile::Wall && tileAt(x+1, y) == Tile::Wall);
            bool wallUD = (tileAt(x, y-1) == Tile::Wall && tileAt(x, y+1) == Tile::Wall);
            bool floorLR = (tileAt(x-1, y) == Tile::Floor && tileAt(x+1, y) == Tile::Floor);
            bool floorUD = (tileAt(x, y-1) == Tile::Floor && tileAt(x, y+1) == Tile::Floor);
            if ((wallLR && floorUD) || (wallUD && floorLR)) {
                if (rng() % 3 == 0)  // 33% chance for doors
                    placeTile(x, y, Tile::Door);
            }
        }
    }

    // Place stairs in last room
    if (!rooms.empty()) {
        const Room& lastRoom = rooms.back();
        placeTile(lastRoom.centerX(), lastRoom.centerY(), Tile::StairsDown);
    }

    // Place terminal: always in second room (early encounter) + random middle room
    if (rooms.size() >= 2) {
        const Room& earlyRoom = rooms[1];
        int tx = earlyRoom.centerX() + 1;
        if (tx >= MAP_W) tx = earlyRoom.centerX();
        placeTile(tx, earlyRoom.centerY(), Tile::Terminal);
    }
    if (rooms.size() >= 4) {
        int lo = 2, hi = (int)rooms.size() - 2;
        if (lo > hi) lo = hi;
        std::uniform_int_distribution<int> ri(lo, hi);
        const Room& termRoom = rooms[ri(rng)];
        int tx = termRoom.centerX() + 1;
        if (tx >= MAP_W) tx = termRoom.centerX();
        placeTile(tx, termRoom.centerY(), Tile::Terminal);
    }

    // Place water puddles
    for (auto& room : rooms) {
        if (rng() % 4 == 0) {
            int wx = room.x + 1 + (int)(rng() % std::max(1, room.w - 2));
            int wy = room.y + 1 + (int)(rng() % std::max(1, room.h - 2));
            placeTile(wx, wy, Tile::Water);
            if (wx + 1 < room.x + room.w)
                placeTile(wx + 1, wy, Tile::Water);
        }
    }

    placePlayer();
    spawnCreatures();
    spawnItems();
    updateCamera();

    // Mark seen as false for new level
    std::fill(seen.begin(), seen.end(), false);
}

void TRogueView::placePlayer() {
    if (!rooms.empty()) {
        player.x = rooms[0].centerX();
        player.y = rooms[0].centerY();
    }
}

void TRogueView::spawnCreatures() {
    int numCreatures = 3 + player.floor * 2;
    for (int i = 0; i < numCreatures && rooms.size() > 1; ++i) {
        std::uniform_int_distribution<int> ri(1, (int)rooms.size() - 1);
        const Room& room = rooms[ri(rng)];
        int cx = room.x + 1 + (int)(rng() % std::max(1, room.w - 2));
        int cy = room.y + 1 + (int)(rng() % std::max(1, room.h - 2));

        Creature c;
        c.x = cx;
        c.y = cy;
        c.alive = true;

        // Scale creature type with floor
        int roll = (int)(rng() % 100);
        if (player.floor >= 4 && roll < 10) {
            c.kind = CreatureKind::Boss;
            c.hp = c.maxHp = 30;
            c.damage = 8;
        } else if (player.floor >= 3 && roll < 25) {
            c.kind = CreatureKind::Glitch;
            c.hp = c.maxHp = 12;
            c.damage = 5;
        } else if (player.floor >= 2 && roll < 50) {
            c.kind = CreatureKind::Goblin;
            c.hp = c.maxHp = 8 + player.floor;
            c.damage = 3 + player.floor;
        } else if (roll < 70) {
            c.kind = CreatureKind::Skeleton;
            c.hp = c.maxHp = 6 + player.floor;
            c.damage = 2 + player.floor;
        } else if (roll < 85) {
            c.kind = CreatureKind::Bat;
            c.hp = c.maxHp = 3 + player.floor;
            c.damage = 1 + player.floor;
        } else {
            c.kind = CreatureKind::Rat;
            c.hp = c.maxHp = 2 + player.floor;
            c.damage = 1;
        }
        creatures.push_back(c);
    }
}

void TRogueView::spawnItems() {
    // Guarantee a data chip in the starting room
    if (!rooms.empty()) {
        const Room& r0 = rooms[0];
        int ix = r0.x + 1 + (int)(rng() % std::max(1, r0.w - 2));
        int iy = r0.y + 1 + (int)(rng() % std::max(1, r0.h - 2));
        items.push_back({ItemKind::DataChip, ix, iy, "data chip", 1});
    }

    for (auto& room : rooms) {
        // Gold in most rooms
        if (rng() % 2 == 0) {
            int ix = room.x + 1 + (int)(rng() % std::max(1, room.w - 2));
            int iy = room.y + 1 + (int)(rng() % std::max(1, room.h - 2));
            items.push_back({ItemKind::Gold, ix, iy, "gold", 5 + (int)(rng() % 15)});
        }
        // Potions occasionally
        if (rng() % 4 == 0) {
            int ix = room.x + 1 + (int)(rng() % std::max(1, room.w - 2));
            int iy = room.y + 1 + (int)(rng() % std::max(1, room.h - 2));
            items.push_back({ItemKind::Potion, ix, iy, "health potion", 5 + (int)(rng() % 8)});
        }
        // Data chips near terminals
        if (rng() % 5 == 0) {
            int ix = room.x + 1 + (int)(rng() % std::max(1, room.w - 2));
            int iy = room.y + 1 + (int)(rng() % std::max(1, room.h - 2));
            items.push_back({ItemKind::DataChip, ix, iy, "data chip", 1});
        }
        // Scrolls rarely
        if (rng() % 6 == 0) {
            int ix = room.x + 1 + (int)(rng() % std::max(1, room.w - 2));
            int iy = room.y + 1 + (int)(rng() % std::max(1, room.h - 2));
            items.push_back({ItemKind::Scroll, ix, iy, "scroll of reveal", 1});
        }
    }
}

// ── Game logic ────────────────────────────────────────────

void TRogueView::addLog(const std::string& msg, uint8_t color) {
    log.push_front({msg, color});
    if ((int)log.size() > LOG_LINES * 2)
        log.resize(LOG_LINES * 2);
}

bool TRogueView::tryMove(int dx, int dy) {
    int nx = player.x + dx;
    int ny = player.y + dy;

    if (!isPassable(nx, ny)) return false;

    // Check for creature at destination
    for (auto& c : creatures) {
        if (c.alive && c.x == nx && c.y == ny) {
            attackCreature(c);
            return true;  // turn consumed
        }
    }

    player.x = nx;
    player.y = ny;
    pickupItems();

    // Creature turns: simple chase AI
    for (auto& c : creatures) {
        if (!c.alive) continue;
        int cdx = player.x - c.x;
        int cdy = player.y - c.y;
        float dist = std::sqrt((float)(cdx * cdx + cdy * cdy));
        if (dist > 8.0f) continue;  // only chase if nearby

        // Move toward player (simple)
        int mx = 0, my = 0;
        if (std::abs(cdx) > std::abs(cdy))
            mx = (cdx > 0) ? 1 : -1;
        else if (cdy != 0)
            my = (cdy > 0) ? 1 : -1;

        int cnx = c.x + mx;
        int cny = c.y + my;

        // Attack player if adjacent
        if (cnx == player.x && cny == player.y) {
            int dmg = std::max(1, c.damage - player.defense);
            player.hp -= dmg;
            char buf[80];
            snprintf(buf, sizeof(buf), "The %s hits you for %d damage!", c.name(), dmg);
            addLog(buf, 2);
            if (player.hp <= 0) {
                player.hp = 0;
                gameOver = true;
                addLog("You have been slain!", 2);
            }
        } else if (isPassable(cnx, cny)) {
            // Check no other creature there
            bool blocked = false;
            for (auto& oc : creatures)
                if (&oc != &c && oc.alive && oc.x == cnx && oc.y == cny)
                    blocked = true;
            if (!blocked) {
                c.x = cnx;
                c.y = cny;
            }
        }
    }

    updateCamera();
    return true;
}

void TRogueView::attackCreature(Creature& c) {
    int dmg = std::max(1, player.attack - 0);  // creatures have no defense
    c.hp -= dmg;
    char buf[80];
    if (c.hp <= 0) {
        c.alive = false;
        int xpGain = 2 + (int)c.kind * 3;
        snprintf(buf, sizeof(buf), "You slay the %s! (+%d XP)", c.name(), xpGain);
        addLog(buf, 1);
        gainXp(xpGain);
    } else {
        snprintf(buf, sizeof(buf), "You hit the %s for %d (%d/%d HP)", c.name(), dmg, c.hp, c.maxHp);
        addLog(buf, 0);
    }
}

void TRogueView::pickupItems() {
    auto it = items.begin();
    while (it != items.end()) {
        if (it->x == player.x && it->y == player.y) {
            char buf[80];
            switch (it->kind) {
                case ItemKind::Gold:
                    player.gold += it->value;
                    snprintf(buf, sizeof(buf), "Picked up %d gold.", it->value);
                    addLog(buf, 1);
                    break;
                case ItemKind::Potion:
                    drinkPotion(*it);
                    break;
                case ItemKind::Scroll:
                    readScroll(*it);
                    break;
                case ItemKind::DataChip:
                    player.dataChips++;
                    addLog("Picked up a data chip.", 4);
                    break;
                case ItemKind::Key:
                    player.hasKey = true;
                    addLog("Found a key!", 1);
                    break;
                default:
                    snprintf(buf, sizeof(buf), "Picked up %s.", it->name.c_str());
                    addLog(buf, 0);
                    break;
            }
            it = items.erase(it);
        } else {
            ++it;
        }
    }
}

void TRogueView::drinkPotion(const Item& it) {
    int heal = it.value;
    player.hp = std::min(player.maxHp, player.hp + heal);
    char buf[60];
    snprintf(buf, sizeof(buf), "Drank health potion. +%d HP (%d/%d)", heal, player.hp, player.maxHp);
    addLog(buf, 1);
}

void TRogueView::readScroll(const Item& it) {
    // Reveal all tiles on the map
    std::fill(seen.begin(), seen.end(), true);
    addLog("The scroll reveals the dungeon map!", 3);
}

void TRogueView::gainXp(int amount) {
    player.xp += amount;
    checkLevelUp();
}

void TRogueView::checkLevelUp() {
    while (player.xp >= player.xpNext) {
        player.xp -= player.xpNext;
        player.level++;
        player.xpNext = 10 + player.level * 5;
        player.maxHp += 5;
        player.hp = player.maxHp;
        player.attack += 1;
        player.defense += (player.level % 2 == 0) ? 1 : 0;
        char buf[60];
        snprintf(buf, sizeof(buf), "Level up! You are now level %d.", player.level);
        addLog(buf, 1);
    }
}

void TRogueView::useStairs() {
    Tile t = tileAt(player.x, player.y);
    if (t == Tile::StairsDown) {
        player.floor++;
        if (player.floor > 5) {
            victory = true;
            addLog("You escaped WibWob Dungeon! VICTORY!", 1);
            return;
        }
        char buf[60];
        snprintf(buf, sizeof(buf), "Descending to floor %d...", player.floor);
        addLog(buf, 3);
        generateLevel();
    }
}

void TRogueView::interactTerminal() {
    // Check adjacent cells for a terminal
    int dx[] = {0, 0, -1, 1, 0};
    int dy[] = {-1, 1, 0, 0, 0};
    bool foundTerminal = false;
    for (int i = 0; i < 5; ++i) {
        if (tileAt(player.x + dx[i], player.y + dy[i]) == Tile::Terminal) {
            foundTerminal = true;
            break;
        }
    }
    if (!foundTerminal) {
        addLog("No terminal nearby.", 0);
        return;
    }

    // Always spawn a terminal window — outcome depends on having a chip
    TEvent termEvent;
    termEvent.what = evCommand;
    termEvent.message.infoPtr = nullptr;

    if (player.dataChips > 0) {
        player.dataChips--;
        // Bonus: reveal map + heal + XP
        std::fill(seen.begin(), seen.end(), true);
        player.hp = std::min(player.maxHp, player.hp + 10);
        gainXp(5);
        addLog("[TERMINAL] Data chip inserted.", 4);
        addLog("[TERMINAL] System hacked: map revealed, +10HP, +5XP", 4);
        termEvent.message.command = cmRogueHackTerminal;
        termEvent.message.infoInt = 1;  // success
    } else {
        addLog("[TERMINAL] Access denied. Need data chip.", 4);
        addLog("[TERMINAL] Find 'd' items in the dungeon.", 4);
        termEvent.message.command = cmRogueHackTerminal;
        termEvent.message.infoInt = 0;  // denied
    }
    putEvent(termEvent);
}

void TRogueView::updateCamera() {
    // Center camera on player
    int viewW = size.x;
    int viewH = size.y - LOG_LINES - 2;  // reserve for HUD + log
    camX = player.x - viewW / 2;
    camY = player.y - viewH / 2;
    camX = std::max(0, std::min(camX, MAP_W - viewW));
    camY = std::max(0, std::min(camY, MAP_H - viewH));
}

// ── Drawing ───────────────────────────────────────────────

void TRogueView::draw() {
    const int W = size.x;
    const int H = size.y;
    if (W <= 0 || H <= 0) return;

    if ((int)lineBuf.size() < W)
        lineBuf.resize(W);

    const int mapViewH = H - LOG_LINES - 2;  // HUD takes 1 row, separator 1 row

    // Update seen tiles from FOV
    for (int my = 0; my < MAP_H; ++my)
        for (int mx = 0; mx < MAP_W; ++mx)
            if (isVisible(mx, my))
                seen[my * MAP_W + mx] = true;

    for (int screenY = 0; screenY < H; ++screenY) {
        // Clear line
        for (int sx = 0; sx < W; ++sx)
            setCell(lineBuf[sx], ' ', C_BG);

        if (screenY < mapViewH) {
            // Map area
            int mapY = screenY + camY;
            for (int sx = 0; sx < W; ++sx) {
                int mapX = sx + camX;
                if (mapX < 0 || mapX >= MAP_W || mapY < 0 || mapY >= MAP_H) {
                    setCell(lineBuf[sx], ' ', C_BG);
                    continue;
                }

                Tile t = tileAt(mapX, mapY);
                bool vis = isVisible(mapX, mapY);
                bool wasSeen = seen[mapY * MAP_W + mapX];

                if (!vis && !wasSeen) {
                    setCell(lineBuf[sx], ' ', C_BG);
                    continue;
                }

                char ch = ' ';
                TColorAttr attr = C_FLOOR;

                switch (t) {
                    case Tile::Wall:      ch = '#'; attr = vis ? C_WALL : C_SEEN; break;
                    case Tile::Floor:     ch = '.'; attr = vis ? C_FLOOR : C_SEEN; break;
                    case Tile::Door:      ch = '+'; attr = vis ? C_DOOR : C_SEEN; break;
                    case Tile::StairsDown:ch = '>'; attr = vis ? C_STAIRS : C_SEEN; break;
                    case Tile::StairsUp:  ch = '<'; attr = vis ? C_STAIRS : C_SEEN; break;
                    case Tile::Water:     ch = '~'; attr = vis ? C_WATER : C_SEEN; break;
                    case Tile::Terminal:  ch = '&'; attr = vis ? C_TERMINAL : C_SEEN; break;
                }

                setCell(lineBuf[sx], ch, attr);
            }

            // Draw items (only in FOV)
            for (const auto& it : items) {
                int sx = it.x - camX;
                int sy = it.y - camY;
                if (sy == screenY && sx >= 0 && sx < W && isVisible(it.x, it.y)) {
                    setCell(lineBuf[sx], itemGlyph(it.kind), itemColor(it.kind));
                }
            }

            // Draw creatures (only in FOV)
            for (const auto& c : creatures) {
                if (!c.alive) continue;
                int sx = c.x - camX;
                int sy = c.y - camY;
                if (sy == screenY && sx >= 0 && sx < W && isVisible(c.x, c.y)) {
                    setCell(lineBuf[sx], c.glyph(), creatureColor(c.kind));
                }
            }

            // Draw player
            {
                int sx = player.x - camX;
                int sy = player.y - camY;
                if (sy == screenY && sx >= 0 && sx < W) {
                    setCell(lineBuf[sx], '@', C_PLAYER);
                }
            }

        } else if (screenY == mapViewH) {
            // HUD line
            char buf[120];
            float hpPct = (player.maxHp > 0) ? (float)player.hp / player.maxHp : 0;
            TColorAttr hpColor = (hpPct > 0.5f) ? C_HPGOOD : C_HPBAD;

            // Build HUD string
            snprintf(buf, sizeof(buf),
                " HP:%d/%d  Atk:%d Def:%d  Lv:%d XP:%d/%d  Floor:%d  Gold:%d  Chips:%d",
                player.hp, player.maxHp, player.attack, player.defense,
                player.level, player.xp, player.xpNext,
                player.floor, player.gold, player.dataChips);

            for (int i = 0; buf[i] && i < W; ++i) {
                TColorAttr attr = C_HUD;
                // Color HP portion
                if (i >= 4 && i < 4 + 10) attr = hpColor;
                setCell(lineBuf[i], buf[i], attr);
            }

        } else if (screenY == mapViewH + 1) {
            // Separator
            for (int sx = 0; sx < W; ++sx)
                setCell(lineBuf[sx], '-', TColorAttr(TColorRGB(0x00,0x00,0x00), TColorRGB(0x40,0x40,0x40)));

        } else {
            // Log area
            int logIdx = screenY - mapViewH - 2;
            if (logIdx >= 0 && logIdx < (int)log.size()) {
                const auto& msg = log[logIdx];
                TColorAttr attr;
                switch (msg.color) {
                    case 1: attr = C_LOG_GOOD; break;
                    case 2: attr = C_LOG_BAD;  break;
                    case 3: attr = C_LOG_INFO; break;
                    case 4: attr = C_LOG_TERM; break;
                    default: attr = C_LOG_NORM; break;
                }
                for (int i = 0; i < (int)msg.text.size() && i < W; ++i)
                    setCell(lineBuf[i], msg.text[i], attr);
            }
        }

        // Game over / Victory overlay
        if (screenY == mapViewH / 2) {
            const char* msg = nullptr;
            TColorAttr attr = C_DEAD;
            if (gameOver) {
                msg = " YOU DIED - Press R to restart ";
                attr = C_DEAD;
            } else if (victory) {
                msg = " VICTORY! You escaped! Press R for new game ";
                attr = C_WIN;
            }
            if (msg) {
                int len = (int)strlen(msg);
                int mx = std::max(0, (W - len) / 2);
                for (int i = 0; i < len && mx + i < W; ++i)
                    setCell(lineBuf[mx + i], msg[i], attr);
            }
        }

        writeLine(0, screenY, W, 1, lineBuf.data());
    }
}

// ── Event handling ────────────────────────────────────────

void TRogueView::handleEvent(TEvent &ev) {
    TView::handleEvent(ev);

    if (ev.what == evKeyDown) {
        const ushort key = ev.keyDown.keyCode;
        const uchar ch = ev.keyDown.charScan.charCode;
        bool handled = true;

        if (gameOver || victory) {
            if (ch == 'r' || ch == 'R') {
                // Full reset
                player = Player{};
                gameOver = false;
                victory = false;
                log.clear();
                generateLevel();
                addLog("Welcome to WibWob Rogue!", 3);
                addLog("Find the stairs down. Reach floor 5.", 3);
                addLog("Press 'T' at terminals to hack.", 4);
            } else {
                handled = false;
            }
        } else {
            // Movement
            if (key == kbUp    || ch == 'k' || ch == '8') { tryMove(0, -1); }
            else if (key == kbDown  || ch == 'j' || ch == '2') { tryMove(0, 1); }
            else if (key == kbLeft  || ch == 'h' || ch == '4') { tryMove(-1, 0); }
            else if (key == kbRight || ch == 'l' || ch == '6') { tryMove(1, 0); }
            // Diagonals (numpad/vi keys)
            else if (ch == 'y' || ch == '7') { tryMove(-1, -1); }
            else if (ch == 'u' || ch == '9') { tryMove(1, -1); }
            else if (ch == 'b' || ch == '1') { tryMove(-1, 1); }
            else if (ch == 'n' || ch == '3') { tryMove(1, 1); }
            // Actions
            else if (ch == '>' || ch == '.') { useStairs(); }
            else if (ch == 't' || ch == 'T') { interactTerminal(); }
            else if (ch == '5' || ch == 's') { /* wait a turn */ tryMove(0, 0); }
            else if (ch == 'r' || ch == 'R') {
                player = Player{};
                gameOver = false;
                victory = false;
                log.clear();
                generateLevel();
                addLog("New game started.", 3);
            }
            else { handled = false; }
        }

        if (handled) {
            drawView();
            clearEvent(ev);
        }
    }
}

void TRogueView::setState(ushort aState, Boolean enable) {
    TView::setState(aState, enable);
    if ((aState & sfExposed) != 0 && enable) {
        drawView();
    }
}

void TRogueView::changeBounds(const TRect& bounds) {
    TView::changeBounds(bounds);
    updateCamera();
    drawView();
}

// ── Window wrapper ────────────────────────────────────────

class TRogueWindow : public TWindow {
public:
    explicit TRogueWindow(const TRect &bounds)
        : TWindow(bounds, "WibWob Rogue", wnNoNumber)
        , TWindowInit(&TRogueWindow::initFrame) {}

    void setup() {
        options |= ofTileable;
        TRect c = getExtent();
        c.grow(-1, -1);
        insert(new TRogueView(c));
    }

    virtual void changeBounds(const TRect& b) override {
        TWindow::changeBounds(b);
        setState(sfExposed, True);
        redraw();
    }
};

TWindow* createRogueWindow(const TRect &bounds) {
    auto *w = new TRogueWindow(bounds);
    w->setup();
    return w;
}
