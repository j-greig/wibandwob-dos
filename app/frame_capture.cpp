/*---------------------------------------------------------*/
/*                                                         */
/*   frame_capture.cpp - TUI Frame Capture & Text Export  */
/*   Implementation of frame capture and export system    */
/*                                                         */
/*---------------------------------------------------------*/

#include "frame_capture.h"
#include <chrono>
#include <iomanip>
#include <fstream>
#include <algorithm>
#include <regex>

/*---------------------------------------------------------*/
/* ANSI escape codes                                       */
/*---------------------------------------------------------*/
const std::string FrameCapture::ANSI_RESET = "\033[0m";
const std::string FrameCapture::ANSI_CLEAR_SCREEN = "\033[2J";
const std::string FrameCapture::ANSI_CURSOR_HOME = "\033[H";

/*---------------------------------------------------------*/
/* Global instance                                         */
/*---------------------------------------------------------*/
FrameCapture* globalFrameCapture = nullptr;

FrameCapture& getFrameCapture() {
    if (!globalFrameCapture) {
        globalFrameCapture = new FrameCapture();
    }
    return *globalFrameCapture;
}

/*---------------------------------------------------------*/
/* CapturedFrame Implementation                            */
/*---------------------------------------------------------*/

TScreenCell CapturedFrame::getCell(int x, int y) const {
    if (!isValidPosition(x, y)) {
        TScreenCell empty;
        ::setCell(empty, ' ', TColorAttr{});
        return empty;
    }
    return cells[y * width + x];
}

void CapturedFrame::setCell(int x, int y, const TScreenCell& cell) {
    if (isValidPosition(x, y)) {
        cells[y * width + x] = cell;
    }
}

bool CapturedFrame::isValidPosition(int x, int y) const {
    return x >= 0 && x < width && y >= 0 && y < height;
}

void CapturedFrame::clear() {
    cells.clear();
    TScreenCell empty;
    ::setCell(empty, ' ', TColorAttr{});
    cells.resize(width * height, empty);
    corruptedCellCount = 0;
    corruptionIntensity = 0.0f;
    glitchPattern.clear();
}

/*---------------------------------------------------------*/
/* FrameCapture Implementation                             */
/*---------------------------------------------------------*/

FrameCapture::FrameCapture() {
    defaultOptions.format = CaptureFormat::PlainText;
    defaultOptions.includeColors = true;
    defaultOptions.preserveSpaces = true;
    defaultOptions.addTimestamp = true;
}

FrameCapture::~FrameCapture() {
}

CapturedFrame FrameCapture::captureView(TView* view) {
    CapturedFrame frame;
    
    if (!view) {
        return frame;
    }
    
    TRect bounds = view->getBounds();
    frame.width = bounds.b.x - bounds.a.x;
    frame.height = bounds.b.y - bounds.a.y;
    frame.timestamp = getCurrentTimestamp();
    
    captureViewBuffer(view, frame);
    analyzeCorruption(frame);
    
    return frame;
}

CapturedFrame FrameCapture::captureScreen() {
    CapturedFrame frame;
    
    frame.width = TScreen::screenWidth;
    frame.height = TScreen::screenHeight;
    frame.timestamp = getCurrentTimestamp();
    
    captureScreenBuffer(frame);
    analyzeCorruption(frame);
    
    return frame;
}

CapturedFrame FrameCapture::captureRegion(int x, int y, int width, int height) {
    CapturedFrame frame;
    
    frame.width = width;
    frame.height = height;
    frame.timestamp = getCurrentTimestamp();
    frame.cells.resize(width * height);
    
    // Capture the specified region
    for (int row = 0; row < height; row++) {
        for (int col = 0; col < width; col++) {
            TScreenCell cell = readScreenCell(x + col, y + row);
            frame.setCell(col, row, cell);
        }
    }
    
    analyzeCorruption(frame);
    return frame;
}

std::string FrameCapture::exportFrame(const CapturedFrame& frame, const CaptureOptions& options) {
    switch (options.format) {
        case CaptureFormat::PlainText:
            return exportAsPlainText(frame, options);
        case CaptureFormat::AnsiEscapes:
            return exportAsAnsi(frame, options);
        case CaptureFormat::Html:
            return exportAsHtml(frame, options);
        case CaptureFormat::Json:
            return exportAsJson(frame, options);
        case CaptureFormat::Clipboard:
            return formatForClipboard(frame);
        default:
            return exportAsPlainText(frame, options);
    }
}

