/*---------------------------------------------------------*/
/*                                                         */
/*   gradient.h - Gradient Rendering Views                */
/*   For Turbo Vision Applications                        */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef GRADIENT_H
#define GRADIENT_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TColorAttr
#include <tvision/tv.h>
#include <cmath>

/*---------------------------------------------------------*/
/* TGradientView - Base class for gradient rendering      */
/*---------------------------------------------------------*/
class TGradientView : public TView
{
public:
    TGradientView(const TRect& bounds, 
                  TColorRGB startColor = TColorRGB(0x00, 0x00, 0x00),
                  TColorRGB endColor = TColorRGB(0xFF, 0xFF, 0xFF));
    
    virtual void draw() = 0;
    
    void setColors(TColorRGB start, TColorRGB end);
    
protected:
    TColorRGB startColor;
    TColorRGB endColor;
    
    // Linear interpolation between two colors
    static TColorRGB interpolate(TColorRGB start, TColorRGB end, float t);
    
    // Get interpolated color at position t (0.0 to 1.0)
    TColorRGB getGradientColor(float t) const;
};

/*---------------------------------------------------------*/
/* THorizontalGradientView - Left to right gradient       */
/*---------------------------------------------------------*/
class THorizontalGradientView : public TGradientView
{
public:
    THorizontalGradientView(const TRect& bounds,
                           TColorRGB startColor = TColorRGB(0x00, 0x00, 0xFF),
                           TColorRGB endColor = TColorRGB(0xFF, 0x00, 0xFF));
    
    virtual void draw();
};

/*---------------------------------------------------------*/
/* TVerticalGradientView - Top to bottom gradient         */
/*---------------------------------------------------------*/
class TVerticalGradientView : public TGradientView
{
public:
    TVerticalGradientView(const TRect& bounds,
                         TColorRGB startColor = TColorRGB(0xFF, 0x00, 0x00),
                         TColorRGB endColor = TColorRGB(0xFF, 0xFF, 0x00));
    
    virtual void draw();
};

/*---------------------------------------------------------*/
/* TRadialGradientView - Center to edge gradient          */
/*---------------------------------------------------------*/
class TRadialGradientView : public TGradientView
{
public:
    TRadialGradientView(const TRect& bounds,
                       TColorRGB startColor = TColorRGB(0xFF, 0xFF, 0xFF),
                       TColorRGB endColor = TColorRGB(0x00, 0x00, 0x00));
    
    virtual void draw();
    
private:
    float distance(float x1, float y1, float x2, float y2) const;
};

/*---------------------------------------------------------*/
/* TDiagonalGradientView - Diagonal gradient              */
/*---------------------------------------------------------*/
class TDiagonalGradientView : public TGradientView
{
public:
    TDiagonalGradientView(const TRect& bounds,
                         TColorRGB startColor = TColorRGB(0x00, 0xFF, 0xFF),
                         TColorRGB endColor = TColorRGB(0xFF, 0x00, 0x00));
    
    virtual void draw();
};

#endif // GRADIENT_H