/*---------------------------------------------------------*/
/*                                                         */
/*   frame_file_player_view.h - ASCII frame-file player   */
/*                                                         */
/*   How it works (MVP):                                  */
/*   - Loads a text file once into 'fileData'.            */
/*   - Builds 'frames' as byte spans split by lines       */
/*     exactly equal to "----" (CRLF safe).               */
/*   - Starts a periodic UI timer; on each tick advances  */
/*     'frameIndex' and requests redraw (no threads).     */
/*   - draw(): blits current frame, truncating/padding to */
/*     view width/height.                                 */
/*   - FPS sources (precedence): ctor param > header >    */
/*     default (300 ms).                                   */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef FRAME_FILE_PLAYER_VIEW_H
#define FRAME_FILE_PLAYER_VIEW_H

#define Uses_TView
#define Uses_TGroup
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#define Uses_TScrollBar
#define Uses_TKeys
#include <tvision/tv.h>

#include <string>
#include <vector>

// Background types for enhanced background system
enum class TBackgroundType {
    Solid,
    Transparent,
    VerticalGradient,
    HorizontalGradient,
    RadialGradient,
    DiagonalGradient
};

struct TBackgroundConfig {
    TBackgroundType type = TBackgroundType::Solid;
    int solidColorIndex = 0;        // Index into ANSI color palette for solid backgrounds
    TColorRGB gradientStart = TColorRGB(0xFF, 0x00, 0x00);  // Red default
    TColorRGB gradientEnd = TColorRGB(0x00, 0x00, 0xFF);    // Blue default
};

struct Span { size_t start; size_t end; }; // [start, end)

class FrameFilePlayerView : public TView {
public:
    explicit FrameFilePlayerView(const TRect &bounds, const std::string &path, unsigned periodMs = 300);
    virtual ~FrameFilePlayerView();

    // TView overrides
    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;

    bool ok() const { return loadOk; }
    const std::string &error() const { return errorMsg; }
    
    // Background support (enhanced with gradients and transparency)
    void setBackgroundIndex(int idx);
    int backgroundIndex() const { return bgConfig.solidColorIndex; }
    void setBackgroundConfig(const TBackgroundConfig& config);
    const TBackgroundConfig& getBackgroundConfig() const { return bgConfig; }
    bool openBackgroundDialog();

private:
    // Data
    std::string fileData;
    std::vector<Span> frames;
    size_t frameIndex {0};
    TTimerId timerId {0};
    unsigned periodMs {300};
    bool loadOk {false};
    std::string errorMsg;
    TBackgroundConfig bgConfig; // Enhanced background configuration

    // Helpers
    void startTimer();
    void stopTimer();
    void advanceFrame();
    void loadAndIndex(const std::string &path);
    static size_t nextLineStart(const std::string &s, size_t pos);
    static size_t findLineEnd(const std::string &s, size_t pos, size_t limit);
};

// Simple text file viewer with vertical scrollbar
class TTextFileView : public TGroup
{
public:
    explicit TTextFileView(const TRect &bounds, const std::string &path);
    virtual ~TTextFileView();

    // TView overrides  
    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void changeBounds(const TRect& bounds) override;

    bool ok() const { return loadOk; }
    const std::string &error() const { return errorMsg; }
    
    // Background support (enhanced with gradients and transparency)
    void setBackgroundIndex(int idx);
    int backgroundIndex() const { return bgConfig.solidColorIndex; }
    void setBackgroundConfig(const TBackgroundConfig& config);
    const TBackgroundConfig& getBackgroundConfig() const { return bgConfig; }
    bool openBackgroundDialog();

private:
    std::vector<std::string> lines;
    int topLine {0};
    bool loadOk {false};
    std::string errorMsg;
    TScrollBar *vScrollBar;
    bool needsRedraw {true};
    TBackgroundConfig bgConfig; // Enhanced background configuration

    void loadFile(const std::string &path);
    void setLimit();
};

// Helper function to detect if file contains frame delimiters
bool hasFrameDelimiters(const std::string& filePath);

#endif // FRAME_FILE_PLAYER_VIEW_H