std::string FrameCapture::exportAsPlainText(const CapturedFrame& frame, const CaptureOptions& options) {
    std::ostringstream oss;
    
    if (options.addTimestamp) {
        oss << "=== Frame Captured: " << frame.timestamp << " ===" << std::endl;
    }
    
    if (options.includeMetadata) {
        oss << "Size: " << frame.width << "x" << frame.height << std::endl;
        oss << "Corruption: " << frame.corruptedCellCount << " cells (" 
            << std::fixed << std::setprecision(1) << (frame.corruptionIntensity * 100.0f) 
            << "%)" << std::endl;
        if (!frame.glitchPattern.empty()) {
            oss << "Pattern: " << frame.glitchPattern << std::endl;
        }
        oss << std::string(50, '=') << std::endl;
    }
    
    // Export character data
    for (int y = 0; y < frame.height; y++) {
        for (int x = 0; x < frame.width; x++) {
            TScreenCell cell = frame.getCell(x, y);
            std::string s = screenCellToText(cell);
            
            if (options.addCorruptionMarkers && isCellCorrupted(cell, x, y)) {
                oss << options.corruptionMarker;
            } else if (s == " " && !options.preserveSpaces) {
                // Skip trailing spaces unless preserving
                continue;
            } else {
                oss << s;
            }
        }
        oss << std::endl;
    }
    
    return oss.str();
}

std::string FrameCapture::exportAsAnsi(const CapturedFrame& frame, const CaptureOptions& options) {
    std::ostringstream oss;
    
    if (options.addTimestamp) {
        oss << ANSI_CLEAR_SCREEN << ANSI_CURSOR_HOME;
        oss << "=== ANSI Frame: " << frame.timestamp << " ===" << std::endl;
    }
    
    TScreenCell prevCell;
    ::setCell(prevCell, ' ', TColorAttr{});
    
    for (int y = 0; y < frame.height; y++) {
        for (int x = 0; x < frame.width; x++) {
            TScreenCell cell = frame.getCell(x, y);
            
            if (options.includeColors) {
                std::string ansiCode = cellToAnsi(cell, &prevCell);
                if (!ansiCode.empty()) {
                    oss << ansiCode;
                }
            }
            
            std::string s = screenCellToText(cell);
            if (options.addCorruptionMarkers && isCellCorrupted(cell, x, y)) {
                oss << "\033[31m" << options.corruptionMarker << "\033[0m"; // Red corruption marker
            } else {
                oss << s;
            }
            
            prevCell = cell;
        }
        oss << std::endl;
    }
    
    if (options.includeColors) {
        oss << ANSI_RESET;
    }
    
    return oss.str();
}

std::string FrameCapture::exportAsHtml(const CapturedFrame& frame, const CaptureOptions& options) {
    std::ostringstream oss;
    
    oss << "<!DOCTYPE html>" << std::endl;
    oss << "<html><head>" << std::endl;
    oss << "<title>Captured Frame - " << frame.timestamp << "</title>" << std::endl;
    oss << "<style>" << std::endl;
    oss << "body { font-family: 'Courier New', monospace; background: black; color: white; }" << std::endl;
    oss << ".frame { white-space: pre; line-height: 1.2; }" << std::endl;
    oss << ".corruption { background: red; color: yellow; }" << std::endl;
    oss << "</style>" << std::endl;
    oss << "</head><body>" << std::endl;
    
    if (options.addTimestamp) {
        oss << "<h3>Frame Captured: " << frame.timestamp << "</h3>" << std::endl;
    }
    
    if (options.includeMetadata) {
        oss << "<p>Size: " << frame.width << "x" << frame.height 
            << ", Corruption: " << frame.corruptedCellCount << " cells</p>" << std::endl;
    }
    
    oss << "<div class=\"frame\">" << std::endl;
    
    for (int y = 0; y < frame.height; y++) {
        for (int x = 0; x < frame.width; x++) {
            TScreenCell cell = frame.getCell(x, y);
            std::string s = screenCellToText(cell);
            
            if (options.addCorruptionMarkers && isCellCorrupted(cell, x, y)) {
                oss << "<span class=\"corruption\">" << escapeHtml(s) << "</span>";
            } else {
                oss << cellToHtml(cell);
            }
        }
        oss << std::endl;
    }
    
    oss << "</div>" << std::endl;
    oss << "</body></html>" << std::endl;
    
    return oss.str();
}

