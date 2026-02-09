#include "mech.h"
#include <algorithm>
#include <random>
#include <chrono>

// Static member initialization
std::mt19937 TMech::rng_(std::chrono::steady_clock::now().time_since_epoch().count());

// Allowed emoji definitions
const std::vector<std::string> AllowedEmoji::eyes = {"👁️", "👁", "💀", "💿", "◌", "◡"};
const std::vector<std::string> AllowedEmoji::mouth = {"🫦"};
const std::vector<std::string> AllowedEmoji::organs = {"🫁", "🧠", "🫀"};
const std::vector<std::string> AllowedEmoji::planets = {"🌏", "🌎", "🌍"};
const std::vector<std::string> AllowedEmoji::elements = {"🌊"};
const std::vector<std::string> AllowedEmoji::creatures = {"👹"};
const std::vector<std::string> AllowedEmoji::patterns = {"▚", "◲", "◱", "◰", "◳", "✜"};

// Component patterns (simplified ASCII versions)
const std::vector<std::vector<std::string>> MechComponents::heads = {
    // Face Wide
    {
        "+--+--+--+",
        "|O |  | O|", 
        "+--+++---+"
    },
    // Face Normal  
    {
        "+------+",
        "|  O   |",
        "+------+"
    },
    // Face Skinny
    {
        "+--+",
        "|><|",
        "+--+"
    },
    // Skull face
    {
        "+--------+",
        "| X   X  |",
        "+---++---+"
    }
};

const std::vector<std::vector<std::string>> MechComponents::bodies = {
    // Basic body
    {
        "  +-----+  ",
        "+-+     +-+",
        "| +-----+ |",
        "|         |"
    },
    // Organ body
    {
        "  +-----+  ", 
        "+-+ @@@ +-+",
        "| +-----+ |",
        "|         |"
    },
    // Pattern body
    {
        "  +-----+  ",
        "+-+#####+-+",
        "| +-----+ |", 
        "|         |"
    }
};

const std::vector<std::vector<std::string>> MechComponents::legs = {
    // Normal legs
    {
        "|         |"
    },
    // Short legs  
    {
        "|         |",
        "|         |"
    }
};

const std::vector<std::vector<std::string>> MechComponents::feet = {
    // Tripod large
    {
        "/|\\       /|\\",
        "/ | \\     / | \\"
    },
    // Tripod small
    {
        "/|\\       /|\\"
    },
    // Prong
    {
        "+++       +++"  
    },
    // Clank
    {
        "+---+     +---+"
    }
};

TMech::TMech() : currentStyle_(BorderStyle::SINGLE) {
    pattern_.resize(CANVAS_HEIGHT);
    clearPattern();
}

void TMech::generate() {
    clearPattern();
    
    std::uniform_int_distribution<> headDist(0, MechComponents::heads.size() - 1);
    std::uniform_int_distribution<> bodyDist(0, MechComponents::bodies.size() - 1);
    std::uniform_int_distribution<> legDist(0, MechComponents::legs.size() - 1);
    std::uniform_int_distribution<> feetDist(0, MechComponents::feet.size() - 1);
    
    // Pick random components
    const auto& head = MechComponents::heads[headDist(rng_)];
    const auto& body = MechComponents::bodies[bodyDist(rng_)];
    const auto& legs = MechComponents::legs[legDist(rng_)];
    const auto& feet = MechComponents::feet[feetDist(rng_)];
    
    // Calculate positioning to center and anchor feet
    int headStartRow = 0;
    int headStartCol = (CANVAS_WIDTH - head[0].length()) / 2;
    
    int bodyStartRow = head.size();
    int bodyStartCol = (CANVAS_WIDTH - body[0].length()) / 2;
    
    int legsStartRow = bodyStartRow + body.size();
    int legsStartCol = bodyStartCol;
    
    int feetStartRow = CANVAS_HEIGHT - feet.size();
    int feetStartCol = (CANVAS_WIDTH - feet[0].length()) / 2;
    
    // Add components to pattern
    addComponent(head, headStartRow, headStartCol);
    addComponent(body, bodyStartRow, bodyStartCol);
    addComponent(legs, legsStartRow, legsStartCol);
    addComponent(feet, feetStartRow, feetStartCol);
    
    // Add random emoji to empty spots in organs/patterns
    std::uniform_int_distribution<> emojiChance(0, 100);
    if (emojiChance(rng_) < 30) { // 30% chance
        // Find a good spot and add an emoji
        for (int row = 1; row < CANVAS_HEIGHT - 2; ++row) {
            for (int col = 1; col < CANVAS_WIDTH - 2; ++col) {
                if (pattern_[row].length() > col && pattern_[row][col] == ' ') {
                    if (emojiChance(rng_) < 10) { // 10% chance per empty spot
                        auto emoji = pickRandomEmoji(AllowedEmoji::organs);
                        if (col + emoji.length() <= pattern_[row].length()) {
                            pattern_[row].replace(col, emoji.length(), emoji);
                            break;
                        }
                    }
                }
            }
        }
    }
}

