/*---------------------------------------------------------*/
/*                                                         */
/*   glitch_engine.h - Terminal Resize Glitch Simulator   */
/*   Programmatic recreation of TVision buffer corruption */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef GLITCH_ENGINE_H
#define GLITCH_ENGINE_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TColorAttr
#define Uses_TRect
#include <tvision/tv.h>
#include <random>
#include <vector>
#include <string>

/*---------------------------------------------------------*/
/* Glitch Parameters - Control corruption characteristics */
/*---------------------------------------------------------*/
struct GlitchParams {
    // Character scatter parameters
    float scatterIntensity = 0.5f;      // 0.0-1.0: How much to scatter characters
    int scatterRadius = 5;               // Maximum pixel offset for scatter
    
    // Color bleeding parameters  
    float colorBleedChance = 0.3f;       // 0.0-1.0: Probability of color bleeding
    int colorBleedDistance = 3;          // How far colors can bleed
    
    // Dimension corruption
    float dimensionCorruption = 0.2f;    // 0.0-1.0: How much to corrupt size calculations
    bool enableBufferDesync = true;      // Enable buffer pointer desynchronization
    
    // Pattern corruption
    float partialDrawChance = 0.4f;      // 0.0-1.0: Chance to interrupt drawing mid-operation
    bool enableCoordinateOffset = true;  // Add random offsets to coordinates
    
    // Timing simulation
    int corruptionWindowMs = 25;         // Simulated corruption timing window
    bool animateCorruption = false;      // Animate corruption over time
    
    // Randomization seed
    uint32_t seed = 0;                   // 0 = use random seed
};

/*---------------------------------------------------------*/
/* CorruptedDrawBuffer - Extended TDrawBuffer with glitches */
/*---------------------------------------------------------*/
class CorruptedDrawBuffer : public TDrawBuffer {
public:
    CorruptedDrawBuffer();
    
    // Override core drawing methods with corruption
    void moveChar(ushort indent, uchar c, TColorAttr attr, ushort count);
    void moveStr(ushort indent, TStringView str, TColorAttr attr);
    void moveCStr(ushort indent, const char *str, TColorAttr attr);
    
    // Corruption methods
    void applyScatterCorruption(const GlitchParams& params);
    void applyColorBleeding(const GlitchParams& params);
    void applyCoordinateOffset(const GlitchParams& params, int &x, int &y);
    
    // State management
    void setCorruptionEnabled(bool enabled) { corruptionEnabled = enabled; }
    bool isCorruptionEnabled() const { return corruptionEnabled; }
    
private:
    bool corruptionEnabled = false;
    mutable std::mt19937 rng;
    
    // Internal corruption helpers
    void scatterCharacter(int index, int scatterRadius);
    void bleedColor(int sourceIndex, int targetIndex);
    int getRandomOffset(int maxOffset);
};

/*---------------------------------------------------------*/
/* GlitchEngine - Main controller for glitch generation   */
/*---------------------------------------------------------*/
class GlitchEngine {
public:
    GlitchEngine();
    ~GlitchEngine();
    
    // Core glitch control
    void enableGlitchMode(bool enabled);
    bool isGlitchModeEnabled() const { return glitchEnabled; }
    
    // Parameter management
    void setGlitchParams(const GlitchParams& params);
    const GlitchParams& getGlitchParams() const { return currentParams; }
    
    // Glitch generation methods
    void corruptView(TView* view);
    void corruptDrawBuffer(TDrawBuffer& buffer);
    void simulateResizeCorruption(TView* view);
    void applyDimensionDesync(TView* view, int& width, int& height);
    
    // Predefined glitch patterns
    void applyScatterPattern(TDrawBuffer& buffer);
    void applyColorBleedPattern(TDrawBuffer& buffer);  
    void applyDiagonalScatter(TDrawBuffer& buffer);
    void applyRadialDistortion(TDrawBuffer& buffer, int centerX, int centerY);
    
    // Frame capture for text export
    std::string captureGlitchedFrame(TView* view);
    std::string captureAsPlainText(TView* view);
    std::string captureAsAnsiEscapes(TView* view);
    
    // Animation support
    void updateAnimation();
    void setAnimationSpeed(float speed) { animationSpeed = speed; }
    
    // Utility methods
    void resetCorruption();
    void generateNewSeed();
    
    // Statistics
    int getCorruptionCount() const { return corruptionCount; }
    float getCorruptionIntensity() const;
    
private:
    bool glitchEnabled = false;
    GlitchParams currentParams;
    std::mt19937 rng;
    
    // Animation state
    float animationTime = 0.0f;
    float animationSpeed = 1.0f;
    
    // Statistics
    int corruptionCount = 0;
    
    // Internal methods
    void initializeRandomization();
    void updateCorruptionParameters();
    
    // Buffer manipulation helpers
    void corruptCharacterPosition(TDrawBuffer& buffer, int index);
    void corruptColorAttributes(TDrawBuffer& buffer, int index);
    TColorAttr blendColors(TColorAttr color1, TColorAttr color2, float ratio);
    
    // Coordinate corruption
    void injectCoordinateError(int& x, int& y, int maxError);
    void simulateBufferPointerError(TDrawBuffer& buffer);
    
    // Pattern generators  
    void generateScatterField(std::vector<int>& offsets, int size);
    void generateColorBleedMap(std::vector<int>& sources, std::vector<int>& targets);
};

/*---------------------------------------------------------*/
/* Global glitch engine instance and helper functions     */
/*---------------------------------------------------------*/

// Global instance (singleton pattern)
extern GlitchEngine* globalGlitchEngine;

// Convenience functions
GlitchEngine& getGlitchEngine();
void enableGlobalGlitchMode(bool enabled);
void setGlobalGlitchParams(const GlitchParams& params);

// Helper macros for easy integration
#define GLITCH_CORRUPT_VIEW(view) \
    if (getGlitchEngine().isGlitchModeEnabled()) \
        getGlitchEngine().corruptView(view)

#define GLITCH_CORRUPT_BUFFER(buffer) \
    if (getGlitchEngine().isGlitchModeEnabled()) \
        getGlitchEngine().corruptDrawBuffer(buffer)

#define GLITCH_CORRUPT_COORDS(x, y) \
    if (getGlitchEngine().isGlitchModeEnabled()) \
        getGlitchEngine().applyDimensionDesync(nullptr, x, y)

#endif // GLITCH_ENGINE_H