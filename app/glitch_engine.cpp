/*---------------------------------------------------------*/
/*                                                         */
/*   glitch_engine.cpp - Terminal Resize Glitch Simulator */
/*   Implementation of programmatic corruption effects    */
/*                                                         */
/*---------------------------------------------------------*/

#include "glitch_engine.h"
#include <algorithm>
#include <chrono>
#include <sstream>
#include <iomanip>

/*---------------------------------------------------------*/
/* Global instance                                         */
/*---------------------------------------------------------*/
GlitchEngine* globalGlitchEngine = nullptr;

GlitchEngine& getGlitchEngine() {
    if (!globalGlitchEngine) {
        globalGlitchEngine = new GlitchEngine();
    }
    return *globalGlitchEngine;
}

void enableGlobalGlitchMode(bool enabled) {
    getGlitchEngine().enableGlitchMode(enabled);
}

void setGlobalGlitchParams(const GlitchParams& params) {
    getGlitchEngine().setGlitchParams(params);
}

/*---------------------------------------------------------*/
/* CorruptedDrawBuffer Implementation                      */
/*---------------------------------------------------------*/

CorruptedDrawBuffer::CorruptedDrawBuffer() : rng(std::random_device{}()) {
}

void CorruptedDrawBuffer::moveChar(ushort indent, uchar c, TColorAttr attr, ushort count) {
    // Call original method first
    TDrawBuffer::moveChar(indent, c, attr, count);
    
    if (corruptionEnabled && getGlitchEngine().isGlitchModeEnabled()) {
        // Apply character scatter corruption
        const auto& params = getGlitchEngine().getGlitchParams();
        if (params.scatterIntensity > 0.0f) {
            std::uniform_real_distribution<float> dist(0.0f, 1.0f);
            if (dist(rng) < params.scatterIntensity) {
                // Scatter some characters from this range
                for (int i = 0; i < count; i += std::max(1, static_cast<int>(4.0f / params.scatterIntensity))) {
                    scatterCharacter(indent + i, params.scatterRadius);
                }
            }
        }
    }
}

void CorruptedDrawBuffer::moveStr(ushort indent, TStringView str, TColorAttr attr) {
    // Call original method first  
    TDrawBuffer::moveStr(indent, str, attr);
    
    if (corruptionEnabled && getGlitchEngine().isGlitchModeEnabled()) {
        const auto& params = getGlitchEngine().getGlitchParams();
        applyScatterCorruption(params);
        applyColorBleeding(params);
    }
}

void CorruptedDrawBuffer::moveCStr(ushort indent, const char *str, TColorAttr attr) {
    // Call original method first
    TDrawBuffer::moveCStr(indent, str, attr);
    
    if (corruptionEnabled && getGlitchEngine().isGlitchModeEnabled()) {
        const auto& params = getGlitchEngine().getGlitchParams();
        applyScatterCorruption(params);
        applyColorBleeding(params);
    }
}

void CorruptedDrawBuffer::applyScatterCorruption(const GlitchParams& params) {
    if (params.scatterIntensity <= 0.0f) return;
    
    std::uniform_real_distribution<float> chanceDist(0.0f, 1.0f);
    std::uniform_int_distribution<int> offsetDist(-params.scatterRadius, params.scatterRadius);
    
    // Apply to random positions in buffer
    int bufferSize = sizeof(data) / sizeof(data[0]);
    int scatterCount = static_cast<int>(bufferSize * params.scatterIntensity * 0.1f);
    
    for (int i = 0; i < scatterCount; i++) {
        if (chanceDist(rng) < params.scatterIntensity) {
            int sourceIndex = rng() % bufferSize;
            int targetOffset = offsetDist(rng);
            int targetIndex = std::max(0, std::min(bufferSize - 1, sourceIndex + targetOffset));
            
            if (sourceIndex != targetIndex) {
                // Swap or copy characters to create scatter effect
                std::swap(data[sourceIndex], data[targetIndex]);
            }
        }
    }
}

void CorruptedDrawBuffer::applyColorBleeding(const GlitchParams& params) {
    if (params.colorBleedChance <= 0.0f) return;
    
    std::uniform_real_distribution<float> chanceDist(0.0f, 1.0f);
    std::uniform_int_distribution<int> distanceDist(1, params.colorBleedDistance);
    
    int bufferSize = sizeof(data) / sizeof(data[0]);
    
    for (int i = 0; i < bufferSize; i++) {
        if (chanceDist(rng) < params.colorBleedChance) {
            int bleedDistance = distanceDist(rng);
            int targetIndex = std::max(0, std::min(bufferSize - 1, i + bleedDistance));
            
            if (i != targetIndex) {
                bleedColor(i, targetIndex);
            }
        }
    }
}