std::string FrameCapture::exportAsJson(const CapturedFrame& frame, const CaptureOptions& options) {
    std::ostringstream oss;
    
    oss << "{" << std::endl;
    oss << "  \"timestamp\": \"" << frame.timestamp << "\"," << std::endl;
    oss << "  \"width\": " << frame.width << "," << std::endl;
    oss << "  \"height\": " << frame.height << "," << std::endl;
    oss << "  \"corruptedCells\": " << frame.corruptedCellCount << "," << std::endl;
    oss << "  \"corruptionIntensity\": " << frame.corruptionIntensity << "," << std::endl;
    oss << "  \"glitchPattern\": \"" << frame.glitchPattern << "\"," << std::endl;
    oss << "  \"cells\": [" << std::endl;
    
    for (int y = 0; y < frame.height; y++) {
        oss << "    [";
        for (int x = 0; x < frame.width; x++) {
            TScreenCell cell = frame.getCell(x, y);
            std::string s = screenCellToText(cell);
            
            oss << "{\"char\":\"" << escapeHtml(s) << "\"";
            if (options.includeColors) {
                // Add color information (simplified)
                oss << ",\"color\":" << static_cast<int>(cell.attr);
            }
            if (options.includePositions) {
                oss << ",\"x\":" << x << ",\"y\":" << y;
            }
            oss << "}";
            if (x < frame.width - 1) oss << ",";
        }
        oss << "]";
        if (y < frame.height - 1) oss << ",";
        oss << std::endl;
    }
    
    oss << "  ]" << std::endl;
    oss << "}" << std::endl;
    
    return oss.str();
}

bool FrameCapture::copyToClipboard(const CapturedFrame& frame, const CaptureOptions& options) {
    std::string content = formatForClipboard(frame);
    
    // Platform-specific clipboard implementation would go here
    // For now, return false indicating clipboard not implemented
    return false;
}

std::string FrameCapture::formatForClipboard(const CapturedFrame& frame) {
    CaptureOptions clipboardOptions = defaultOptions;
    clipboardOptions.format = CaptureFormat::PlainText;
    clipboardOptions.preserveSpaces = true;
    clipboardOptions.addTimestamp = false;
    clipboardOptions.includeMetadata = false;
    
    return exportAsPlainText(frame, clipboardOptions);
}

bool FrameCapture::saveFrame(const CapturedFrame& frame, const std::string& filename, const CaptureOptions& options) {
    std::ofstream file(filename);
    if (!file.is_open()) {
        return false;
    }
    
    std::string content = exportFrame(frame, options);
    file << content;
    file.close();
    
    return true;
}

void FrameCapture::analyzeCorruption(CapturedFrame& frame) {
    auto corruptedCells = findCorruptedCells(frame);
    frame.corruptedCellCount = static_cast<int>(corruptedCells.size());
    frame.corruptionIntensity = calculateCorruptionIntensity(frame);
    frame.glitchPattern = identifyCorruptionPattern(frame);
}

std::vector<std::pair<int, int>> FrameCapture::findCorruptedCells(const CapturedFrame& frame) {
    std::vector<std::pair<int, int>> corrupted;
    
    for (int y = 0; y < frame.height; y++) {
        for (int x = 0; x < frame.width; x++) {
            TScreenCell cell = frame.getCell(x, y);
            if (isCellCorrupted(cell, x, y)) {
                corrupted.emplace_back(x, y);
            }
        }
    }
    
    return corrupted;
}

float FrameCapture::calculateCorruptionIntensity(const CapturedFrame& frame) {
    if (frame.width * frame.height == 0) return 0.0f;
    
    return static_cast<float>(frame.corruptedCellCount) / 
           static_cast<float>(frame.width * frame.height);
}

void FrameCapture::captureScreenBuffer(CapturedFrame& frame) {
    frame.cells.resize(frame.width * frame.height);
    
    for (int y = 0; y < frame.height; y++) {
        for (int x = 0; x < frame.width; x++) {
            TScreenCell cell = readScreenCell(x, y);
            frame.setCell(x, y, cell);
        }
    }
}

void FrameCapture::captureViewBuffer(TView* view, CapturedFrame& frame) {
    // This is simplified - a full implementation would need deeper TVision integration
    frame.clear();
    
    // For now, fall back to screen buffer capture
    TRect bounds = view->getBounds();
    for (int y = 0; y < frame.height; y++) {
        for (int x = 0; x < frame.width; x++) {
            TScreenCell cell = readScreenCell(bounds.a.x + x, bounds.a.y + y);
            frame.setCell(x, y, cell);
        }
    }
}

TScreenCell FrameCapture::readScreenCell(int x, int y) {
    // Direct access to TScreen's raw buffer
    if (x < 0 || x >= TScreen::screenWidth || y < 0 || y >= TScreen::screenHeight) {
        TScreenCell empty;
        ::setCell(empty, ' ', TColorAttr{});
        return empty;
    }
    
    // Access the actual screen buffer directly
    if (TScreen::screenBuffer) {
        return TScreen::screenBuffer[y * TScreen::screenWidth + x];
    }
    
    // Fallback if buffer not available
    TScreenCell fallback;
    ::setCell(fallback, '?', TColorAttr{});
    return fallback;
}

