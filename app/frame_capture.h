/*---------------------------------------------------------*/
/*                                                         */
/*   frame_capture.h - TUI Frame Capture & Text Export    */
/*   System for capturing and exporting glitched frames   */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef FRAME_CAPTURE_H
#define FRAME_CAPTURE_H

#define Uses_TView
#define Uses_TScreen
#define Uses_TScreenCell
#define Uses_TColorAttr
#define Uses_TRect
#include <tvision/tv.h>
#include <string>
#include <vector>
#include <sstream>

/*---------------------------------------------------------*/
/* Frame capture modes and options                        */
/*---------------------------------------------------------*/
enum class CaptureFormat {
    PlainText,      // Just characters, no colors
    AnsiEscapes,    // ANSI escape sequences for colors
    Html,           // HTML with CSS styling
    Json,           // Structured JSON with metadata
    Clipboard       // Formatted for clipboard paste
};

struct CaptureOptions {
    CaptureFormat format = CaptureFormat::PlainText;
    bool includeColors = true;
    bool includePositions = false;
    bool preserveSpaces = true;
    bool addTimestamp = true;
    bool includeMetadata = false;
    
    // Glitch-specific options
    bool highlightCorruption = false;
    bool addCorruptionMarkers = false;
    std::string corruptionMarker = "█";
};

/*---------------------------------------------------------*/
/* Frame data structure                                    */
/*---------------------------------------------------------*/
struct CapturedFrame {
    int width = 0;
    int height = 0;
    std::vector<TScreenCell> cells;
    std::string timestamp;
    
    // Metadata
    int corruptedCellCount = 0;
    float corruptionIntensity = 0.0f;
    std::string glitchPattern;
    
    // Helper methods
    TScreenCell getCell(int x, int y) const;
    void setCell(int x, int y, const TScreenCell& cell);
    bool isValidPosition(int x, int y) const;
    void clear();
};

/*---------------------------------------------------------*/
/* Frame capture system                                    */
/*---------------------------------------------------------*/
class FrameCapture {
public:
    FrameCapture();
    ~FrameCapture();
    
    // Core capture methods
    CapturedFrame captureView(TView* view);
    CapturedFrame captureScreen();
    CapturedFrame captureRegion(int x, int y, int width, int height);
    
    // Export methods
    std::string exportFrame(const CapturedFrame& frame, const CaptureOptions& options);
    std::string exportAsPlainText(const CapturedFrame& frame, const CaptureOptions& options);
    std::string exportAsAnsi(const CapturedFrame& frame, const CaptureOptions& options);
    std::string exportAsHtml(const CapturedFrame& frame, const CaptureOptions& options);
    std::string exportAsJson(const CapturedFrame& frame, const CaptureOptions& options);
    
    // Clipboard integration
    bool copyToClipboard(const CapturedFrame& frame, const CaptureOptions& options);
    std::string formatForClipboard(const CapturedFrame& frame);
    
    // File operations
    bool saveFrame(const CapturedFrame& frame, const std::string& filename, const CaptureOptions& options);
    bool loadFrame(CapturedFrame& frame, const std::string& filename);
    
    // Frame analysis
    void analyzeCorruption(CapturedFrame& frame);
    std::vector<std::pair<int, int>> findCorruptedCells(const CapturedFrame& frame);
    float calculateCorruptionIntensity(const CapturedFrame& frame);
    
    // Comparison and diff
    CapturedFrame diffFrames(const CapturedFrame& before, const CapturedFrame& after);
    std::string generateDiffReport(const CapturedFrame& before, const CapturedFrame& after);
    
    // Settings
    void setDefaultOptions(const CaptureOptions& options) { defaultOptions = options; }
    const CaptureOptions& getDefaultOptions() const { return defaultOptions; }
    
private:
    CaptureOptions defaultOptions;
    
    // Internal capture helpers
    void captureScreenBuffer(CapturedFrame& frame);
    void captureViewBuffer(TView* view, CapturedFrame& frame);
    TScreenCell readScreenCell(int x, int y);
    
    // Export helpers
    std::string cellToAnsi(const TScreenCell& cell, const TScreenCell* prevCell = nullptr);
    std::string colorToAnsi(TColorAttr color, bool background = false);
    std::string cellToHtml(const TScreenCell& cell);
    std::string colorToHtml(TColorAttr color);
    std::string escapeHtml(const std::string& text);
    
    // Corruption analysis
    bool isCellCorrupted(const TScreenCell& cell, int x, int y);
    std::string identifyCorruptionPattern(const CapturedFrame& frame);
    
    // Utility methods
    std::string getCurrentTimestamp();
    char screenCellToChar(const TScreenCell& cell);
    bool isVisibleCharacter(char c);
    
    // ANSI escape codes
    static const std::string ANSI_RESET;
    static const std::string ANSI_CLEAR_SCREEN;
    static const std::string ANSI_CURSOR_HOME;
};

/*---------------------------------------------------------*/
/* Convenience functions and macros                       */
/*---------------------------------------------------------*/

// Global frame capture instance
extern FrameCapture* globalFrameCapture;
FrameCapture& getFrameCapture();

// Quick capture functions
std::string quickCaptureScreen(CaptureFormat format = CaptureFormat::PlainText);
std::string quickCaptureView(TView* view, CaptureFormat format = CaptureFormat::PlainText);
bool quickSaveScreen(const std::string& filename, CaptureFormat format = CaptureFormat::AnsiEscapes);

// Glitch-aware capture functions
std::string captureGlitchedFrame(TView* view = nullptr);
std::string captureWithCorruptionHighlight(TView* view = nullptr);
bool saveGlitchedFrame(const std::string& filename, TView* view = nullptr);

// Macros for easy integration
#define CAPTURE_CURRENT_SCREEN() quickCaptureScreen()
#define CAPTURE_VIEW(view) quickCaptureView(view)
#define SAVE_GLITCHED_FRAME(filename) saveGlitchedFrame(filename)

#endif // FRAME_CAPTURE_H