void TMech::clearPattern() {
    for (auto& line : pattern_) {
        line.assign(CANVAS_WIDTH, ' ');
    }
}

void TMech::addComponent(const std::vector<std::string>& component, int startRow, int startCol) {
    for (size_t i = 0; i < component.size() && (startRow + i) < CANVAS_HEIGHT; ++i) {
        const std::string& compLine = component[i];
        if (startCol >= 0 && startCol + compLine.length() <= CANVAS_WIDTH) {
            pattern_[startRow + i].replace(startCol, compLine.length(), compLine);
        }
    }
}

void TMech::applyBorderStyle(BorderStyle style) {
    currentStyle_ = style;
    
    // Apply style transformation to all lines
    for (auto& line : pattern_) {
        std::string newLine;
        for (char ch : line) {
            newLine += applyStyleToChar(ch);
        }
        line = newLine;
    }
}

std::string TMech::applyStyleToChar(char ch) const {
    // For now, just return the character as-is
    // TODO: Implement proper Unicode box drawing char conversion
    return std::string(1, ch);
}

std::string TMech::pickRandomEmoji(const std::vector<std::string>& emojiList) const {
    if (emojiList.empty()) return "";
    std::uniform_int_distribution<> dist(0, emojiList.size() - 1);
    return emojiList[dist(rng_)];
}

const std::string& TMech::getLine(int row) const {
    static const std::string empty(CANVAS_WIDTH, ' ');
    if (row >= 0 && row < CANVAS_HEIGHT) {
        return pattern_[row];
    }
    return empty;
}

bool TMech::validateMech() const {
    // Basic validation - ensure we have some content and feet touch ground if present
    bool hasContent = false;
    for (const auto& line : pattern_) {
        if (line.find_first_not_of(' ') != std::string::npos) {
            hasContent = true;
            break;
        }
    }
    
    if (!hasContent) return false;
    
    // If mech has feet, ensure they touch the ground
    if (hasFeet()) {
        return feetTouchGround();
    }
    
    return true;
}

bool TMech::hasFeet() const {
    // Check last few rows for foot patterns
    for (int row = CANVAS_HEIGHT - 3; row < CANVAS_HEIGHT; ++row) {
        const std::string& line = pattern_[row];
        if (line.find("╱") != std::string::npos || line.find("╲") != std::string::npos ||
            line.find("╔") != std::string::npos || line.find("╗") != std::string::npos ||
            line.find("┌") != std::string::npos || line.find("┐") != std::string::npos) {
            return true;
        }
    }
    return false;
}

bool TMech::feetTouchGround() const {
    // Check if last row has foot elements
    const std::string& lastRow = pattern_[CANVAS_HEIGHT - 1];
    return lastRow.find_first_not_of(' ') != std::string::npos;
}