std::string FrameCapture::cellToAnsi(const TScreenCell& cell, const TScreenCell* prevCell) {
    std::ostringstream oss;
    
    // Simple ANSI color implementation
    if (!prevCell || cell.attr != prevCell->attr) {
        // Add ANSI color codes based on cell attributes
        oss << "\033[0m"; // Reset first
        // Add specific color codes here based on cell.attr
    }
    
    return oss.str();
}

std::string FrameCapture::cellToHtml(const TScreenCell& cell) {
    std::string result = escapeHtml(screenCellToText(cell));
    
    // Add color styling based on cell attributes
    // Simplified implementation
    return result;
}

std::string FrameCapture::escapeHtml(const std::string& text) {
    std::string result = text;
    std::regex htmlChars("[&<>\"']");
    
    // Simple HTML escaping
    for (auto& c : result) {
        switch (c) {
            case '&': c = '&'; break; // This needs proper replacement
            case '<': c = '<'; break; // This needs proper replacement  
            case '>': c = '>'; break; // This needs proper replacement
        }
    }
    
    return result;
}

bool FrameCapture::isCellCorrupted(const TScreenCell& cell, int x, int y) {
    // Heuristics for detecting corruption
    // This is simplified - real implementation would have better detection
    std::string s = screenCellToText(cell);
    if (s.empty())
        return false;
    if (s == " ")
        return false;
    unsigned char c = (unsigned char) s[0];
    if (c < 32 && c != ' ' && c != '\t' && c != '\n')
        return true;
    
    return false;
}

std::string FrameCapture::identifyCorruptionPattern(const CapturedFrame& frame) {
    // Analyze corruption patterns
    if (frame.corruptedCellCount == 0) return "None";
    if (frame.corruptionIntensity < 0.1f) return "Light Scatter";
    if (frame.corruptionIntensity < 0.3f) return "Moderate Corruption";
    return "Heavy Distortion";
}

std::string FrameCapture::getCurrentTimestamp() {
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()) % 1000;
    
    std::ostringstream oss;
    oss << std::put_time(std::localtime(&time_t), "%Y-%m-%d %H:%M:%S");
    oss << "." << std::setfill('0') << std::setw(3) << ms.count();
    return oss.str();
}

std::string FrameCapture::screenCellToText(const TScreenCell& cell) {
    const TCellChar &ch = cell._ch;
    if (ch.isWideCharTrail())
        return " ";
    TStringView tv = ch.getText();
    if (tv.empty())
        return " ";
    std::string s(tv.data(), tv.size());
    if (s.size() == 1 && s[0] == '\0')
        return " ";
    return s;
}

bool FrameCapture::isVisibleCharacter(char c) {
    return c >= 32 && c <= 126;
}

/*---------------------------------------------------------*/
/* Convenience functions                                   */
/*---------------------------------------------------------*/

std::string quickCaptureScreen(CaptureFormat format) {
    CaptureOptions options;
    options.format = format;
    
    auto frame = getFrameCapture().captureScreen();
    return getFrameCapture().exportFrame(frame, options);
}

std::string quickCaptureView(TView* view, CaptureFormat format) {
    if (!view) return "";
    
    CaptureOptions options;
    options.format = format;
    
    auto frame = getFrameCapture().captureView(view);
    return getFrameCapture().exportFrame(frame, options);
}

bool quickSaveScreen(const std::string& filename, CaptureFormat format) {
    CaptureOptions options;
    options.format = format;
    
    auto frame = getFrameCapture().captureScreen();
    return getFrameCapture().saveFrame(frame, filename, options);
}

std::string captureGlitchedFrame(TView* view) {
    CaptureOptions options;
    options.format = CaptureFormat::AnsiEscapes;
    options.includeMetadata = true;
    options.addCorruptionMarkers = true;
    
    CapturedFrame frame;
    if (view) {
        frame = getFrameCapture().captureView(view);
    } else {
        frame = getFrameCapture().captureScreen();
    }
    
    return getFrameCapture().exportFrame(frame, options);
}

std::string captureWithCorruptionHighlight(TView* view) {
    CaptureOptions options;
    options.format = CaptureFormat::PlainText;
    options.addCorruptionMarkers = true;
    options.highlightCorruption = true;
    options.corruptionMarker = "█";
    
    CapturedFrame frame;
    if (view) {
        frame = getFrameCapture().captureView(view);
    } else {
        frame = getFrameCapture().captureScreen();
    }
    
    return getFrameCapture().exportFrame(frame, options);
}

bool saveGlitchedFrame(const std::string& filename, TView* view) {
    CaptureOptions options;
    options.format = CaptureFormat::AnsiEscapes;
    options.includeMetadata = true;
    options.addTimestamp = true;
    
    CapturedFrame frame;
    if (view) {
        frame = getFrameCapture().captureView(view);
    } else {
        frame = getFrameCapture().captureScreen();
    }
    
    return getFrameCapture().saveFrame(frame, filename, options);
}
