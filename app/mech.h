#pragma once

#include <string>
#include <vector>
#include <random>
#include <map>

// Border style types
enum class BorderStyle {
    SINGLE,
    DOUBLE, 
    ROUND,
    FAT,
    SINGLE_DOUBLE,
    NONE
};

// Allowed emoji from mechs.md
struct AllowedEmoji {
    static const std::vector<std::string> eyes;
    static const std::vector<std::string> mouth;
    static const std::vector<std::string> organs;
    static const std::vector<std::string> planets;
    static const std::vector<std::string> elements;
    static const std::vector<std::string> creatures;
    static const std::vector<std::string> patterns;
};

// Component patterns from mechs.md
struct MechComponents {
    // Head patterns (faces)
    static const std::vector<std::vector<std::string>> heads;
    
    // Body patterns
    static const std::vector<std::vector<std::string>> bodies;
    
    // Leg patterns
    static const std::vector<std::vector<std::string>> legs;
    
    // Feet patterns
    static const std::vector<std::vector<std::string>> feet;
};

// Individual mechanoid
class TMech {
public:
    static constexpr int CANVAS_WIDTH = 19;
    static constexpr int CANVAS_HEIGHT = 9;
    
    TMech();
    
    // Generate a new random mech
    void generate();
    
    // Apply border style to current pattern
    void applyBorderStyle(BorderStyle style);
    
    // Get pattern line
    const std::string& getLine(int row) const;
    
    // Get all lines
    const std::vector<std::string>& getPattern() const { return pattern_; }
    
private:
    std::vector<std::string> pattern_;
    BorderStyle currentStyle_;
    static std::mt19937 rng_;
    
    // Helper methods
    void clearPattern();
    void addComponent(const std::vector<std::string>& component, int startRow, int startCol);
    std::string applyStyleToChar(char ch) const;
    std::string pickRandomEmoji(const std::vector<std::string>& emojiList) const;
    bool hasBoxDrawingChar(const std::string& line) const;
    
    // Validation
    bool validateMech() const;
    bool hasFeet() const;
    bool feetTouchGround() const;
};