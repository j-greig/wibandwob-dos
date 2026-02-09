/*---------------------------------------------------------*/
/*                                                         */
/*   test_pattern.h - Reusable Test Pattern Module        */
/*   For Turbo Vision Applications                        */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef TEST_PATTERN_H
#define TEST_PATTERN_H

#define Uses_TDrawBuffer
#define Uses_TColorAttr
#include <tvision/tv.h>

class TTestPattern
{
public:
    // Pattern display modes
    enum PatternMode {
        pmTiled,        // Pattern resets at start of each row (cropped at edges)
        pmContinuous    // Pattern flows continuously like text (wraps at edges)
    };
    
    // Draw one row of the test pattern at position y in buffer
    static void drawPatternRow(TDrawBuffer& b, int row, int width, int offset = 0);
    
    // Get pattern height (number of rows in pattern)
    static int getPatternHeight() { return 2; }
    
    // Block character for drawing
    static const char blockChar = '\xDB';  // ASCII 219 - Full block
    
private:
    // 16 ANSI colors
    static const TColorAttr ansiColors[16];
    
    // 16 grayscale shades
    static const TColorAttr grayShades[16];
};

#endif // TEST_PATTERN_H