void CorruptedDrawBuffer::applyCoordinateOffset(const GlitchParams& params, int &x, int &y) {
    if (!params.enableCoordinateOffset) return;
    
    std::uniform_int_distribution<int> offsetDist(-2, 2);
    x += offsetDist(rng);
    y += offsetDist(rng);
}

void CorruptedDrawBuffer::scatterCharacter(int index, int scatterRadius) {
    int bufferSize = sizeof(data) / sizeof(data[0]);
    if (index < 0 || index >= bufferSize) return;
    
    std::uniform_int_distribution<int> offsetDist(-scatterRadius, scatterRadius);
    int targetIndex = std::max(0, std::min(bufferSize - 1, index + offsetDist(rng)));
    
    if (index != targetIndex) {
        std::swap(data[index], data[targetIndex]);
    }
}

void CorruptedDrawBuffer::bleedColor(int sourceIndex, int targetIndex) {
    int bufferSize = sizeof(data) / sizeof(data[0]);
    if (sourceIndex < 0 || sourceIndex >= bufferSize || 
        targetIndex < 0 || targetIndex >= bufferSize) return;
    
    // Copy color attributes from source to target while keeping character
    auto sourceCell = data[sourceIndex];
    auto targetCell = data[targetIndex];
    
    // Blend or copy the color attributes
    TScreenCell newCell;
    newCell._ch = targetCell._ch;
    newCell.attr = sourceCell.attr;
    data[targetIndex] = newCell;
}

int CorruptedDrawBuffer::getRandomOffset(int maxOffset) {
    std::uniform_int_distribution<int> dist(-maxOffset, maxOffset);
    return dist(rng);
}

/*---------------------------------------------------------*/
/* GlitchEngine Implementation                             */
/*---------------------------------------------------------*/

GlitchEngine::GlitchEngine() : rng(std::random_device{}()) {
    initializeRandomization();
}

GlitchEngine::~GlitchEngine() {
}

void GlitchEngine::enableGlitchMode(bool enabled) {
    glitchEnabled = enabled;
    if (enabled) {
        generateNewSeed();
    }
}

void GlitchEngine::setGlitchParams(const GlitchParams& params) {
    currentParams = params;
    if (params.seed != 0) {
        rng.seed(params.seed);
    }
}

void GlitchEngine::corruptView(TView* view) {
    if (!glitchEnabled || !view) return;
    
    corruptionCount++;
    
    // Simulate the buffer reassignment race condition
    if (currentParams.enableBufferDesync) {
        // This would require deeper integration with TVision's internals
        // For now, we'll focus on drawing corruption
    }
}

void GlitchEngine::corruptDrawBuffer(TDrawBuffer& buffer) {
    if (!glitchEnabled) return;
    
    // Apply various corruption patterns based on parameters
    if (currentParams.scatterIntensity > 0.0f) {
        applyScatterPattern(buffer);
    }
    
    if (currentParams.colorBleedChance > 0.0f) {
        applyColorBleedPattern(buffer);
    }
    
    corruptionCount++;
}

void GlitchEngine::simulateResizeCorruption(TView* view) {
    if (!glitchEnabled || !view) return;
    
    // Simulate the dimension corruption that happens during resize
    TRect bounds = view->getBounds();
    int width = bounds.b.x - bounds.a.x;
    int height = bounds.b.y - bounds.a.y;
    
    applyDimensionDesync(view, width, height);
    
    // Create a modified bounds that simulates the race condition
    if (currentParams.dimensionCorruption > 0.0f) {
        std::uniform_real_distribution<float> dist(0.8f, 1.2f);
        width = static_cast<int>(width * dist(rng));
        height = static_cast<int>(height * dist(rng));
    }
}

void GlitchEngine::applyDimensionDesync(TView* view, int& width, int& height) {
    if (!glitchEnabled) return;
    
    if (currentParams.dimensionCorruption > 0.0f) {
        std::uniform_real_distribution<float> corruptionDist(
            1.0f - currentParams.dimensionCorruption, 
            1.0f + currentParams.dimensionCorruption
        );
        
        width = static_cast<int>(width * corruptionDist(rng));
        height = static_cast<int>(height * corruptionDist(rng));
        
        // Clamp to reasonable bounds
        width = std::max(1, std::min(200, width));
        height = std::max(1, std::min(60, height));
    }
}

void GlitchEngine::applyScatterPattern(TDrawBuffer& buffer) {
    // This is a simplified version - full implementation would need
    // access to TDrawBuffer's internal data structure
    
    std::uniform_real_distribution<float> chanceDist(0.0f, 1.0f);
    if (chanceDist(rng) < currentParams.scatterIntensity) {
        // Scatter effect would be applied here
        // Implementation depends on TDrawBuffer internal structure
    }
}

