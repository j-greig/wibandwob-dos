/*---------------------------------------------------------*/
/*                                                         */
/*   animated_ascii_view.h - Multi-Layer ASCII Animation  */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef ANIMATED_ASCII_VIEW_H
#define ANIMATED_ASCII_VIEW_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TRect
#include <tvision/tv.h>
#include <vector>
#include <string>
#include <unordered_map>

// Multi-layer animated ASCII art view where different character types
// move with different patterns (waves flow, faces bob, circles drift, etc.)
class TAnimatedAsciiView : public TView {
public:
    explicit TAnimatedAsciiView(const TRect &bounds, unsigned periodMs = 120);
    virtual ~TAnimatedAsciiView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

    void setSpeed(unsigned periodMs_);

private:
    struct AnimatedLine {
        std::string text;
        int originalY;     // Base Y position
        int currentY;      // Animated Y position
        int offsetX;       // Horizontal scroll offset
        int layer;         // Animation type
    };

    enum AnimationLayer {
        LAYER_KAOMOJI = 0,    // Lines with faces bob up/down
        LAYER_WAVES = 1,      // Lines with ≋ flow horizontally
        LAYER_CIRCLES = 2,    // Lines with ⊖⊕ drift slowly  
        LAYER_SQUIGGLES = 3,  // Lines with ∿ wiggle
        LAYER_BLOCKS = 4,     // Lines with ▓▒░ slide horizontally
        LAYER_TRIANGLES = 5,  // Lines with ▝▗ bounce
        LAYER_ARROWS = 6,     // Lines with ↝ flow rapidly
        LAYER_STATIC = 7      // Static lines
    };

    void startTimer();
    void stopTimer();
    void advance();
    void initializeArt();
    int getLineAnimationLayer(const std::string& line) const;
    void updateLinePosition(AnimatedLine& animLine);

    unsigned periodMs;
    TTimerId timerId {0};
    int phase {0};
    
    std::vector<AnimatedLine> animatedLines;
    
    // Original ASCII art as string data
    static const std::vector<std::string> asciiArtLines;
};

// Factory helper used by the app to avoid direct dependency on the view type.
class TWindow; 
TWindow* createAnimatedAsciiWindow(const TRect &bounds);

#endif // ANIMATED_ASCII_VIEW_H