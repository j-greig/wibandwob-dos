/*---------------------------------------------------------*/
/*                                                         */
/*   gradient.cpp - Gradient Rendering Implementation     */
/*   For Turbo Vision Applications                        */
/*                                                         */
/*---------------------------------------------------------*/

#include "gradient.h"
#include <algorithm>

/*---------------------------------------------------------*/
/* TGradientView Implementation                           */
/*---------------------------------------------------------*/

TGradientView::TGradientView(const TRect& bounds, 
                           TColorRGB startColor,
                           TColorRGB endColor) :
    TView(bounds),
    startColor(startColor),
    endColor(endColor)
{
    options |= ofFramed;
    growMode = gfGrowHiX | gfGrowHiY;
}

void TGradientView::setColors(TColorRGB start, TColorRGB end)
{
    startColor = start;
    endColor = end;
    drawView();
}

TColorRGB TGradientView::interpolate(TColorRGB start, TColorRGB end, float t)
{
    // Clamp t to [0, 1]
    t = std::max(0.0f, std::min(1.0f, t));
    
    uint8_t r = static_cast<uint8_t>(start.r + (end.r - start.r) * t);
    uint8_t g = static_cast<uint8_t>(start.g + (end.g - start.g) * t);
    uint8_t b = static_cast<uint8_t>(start.b + (end.b - start.b) * t);
    
    return TColorRGB(r, g, b);
}

TColorRGB TGradientView::getGradientColor(float t) const
{
    return interpolate(startColor, endColor, t);
}

/*---------------------------------------------------------*/
/* THorizontalGradientView Implementation                 */
/*---------------------------------------------------------*/

THorizontalGradientView::THorizontalGradientView(const TRect& bounds,
                                               TColorRGB startColor,
                                               TColorRGB endColor) :
    TGradientView(bounds, startColor, endColor)
{
}

void THorizontalGradientView::draw()
{
    TDrawBuffer b;
    const char fillChar = '\xDB';  // Full block character
    
    for (int y = 0; y < size.y; y++)
    {
        // Horizontal gradient: colors change horizontally (left to right)
        float t = (size.y > 1) ? static_cast<float>(y) / (size.y - 1) : 0.0f;
        TColorRGB color = getGradientColor(t);
        TColorAttr attr(color, color);
        
        // Fill entire row with same color
        b.moveChar(0, fillChar, attr, size.x);
        writeLine(0, y, size.x, 1, b);
    }
}

/*---------------------------------------------------------*/
/* TVerticalGradientView Implementation                   */
/*---------------------------------------------------------*/

TVerticalGradientView::TVerticalGradientView(const TRect& bounds,
                                           TColorRGB startColor,
                                           TColorRGB endColor) :
    TGradientView(bounds, startColor, endColor)
{
}

void TVerticalGradientView::draw()
{
    TDrawBuffer b;
    const char fillChar = '\xDB';  // Full block character
    
    for (int y = 0; y < size.y; y++)
    {
        // Vertical gradient: colors change vertically (top to bottom)
        // Calculate colors for each column
        for (int x = 0; x < size.x; x++)
        {
            float t = (size.x > 1) ? static_cast<float>(x) / (size.x - 1) : 0.0f;
            TColorRGB color = getGradientColor(t);
            TColorAttr attr(color, color);
            b.moveChar(x, fillChar, attr, 1);
        }
        writeLine(0, y, size.x, 1, b);
    }
}

/*---------------------------------------------------------*/
/* TRadialGradientView Implementation                     */
/*---------------------------------------------------------*/

TRadialGradientView::TRadialGradientView(const TRect& bounds,
                                       TColorRGB startColor,
                                       TColorRGB endColor) :
    TGradientView(bounds, startColor, endColor)
{
}

float TRadialGradientView::distance(float x1, float y1, float x2, float y2) const
{
    float dx = x2 - x1;
    float dy = y2 - y1;
    return std::sqrt(dx * dx + dy * dy);
}

void TRadialGradientView::draw()
{
    TDrawBuffer b;
    const char fillChar = '\xDB';  // Full block character
    
    // Center point
    float centerX = size.x / 2.0f;
    float centerY = size.y / 2.0f;
    
    // Maximum distance from center to corner
    float maxDist = distance(0, 0, centerX, centerY);
    
    for (int y = 0; y < size.y; y++)
    {
        for (int x = 0; x < size.x; x++)
        {
            float dist = distance(x, y, centerX, centerY);
            float t = (maxDist > 0) ? dist / maxDist : 0.0f;
            TColorRGB color = getGradientColor(t);
            TColorAttr attr(color, color);
            b.moveChar(x, fillChar, attr, 1);
        }
        writeLine(0, y, size.x, 1, b);
    }
}

/*---------------------------------------------------------*/
/* TDiagonalGradientView Implementation                   */
/*---------------------------------------------------------*/

TDiagonalGradientView::TDiagonalGradientView(const TRect& bounds,
                                           TColorRGB startColor,
                                           TColorRGB endColor) :
    TGradientView(bounds, startColor, endColor)
{
}

void TDiagonalGradientView::draw()
{
    TDrawBuffer b;
    const char fillChar = '\xDB';  // Full block character
    
    // Maximum diagonal distance
    float maxDiag = size.x + size.y - 2;
    
    for (int y = 0; y < size.y; y++)
    {
        for (int x = 0; x < size.x; x++)
        {
            // Distance along diagonal from top-left
            float diagDist = x + y;
            float t = (maxDiag > 0) ? diagDist / maxDiag : 0.0f;
            TColorRGB color = getGradientColor(t);
            TColorAttr attr(color, color);
            b.moveChar(x, fillChar, attr, 1);
        }
        writeLine(0, y, size.x, 1, b);
    }
}