void GlitchEngine::applyColorBleedPattern(TDrawBuffer& buffer) {
    // Color bleeding implementation
    std::uniform_real_distribution<float> chanceDist(0.0f, 1.0f);
    if (chanceDist(rng) < currentParams.colorBleedChance) {
        // Color bleed effect would be applied here
    }
}

void GlitchEngine::applyDiagonalScatter(TDrawBuffer& buffer) {
    // Diagonal scatter pattern that mimics resize artifacts
    // Implementation would create diagonal streaking effects
}

void GlitchEngine::applyRadialDistortion(TDrawBuffer& buffer, int centerX, int centerY) {
    // Radial distortion from center point
    // Useful for simulating buffer overflow artifacts
}

std::string GlitchEngine::captureGlitchedFrame(TView* view) {
    if (!view) return "";
    
    // This would need deep TVision integration to capture actual frame content
    // For now, return placeholder
    std::ostringstream oss;
    oss << "=== GLITCHED FRAME CAPTURE ===" << std::endl;
    oss << "Corruption Count: " << corruptionCount << std::endl;
    oss << "Scatter Intensity: " << currentParams.scatterIntensity << std::endl;
    oss << "Color Bleed Chance: " << currentParams.colorBleedChance << std::endl;
    oss << "============================" << std::endl;
    
    return oss.str();
}

std::string GlitchEngine::captureAsPlainText(TView* view) {
    return captureGlitchedFrame(view); // Simplified for now
}

std::string GlitchEngine::captureAsAnsiEscapes(TView* view) {
    return captureGlitchedFrame(view); // Simplified for now
}

void GlitchEngine::updateAnimation() {
    if (!currentParams.animateCorruption) return;
    
    auto now = std::chrono::high_resolution_clock::now();
    static auto lastUpdate = now;
    auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - lastUpdate).count();
    
    animationTime += elapsed * animationSpeed * 0.001f;
    lastUpdate = now;
    
    // Update corruption parameters based on animation time
    updateCorruptionParameters();
}

void GlitchEngine::resetCorruption() {
    corruptionCount = 0;
    animationTime = 0.0f;
    generateNewSeed();
}

void GlitchEngine::generateNewSeed() {
    if (currentParams.seed == 0) {
        rng.seed(std::random_device{}());
    } else {
        rng.seed(currentParams.seed);
    }
}

float GlitchEngine::getCorruptionIntensity() const {
    return (currentParams.scatterIntensity + currentParams.colorBleedChance + 
            currentParams.dimensionCorruption + currentParams.partialDrawChance) / 4.0f;
}

void GlitchEngine::initializeRandomization() {
    generateNewSeed();
}

void GlitchEngine::updateCorruptionParameters() {
    if (!currentParams.animateCorruption) return;
    
    // Animate corruption parameters over time
    float wave = std::sin(animationTime * 2.0f) * 0.5f + 0.5f; // 0.0 to 1.0 wave
    
    // Vary scatter intensity over time
    currentParams.scatterIntensity = wave * 0.8f;
    currentParams.colorBleedChance = (1.0f - wave) * 0.6f;
}

void GlitchEngine::corruptCharacterPosition(TDrawBuffer& buffer, int index) {
    // Character position corruption implementation
}

void GlitchEngine::corruptColorAttributes(TDrawBuffer& buffer, int index) {
    // Color attribute corruption implementation  
}

TColorAttr GlitchEngine::blendColors(TColorAttr color1, TColorAttr color2, float ratio) {
    // Color blending for corruption effects
    return color1; // Simplified for now
}

void GlitchEngine::injectCoordinateError(int& x, int& y, int maxError) {
    std::uniform_int_distribution<int> errorDist(-maxError, maxError);
    x += errorDist(rng);
    y += errorDist(rng);
}

void GlitchEngine::simulateBufferPointerError(TDrawBuffer& buffer) {
    // Simulate the buffer pointer reassignment race condition
}

void GlitchEngine::generateScatterField(std::vector<int>& offsets, int size) {
    offsets.resize(size);
    std::uniform_int_distribution<int> offsetDist(-currentParams.scatterRadius, currentParams.scatterRadius);
    
    for (int i = 0; i < size; i++) {
        offsets[i] = offsetDist(rng);
    }
}

void GlitchEngine::generateColorBleedMap(std::vector<int>& sources, std::vector<int>& targets) {
    // Generate color bleed mapping
    int bleedCount = static_cast<int>(sources.size() * currentParams.colorBleedChance);
    
    sources.resize(bleedCount);
    targets.resize(bleedCount);
    
    std::uniform_int_distribution<int> indexDist(0, static_cast<int>(sources.size()) - 1);
    std::uniform_int_distribution<int> offsetDist(1, currentParams.colorBleedDistance);
    
    for (int i = 0; i < bleedCount; i++) {
        sources[i] = indexDist(rng);
        targets[i] = sources[i] + offsetDist(rng);
    }
}