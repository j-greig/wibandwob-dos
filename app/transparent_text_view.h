/*---------------------------------------------------------*/
/*                                                         */
/*   transparent_text_view.h - Text View with             */
/*   Transparent/Custom Background Support                */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef TRANSPARENT_TEXT_VIEW_H
#define TRANSPARENT_TEXT_VIEW_H

#define Uses_TBackground
#define Uses_TRect
#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TWindow
#define Uses_TFrame
#define Uses_TKeys
#define Uses_TProgram
#define Uses_TDeskTop
#include <tvision/tv.h>

#include <string>
#include <vector>
#include <fstream>

/*---------------------------------------------------------*/
/* TTransparentTextView - Text viewer with custom BG     */
/*---------------------------------------------------------*/

class TTransparentTextView : public TView
{
public:
    TTransparentTextView(const TRect& bounds, const std::string& filePath);
    virtual ~TTransparentTextView() {}

    virtual void draw() override;
    virtual void handleEvent(TEvent& event) override;

    // Background color control
    void setBackgroundColor(TColorRGB color);
    void setBackgroundToDefault();
    TColorRGB getBackgroundColor() const { return bgColor; }
    bool hasCustomBackground() const { return useCustomBg; }

    const std::string& getFileName() const { return fileName; }

private:
    std::vector<std::string> lines;
    std::string fileName;
    TColorRGB bgColor;
    TColorRGB fgColor;
    bool useCustomBg;
    int scrollY;
    int scrollX;

    void loadFile(const std::string& path);
    size_t utf8Length(const std::string& str) const;
};

/*---------------------------------------------------------*/
/* TTransparentTextWindow - Window hosting the view      */
/*---------------------------------------------------------*/

class TTransparentTextWindow : public TWindow
{
public:
    TTransparentTextWindow(const TRect& bounds, const std::string& title,
                          const std::string& filePath);

    TTransparentTextView* getTextView() { return textView; }
    const std::string& getFilePath() const;

    // Override changeBounds for proper redraw
    virtual void changeBounds(const TRect& bounds) override;

private:
    TTransparentTextView* textView;
    static TFrame* initFrame(TRect r);
};

#endif // TRANSPARENT_TEXT_VIEW_H
