/*---------------------------------------------------------*/
/*                                                         */
/*   wwdos_app.cpp - Test Pattern Window Spawner   */
/*   Unlimited resizable windows with test patterns       */
/*                                                         */
/*---------------------------------------------------------*/

#define Uses_TKeys
#define Uses_TApplication
#define Uses_TEvent
#define Uses_TRect
#define Uses_TDialog
#define Uses_TStaticText
#define Uses_TButton
#define Uses_TListBox
#define Uses_TStringCollection
#define Uses_TMenuBar
#define Uses_TMenuBox
#define Uses_TSubMenu
#define Uses_TMenuItem
#define Uses_TMenu
#define Uses_TStatusLine
#define Uses_TStatusItem
#define Uses_TStatusDef
#define Uses_TDeskTop
#define Uses_TWindow
#define Uses_TFrame
#define Uses_TScroller
#define Uses_TScrollBar
#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TText
#define Uses_MsgBox
#define Uses_cmTile
#define Uses_cmCascade
#define Uses_TFileDialog
#define Uses_TBackground
#define Uses_TInputLine
#define Uses_TLabel
#include <tvision/tv.h>

#include "test_pattern.h"
#include "core/json_utils.h"
#include "gradient.h"
#include "ui/ui_helpers.h"
#include "glitch_engine.h"
#include "frame_capture.h"
#include "frame_file_player_view.h"
#include "ascii_image_view.h"
// Animated blocks view/window
#include "animated_blocks_view.h"
// Animated gradient view/window
#include "animated_gradient_view.h"
// Animated score (ASCII score) view/window
#include "animated_score_view.h"
// Generative art: Verse Field
#include "generative_verse_view.h"
// Generative art experiments
#include "generative_orbit_view.h"
#include "generative_mycelium_view.h"
// Generative art: Torus Field
#include "generative_torus_view.h"
// Generative art: Cube Spinner
#include "generative_cube_view.h"
// Generative art: Monster Portal (emoji tiler)
#include "generative_monster_portal_view.h"
// Generative art: Monster Verse (Verse engine + monsters)
#include "generative_monster_verse_view.h"
#include "contour_map_view.h"
#include "generative_lab_view.h"
// Generative art: Monster Cam (Emoji)
#include "generative_monster_cam_view.h"
#include "game_of_life_view.h"
#include "animated_ascii_view.h"
// Generative art: ASCII Cam
// DISABLED: #include "generative_ascii_cam_view.h"
// API-controllable text editor
#include "text_editor_view.h"
// Unified auth config
#include "llm/base/auth_config.h"
// Wib&Wob AI chat interface
#include "wibwob_view.h"
// Scrollbar fix prototypes (test versions)
#include "wibwob_scroll_test.h"
// Custom frame for windows without titles
#include "notitle_frame.h"
#include "windows/frame_animation_window.h"
// Transparent background text view
#include "transparent_text_view.h"
// TUI Browser window
#include "browser_view.h"
// Scramble cat presence
#include "scramble_view.h"
#include "scramble_engine.h"
// Multi-user PartyKit room chat
#include "room_chat_view.h"
// Paint canvas window
#include "paint/paint_window.h"
#include "paint/paint_wwp_codec.h"
// Micropolis ASCII MVP window
#include "micropolis_ascii_view.h"
// Quadra falling blocks game
#include "quadra_view.h"
// Snake game
#include "snake_view.h"
// WibWob Rogue dungeon crawler
#include "rogue_view.h"
// Deep Signal space scanner game
#include "deep_signal_view.h"
// Terminal emulator window (tvterm)
#include "tvterm_view.h"
// Desktop texture & gallery mode
#include "wibwob_background.h"
// App launcher (E011)
#include "app_launcher_view.h"
#include "ascii_gallery_view.h"
#include "figlet_text_view.h"
#include "figlet_utils.h"
// Factory for ASCII grid demo window (implemented in ascii_grid_view.cpp).
class TWindow; TWindow* createAsciiGridDemoWindow(const TRect &bounds);
// #include "mech_window.h" // deferred feature; header not present yet
#include <sstream>
#include <fstream>
#include <string>
#include <cstdlib>
#include <ctime>
#include <cmath>
#include <sys/stat.h>
#include <cstdio>
#include <fstream>
#include <vector>
#include <cstring>
#include <map>
#include <deque>
#include <dirent.h>
#include <algorithm>
// Local API IPC bridge (Unix domain socket)
#include "api_ipc.h"
#include "command_registry.h"
#include "window_type_registry.h"

// Find first existing primer directory across module paths.
// Checks modules-private/*/primers/ then modules/*/primers/ then legacy app/primers/.
std::string findPrimerDir() {
    const char* moduleDirs[] = { "modules-private", "modules" };
    for (const char* base : moduleDirs) {
        DIR* dir = opendir(base);
        if (!dir) continue;
        struct dirent* entry;
        while ((entry = readdir(dir)) != nullptr) {
            if (entry->d_name[0] == '.') continue;
            std::string candidate = std::string(base) + "/" + entry->d_name + "/primers";
            struct stat st;
            if (stat(candidate.c_str(), &st) == 0 && S_ISDIR(st.st_mode)) {
                closedir(dir);
                return candidate;
            }
        }
        closedir(dir);
    }
    // Legacy fallback
    struct stat st;
    if (stat("app/primers", &st) == 0 && S_ISDIR(st.st_mode))
        return "app/primers";
    return "primers";
}

// Configuration - Toggle pattern display mode
// true  = Continuous mode (pattern flows like text, wraps at line ends creating diagonals)
// false = Tiled mode (pattern resets at start of each line, crops at edges)
bool USE_CONTINUOUS_PATTERN = true;  // Made non-const so it can be changed at runtime

static TRect clampToDesktop(TRect bounds, const TRect& desk) {
    const int minW = 10;
    const int minH = 5;
    const int deskW = std::max(1, desk.b.x - desk.a.x);
    const int deskH = std::max(1, desk.b.y - desk.a.y);

    int w = bounds.b.x - bounds.a.x;
    int h = bounds.b.y - bounds.a.y;

    if (w < minW) w = minW;
    if (h < minH) h = minH;
    if (w > deskW) w = deskW;
    if (h > deskH) h = deskH;

    int x = bounds.a.x;
    int y = bounds.a.y;

    if (x + w > desk.b.x) x = desk.b.x - w;
    if (y + h > desk.b.y) y = desk.b.y - h;
    if (x < desk.a.x) x = desk.a.x;
    if (y < desk.a.y) y = desk.a.y;

    return TRect(x, y, x + w, y + h);
}

// Command constants
// File menu commands
const ushort cmNewWindow = 100;
const ushort cmNewGradientH = 102;
const ushort cmNewGradientV = 103;
const ushort cmNewGradientR = 104;
const ushort cmNewGradientD = 105;
const ushort cmNewDonut = 108;
const ushort cmOpenAnimation = 109;
const ushort cmSaveWorkspace = 110;
const ushort cmNewMechs = 111;
const ushort cmOpenWorkspace = 115;
const ushort cmSaveWorkspaceAs = 120;
const ushort cmManageWorkspaces = 280;
const ushort cmRecentWorkspace = 275;  // 275..279
// Future File commands
const ushort cmOpenAnsiArt = 112;
const ushort cmNewPaintCanvas = 113;
const ushort cmNewFigletText = 119;
const ushort cmOpenImageFile = 114;

// Window menu commands
const ushort cmOpenTransparentText = 116;
const ushort cmOpenMonodraw = 118;

// Edit menu commands
const ushort cmScreenshot = 101;
const ushort cmPatternContinuous = 106;
const ushort cmPatternTiled = 107;
// Edit menu commands
const ushort cmSettings = 117;

// View menu commands
const ushort cmZoomIn = 121;
const ushort cmZoomOut = 122;
const ushort cmActualSize = 123;
const ushort cmFullScreen = 124;
const ushort cmTextEditor = 130;
const ushort cmAsciiGridDemo = 132;
const ushort cmAnimatedBlocks = 134;
const ushort cmAnimatedGradient = 135;
const ushort cmAnimatedScore = 136;
const ushort cmScoreBgColor = 137;
const ushort cmWindowBgColor = 139;
const ushort cmVerseField = 138;
const ushort cmOrbitField = 150;
const ushort cmMyceliumField = 151;
const ushort cmTorusField = 152;
const ushort cmCubeField = 153;
const ushort cmMonsterPortal = 154;
const ushort cmMonsterVerse = 155;
const ushort cmMonsterCam   = 156;
const ushort cmASCIICam     = 157;
const ushort cmContourMap   = 158;
const ushort cmGenerativeLab = 159;

// Tools menu commands (future)
const ushort cmAnsiEditor = 125;
const ushort cmPaintTools = 126;
const ushort cmAnimationStudio = 127;
const ushort cmQuantumPrinter = 128;
const ushort cmWibWobChat = 131;
const ushort cmSendToBack = 133;
const ushort cmWibWobTestA = 148;  // Scrollbar test: standardScrollBar fix
const ushort cmWibWobTestB = 149;  // Scrollbar test: TScroller refactor
const ushort cmWibWobTestC = 160;  // Scrollbar test: Split view architecture
const ushort cmRepaint = 161;      // Force repaint
const ushort cmBrowser = 170;      // Browser window
const ushort cmApiKey = 171;       // API key entry dialog
// cmScrambleToggle (180) defined in scramble_view.h
const ushort cmScrambleCat = cmScrambleToggle;  // alias for menu/IPC

// Help menu commands
const ushort cmAbout = 129;
const ushort cmKeyboardShortcuts = 210;
const ushort cmDebugInfo = 211;
const ushort cmApiKeyHelp = 212;
const ushort cmLlmStatus = 230;
const ushort cmMicropolisAscii = 213;
const ushort cmQuadra = 215;
const ushort cmSnake = 216;
const ushort cmRogue = 217;
const ushort cmRogueHackTerminal = 218;
const ushort cmDeepSignal = 219;
const ushort cmDeepSignalTerminal = 220;
const ushort cmOpenTerminal = 214;
const ushort cmAppLauncher = 232;    // Applications folder browser
const ushort cmScrambleReply = 233;  // Async Scramble LLM response ready
const ushort cmAsciiGallery = 234;   // ASCII Art Gallery browser

// Glitch menu commands
const ushort cmToggleGlitchMode = 140;
const ushort cmGlitchScatter = 141;
const ushort cmGlitchColorBleed = 142;
const ushort cmGlitchRadialDistort = 143;
const ushort cmGlitchDiagonalScatter = 144;
const ushort cmCaptureGlitchedFrame = 145;
const ushort cmResetGlitchParams = 146;
const ushort cmGlitchSettings = 147;

// Right-click context menu commands
// cmApiKeyChanged (186) and cmNoOp (999) defined in room_chat_view.h
const ushort cmCtxToggleShadow = 250;
const ushort cmCtxClearTitle = 251;
const ushort cmCtxToggleFrame = 252;
const ushort cmCtxGalleryToggle = 253;

// Desktop right-click preset commands
const ushort cmDeskPresetBase = 260;  // 260..268 for up to 9 presets
const ushort cmDeskGallery = 270;
static const int kMaxRecentWorkspaces = 5;

struct RecentWorkspaceInfo {
    std::string path;
    std::string fileName;
    time_t mtime;
};

static std::vector<std::string> scanRecentWorkspacePaths(const char* dirPath, int maxCount)
{
    std::vector<RecentWorkspaceInfo> entries;
    DIR* dir = opendir(dirPath);
    if (!dir)
        return {};

    struct dirent* ent;
    while ((ent = readdir(dir)) != nullptr) {
        const char* name = ent->d_name;
        if (!name || name[0] == '.')
            continue;
        size_t len = std::strlen(name);
        if (len < 6 || std::strcmp(name + len - 5, ".json") != 0)
            continue;

        std::string path = std::string(dirPath) + "/" + name;
        struct stat st;
        if (stat(path.c_str(), &st) != 0 || !S_ISREG(st.st_mode))
            continue;

        entries.push_back({path, name, st.st_mtime});
    }
    closedir(dir);

    std::sort(entries.begin(), entries.end(),
              [](const RecentWorkspaceInfo& a, const RecentWorkspaceInfo& b) {
                  if (a.mtime != b.mtime)
                      return a.mtime > b.mtime;
                  return a.fileName < b.fileName;
              });

    if ((int)entries.size() > maxCount)
        entries.resize(maxCount);

    std::vector<std::string> out;
    out.reserve(entries.size());
    for (const auto& e : entries)
        out.push_back(e.path);
    return out;
}

static int countWindowsInWorkspace(const std::string& path)
{
    FILE* f = fopen(path.c_str(), "r");
    if (!f) return -1;
    // Quick count: find "windows" array, count occurrences of "\"type\""
    std::string content;
    char buf[4096];
    while (size_t n = fread(buf, 1, sizeof(buf), f))
        content.append(buf, n);
    fclose(f);
    int count = 0;
    size_t pos = content.find("\"windows\"");
    if (pos == std::string::npos) return 0;
    while ((pos = content.find("\"type\"", pos + 1)) != std::string::npos)
        ++count;
    return count;
}

static std::string recentWorkspaceLabel(const std::string& path)
{
    size_t slash = path.find_last_of("/\\");
    std::string name = (slash == std::string::npos) ? path : path.substr(slash + 1);
    int n = countWindowsInWorkspace(path);
    if (n > 0)
        name += " (" + std::to_string(n) + ")";
    return name;
}

static TMenuItem* buildRecentWorkspacesSubmenuItem()
{
    std::vector<std::string> recents = scanRecentWorkspacePaths("workspaces", kMaxRecentWorkspaces);
    TMenuItem* items = nullptr;
    if (recents.empty()) {
        items = new TMenuItem("(none)", cmNoOp, kbNoKey);  // must be non-zero; 0 = "has submenu" → null deref crash
    } else {
        for (int i = (int)recents.size() - 1; i >= 0; --i) {
            std::string label = recentWorkspaceLabel(recents[i]);
            char* labelStr = new char[label.size() + 1];
            std::strcpy(labelStr, label.c_str());
            items = new TMenuItem(labelStr,
                                  cmRecentWorkspace + i,
                                  kbNoKey, hcNoContext, nullptr, items);
        }
    }
    return new TMenuItem("~R~ecent >", kbNoKey, new TMenu(*items), hcNoContext, nullptr);
}

// Forward declarations
class TTestPatternView;
class TTestPatternWindow;
class TGradientWindow;
class TWwdosApp;
class TCustomMenuBar;
class TCustomStatusLine;

/*---------------------------------------------------------*/
/* TCustomMenuBar - Menu bar with animated kaomoji        */
/*---------------------------------------------------------*/
class TCustomMenuBar : public TMenuBar
{
public:
    enum KaomojiMood {
        NEUTRAL,      // つ◕‿◕‿◕༽つ - Default
        EXCITED,      // つ◉‿◉‿◉༽つ - Tool use, window spawning
        THINKING,     // つ●‿●‿●༽つ - LLM processing
        SLEEPY,       // つ◡‿◡‿◡༽つ - Idle, blinking
        CURIOUS,      // つ○‿○‿○༽つ - User input
        MEMORY,       // つ■‿■‿■༽つ - Symbient memory tool
        GEOMETRIC,    // つ□‿□‿□༽つ - Geometric tool/pattern mode
        SURPRISED     // つ◎‿◎‿◎༽つ - Errors, unexpected events
    };

    TCustomMenuBar(const TRect& bounds, TMenu* aMenu) : TMenuBar(bounds, aMenu) {
        // Start blink timer (3-6 seconds between blinks)
        scheduleNextBlink();
    }
    TCustomMenuBar(const TRect& bounds, TSubMenu& aMenu) : TMenuBar(bounds, aMenu) {
        scheduleNextBlink();
    }

    virtual TColorAttr mapColor(uchar index) noexcept override
    {
        TColorRGB trueBlack(0, 0, 0);
        TColorRGB trueWhite(255, 255, 255);

        switch(index) {
            case 1:  case 3:  case 4:  case 6:
                return TColorAttr(trueBlack, trueWhite);
            default:
                return TMenuBar::mapColor(index);
        }
    }

    virtual void draw() override
    {
        TMenuBar::draw();

        // Update blink state
        auto now = std::chrono::steady_clock::now();
        if (now >= nextBlinkTime && currentMood == NEUTRAL) {
            isBlinking = true;
            blinkStartTime = now;
        }

        // End blink after 150ms
        if (isBlinking && std::chrono::duration_cast<std::chrono::milliseconds>(now - blinkStartTime).count() > 150) {
            isBlinking = false;
            scheduleNextBlink();
        }

        // Get kaomoji based on current mood and blink state
        const char* kaomoji = getKaomojiForState();
        int kaomojiWidth = 12;
        int xPos = size.x - kaomojiWidth;

        if (xPos > 1) {
            TDrawBuffer b;
            TAttrPair cNormal = getColor(0x0301);
            b.moveChar(0, ' ', cNormal, kaomojiWidth);
            b.moveStr(0, kaomoji, cNormal);
            writeBuf(xPos, 0, kaomojiWidth, 1, b);
        }
    }

    void setMood(KaomojiMood mood, int durationMs = 2000) {
        currentMood = mood;
        if (durationMs > 0) {
            moodEndTime = std::chrono::steady_clock::now() + std::chrono::milliseconds(durationMs);
        }
    }

    void update() {
        // Revert to neutral after mood duration
        auto now = std::chrono::steady_clock::now();
        if (currentMood != NEUTRAL && now >= moodEndTime) {
            currentMood = NEUTRAL;
        }
        drawView();
    }

private:
    KaomojiMood currentMood = NEUTRAL;
    bool isBlinking = false;
    std::chrono::steady_clock::time_point blinkStartTime;
    std::chrono::steady_clock::time_point nextBlinkTime;
    std::chrono::steady_clock::time_point moodEndTime;

    void scheduleNextBlink() {
        // Random blink interval: 3-6 seconds
        int interval = 3000 + (rand() % 3000);
        nextBlinkTime = std::chrono::steady_clock::now() + std::chrono::milliseconds(interval);
    }

    const char* getKaomojiForState() {
        // Blink overrides mood
        if (isBlinking) return "つ-‿-‿-༽つ";

        switch(currentMood) {
            case EXCITED:    return "つ◉‿◉‿◉༽つ";
            case THINKING:   return "つ●‿●‿●༽つ";
            case SLEEPY:     return "つ◡‿◡‿◡༽つ";
            case CURIOUS:    return "つ○‿○‿○༽つ";
            case MEMORY:     return "つ■‿■‿■༽つ";
            case GEOMETRIC:  return "つ□‿□‿□༽つ";
            case SURPRISED:  return "つ◎‿◎‿◎༽つ";
            case NEUTRAL:
            default:         return "つ◕‿◕‿◕༽つ";
        }
    }
};

/*---------------------------------------------------------*/
/* TCustomStatusLine - Status line with white hotkeys     */
/*---------------------------------------------------------*/
class TCustomStatusLine : public TStatusLine
{
public:
    TCustomStatusLine(const TRect& bounds, TStatusDef& aDefs) : TStatusLine(bounds, aDefs) {}
    
    virtual TColorAttr mapColor(uchar index) noexcept override
    {
        TColorRGB trueBlack(0, 0, 0);
        TColorRGB trueWhite(255, 255, 255);
        
        // Status line uses different indices than menu bar
        switch(index) {
            case 1:  case 2:  case 3:  case 4:
                return TColorAttr(trueBlack, trueWhite);
            default:
                return TStatusLine::mapColor(index);
        }
    }

    virtual void draw() override
    {
        TStatusLine::draw();
        drawLlmIndicator();
        drawApiIndicator();
    }

private:
    void drawLlmIndicator()
    {
        const AuthConfig& auth = AuthConfig::instance();
        TColorRGB bg(255, 255, 255);
        TColorRGB fg;
        const char* label = auth.modeName();  // "LLM AUTH" / "LLM KEY" / "LLM OFF"

        switch (auth.mode()) {
            case AuthMode::ClaudeCode:
                fg = TColorRGB(0, 160, 0);       // green
                break;
            case AuthMode::ApiKey:
                fg = TColorRGB(180, 140, 0);      // amber
                break;
            case AuthMode::NoAuth:
                fg = TColorRGB(180, 50, 50);      // red
                break;
        }

        // Place to the left of the API indicator (API indicator ~8 chars from right)
        int labelLen = static_cast<int>(strlen(label));
        int xPos = size.x - labelLen - 10;  // 10 = API indicator width + gap
        if (xPos < 1) return;

        TDrawBuffer b;
        TColorAttr attr(fg, bg);
        b.moveChar(0, ' ', attr, labelLen + 1);
        b.moveStr(0, label, attr);
        writeBuf(xPos, 0, labelLen + 1, 1, b);
    }

    void drawApiIndicator()
    {
        // TWwdosApp is incomplete here — use the opaque helper
        auto status = getAppIpcStatus(TApplication::application);

        // Build indicator string and pick colour
        TColorRGB bg(255, 255, 255);
        TColorRGB fg;
        const char* label;

        if (status.api_active) {
            fg = TColorRGB(0, 160, 0);       // green
            label = "API ON";
        } else if (status.listening) {
            fg = TColorRGB(120, 120, 120);    // grey
            label = "API IDLE";
        } else {
            fg = TColorRGB(180, 50, 50);      // red
            label = "API OFF";
        }

        int labelLen = strlen(label);
        int xPos = size.x - labelLen - 1;
        if (xPos < 1) return;

        TDrawBuffer b;
        TColorAttr attr(fg, bg);
        b.moveChar(0, ' ', attr, labelLen + 1);
        b.moveStr(0, label, attr);
        writeBuf(xPos, 0, labelLen + 1, 1, b);
    }

    // Forward-declared helper — implemented after TWwdosApp is defined
    static ApiIpcServer::ConnectionStatus getAppIpcStatus(void* app);
};

/*---------------------------------------------------------*/
/* TTestPatternView - The interior view showing pattern   */
/*---------------------------------------------------------*/
class TTestPatternView : public TView
{
    
public:
    TTestPatternView(const TRect& bounds) : TView(bounds)
    {
        options |= ofFramed;
        growMode = gfGrowHiX | gfGrowHiY;
    }
    
    virtual void draw()
    {
        TDrawBuffer b;
        int patternHeight = TTestPattern::getPatternHeight();
        
        for (int y = 0; y < size.y; y++)
        {
            int patternRow = y % patternHeight;
            int offset = 0;
            
            // Calculate offset for continuous patterns
            if (USE_CONTINUOUS_PATTERN) {
                offset = (y / patternHeight) * size.x;
            }
            
            TTestPattern::drawPatternRow(b, patternRow, size.x, offset);
            writeLine(0, y, size.x, 1, b);
        }
    }
};

/*---------------------------------------------------------*/
/* TTestPatternWindow - Window containing test pattern    */
/*---------------------------------------------------------*/
class TTestPatternWindow : public TWindow
{
private:
    TTestPatternView* patternView;
    
public:
    TTestPatternWindow(const TRect& bounds, const char* aTitle) :
        TWindow(bounds, "", wnNoNumber),
        TWindowInit(&TTestPatternWindow::initFrame)
    {
        options |= ofTileable;  // Enable cascade/tile functionality
        
        // Get the interior bounds (excluding frame)
        TRect interior = getExtent();
        interior.grow(-1, -1);
        
        // Insert the test pattern view
        patternView = new TTestPatternView(interior);
        insert(patternView);
    }
    
    TTestPatternView* getPatternView() { return patternView; }
    
    static TFrame* initFrame(TRect r)
    {
        return new TNoTitleFrame(r);
    }
    
};

/*---------------------------------------------------------*/
/* TGradientWindow - Window containing gradient           */
/*---------------------------------------------------------*/
class TGradientWindow : public TWindow
{
public:
    enum GradientType {
        gtHorizontal,
        gtVertical,
        gtRadial,
        gtDiagonal
    };
    
    TGradientWindow(const TRect& bounds, const char* aTitle, GradientType type) :
        TWindow(bounds, "", wnNoNumber),
        TWindowInit(&TGradientWindow::initFrame)
    {
        options |= ofTileable;  // Enable cascade/tile functionality
        
        // Get the interior bounds (excluding frame)
        TRect interior = getExtent();
        interior.grow(-1, -1);
        
        // Insert the appropriate gradient view
        TGradientView* gradientView = nullptr;
        switch (type)
        {
            case gtHorizontal:
                gradientView = new THorizontalGradientView(interior);
                break;
            case gtVertical:
                gradientView = new TVerticalGradientView(interior);
                break;
            case gtRadial:
                gradientView = new TRadialGradientView(interior);
                break;
            case gtDiagonal:
                gradientView = new TDiagonalGradientView(interior);
                break;
        }
        
        if (gradientView)
            insert(gradientView);
    }

    static TFrame* initFrame(TRect r)
    {
        return new TNoTitleFrame(r);
    }
};

/*---------------------------------------------------------*/
/* TWwdosApp - Main application class               */
/*---------------------------------------------------------*/
class TWwdosApp : public TApplication
{
public:
    TWwdosApp();
    virtual void handleEvent(TEvent& event);
    virtual void idle();
    virtual void run();
    virtual TPalette& getPalette() const;
    static TMenuBar* initMenuBar(TRect);
    static TStatusLine* initStatusLine(TRect);
    static TDeskTop* initDeskTop(TRect);

    /// Connection status for the API indicator in the status line.
    ApiIpcServer::ConnectionStatus getIpcStatus() const {
        return ipcServer ? ipcServer->getConnectionStatus() : ApiIpcServer::ConnectionStatus{};
    }
    
private:
    void newTestWindow();
    void newTestWindow(const TRect& bounds);
    void newGradientWindow(TGradientWindow::GradientType type);
    void newGradientWindow(TGradientWindow::GradientType type, const TRect& bounds);
    // void newMechWindow();
    void newDonutWindow();
    void newBrowserWindow();
    void newBrowserWindow(const TRect& bounds);
    void newWibWobWindow();
    void newWibWobTestWindowA();
    void newWibWobTestWindowB();
    void newWibWobTestWindowC();
    void newRoomChatWindow();
    void openAnimationFile();
    void openAnimationFilePath(const std::string& path);
    void openAnimationFilePath(const std::string& path, const TRect& bounds, bool frameless = false, bool shadowless = false, const std::string& title = "");
    void openTransparentTextFile();
    void openMonodrawFile(const char* fileName);
    void openWorkspace();
    bool openWorkspacePath(const std::string& path);
    void cascade();
    void tile();
    void closeAll(bool preserveSession = true);
    void takeScreenshot(bool showDialog = true);
    void setPatternMode(bool continuous);
    void showApiKeyDialog();
    void saveWorkspace();
    void saveWorkspaceAs();
    void manageWorkspaces();
    bool saveWorkspacePath(const std::string& path);
    TRect calculateWindowBounds(const std::string& filePath);
    std::string buildWorkspaceJson();
    bool loadWorkspaceFromFile(const std::string& path);
public:
    // JSON parse helpers (public for workspace preview + free functions)
    static bool parseBool(const std::string &s, size_t &pos, bool &out);
    static bool parseString(const std::string &s, size_t &pos, std::string &out);
    static bool parseNumber(const std::string &s, size_t &pos, int &out);
    static void skipWs(const std::string &s, size_t &pos);
    static bool consume(const std::string &s, size_t &pos, char ch);
    static bool parseKeyedString(const std::string &s, size_t objStart, const char *key, std::string &out);
    static bool parseKeyedNumber(const std::string &s, size_t objStart, const char *key, int &out);
    static bool parseKeyedBool(const std::string &s, size_t objStart, const char *key, bool &out);
    static bool parseBounds(const std::string &s, size_t objStart, int &x,int &y,int &w,int &h);
private:
    
    int windowNumber;
    static const int maxWindows = 99;

    // Scramble cat overlay
    TScrambleWindow* scrambleWindow;
    ScrambleEngine scrambleEngine;
    std::string pendingScrambleReply;  // Queued async response for event-loop delivery
    ScrambleDisplayState scrambleState;
    void cycleScramble();
    void wireScrambleInput();
    void deliverScrambleReply();

    // Runtime API key (shared across all chat windows)
    static std::string runtimeApiKey;
    std::vector<std::string> recentWorkspaces_;
    std::string currentWorkspacePath_;  // path of last loaded/saved workspace
    friend std::string getAppRuntimeApiKey();

    // Kaomoji mood helper
    void setKaomojiMood(TCustomMenuBar::KaomojiMood mood, int durationMs = 2000) {
        if (menuBar) {
            auto* customMenuBar = dynamic_cast<TCustomMenuBar*>(menuBar);
            if (customMenuBar) {
                customMenuBar->setMood(mood, durationMs);
            }
        }
    }

    // Chat log for multiplayer relay (outgoing messages from local Scramble)
    struct ChatEntry { int seq; std::string sender; std::string text; };
    std::deque<ChatEntry> chatLog_;
    int chatSeq_ = 0;
    static constexpr int kChatLogMax = 50;

    // API/IPC registry for per-window control
    int apiIdCounter = 1;
    std::map<TWindow*, std::string> winToId;
    std::map<std::string, TWindow*> idToWin;
    std::string lastRegisteredWindowId_;
    
    std::string registerWindow(TWindow* w, bool emit_event = true) {
        if (!w) return std::string();
        auto it = winToId.find(w);
        if (it != winToId.end()) {
            lastRegisteredWindowId_ = it->second;
            return it->second;
        }
        if (TProgram::deskTop) {
            TRect desk = TProgram::deskTop->getExtent();
            TRect clamped = clampToDesktop(w->getBounds(), desk);
            w->locate(clamped);
        }
        char buf[32];
        std::snprintf(buf, sizeof(buf), "w%d", apiIdCounter++);
        std::string id(buf);
        winToId[w] = id;
        idToWin[id] = w;
        lastRegisteredWindowId_ = id;
        // Notify event subscribers that state has changed.
        if (emit_event && ipcServer) {
            std::string payload = std::string("{\"id\":\"") + id + "\"}";
            ipcServer->publish_event("state_changed", payload);
        }
        return id;
    }
    
    TWindow* findWindowById(const std::string& id) {
        // Scan desktop to discover unregistered windows and purge stale entries.
        // Must scan first so stale pointers are removed before we return one.
        // IMPORTANT: do NOT clear existing maps — that would reassign IDs for
        // already-known windows and cause multiplayer desync.
        std::vector<TWindow*> activeWins;
        TView *start = deskTop->first();
        if (start) {
            TView *v = start;
            do {
                TWindow *w = dynamic_cast<TWindow*>(v);
                if (w) {
                    activeWins.push_back(w);
                    if (winToId.find(w) == winToId.end()) {
                        // Unregistered window — give it a stable ID without firing an event.
                        char buf[32];
                        std::snprintf(buf, sizeof(buf), "w%d", apiIdCounter++);
                        std::string new_id(buf);
                        winToId[w] = new_id;
                        idToWin[new_id] = w;
                    }
                }
                v = v->next;
            } while (v != start);
        }
        // Purge stale entries (windows closed since last scan).
        {
            auto it = winToId.begin();
            while (it != winToId.end()) {
                bool alive = false;
                for (auto* aw : activeWins) { if (aw == it->first) { alive = true; break; } }
                if (!alive) {
                    idToWin.erase(it->second);
                    it = winToId.erase(it);
                } else {
                    ++it;
                }
            }
        }
        auto it = idToWin.find(id);
        if (it != idToWin.end()) return it->second;
        return nullptr;
    }
    
    // IPC server
    ApiIpcServer* ipcServer = nullptr;
    
    // Friend API helper functions implemented below to bridge IPC calls.
    friend void api_spawn_test(TWwdosApp&);
    friend void api_spawn_gradient(TWwdosApp&, const std::string&);
    friend void api_open_animation_path(TWwdosApp&, const std::string&);
    friend void api_open_text_view_path(TWwdosApp&, const std::string&, const TRect* bounds);
    friend void api_spawn_test(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_gradient(TWwdosApp&, const std::string&, const TRect* bounds);
    friend void api_open_animation_path(TWwdosApp&, const std::string&, const TRect* bounds, bool frameless, bool shadowless, const std::string& title);
    friend void api_cascade(TWwdosApp&);
    friend void api_toggle_scramble(TWwdosApp&);
    friend void api_expand_scramble(TWwdosApp&);
    friend std::string api_scramble_say(TWwdosApp&, const std::string&);
    friend std::string api_scramble_pet(TWwdosApp&);
    friend std::string api_chat_receive(TWwdosApp&, const std::string&, const std::string&);
    friend void api_tile(TWwdosApp&);
    friend void api_close_all(TWwdosApp&);
    friend void api_set_pattern_mode(TWwdosApp&, const std::string&);
    friend void api_save_workspace(TWwdosApp&);
    friend bool api_save_workspace_path(TWwdosApp&, const std::string&);
    friend bool api_open_workspace_path(TWwdosApp&, const std::string&);
    friend void api_screenshot(TWwdosApp&);
    friend std::string api_get_state(TWwdosApp&);
    friend std::string api_move_window(TWwdosApp&, const std::string&, int, int);
    friend std::string api_resize_window(TWwdosApp&, const std::string&, int, int);
    friend std::string api_focus_window(TWwdosApp&, const std::string&);
    friend std::string api_raise_window(TWwdosApp&, const std::string&);
    friend std::string api_lower_window(TWwdosApp&, const std::string&);
    friend std::string api_close_window(TWwdosApp&, const std::string&);
    friend std::string api_get_canvas_size(TWwdosApp&);
    friend void api_spawn_text_editor(TWwdosApp&, const TRect* bounds, const std::string& title);
    friend void api_spawn_browser(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_room_chat(TWwdosApp&, const TRect* bounds);
    friend std::string api_room_chat_receive(TWwdosApp&, const std::string& sender, const std::string& text, const std::string& ts);
    friend std::string api_room_presence(TWwdosApp&, const std::string& participants_json);
    friend std::string api_get_room_chat_pending(TWwdosApp&);
    friend std::string api_get_room_chat_display_name(TWwdosApp&);
    friend std::string api_take_last_registered_window_id(TWwdosApp&);
    friend void api_spawn_verse(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_mycelium(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_orbit(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_torus(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_cube(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_life(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_blocks(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_score(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_ascii(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_animated_gradient(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_monster_cam(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_monster_verse(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_contour_map(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_generative_lab(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_monster_portal(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_micropolis_ascii(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_quadra(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_snake(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_rogue(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_deep_signal(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_app_launcher(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_gallery(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_figlet_text(TWwdosApp&, const TRect*,
        const std::string& text, const std::string& font,
        bool frameless, bool shadowless);
    friend void api_spawn_figlet_text_at(TWwdosApp&,
        const std::string& text, const std::string& font, int x, int y,
        bool frameless, bool shadowless);
    friend TFigletTextWindow* findFigletWindow(TWwdosApp&, const std::string& id);
    friend std::string api_figlet_set_text(TWwdosApp&, const std::string& id, const std::string& text);
    friend std::string api_figlet_set_font(TWwdosApp&, const std::string& id, const std::string& font);
    friend std::string api_figlet_set_color(TWwdosApp&, const std::string& id, const std::string& fg, const std::string& bg);
    friend std::string api_gallery_list(TWwdosApp&, const std::string& tab);
    friend void api_spawn_terminal(TWwdosApp&, const TRect* bounds);
    friend void api_spawn_wibwob(TWwdosApp&, const TRect* bounds);
    friend std::string api_terminal_write(TWwdosApp&, const std::string& text, const std::string& window_id);
    friend std::string api_terminal_read(TWwdosApp&, const std::string& window_id);
    friend void api_spawn_paint(TWwdosApp&, const TRect* bounds);
    friend TPaintCanvasView* api_find_paint_canvas(TWwdosApp&, const std::string&);
    friend TGenerativeLabView* api_find_gen_lab_view(TWwdosApp&, const std::string&);
    friend std::string api_browser_fetch(TWwdosApp&, const std::string& url);
    friend std::string api_send_text(TWwdosApp&, const std::string&, const std::string&, 
                                     const std::string&, const std::string&);
    friend std::string api_send_figlet(TWwdosApp&, const std::string&, const std::string&, 
                                       const std::string&, int, const std::string&);
    // Per-window toggles
    friend std::string api_window_shadow(TWwdosApp&, const std::string&, bool);
    friend std::string api_window_title(TWwdosApp&, const std::string&, const std::string&);
    // Desktop texture & gallery mode
    friend std::string api_desktop_preset(TWwdosApp&, const std::string&);
    friend std::string api_desktop_texture(TWwdosApp&, const std::string&);
    friend std::string api_desktop_color(TWwdosApp&, int, int);
    friend std::string api_desktop_gallery(TWwdosApp&, bool);
    friend std::string api_desktop_get(TWwdosApp&);
    bool galleryMode_ = false;
};

// Static member definition
std::string TWwdosApp::runtimeApiKey;

// Accessor for runtime API key (used by wibwob_view.cpp)
std::string getAppRuntimeApiKey() {
    return TWwdosApp::runtimeApiKey;
}

TWwdosApp::TWwdosApp() :
    TProgInit(&TWwdosApp::initStatusLine,
              &TWwdosApp::initMenuBar,
              &TWwdosApp::initDeskTop),
    windowNumber(0),
    scrambleWindow(nullptr),
    scrambleState(sdsHidden)
{
    recentWorkspaces_ = scanRecentWorkspacePaths("workspaces", kMaxRecentWorkspaces);

    // Start IPC server for local API control (best-effort; ignore failures)
    ipcServer = new ApiIpcServer(this);

    // Socket path: /tmp/wwdos.sock (default) or /tmp/wibwob_N.sock (multi-instance).
    std::string sockPath = "/tmp/wwdos.sock";
    const char* inst = std::getenv("WIBWOB_INSTANCE");
    if (inst && inst[0] != '\0')
        sockPath = std::string("/tmp/wibwob_") + inst + ".sock";
    fprintf(stderr, "[wibwob] IPC socket: %s\n", sockPath.c_str());

    if (!ipcServer->start(sockPath)) {
        fprintf(stderr, "[wibwob] ERROR: IPC server failed to start on %s\n", sockPath.c_str());
        delete ipcServer;
        ipcServer = nullptr;
    } else {
        fprintf(stderr, "[wibwob] IPC server started on %s\n", sockPath.c_str());
    }

    // Auto-restore layout from env var (room deployment).
    const char* layoutPath = std::getenv("WIBWOB_LAYOUT_PATH");
    if (layoutPath && layoutPath[0] != '\0') {
        fprintf(stderr, "[wibwob] Restoring layout from WIBWOB_LAYOUT_PATH=%s\n", layoutPath);
        if (!loadWorkspaceFromFile(layoutPath)) {
            fprintf(stderr, "[wibwob] WARNING: Failed to restore layout from %s\n", layoutPath);
        }
    }

    // Sprites / multi-user mode: no hardcoded layout — use WIBWOB_LAYOUT_PATH
    // to point at workspaces/sprites-default.json (or any custom workspace).
    // See scripts/sprite-user-session.sh for env var wiring.

    // Init Scramble engine (KB + Haiku client).
    scrambleEngine.init(".");

    // Auto-open Scramble if WIBWOB_SCRAMBLE_DEFAULT is set (e.g. "tall" or "smol")
    const char* scrambleDefault = std::getenv("WIBWOB_SCRAMBLE_DEFAULT");
    if (scrambleDefault && scrambleDefault[0]) {
        // cycleScramble() creates in smol mode first
        cycleScramble();
        // If "tall", cycle again to expand
        if (std::string(scrambleDefault) == "tall") {
            cycleScramble();
        }
    }
}

void TWwdosApp::handleEvent(TEvent& event)
{
    TApplication::handleEvent(event);
    
    if (event.what == evCommand)
    {
        // Handle font selection from Edit → FIGlet Font → Category submenus
        // (range check before switch — can't use case for ranges)
        ushort cmd = event.message.command;
        if (cmd >= cmFigletCatFontBase && cmd < cmFigletCatFontBase + 200) {
            TFigletTextWindow* fw = dynamic_cast<TFigletTextWindow*>(
                deskTop->current);
            if (fw && fw->getFigletView()) {
                const std::string& fname = figlet::fontByIndex(cmd - cmFigletCatFontBase);
                if (!fname.empty())
                    fw->getFigletView()->setFont(fname);
            }
            clearEvent(event);
            return;
        }
        if (cmd >= cmRecentWorkspace && cmd < cmRecentWorkspace + kMaxRecentWorkspaces) {
            int idx = cmd - cmRecentWorkspace;
            if (idx >= 0 && idx < (int)recentWorkspaces_.size())
                loadWorkspaceFromFile(recentWorkspaces_[idx]);
            clearEvent(event);
            return;
        }

        switch (event.message.command)
        {
            case cmNewWindow:
                newTestWindow();
                clearEvent(event);
                break;
            case cmNewGradientH:
                newGradientWindow(TGradientWindow::gtHorizontal);
                clearEvent(event);
                break;
            case cmNewGradientV:
                newGradientWindow(TGradientWindow::gtVertical);
                clearEvent(event);
                break;
            case cmNewGradientR:
                newGradientWindow(TGradientWindow::gtRadial);
                clearEvent(event);
                break;
            case cmNewGradientD:
                newGradientWindow(TGradientWindow::gtDiagonal);
                clearEvent(event);
                break;
            // case cmNewMechs:
            //     newMechWindow();
            //     clearEvent(event);
            //     break;
            case cmNewDonut:
                newDonutWindow();
                clearEvent(event);
                break;
            case cmOpenAnimation:
                if (event.message.infoPtr) {
                    // Called from gallery with a specific file path
                    openAnimationFilePath((const char*)event.message.infoPtr);
                } else {
                    openAnimationFile();
                }
                clearEvent(event);
                break;
            case cmOpenTransparentText:
                openTransparentTextFile();
                clearEvent(event);
                break;
            case cmOpenWorkspace:
                openWorkspace();
                clearEvent(event);
                break;
            case cmSaveWorkspace:
                saveWorkspace();
                clearEvent(event);
                break;
            case cmSaveWorkspaceAs:
                saveWorkspaceAs();
                clearEvent(event);
                break;
            case cmManageWorkspaces:
                manageWorkspaces();
                clearEvent(event);
                break;
            case cmPatternContinuous:
                setPatternMode(true);
                clearEvent(event);
                break;
            case cmPatternTiled:
                setPatternMode(false);
                clearEvent(event);
                break;
            case cmScreenshot:
                takeScreenshot();
                clearEvent(event);
                break;
            case cmCascade:
                cascade();
                clearEvent(event);
                break;
            case cmTile:
                tile();
                clearEvent(event);
                break;
            case cmCloseAll:
                closeAll();
                clearEvent(event);
                break;
            case cmSendToBack: {
                // Move the current window directly in front of the desktop background (i.e., to back).
                if (deskTop && deskTop->current && deskTop->background)
                    deskTop->current->putInFrontOf((TView*)deskTop->background);
                clearEvent(event);
                break;
            }
                
            // Edit menu commands
                
            // REMOVED E009: cmZoomIn/Out/ActualSize/FullScreen (placeholders, no menu items)
            case cmTextEditor: {
                TRect r = deskTop->getExtent();
                r.grow(-5, -3); // Leave some margin
                auto *w = createTextEditorWindow(r);
                deskTop->insert(w);
                registerWindow(w);
                clearEvent(event);
                break;
            }
            case cmBrowser:
                newBrowserWindow();
                clearEvent(event);
                break;
            case cmScrambleCat:
                cycleScramble();
                clearEvent(event);
                break;
            case cmScrambleExpand:
                cycleScramble();
                clearEvent(event);
                break;
            case cmAsciiGridDemo: {
                TRect r = deskTop->getExtent();
                r.grow(-10, -5);
                deskTop->insert(createAsciiGridDemoWindow(r));
                clearEvent(event);
                break;
            }
            case cmAnimatedBlocks: {
                TRect r = deskTop->getExtent();
                r.grow(-10, -5);
                deskTop->insert(createAnimatedBlocksWindow(r));
                clearEvent(event);
                break;
            }
            case cmAnimatedGradient: {
                TRect r = deskTop->getExtent();
                r.grow(-10, -5);
                deskTop->insert(createAnimatedGradientWindow(r));
                clearEvent(event);
                break;
            }
            case cmAnimatedScore: {
                TRect r = deskTop->getExtent();
                r.grow(-12, -6);
                deskTop->insert(createAnimatedScoreWindow(r));
                clearEvent(event);
                break;
            }
            case cmVerseField: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1); // almost full-screen to emphasise immersion
                deskTop->insert(createGenerativeVerseWindow(r));
                clearEvent(event);
                break;
            }
            case cmOrbitField: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                deskTop->insert(createGenerativeOrbitWindow(r));
                clearEvent(event);
                break;
            }
            case cmMyceliumField: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                deskTop->insert(createGenerativeMyceliumWindow(r));
                clearEvent(event);
                break;
            }
            case cmTorusField: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                deskTop->insert(createGenerativeTorusWindow(r));
                clearEvent(event);
                break;
            }
            case cmCubeField: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                deskTop->insert(createGenerativeCubeWindow(r));
                clearEvent(event);
                break;
            }
            case cmMonsterPortal: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                deskTop->insert(createGenerativeMonsterPortalWindow(r));
                clearEvent(event);
                break;
            }
            case cmContourMap: {
                api_spawn_contour_map(*this, nullptr);
                clearEvent(event);
                break;
            }
            case cmGenerativeLab: {
                api_spawn_generative_lab(*this, nullptr);
                clearEvent(event);
                break;
            }
            case cmMonsterVerse: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                deskTop->insert(createGenerativeMonsterVerseWindow(r));
                clearEvent(event);
                break;
            }
            case cmMonsterCam: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                deskTop->insert(createGenerativeMonsterCamWindow(r));
                clearEvent(event);
                break;
            }
            case cmMicropolisAscii: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                TWindow* w = createMicropolisAsciiWindow(r);
                deskTop->insert(w);
                registerWindow(w);
                clearEvent(event);
                break;
            }
            case cmQuadra: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                TWindow* w = createQuadraWindow(r);
                deskTop->insert(w);
                registerWindow(w);
                clearEvent(event);
                break;
            }
            case cmSnake: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                TWindow* w = createSnakeWindow(r);
                deskTop->insert(w);
                registerWindow(w);
                clearEvent(event);
                break;
            }
            case cmRogue: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                TWindow* w = createRogueWindow(r);
                deskTop->insert(w);
                registerWindow(w);
                clearEvent(event);
                break;
            }
            case cmDeepSignal: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                TWindow* w = createDeepSignalWindow(r);
                deskTop->insert(w);
                registerWindow(w);
                clearEvent(event);
                break;
            }
            case cmOpenTerminal: {
                TRect r = deskTop->getExtent();
                r.grow(-2, -1);
                TWindow* w = createTerminalWindow(r);
                if (w) {
                    deskTop->insert(w);
                    registerWindow(w);
                }
                clearEvent(event);
                break;
            }
            case cmAppLauncher: {
                TRect desk = deskTop->getExtent();
                int ww = 63, hh = 20;
                int x = (desk.b.x - ww) / 2;
                int y = (desk.b.y - hh) / 2;
                if (x < 0) x = 0;
                if (y < 0) y = 0;
                TRect r(x, y, x + ww, y + hh);
                TWindow* w = createAppLauncherWindow(r);
                deskTop->insert(w);
                registerWindow(w);
                clearEvent(event);
                break;
            }
            case cmCtxGalleryToggle:
            case cmDeskGallery: {
                api_desktop_gallery(*this, !galleryMode_);
                clearEvent(event);
                break;
            }
            case cmAsciiGallery: {
                TRect desk = deskTop->getExtent();
                int ww = desk.b.x * 9 / 10;
                int hh = desk.b.y * 9 / 10;
                int x = (desk.b.x - ww) / 2;
                int y = (desk.b.y - hh) / 2;
                TRect r(x, y, x + ww, y + hh);
                TWindow* w = createAsciiGalleryWindow(r);
                deskTop->insert(w);
                registerWindow(w);
                clearEvent(event);
                break;
            }
            case cmRogueHackTerminal: {
                // Spawn a small terminal window for roguelike hacking
                TRect desk = deskTop->getExtent();
                int tw = 52, th = 18;
                int tx = desk.b.x - tw - 1;
                int ty = 1;
                if (tx < 0) tx = 0;
                TRect termBounds(tx, ty, tx + tw, ty + th);
                TWindow* tw2 = createTerminalWindow(termBounds);
                if (tw2) {
                    deskTop->insert(tw2);
                    registerWindow(tw2);
                    auto* termWin = dynamic_cast<TWibWobTerminalWindow*>(tw2);
                    if (termWin) {
                        bool hackSuccess = (event.message.infoInt != 0);
                        if (hackSuccess) {
                            termWin->sendText(
                                "clear && echo '=== DUNGEON TERMINAL v2.7 ===' && "
                                "echo '> Inserting data chip...' && "
                                "sleep 0.3 && echo '> AUTHENTICATION: GRANTED' && "
                                "sleep 0.2 && echo '> Downloading floor map...' && "
                                "sleep 0.3 && echo '  [########----------] 42%%' && "
                                "sleep 0.2 && echo '  [################--] 84%%' && "
                                "sleep 0.1 && echo '  [####################] 100%%' && "
                                "sleep 0.2 && echo '> MAP DATA EXTRACTED' && "
                                "echo '> Patching health subsystem...' && "
                                "sleep 0.2 && echo '  +10 HP restored' && "
                                "echo '> Mining XP cache...' && "
                                "sleep 0.1 && echo '  +5 XP acquired' && "
                                "sleep 0.2 && echo '' && "
                                "echo '=== HACK COMPLETE ===' && "
                                "echo '' && echo 'Type exit to close terminal'\n"
                            );
                        } else {
                            termWin->sendText(
                                "clear && echo '=== DUNGEON TERMINAL v2.7 ===' && "
                                "echo '> Scanning credentials...' && "
                                "sleep 0.3 && echo '> ERROR: No data chip detected' && "
                                "sleep 0.2 && echo '' && "
                                "echo '  *** ACCESS DENIED ***' && "
                                "echo '' && "
                                "echo 'Insert a data chip (d) to hack this terminal.' && "
                                "echo 'Find data chips scattered in the dungeon.' && "
                                "echo '' && echo 'Type exit to close terminal'\n"
                            );
                        }
                    }
                }
                clearEvent(event);
                break;
            }
            case cmDeepSignalTerminal: {
                // Spawn a terminal window for signal/anomaly analysis
                TRect desk = deskTop->getExtent();
                int tw = 56, th = 20;
                int tx = desk.b.x - tw - 1;
                int ty = 1;
                if (tx < 0) tx = 0;
                TRect termBounds(tx, ty, tx + tw, ty + th);
                TWindow* tw2 = createTerminalWindow(termBounds);
                if (tw2) {
                    deskTop->insert(tw2);
                    registerWindow(tw2);
                    auto* termWin = dynamic_cast<TWibWobTerminalWindow*>(tw2);
                    if (termWin) {
                        int sigId = event.message.infoInt;
                        if (sigId >= 0 && sigId <= 4) {
                            // Signal decode animations (5 unique sequences)
                            const char* scripts[] = {
                                // Signal 0: Nav Beacon
                                "clear && echo '=== SIGNAL ANALYZER v3.1 ===' && echo '' && "
                                "echo 'Scanning frequency bands...' && sleep 0.4 && "
                                "echo '  _/\\  /\\  /\\  /\\  /\\_' && "
                                "echo ' /    \\/  \\/  \\/  \\/   ' && sleep 0.3 && "
                                "echo '' && echo 'Signal type: NAVIGATION BEACON' && "
                                "echo 'Origin: Automated relay station' && "
                                "echo 'Message: SAFE HARBOR AT SECTOR 0,0' && "
                                "echo '' && echo '[SIGNAL 1/5 DECODED]' && "
                                "echo '' && echo 'Type exit to close'\n",
                                // Signal 1: Distress Call
                                "clear && echo '=== SIGNAL ANALYZER v3.1 ===' && echo '' && "
                                "echo 'Intercepting transmission...' && sleep 0.3 && "
                                "echo '...---... ...---... ...---...' && sleep 0.4 && "
                                "echo '' && echo 'Pattern: SOS (universal distress)' && "
                                "echo 'Signal age: 847 standard years' && sleep 0.3 && "
                                "echo 'Origin: Colony ship MERIDIAN' && "
                                "echo 'Status: No life signs detected' && "
                                "echo '' && echo '[SIGNAL 2/5 DECODED]' && "
                                "echo '' && echo 'Type exit to close'\n",
                                // Signal 2: Science Data
                                "clear && echo '=== SIGNAL ANALYZER v3.1 ===' && echo '' && "
                                "echo 'Receiving data burst...' && sleep 0.3 && "
                                "echo '01001000 01000101 01001100' && sleep 0.2 && "
                                "echo '01010000 00100000 01010101' && sleep 0.2 && "
                                "echo '01010011 00100000 01010000' && sleep 0.3 && "
                                "echo '' && echo 'Decoding binary stream...' && sleep 0.4 && "
                                "echo 'Content: STELLAR CARTOGRAPHY DATA' && "
                                "echo 'Catalog: 2,847 uncharted systems' && "
                                "echo '' && echo '[SIGNAL 3/5 DECODED]' && "
                                "echo '' && echo 'Type exit to close'\n",
                                // Signal 3: Warning
                                "clear && echo '=== SIGNAL ANALYZER v3.1 ===' && echo '' && "
                                "echo 'Encrypted signal detected!' && sleep 0.3 && "
                                "echo 'Attempting decryption...' && sleep 0.2 && "
                                "echo '  [####----------] 28%%' && sleep 0.3 && "
                                "echo '  [########------] 57%%' && sleep 0.2 && "
                                "echo '  [############--] 85%%' && sleep 0.2 && "
                                "echo '  [################] 100%%' && sleep 0.3 && "
                                "echo '' && echo '*** WARNING BUOY ***' && "
                                "echo 'ANOMALOUS REGION - DO NOT APPROACH' && "
                                "echo 'SPATIAL DISTORTION DETECTED' && "
                                "echo '' && echo '[SIGNAL 4/5 DECODED]' && "
                                "echo '' && echo 'Type exit to close'\n",
                                // Signal 4: First Contact
                                "clear && echo '=== SIGNAL ANALYZER v3.1 ===' && echo '' && "
                                "echo 'Unknown modulation detected!' && sleep 0.5 && "
                                "echo 'Frequency: Non-standard' && sleep 0.3 && "
                                "echo 'Pattern analysis...' && sleep 0.4 && "
                                "echo '' && echo '  *   *   *' && sleep 0.2 && "
                                "echo '   * * * *' && sleep 0.2 && "
                                "echo '    * * *' && sleep 0.2 && "
                                "echo '   * * * *' && sleep 0.2 && "
                                "echo '  *   *   *' && sleep 0.3 && "
                                "echo '' && echo 'Mathematical structure detected!' && "
                                "echo 'Content: PRIME SEQUENCE + COORDINATES' && "
                                "echo 'Assessment: FIRST CONTACT PROTOCOL' && "
                                "echo '' && echo '=== ALL 5 SIGNALS DECODED ===' && "
                                "echo 'MISSION COMPLETE!' && "
                                "echo '' && echo 'Type exit to close'\n",
                            };
                            termWin->sendText(scripts[sigId]);
                        } else if (sigId >= 10 && sigId <= 12) {
                            // Anomaly analysis (3 unique)
                            const char* anomScripts[] = {
                                // Anomaly 0: Spatial Rift
                                "clear && echo '=== ANOMALY SCANNER ===' && echo '' && "
                                "echo 'Spatial distortion detected!' && sleep 0.3 && "
                                "echo '' && echo '     .  * .     ' && "
                                "echo '   ~~ * ~~ ~~   ' && "
                                "echo '  ~~~~ * ~~~~   ' && "
                                "echo '   ~~ * ~~ ~~   ' && "
                                "echo '     .  * .     ' && "
                                "echo '' && echo 'Type: Spatial Rift' && "
                                "echo 'Diameter: 4.7 AU' && "
                                "echo 'Status: Stable but impassable' && "
                                "echo '' && echo 'Type exit to close'\n",
                                // Anomaly 1: Energy Signature
                                "clear && echo '=== ANOMALY SCANNER ===' && echo '' && "
                                "echo 'Unidentified energy source!' && sleep 0.3 && "
                                "echo 'Power output: 4.2 x 10^26 watts' && sleep 0.2 && "
                                "echo '' && echo 'Spectrum analysis:' && "
                                "echo '  low  |####          |' && "
                                "echo '  mid  |########      |' && "
                                "echo '  high |##############|' && "
                                "echo '' && echo 'Type: Unknown - possibly artificial' && "
                                "echo 'Origin: Pre-dates known civilizations' && "
                                "echo '' && echo 'Type exit to close'\n",
                                // Anomaly 2: Temporal Echo
                                "clear && echo '=== ANOMALY SCANNER ===' && echo '' && "
                                "echo 'Chronometric disturbance!' && sleep 0.4 && "
                                "echo '' && echo 'Temporal readings:' && sleep 0.2 && "
                                "echo '  Past:    ##########' && sleep 0.2 && "
                                "echo '  Present: ####' && sleep 0.2 && "
                                "echo '  Future:  ########' && sleep 0.3 && "
                                "echo '' && echo 'Type: Temporal Echo' && "
                                "echo 'Events from multiple timelines' && "
                                "echo 'overlap at this coordinate.' && "
                                "echo '' && echo 'Type exit to close'\n",
                            };
                            int aIdx = sigId - 10;
                            if (aIdx >= 0 && aIdx < 3)
                                termWin->sendText(anomScripts[aIdx]);
                        }
                    }
                    // Re-select the Deep Signal game window so it keeps focus
                    deskTop->forEach([](TView *v, void *) {
                        auto *w = dynamic_cast<TWindow*>(v);
                        if (w && w->title) {
                            std::string t(w->title);
                            if (t == "Deep Signal") w->select();
                        }
                    }, nullptr);
                }
                clearEvent(event);
                break;
            }
            // DISABLED: ASCII Cam (file not in repo)
            // case cmASCIICam: {
            //     TRect r = deskTop->getExtent();
            //     r.grow(-2, -1);
            //     deskTop->insert(createGenerativeASCIICamWindow(r));
            //     clearEvent(event);
            //     break;
            // }
            case cmScoreBgColor: {
                // Try to find an Animated Score view in the current window.
                auto findScore = [](TView *p, void *out) -> Boolean {
                    if (!p) return False;
                    TAnimatedScoreView **pp = (TAnimatedScoreView**)out;
                    if (*pp) return False;
                    if (auto *v = dynamic_cast<TAnimatedScoreView*>(p)) { *pp = v; return True; }
                    return False;
                };
                TAnimatedScoreView *score = nullptr;
                if (deskTop && deskTop->current) {
                    TView *cur = deskTop->current;
                    // If current is a window/group, search its children; else, check itself.
                    if (auto *grp = dynamic_cast<TGroup*>(cur))
                        grp->firstThat(findScore, &score);
                    if (!score)
                        score = dynamic_cast<TAnimatedScoreView*>(cur);
                }
                if (!score) {
                    // Fallback: search desktop for any score view.
                    if (deskTop)
                        deskTop->firstThat(findScore, &score);
                }
                if (score) {
                    score->openBackgroundPaletteDialog();
                } else {
                    messageBox("No Animated Score view is active.", mfInformation | mfOKButton);
                }
                clearEvent(event);
                break;
            }
            // REMOVED E009: cmWindowBgColor (Background Color retired, no menu item)
                
            // Tools menu commands
            case cmWibWobChat:
                newWibWobWindow();
                clearEvent(event);
                break;
            case cmRoomChat:
                newRoomChatWindow();
                clearEvent(event);
                break;
            case cmRoomPresence: {
                auto* participants =
                    static_cast<std::vector<RoomParticipant>*>(event.message.infoPtr);
                if (participants) {
                    if (TRoomChatWindow* win = getRoomChatWindow())
                        win->updatePresence(*participants);
                    delete participants;
                }
                clearEvent(event);
                break;
            }
            case cmRoomChatReceive: {
                auto* msg = static_cast<RoomChatMessage*>(event.message.infoPtr);
                if (msg) {
                    if (TRoomChatWindow* win = getRoomChatWindow())
                        win->receiveMessage(*msg);
                    delete msg;
                }
                clearEvent(event);
                break;
            }
            // REMOVED E009: cmWibWobTestA/B/C (dev-only, no menu items)
            case cmRepaint:
                if (deskTop) {
                    deskTop->drawView();
                }
                clearEvent(event);
                break;
            // REMOVED E009: cmAnsiEditor, cmPaintTools, cmAnimationStudio (placeholders, no menu items)
            case cmQuantumPrinter:
                messageBox("🚀 QUANTUM PRINTER ACTIVATED! 🚀\n\nPrinting reality at 42Hz...", mfInformation | mfOKButton);
                clearEvent(event);
                break;
            case cmApiKey:
                showApiKeyDialog();
                clearEvent(event);
                break;

            // Help menu commands
            case cmAbout:
                messageBox("WIBWOBWORLD Test Pattern Generator\n\nBuilt with Turbo Vision\nつ◕‿◕‿◕༽つ", mfInformation | mfOKButton);
                clearEvent(event);
                break;
            case cmKeyboardShortcuts:
                messageBox(
                    "Keyboard Shortcuts\n\n"
                    "Ctrl+N   New Test Pattern\n"
                    "Ctrl+D   New Animation\n"
                    "Ctrl+O   Open Text/Animation\n"
                    "Ctrl+B   Browser\n"
                    "Ctrl+S   Save Workspace\n"
                    "Ctrl+P   Screenshot\n"
                    "Ctrl+Ins Copy Page\n"
                    "F5       Repaint\n"
                    "F6       Next Window\n"
                    "Shift+F6 Previous Window\n"
                    "F8       Scramble (cycle)\n"
                    "F12      Wib&Wob Chat\n"
                    "Alt+F3   Close Window\n"
                    "Alt+X    Exit",
                    mfInformation | mfOKButton);
                clearEvent(event);
                break;
            case cmApiKeyHelp:
                messageBox(
                    "API Key (ANTHROPIC_API_KEY)\n\n"
                    "Fallback auth for Scramble Cat and\n"
                    "Wib&Wob Chat when Claude Code CLI\n"
                    "is not logged in.\n\n"
                    "Set via:\n"
                    "  1. ANTHROPIC_API_KEY env var\n"
                    "  2. Tools > API Key dialog\n\n"
                    "Preferred: run 'claude /login'\n"
                    "See Help > LLM Status for details.",
                    mfInformation | mfOKButton);
                clearEvent(event);
                break;
            case cmLlmStatus:
            {
                std::string summary = AuthConfig::instance().statusSummary();
                messageBox(summary.c_str(),
                    mfInformation | mfOKButton);
                clearEvent(event);
                break;
            }

            case cmScrambleReply:
            {
                deliverScrambleReply();
                clearEvent(event);
                break;
            }

            case cmScrambleCancel:
            {
                // Cancel async scramble request (ESC during thinking)
                if (scrambleEngine.isBusy()) {
                    scrambleEngine.haiku().cancelAsync();
                }
                clearEvent(event);
                break;
            }

            // REMOVED E009: entire Glitch Effects submenu handlers
            // (cmToggleGlitchMode, cmGlitchScatter, cmGlitchColorBleed,
            //  cmGlitchRadialDistort, cmGlitchDiagonalScatter,
            //  cmCaptureGlitchedFrame, cmResetGlitchParams, cmGlitchSettings)
                
            case cmNewPaintCanvas: {
                TRect d = deskTop->getExtent();
                int dw = d.b.x - d.a.x;
                int dh = d.b.y - d.a.y;
                int w = (int)(dw * 0.9);
                int h = (int)(dh * 0.9);
                int left = d.a.x + (dw - w) / 2;
                int top  = d.a.y + (dh - h) / 2;
                TRect r(left, top, left + w, top + h);
                TWindow* pw = createPaintWindow(r);
                deskTop->insert(pw);
                registerWindow(pw);
                clearEvent(event);
                break;
            }
            case cmNewFigletText: {
                api_spawn_figlet_text(*this, nullptr, "Hello", "standard", false, false);
                clearEvent(event);
                break;
            }
            case cmFigletEditText: {
                // Route to focused figlet window
                TFigletTextWindow* fw = dynamic_cast<TFigletTextWindow*>(
                    deskTop->current);
                if (fw && fw->getFigletView())
                    fw->getFigletView()->showEditTextDialog();
                clearEvent(event);
                break;
            }
            case cmFigletMoreFonts: {
                TFigletTextWindow* fw = dynamic_cast<TFigletTextWindow*>(
                    deskTop->current);
                if (fw && fw->getFigletView())
                    fw->getFigletView()->showFontListDialog();
                clearEvent(event);
                break;
            }
            case cmOpenImageFile: {
                char fileName[MAXPATH];
                strcpy(fileName, "*.{png,jpg,jpeg}");
                TFileDialog* dialog = new TFileDialog("*.{png,jpg,jpeg}", "Open Image File", "~N~ame", fdOpenButton, 101);
                if (executeDialog(dialog, fileName) != cmCancel) {
                    windowNumber++;
                    // Cascade-like default bounds
                    int offset = (windowNumber - 1) % 10;
                    TRect bounds(2 + offset * 2, 1 + offset, 70 + offset * 2, 25 + offset);
                    if (TWindow *w = createAsciiImageWindowFromFile(bounds, fileName)) {
                        deskTop->insert(w);
                        registerWindow(w);
                    }
                }
                clearEvent(event);
                break;
            }

            case cmOpenMonodraw: {
                char fileName[MAXPATH];
                strcpy(fileName, "*.monojson");
                TFileDialog* dialog = new TFileDialog("*.monojson", "Open Monodraw File", "~N~ame", fdOpenButton, 101);
                if (executeDialog(dialog, fileName) != cmCancel) {
                    openMonodrawFile(fileName);
                }
                clearEvent(event);
                break;
            }

            default:
                break;
        }
    }
}

void TWwdosApp::newTestWindow()
{
    // Create window title
    windowNumber++;
    std::stringstream title;
    title << "Test Pattern " << windowNumber;
    
    // Calculate window position (cascade effect)
    int offset = (windowNumber - 1) % 10;
    TRect bounds(
        2 + offset * 2,           // left
        1 + offset,               // top
        50 + offset * 2,          // right
        15 + offset               // bottom
    );
    
    // Create and insert window
    TTestPatternWindow* window = new TTestPatternWindow(bounds, title.str().c_str());
    deskTop->insert(window);
}

void TWwdosApp::newTestWindow(const TRect& bounds)
{
    // Create window title
    windowNumber++;
    std::stringstream title;
    title << "Test Pattern " << windowNumber;
    
    // Create and insert window with provided bounds
    TTestPatternWindow* window = new TTestPatternWindow(bounds, title.str().c_str());
    deskTop->insert(window);
    registerWindow(window);
}

void TWwdosApp::newBrowserWindow()
{
    TRect r = deskTop->getExtent();
    r.grow(-3, -2);
    TWindow* window = createBrowserWindow(r);
    deskTop->insert(window);
    registerWindow(window);
    if (auto* browser = dynamic_cast<TBrowserWindow*>(window))
        browser->fetchUrl("https://symbient.life");
}

void TWwdosApp::newBrowserWindow(const TRect& bounds)
{
    TWindow* window = createBrowserWindow(bounds);
    deskTop->insert(window);
    registerWindow(window);
    if (auto* browser = dynamic_cast<TBrowserWindow*>(window))
        browser->fetchUrl("https://symbient.life");
}

void TWwdosApp::deliverScrambleReply()
{
    if (pendingScrambleReply.empty() || !scrambleWindow) return;
    std::string reply = std::move(pendingScrambleReply);
    pendingScrambleReply.clear();

    if (scrambleWindow->getView()) {
        scrambleWindow->getView()->setPose(spCurious);
        scrambleWindow->getView()->say(reply);
    }
    if (scrambleWindow->getMessageView()) {
        scrambleWindow->getMessageView()->addMessage("scramble", reply);
    }
}

void TWwdosApp::wireScrambleInput()
{
    if (!scrambleWindow || !scrambleWindow->getInputView()) return;

    scrambleWindow->getInputView()->onSubmit = [this](const std::string& input) {
        if (!scrambleWindow) return;

        // Add user message to history
        if (scrambleWindow->getMessageView()) {
            scrambleWindow->getMessageView()->addMessage("you", input);
        }

        // Log non-slash messages for multiplayer chat relay
        if (input.empty() || input[0] != '/') {
            chatLog_.push_back({++chatSeq_, "you", input});
            if ((int)chatLog_.size() > kChatLogMax)
                chatLog_.pop_front();
        }

        // Slash commands: check registry first, then fall through to engine.
        // /cascade, /screenshot, /scramble_pet → execute the registry command.
        // /scramble_say hello cat → cmdName="scramble_say", args="hello cat"
        if (!input.empty() && input[0] == '/' && input.size() > 1) {
            std::string rest = input.substr(1);
            // Split on first space: "scramble_say hello" → name="scramble_say" args="hello"
            std::string cmdName;
            std::string cmdArgs;
            size_t sp = rest.find(' ');
            if (sp != std::string::npos) {
                cmdName = rest.substr(0, sp);
                cmdArgs = rest.substr(sp + 1);
                // Strip leading spaces from args
                while (!cmdArgs.empty() && cmdArgs.front() == ' ') cmdArgs.erase(cmdArgs.begin());
            } else {
                cmdName = rest;
            }
            for (char& c : cmdName) if (c >= 'A' && c <= 'Z') c += 32;
            while (!cmdName.empty() && cmdName.back() == ' ') cmdName.pop_back();

            const auto& caps = get_command_capabilities();
            for (const auto& cap : caps) {
                if (cmdName == cap.name) {
                    // Pass args under all plausible param names — each command reads only one
                    std::map<std::string, std::string> kv;
                    if (!cmdArgs.empty()) {
                        kv["text"] = cmdArgs;
                        kv["path"] = cmdArgs;
                        kv["mode"] = cmdArgs;
                        kv["variant"] = cmdArgs;
                    }
                    std::string result = exec_registry_command(*this, cmdName, kv);
                    // If command returned a response (e.g. scramble_say returns text), show it
                    std::string ack;
                    if (result == "ok") {
                        ack = "done. /ᐠ- -ᐟ\\";
                    } else if (result.rfind("err", 0) == 0) {
                        ack = result + " (=^..^=)";
                    } else {
                        ack = result; // e.g. scramble_say returns the response text
                    }
                    // Only show ack in message view if scramble_say didn't already add it
                    if (cmdName != "scramble_say" && cmdName != "scramble_pet") {
                        if (scrambleWindow->getView()) {
                            scrambleWindow->getView()->say(ack);
                        }
                        if (scrambleWindow->getMessageView()) {
                            scrambleWindow->getMessageView()->addMessage("scramble", ack);
                        }
                    }
                    return;
                }
            }
            // Not in registry — engine handles /help, /who, /cmds, unknown
        }

        // Query engine (async for LLM, sync for slash commands)
        std::string syncResult;
        bool isAsync = scrambleEngine.askAsync(input, syncResult,
            [this](const std::string& response) {
                // Callback fires from poll() inside idle() — do NOT drawView() here.
                pendingScrambleReply = response.empty() ? "(no response from model — try again)" : response;
                // Clear spinner
                if (scrambleWindow && scrambleWindow->getInputView())
                    scrambleWindow->getInputView()->setThinking(false);
                TEvent event;
                event.what = evCommand;
                event.message.command = cmScrambleReply;
                event.message.infoPtr = nullptr;
                putEvent(event);
            });

        if (isAsync && scrambleWindow->getInputView()) {
            scrambleWindow->getInputView()->setThinking(true);
        }

        if (!isAsync) {
            // Slash command or fallback — deliver immediately (not from idle)
            pendingScrambleReply = syncResult.empty() ? "(no response from model — try again)" : syncResult;
            deliverScrambleReply();
        } else {
            // Show "thinking" state while async runs
            if (scrambleWindow && scrambleWindow->getView()) {
                scrambleWindow->getView()->setPose(spCurious);
                scrambleWindow->getView()->say("... *thinking* /ᐠ｡ꞈ｡ᐟ\\");
            }
        }
    };
}

void TWwdosApp::cycleScramble()
{
    if (!scrambleWindow || scrambleState == sdsHidden) {
        // Create at bottom-right corner of desktop in smol mode
        TRect desktop = deskTop->getExtent();
        int w = 38;
        int h = 14;
        TRect r(desktop.b.x - w - 1, desktop.b.y - h,
                desktop.b.x - 1,     desktop.b.y);
        scrambleWindow = static_cast<TScrambleWindow*>(createScrambleWindow(r, sdsSmol));
        scrambleState = sdsSmol;
        // Wire engine into view
        if (scrambleWindow->getView()) {
            scrambleWindow->getView()->setEngine(&scrambleEngine);
        }
        wireScrambleInput();
        deskTop->insert(scrambleWindow);
        // Put behind other windows (just in front of background)
        if (deskTop->background) {
            scrambleWindow->putInFrontOf((TView*)deskTop->background);
        }
    } else if (scrambleState == sdsSmol) {
        // Expand: smol -> tall
        TRect desktop = deskTop->getExtent();
        int w = 40;
        TRect r(desktop.b.x - w - 1, desktop.a.y,
                desktop.b.x - 1,     desktop.b.y);
        scrambleWindow->changeBounds(r);
        scrambleWindow->setDisplayState(sdsTall);
        scrambleState = sdsTall;
        scrambleWindow->focusInput();
        // Welcome message if history is empty
        if (scrambleWindow->getMessageView() &&
            scrambleWindow->getMessageView()->getMessages().empty()) {
            scrambleWindow->getMessageView()->addMessage("scramble", "mrrp! ask me anything (=^..^=)");
        }
    } else if (scrambleState == sdsTall) {
        // Remove existing Scramble window
        destroy(scrambleWindow);
        scrambleWindow = nullptr;
        scrambleState = sdsHidden;
    }
}

void TWwdosApp::cascade()
{
    deskTop->cascade(deskTop->getExtent());
}

void TWwdosApp::tile()
{
    deskTop->tile(deskTop->getExtent());
}

void TWwdosApp::closeAll(bool preserveSession)
{
    // Close windows on the desktop.
    // When preserveSession=true (default, used by menu and API close_all):
    //   Keeps Wib&Wob chat, terminals, and Scramble alive so the agent
    //   does not lose its communication channel.
    // When preserveSession=false (used by workspace restore):
    //   Closes everything for a clean slate.
    std::vector<TWindow*> toClose;
    TView *start = deskTop->first();
    if (start) {
        TView *v = start;
        do {
            TView *nextV = v->next;
            if (TWindow *w = dynamic_cast<TWindow*>(v)) {
                if (preserveSession &&
                    (dynamic_cast<TWibWobWindow*>(w) ||
                     dynamic_cast<TWibWobTerminalWindow*>(w) ||
                     dynamic_cast<TScrambleWindow*>(w))) {
                    v = nextV;
                    continue;
                }
                toClose.push_back(w);
            }
            v = nextV;
        } while (v != start);
    }
    for (auto *w : toClose) {
        if (w && (w->flags & wfClose))
            w->close();
    }
}

void TWwdosApp::newGradientWindow(TGradientWindow::GradientType type)
{
    // Create window title
    windowNumber++;
    std::stringstream title;
    
    switch (type)
    {
        case TGradientWindow::gtHorizontal:
            title << "Horizontal Gradient " << windowNumber;
            break;
        case TGradientWindow::gtVertical:
            title << "Vertical Gradient " << windowNumber;
            break;
        case TGradientWindow::gtRadial:
            title << "Radial Gradient " << windowNumber;
            break;
        case TGradientWindow::gtDiagonal:
            title << "Diagonal Gradient " << windowNumber;
            break;
    }
    
    // Calculate window position (cascade effect)
    int offset = (windowNumber - 1) % 10;
    TRect bounds(
        2 + offset * 2,           // left
        1 + offset,               // top
        50 + offset * 2,          // right
        15 + offset               // bottom
    );
    
    // Create and insert window
    TGradientWindow* window = new TGradientWindow(bounds, title.str().c_str(), type);
    deskTop->insert(window);
    registerWindow(window);
}

void TWwdosApp::newGradientWindow(TGradientWindow::GradientType type, const TRect& bounds)
{
    // Create window title
    windowNumber++;
    std::stringstream title;
    
    switch (type)
    {
        case TGradientWindow::gtHorizontal:
            title << "Horizontal Gradient " << windowNumber;
            break;
        case TGradientWindow::gtVertical:
            title << "Vertical Gradient " << windowNumber;
            break;
        case TGradientWindow::gtRadial:
            title << "Radial Gradient " << windowNumber;
            break;
        case TGradientWindow::gtDiagonal:
            title << "Diagonal Gradient " << windowNumber;
            break;
    }
    
    // Create and insert window with provided bounds
    TGradientWindow* window = new TGradientWindow(bounds, title.str().c_str(), type);
    deskTop->insert(window);
    registerWindow(window);
}

// void TWwdosApp::newMechWindow()
// {
//     // Create window title
//     windowNumber++;
//     std::stringstream title;
//     title << "Mechs Grid " << windowNumber;
//     
//     // Calculate window position (cascade effect)
//     int offset = (windowNumber - 1) % 10;
//     TRect bounds(
//         2 + offset * 2,           // left
//         1 + offset,               // top
//         70 + offset * 2,          // right (wider for mech grid)
//         30 + offset               // bottom (taller for mech grid)
//     );
//     
//     // Create and insert window
//     TMechWindow* window = new TMechWindow(bounds, title.str().c_str(), windowNumber);
//     deskTop->insert(window);
//     registerWindow(window);
// }

void TWwdosApp::newDonutWindow()
{
    // Create window title
    windowNumber++;
    std::stringstream title;
    title << "Donut Animation " << windowNumber;
    
    // Calculate window position (cascade effect)
    int offset = (windowNumber - 1) % 10;
    TRect bounds(
        2 + offset * 2,           // left
        1 + offset,               // top
        50 + offset * 2,          // right
        15 + offset               // bottom
    );
    
    // Create and insert window with donut.txt file (no title for minimalist aesthetic)
    // Path is relative to repo root (CWD when launched via ./build/app/test_pattern)
    TFrameAnimationWindow* window = new TFrameAnimationWindow(bounds, "", "app/donut.txt");
    deskTop->insert(window);
    registerWindow(window);
}

void TWwdosApp::newWibWobWindow()
{
    // Only one W&W chat window per instance — raise existing if already open.
    if (deskTop) {
        TView* v = deskTop->first();
        if (v) {
            TView* start = v;
            do {
                if (auto* ww = dynamic_cast<TWibWobWindow*>(v)) {
                    deskTop->setCurrent(ww, TDeskTop::normalSelect);
                    return;
                }
                v = v->next;
            } while (v != start);
        }
    }

    TRect bounds(2, 1, 82, 28);
    TWindow* window = createWibWobWindow(bounds, "Wib&Wob Chat");
    if (!window) {
        messageBox("Failed to create Wib&Wob Chat window.", mfError | mfOKButton);
        return;
    }

    deskTop->insert(window);
    registerWindow(window);
    window->select();
}

void TWwdosApp::newRoomChatWindow()
{
    windowNumber++;
    int offset = (windowNumber - 1) % 8;
    TRect bounds(
        4 + offset * 2,
        2 + offset,
        100 + offset * 2,
        28 + offset
    );
    TWindow* window = createRoomChatWindow(bounds);
    if (!window) {
        messageBox("Failed to create Room Chat window.", mfError | mfOKButton);
        return;
    }
    deskTop->insert(window);
    registerWindow(window);
    window->select();
}

void TWwdosApp::newWibWobTestWindowA()
{
    // Test window A: standardScrollBar() fix (minimal change approach)
    windowNumber++;
    std::stringstream title;
    title << "Test A: stdScrollBar " << windowNumber;

    int offset = (windowNumber - 1) % 10;
    TRect bounds(
        2 + offset * 2,
        1 + offset,
        82 + offset * 2,
        28 + offset
    );

    TWindow* window = createWibWobTestWindowA(bounds, title.str());
    if (!window) {
        messageBox("Failed to create Test A window.", mfError | mfOKButton);
        return;
    }

    deskTop->insert(window);
    registerWindow(window);
    window->select();
}

void TWwdosApp::newWibWobTestWindowB()
{
    // Test window B: TScroller-based (proper TV architecture)
    windowNumber++;
    std::stringstream title;
    title << "Test B: TScroller " << windowNumber;

    int offset = (windowNumber - 1) % 10;
    TRect bounds(
        2 + offset * 2,
        1 + offset,
        82 + offset * 2,
        28 + offset
    );

    TWindow* window = createWibWobTestWindowB(bounds, title.str());
    if (!window) {
        messageBox("Failed to create Test B window.", mfError | mfOKButton);
        return;
    }

    deskTop->insert(window);
    registerWindow(window);
    window->select();
}

void TWwdosApp::newWibWobTestWindowC()
{
    // Test window C: Split view architecture (MessageView + InputView)
    windowNumber++;
    std::stringstream title;
    title << "Test C: Split Arch " << windowNumber;

    int offset = (windowNumber - 1) % 10;
    TRect bounds(
        2 + offset * 2,
        1 + offset,
        82 + offset * 2,
        28 + offset
    );

    TWindow* window = createWibWobTestWindowC(bounds, title.str());
    if (!window) {
        messageBox("Failed to create Test C window.", mfError | mfOKButton);
        return;
    }

    deskTop->insert(window);
    registerWindow(window);
    window->select();
}

void TWwdosApp::openAnimationFile()
{
    char fileName[MAXPATH];
    std::string primerGlob = findPrimerDir() + "/*.txt";
    strcpy(fileName, primerGlob.c_str());

    TFileDialog* dialog = new TFileDialog(primerGlob.c_str(), "Open Text/Animation File", "~N~ame", fdOpenButton, 100);
    if (executeDialog(dialog, fileName) != cmCancel)
    {
        windowNumber++;
        
        // Auto-size window to file content
        TRect bounds = calculateWindowBounds(fileName);
        // Create window without title (empty string)
        TFrameAnimationWindow* window = new TFrameAnimationWindow(bounds, "", fileName);
        deskTop->insert(window);
        registerWindow(window);
    }
}

void TWwdosApp::openAnimationFilePath(const std::string& filePath)
{
    // Determine file type and create appropriate title
    windowNumber++;
    std::stringstream title;
    
    if (hasFrameDelimiters(filePath)) {
        title << "Animation " << windowNumber;
    } else {
        // Extract filename without path for text files
        size_t lastSlash = filePath.find_last_of("/\\");
        std::string baseName = (lastSlash != std::string::npos) ? filePath.substr(lastSlash + 1) : filePath;
        title << baseName << " - Text " << windowNumber;
    }
    
    // Auto-size window to file content
    TRect bounds = calculateWindowBounds(filePath);
    // Create and insert window with selected file
    TFrameAnimationWindow* window = new TFrameAnimationWindow(bounds, "", filePath);
    deskTop->insert(window);
    registerWindow(window);
}

void TWwdosApp::openAnimationFilePath(const std::string& filePath, const TRect& bounds, bool frameless, bool shadowless, const std::string& title)
{
    windowNumber++;
    // Create and insert window with provided bounds
    TFrameAnimationWindow* window = new TFrameAnimationWindow(bounds, title.c_str(), filePath, frameless, shadowless);
    deskTop->insert(window);
    registerWindow(window);
}

void TWwdosApp::openTransparentTextFile()
{
    char fileName[MAXPATH];
    std::string primerGlob = findPrimerDir() + "/*.txt";
    strcpy(fileName, primerGlob.c_str());

    TFileDialog* dialog = new TFileDialog(primerGlob.c_str(), "Open Text File (Transparent BG)", "~N~ame", fdOpenButton, 100);
    if (executeDialog(dialog, fileName) != cmCancel)
    {
        windowNumber++;

        // Extract filename without path for title
        std::string filePath(fileName);
        size_t lastSlash = filePath.find_last_of("/\\");
        std::string baseName = (lastSlash != std::string::npos) ? filePath.substr(lastSlash + 1) : filePath;

        std::stringstream title;
        title << baseName << " (Transparent)";

        // Calculate window position (cascade effect)
        int offset = (windowNumber - 1) % 10;
        TRect bounds(
            2 + offset * 2,           // left
            1 + offset,               // top
            82 + offset * 2,          // right (80 cols + frame)
            25 + offset               // bottom (24 rows + frame)
        );

        // Create transparent background text window
        TTransparentTextWindow* window = new TTransparentTextWindow(bounds, title.str(), filePath);
        deskTop->insert(window);
        registerWindow(window);
    }
}

void TWwdosApp::openMonodrawFile(const char* fileName)
{
    // Use curl to call the Monodraw API endpoint
    std::stringstream cmd;
    cmd << "curl -s -X POST 'http://127.0.0.1:8089/monodraw/load' "
        << "-H 'Content-Type: application/json' "
        << "-d '{\"file_path\": \"" << fileName << "\", "
        << "\"target\": \"text_editor\", "
        << "\"mode\": \"replace\", "
        << "\"flatten\": true, "
        << "\"insert_header\": true}' "
        << "> /dev/null 2>&1 &";  // Background, suppress output

    int result = std::system(cmd.str().c_str());

    if (result == 0) {
        std::string msg = "Importing Monodraw file to text editor...";
        messageBox(msg.c_str(), mfInformation | mfOKButton);
    } else {
        messageBox("Failed to import Monodraw file. Is API server running?", mfError | mfOKButton);
    }
}

void TWwdosApp::setPatternMode(bool continuous)
{
    USE_CONTINUOUS_PATTERN = continuous;

    // Show confirmation message
    std::string mode = continuous ? "Continuous (Diagonal)" : "Tiled (Cropped)";
    std::stringstream msg;
    msg << "Pattern mode set to: " << mode;
    messageBox(msg.str().c_str(), mfInformation | mfOKButton);
}


void TWwdosApp::showApiKeyDialog()
{
    // Build dialog
    TRect dlgRect(0, 0, 56, 14);
    dlgRect.move((TProgram::deskTop->size.x - 56) / 2,
                 (TProgram::deskTop->size.y - 14) / 2);

    TDialog* dlg = new TDialog(dlgRect, "API Key");

    dlg->insert(new TStaticText(TRect(3, 2, 53, 3),
        "Used by Scramble (Haiku) and Wib&Wob Chat."));
    dlg->insert(new TLabel(TRect(3, 4, 53, 5), "Anthropic API key (sk-ant-...):", nullptr));

    TRect inputRect(3, 5, 53, 6);
    TInputLine* input = new TInputLine(inputRect, 256);
    dlg->insert(input);

    // Status line showing current key state
    std::string status = runtimeApiKey.empty()
        ? "No key set (or use ANTHROPIC_API_KEY env var)"
        : "Key configured (runtime override active)";
    dlg->insert(new TStaticText(TRect(3, 7, 53, 8), status.c_str()));
    dlg->insert(new TStaticText(TRect(3, 8, 53, 9),
        "See Help > API Key Help for details."));

    TRect okRect(12, 10, 24, 12);
    TRect cancelRect(30, 10, 42, 12);
    dlg->insert(new TButton(okRect, "~O~K", cmOK, bfDefault));
    dlg->insert(new TButton(cancelRect, "Cancel", cmCancel, bfNormal));

    ushort result = TProgram::deskTop->execView(dlg);
    if (result == cmOK) {
        char keyBuf[256];
        input->getData(keyBuf);
        std::string key(keyBuf);
        // Trim whitespace
        while (!key.empty() && (key.back() == ' ' || key.back() == '\0'))
            key.pop_back();
        while (!key.empty() && key.front() == ' ')
            key.erase(key.begin());

        if (!key.empty()) {
            runtimeApiKey = key;
            // Wire to Scramble engine so it can use Haiku immediately.
            scrambleEngine.setApiKey(key);
            // Broadcast to all views (WibWobView picks this up to re-init its engine).
            message(deskTop, evBroadcast, cmApiKeyChanged, nullptr);
            fprintf(stderr, "[app] api key set via dialog (len=%zu) — wired to runtimeApiKey + scrambleEngine + broadcast\n",
                    key.size());
            if (key.substr(0, 6) == "sk-ant") {
                messageBox("API key set. Chat will use Anthropic API.",
                           mfInformation | mfOKButton);
            } else {
                messageBox("Key set, but doesn't look like an Anthropic key (expected sk-ant-...).",
                           mfWarning | mfOKButton);
            }
        } else {
            messageBox("No key entered.", mfWarning | mfOKButton);
        }
    }
    TObject::destroy(dlg);
}

void TWwdosApp::takeScreenshot(bool showDialog)
{
    // Create logs/screenshots/ directory if it doesn't exist.
    mkdir("logs", 0755);
    mkdir("logs/screenshots", 0755);

    // Generate timestamp for filenames.
    time_t rawtime;
    struct tm* timeinfo;
    char timestamp[80];
    time(&rawtime);
    timeinfo = localtime(&rawtime);
    strftime(timestamp, sizeof(timestamp), "%Y%m%d_%H%M%S", timeinfo);

    // 1) Authoritative in-process capture from Turbo Vision screen buffer.
    std::string base = std::string("logs/screenshots/tui_") + timestamp;
    std::string txtPath = base + ".txt";
    std::string ansiPath = base + ".ans";
    auto frame = getFrameCapture().captureScreen();

    CaptureOptions txtOpts;
    txtOpts.format = CaptureFormat::PlainText;
    txtOpts.addTimestamp = true;
    txtOpts.includeMetadata = true;
    bool txtOk = getFrameCapture().saveFrame(frame, txtPath, txtOpts);

    // ANSI export disabled by default — nobody uses it and it doubles
    // screenshot I/O.  Flip this to true or add a command param to re-enable.
    bool ansiOk = false;
    if (false) {
        CaptureOptions ansiOpts;
        ansiOpts.format = CaptureFormat::AnsiEscapes;
        ansiOpts.addTimestamp = true;
        ansiOpts.includeMetadata = true;
        ansiOk = getFrameCapture().saveFrame(frame, ansiPath, ansiOpts);
    }

    if (showDialog) {
        if (txtOk || ansiOk) {
            std::stringstream msg;
            msg << "Saved capture:";
            if (txtOk) msg << " " << txtPath;
            if (ansiOk) msg << " " << ansiPath;
            messageBox(msg.str().c_str(), mfInformation | mfOKButton);
        } else {
            messageBox("Capture failed (screen buffer paths failed).", mfError | mfOKButton);
        }
    }
}

// Custom monochrome palette with reversed main areas
// Palette indices:
// 0-7:   Desktop/Background (black background with pattern)
// 8-15:  Window frame colors 
// 16-23: Cyan window (alternate)
// 24-31: Gray window (alternate)
// 32-39: Dialog colors
// 40-47: Menu colors (reversed to black bg)
// 48-55: Status line colors (reversed to black bg)
// 56-63: Help colors
// 64+:   Additional elements

#define cpMonochrome \
    "\x70\x70\x0F\x07\x70\x70\x70\x07\x0F\x07\x07\x07\x70\x07\x0F" \
    "\x70\x0F\x70\x07\x07\x70\x07\x0F\x70\x7F\x7F\x70\x07\x70\x07\x0F" \
    "\x70\x7F\x7F\x70\x07\x70\x70\x7F\x7F\x07\x70\x0F\x70\x0F\x70\x07" \
    "\x0F\x0F\x0F\x70\x0F\x07\x70\x70\x70\x07\x70\x0F\x07\x07\x78\x00" \
    "\x70\xF0\x0F\x70\x07\x70\x70\x0F\x0F\x07\xF0\x7F\x08\x7F\xF0\x70" \
    "\x7F\x7F\x7F\x0F\x70\x70\x07\x70\x70\x70\x07\x7F\x70\x07\x08\x00" \
    "\x70\x7F\x7F\x70\x07\x70\x70\x7F\x7F\x07\x0F\x0F\x78\x0F\x78\x07" \
    "\x0F\x0F\x0F\x70\x0F\x07\x70\x70\x70\x07\x70\x0F\x07\x07\x78\x00" \
    "\x07\x0F\x07\x70\x70\x07\x0F\x70"

TPalette& TWwdosApp::getPalette() const
{
    static TPalette palette(cpMonochrome, sizeof(cpMonochrome)-1);
    return palette;
}

// Build "FIGlet ~F~ont ▶ { categories... | More Fonts... }" submenu item
// for the Edit menu bar. Returns a TSubMenu& that can be appended with +.
static TMenuItem& buildFigletFontSubMenu() {
    const auto& cat = figlet::catalogue();

    // Build "More Fonts..." as the tail item
    TMenuItem* tail = new TMenuItem("~M~ore Fonts...", cmFigletMoreFonts,
                                     kbNoKey, hcNoContext, nullptr, nullptr);
    TMenuItem* sep = &newLine();
    sep->next = tail;

    // Build category submenus in reverse order
    TMenuItem* catChain = sep;
    for (int c = (int)cat.categories.size() - 1; c >= 0; c--) {
        TMenuItem* catItems = figlet::buildCategoryMenuItems(
            cat.categories[c], cmFigletCatFontBase, "");
        if (!catItems) continue;
        TMenu* catSub = new TMenu(*catItems);
        std::string label = cat.categories[c].name;
        char* str = new char[label.size() + 1];
        std::strcpy(str, label.c_str());
        TMenuItem* item = new TMenuItem(str, kbNoKey, catSub, hcNoContext, catChain);
        catChain = item;
    }

    // Wrap as "FIGlet Font ▶ ..." submenu
    TMenu* fontMenu = new TMenu(*catChain);
    return *new TMenuItem("FIGlet ~F~ont", kbNoKey, fontMenu, hcNoContext, nullptr);
}

TMenuBar* TWwdosApp::initMenuBar(TRect r)
{
    r.b.y = r.a.y + 1;
    TMenuItem* recentSubmenu = buildRecentWorkspacesSubmenuItem();
    
    return new TCustomMenuBar(r,
        *new TSubMenu("~F~ile", kbAltF) +
            *new TMenuItem("New ~T~est Pattern", cmNewWindow, kbCtrlN) +
            *new TMenuItem("New ~H~-Gradient", cmNewGradientH, kbNoKey) +
            *new TMenuItem("New ~V~-Gradient", cmNewGradientV, kbNoKey) +
            *new TMenuItem("New ~R~adial Gradient", cmNewGradientR, kbNoKey) +
            *new TMenuItem("New ~D~iagonal Gradient", cmNewGradientD, kbNoKey) +
            // REMOVED E009: New Mechs Grid (dead end, handler commented out)
            *new TMenuItem("New ~A~nimation", cmNewDonut, kbCtrlD) +
            newLine() +
            *new TMenuItem("~O~pen Text/Animation...", cmOpenAnimation, kbCtrlO) +
            *new TMenuItem("Open I~m~age...", cmOpenImageFile, kbNoKey) +
            *new TMenuItem("Open Mo~n~odraw...", cmOpenMonodraw, kbNoKey) +
            newLine() +
            *new TMenuItem("~S~ave Workspace", cmSaveWorkspace, kbCtrlS) +
            *new TMenuItem("Save Workspace ~A~s...", cmSaveWorkspaceAs, kbNoKey) +
            *new TMenuItem("Open ~W~orkspace...", cmOpenWorkspace, kbNoKey) +
            *new TMenuItem("~M~anage Workspaces...", cmManageWorkspaces, kbNoKey) +
            *recentSubmenu +
            newLine() +
            *new TMenuItem("E~x~it", cmQuit, cmQuit, hcNoContext, "Alt-X") +
        *new TSubMenu("~E~dit", kbAltE) +
            *new TMenuItem("~C~opy Page", cmCopy, kbCtrlIns) +
            newLine() +
            *new TMenuItem("Sc~r~eenshot", cmScreenshot, kbCtrlP) +
            newLine() +
            (TMenuItem&) (
                *new TSubMenu("Pattern ~M~ode", kbNoKey) +
                    *new TMenuItem(USE_CONTINUOUS_PATTERN ? "\x04 ~C~ontinuous (Diagonal)" : "  ~C~ontinuous (Diagonal)", 
                                  cmPatternContinuous, kbNoKey) +
                    *new TMenuItem(!USE_CONTINUOUS_PATTERN ? "\x04 ~T~iled (Cropped)" : "  ~T~iled (Cropped)", 
                                  cmPatternTiled, kbNoKey)
            ) +
            newLine() +
            *new TMenuItem("FIGlet Edit ~T~ext...", cmFigletEditText, kbNoKey) +
            (TMenuItem&) buildFigletFontSubMenu() +
        *new TSubMenu("~V~iew", kbAltV) +
            *new TMenuItem("ASCII ~G~rid Demo", cmAsciiGridDemo, kbNoKey) +
            *new TMenuItem("~A~nimated Blocks", cmAnimatedBlocks, kbNoKey) +
            *new TMenuItem("Animated Gradie~n~t", cmAnimatedGradient, kbNoKey) +
            *new TMenuItem("Animated S~c~ore", cmAnimatedScore, kbNoKey) +
            *new TMenuItem("Score ~B~G Color...", cmScoreBgColor, kbNoKey) +
            *new TMenuItem("~V~erse Field (Generative)", cmVerseField, kbNoKey) +
            *new TMenuItem("~O~rbit Field (Generative)", cmOrbitField, kbNoKey) +
            *new TMenuItem("M~y~celium Field (Generative)", cmMyceliumField, kbNoKey) +
            *new TMenuItem("~T~orus Field (Generative)", cmTorusField, kbNoKey) +
            *new TMenuItem("C~u~be Spinner (Generative)", cmCubeField, kbNoKey) +
            *new TMenuItem("Monster ~P~ortal (Generative)", cmMonsterPortal, kbNoKey) +
            *new TMenuItem("Monster Ve~r~se (Generative)", cmMonsterVerse, kbNoKey) +
            *new TMenuItem("Monster Cam (Emo~j~i)", cmMonsterCam, kbNoKey) +
            *new TMenuItem("~C~ontour Studio", cmContourMap, kbNoKey) +
            *new TMenuItem("~G~enerative Lab", cmGenerativeLab, kbNoKey) +
            newLine() +
            *new TMenuItem("~A~pplications", cmAppLauncher, kbNoKey) +
            *new TMenuItem("ASCII ~G~allery", cmAsciiGallery, kbNoKey) +
            newLine() +
            (TMenuItem&)(
                *new TSubMenu("~G~ames", kbNoKey) +
                    *new TMenuItem("~M~icropolis City Builder", cmMicropolisAscii, kbNoKey) +
                    *new TMenuItem("~Q~uadra (Falling Blocks)", cmQuadra, kbNoKey) +
                    *new TMenuItem("~S~nake", cmSnake, kbNoKey) +
                    *new TMenuItem("Wib~W~ob Rogue", cmRogue, kbNoKey) +
                    *new TMenuItem("~D~eep Signal", cmDeepSignal, kbNoKey)
            ) +
            newLine() +
            *new TMenuItem("Pa~i~nt Canvas", cmNewPaintCanvas, kbNoKey) +
            *new TMenuItem("~F~IGlet Text", cmNewFigletText, kbNoKey) +
            newLine() +
            *new TMenuItem("Scra~m~ble Cat", cmScrambleCat, kbF8) +
        *new TSubMenu("~W~indow", kbAltW) +
            *new TMenuItem("~T~ext Editor", cmTextEditor, kbNoKey) +
            *new TMenuItem("~B~rowser", cmBrowser, kbCtrlB) +
            *new TMenuItem("Te~r~minal", cmOpenTerminal, kbNoKey) +
            *new TMenuItem("~O~pen Text File (Transparent)...", cmOpenTransparentText, kbNoKey) +
            newLine() +
            *new TMenuItem("~C~ascade", cmCascade, kbNoKey) +
            *new TMenuItem("Ti~l~e", cmTile, kbNoKey) +
            *new TMenuItem("Send to Bac~k~", cmSendToBack, kbNoKey) +
            newLine() +
            *new TMenuItem("~N~ext", cmNext, kbF6) +
            *new TMenuItem("~P~revious", cmPrev, kbShiftF6) +
            newLine() +
            *new TMenuItem("Clos~e~", cmClose, kbAltF3) +
            *new TMenuItem("Close ~A~ll", cmCloseAll, kbNoKey) +
            // REMOVED E009: Background Color... (retired for now)
        *new TSubMenu("~T~ools", kbAltT) +
            *new TMenuItem("~W~ib&Wob Chat", cmWibWobChat, kbF12) +
            *new TMenuItem("~R~oom Chat", cmRoomChat, kbNoKey) +
            // REMOVED E009: Test A/B/C (dev-only, type fallback to test_pattern)
            // REMOVED E009: Glitch Effects submenu (entire submenu disabled)
            // REMOVED E009: ANSI Editor, Animation Studio (placeholders)
            newLine() +
            *new TMenuItem("~Q~uantum Printer", cmQuantumPrinter, kbF11) +
            newLine() +
            *new TMenuItem("API ~K~ey...", cmApiKey, kbNoKey) +
        *new TSubMenu("~H~elp", kbAltH) +
            *new TMenuItem("~A~bout WIBWOBWORLD", cmAbout, kbNoKey) +
            *new TMenuItem("~K~eyboard Shortcuts", cmKeyboardShortcuts, kbNoKey) +
            *new TMenuItem("A~P~I Key Help", cmApiKeyHelp, kbNoKey) +
            *new TMenuItem("~L~LM Status", cmLlmStatus, kbNoKey)
    );
}

TStatusLine* TWwdosApp::initStatusLine(TRect r)
{
    r.a.y = r.b.y - 1;
    return new TCustomStatusLine(r,
        *new TStatusDef(0, 0xFFFF) +
            *new TStatusItem("~Alt-X~ Exit", kbAltX, cmQuit) +
            *new TStatusItem("~Ctrl-N~ New Window", kbCtrlN, cmNewWindow) +
            *new TStatusItem("~F5~ Repaint", kbF5, cmRepaint) +
            *new TStatusItem("~F6~ Next", kbF6, cmNext) +
            *new TStatusItem("~Alt-F3~ Close", kbAltF3, cmClose) +
            *new TStatusItem("~F8~ Scramble", kbF8, cmScrambleCat)
    );
}

// Implemented here because TWwdosApp must be fully defined first.
ApiIpcServer::ConnectionStatus TCustomStatusLine::getAppIpcStatus(void* appPtr) {
    auto* app = dynamic_cast<TWwdosApp*>(static_cast<TApplication*>(appPtr));
    if (app) {
        return app->getIpcStatus();
    }
    return {};
}

TDeskTop* TWwdosApp::initDeskTop(TRect r)
{
    r.a.y = 1;
    r.b.y--;
    TDeskTop* desktop = new TDeskTop(r);

    // Replace default TBackground with TWibWobBackground (colour-controllable)
    if (desktop->background) {
        TRect bgBounds = desktop->background->getBounds();
        desktop->remove(desktop->background);
        destroy(desktop->background);
        auto* bg = new TWibWobBackground(bgBounds, '\xB1', 7, 1);
        bg->growMode = gfGrowHiX | gfGrowHiY;
        desktop->background = bg;
        desktop->insertBefore(bg, desktop->first());
    }

    return desktop;
}


void TWwdosApp::run()
{
    // Call parent run to initialize everything first
    TApplication::run();
}

TRect TWwdosApp::calculateWindowBounds(const std::string& filePath)
{
    // If the file contains animation frame delimiters, size to the
    // largest frame (width/height). Otherwise, size to full text
    // dimensions (longest line, total lines).
    auto capToDesktop = [&](int &w, int &h) {
        TRect screenBounds = deskTop->getExtent();
        int screenWidth = screenBounds.b.x;
        int screenHeight = screenBounds.b.y;
        // Hard caps: allow max width to use full desktop width; keep height within desktop.
        if (w > screenWidth) w = screenWidth;
        if (h > screenHeight - 2) h = screenHeight - 2; // never taller than app
        // Minimum sensible size
        if (w < 20) w = 20;
        if (h < 5) h = 5;
    };

    std::ifstream file(filePath, std::ios::in | std::ios::binary);
    if (!file.is_open()) {
        int ww = 50, hh = 15;
        capToDesktop(ww, hh);
        return TRect(2, 1, 2 + ww, 1 + hh);
    }

    const std::string delim = "----";
    bool treatAsAnimation = hasFrameDelimiters(filePath);

    int maxWidth = 0;
    int maxHeight = 0;

    if (treatAsAnimation) {
        // Track width/height per frame; split on exact delimiter lines (CR before LF allowed).
        std::string line;
        int curHeight = 0;
        int curWidthMax = 0;
        auto commitFrame = [&]() {
            if (curHeight > 0 || curWidthMax > 0) {
                if (curWidthMax > maxWidth) maxWidth = curWidthMax;
                if (curHeight > maxHeight) maxHeight = curHeight;
            }
            curHeight = 0;
            curWidthMax = 0;
        };
        while (std::getline(file, line)) {
            // Trim trailing CR
            if (!line.empty() && line.back() == '\r') line.pop_back();
            if (line == delim) {
                commitFrame();
                continue;
            }
            // Measure display columns (UTF-8 aware) instead of byte length.
            int lineWidth = (int)TText::width(TStringView(line.c_str(), line.size()));
            if (lineWidth > curWidthMax) curWidthMax = lineWidth;
            curHeight++;
        }
        commitFrame();
        // Fallback: if no delimiters in content (edge case), use collected totals
        if (maxHeight == 0 && maxWidth == 0) {
            // Treat whole file as one frame
            file.clear();
            file.seekg(0);
            int h = 0, w = 0;
            while (std::getline(file, line)) {
                if (!line.empty() && line.back() == '\r') line.pop_back();
                w = std::max(w, (int)TText::width(TStringView(line.c_str(), line.size())));
                h++;
            }
            maxWidth = w;
            maxHeight = h;
        }
    } else {
        // Plain text: longest line and total line count
        std::string line;
        int height = 0;
        while (std::getline(file, line)) {
            if (!line.empty() && line.back() == '\r') line.pop_back();
            int lineWidth = (int)TText::width(TStringView(line.c_str(), line.size()));
            if (lineWidth > maxWidth) maxWidth = lineWidth;
            height++;
        }
        maxHeight = height;
    }
    file.close();

    // Add padding for window frame (borders): +2 width, +2 height
    int windowWidth = maxWidth + 2;
    int windowHeight = maxHeight + 2;
    capToDesktop(windowWidth, windowHeight);

    // Center on desktop
    TRect screenBounds = deskTop->getExtent();
    int screenWidth = screenBounds.b.x;
    int screenHeight = screenBounds.b.y;
    int x = std::max(0, (screenWidth - windowWidth) / 2);
    int y = std::max(0, (screenHeight - windowHeight) / 2);
    return TRect(x, y, x + windowWidth, y + windowHeight);
}

void TWwdosApp::idle()
{
    TApplication::idle();

    // Poll IPC server for incoming API commands
    if (ipcServer) ipcServer->poll();
    // Poll Scramble async LLM calls (non-blocking)
    scrambleEngine.poll();

    // DISABLED: Update animated kaomoji in menu bar (causing crashes + freezes)
    // if (menuBar) {
    //     auto* customMenuBar = dynamic_cast<TCustomMenuBar*>(menuBar);
    //     if (customMenuBar) {
    //         customMenuBar->update();
    //     }
    // }

    // Broadcast terminal update check so tvterm windows refresh
    message(this, evBroadcast, TWibWobTerminalWindow::termConsts.cmCheckTerminalUpdates, nullptr);
}

int main()
{
    // Detect auth mode once before any LLM consumer initialises.
    AuthConfig::instance().detect();

    TWwdosApp app;
    app.run();
    return 0;
}

// ---- IPC API helper functions (friend) ----
// Backward compatibility overloads
void api_spawn_test(TWwdosApp& app) { app.newTestWindow(); }
void api_spawn_gradient(TWwdosApp& app, const std::string& kind) {
    if (kind == "horizontal") app.newGradientWindow(TGradientWindow::gtHorizontal);
    else if (kind == "vertical") app.newGradientWindow(TGradientWindow::gtVertical);
    else if (kind == "radial") app.newGradientWindow(TGradientWindow::gtRadial);
    else if (kind == "diagonal") app.newGradientWindow(TGradientWindow::gtDiagonal);
    else app.newGradientWindow(TGradientWindow::gtHorizontal);
}
void api_open_animation_path(TWwdosApp& app, const std::string& path) {
    app.openAnimationFilePath(path);
}

// New overloads with bounds support
void api_spawn_test(TWwdosApp& app, const TRect* bounds) { 
    if (bounds) {
        app.newTestWindow(*bounds);
    } else {
        app.newTestWindow();
    }
}

void api_spawn_gradient(TWwdosApp& app, const std::string& kind, const TRect* bounds) {
    TGradientWindow::GradientType type = TGradientWindow::gtHorizontal;
    if (kind == "horizontal") type = TGradientWindow::gtHorizontal;
    else if (kind == "vertical") type = TGradientWindow::gtVertical;
    else if (kind == "radial") type = TGradientWindow::gtRadial;
    else if (kind == "diagonal") type = TGradientWindow::gtDiagonal;
    
    if (bounds) {
        app.newGradientWindow(type, *bounds);
    } else {
        app.newGradientWindow(type);
    }
}

void api_open_text_view_path(TWwdosApp& app, const std::string& path, const TRect* bounds) {
    if (path.empty()) return;
    app.windowNumber++;
    size_t lastSlash = path.find_last_of("/\\");
    std::string baseName = (lastSlash != std::string::npos) ? path.substr(lastSlash + 1) : path;
    std::string title = baseName + " (Transparent)";
    TRect r;
    if (bounds && (bounds->b.x - bounds->a.x) > 0 && (bounds->b.y - bounds->a.y) > 0) {
        r = *bounds;
    } else {
        int offset = (app.windowNumber - 1) % 10;
        r = TRect(2 + offset * 2, 1 + offset, 82 + offset * 2, 25 + offset);
    }
    TTransparentTextWindow* window = new TTransparentTextWindow(r, title, path);
    app.deskTop->insert(window);
    app.registerWindow(window);
}

void api_open_animation_path(TWwdosApp& app, const std::string& path, const TRect* bounds, bool frameless, bool shadowless, const std::string& title) {
    if (bounds) {
        app.openAnimationFilePath(path, *bounds, frameless, shadowless, title);
    } else if (frameless || shadowless) {
        TRect autoBounds = app.calculateWindowBounds(path);
        app.openAnimationFilePath(path, autoBounds, frameless, shadowless, title);
    } else {
        app.openAnimationFilePath(path);
    }
}

void api_cascade(TWwdosApp& app) { app.cascade(); }
void api_toggle_scramble(TWwdosApp& app) { app.cycleScramble(); }
void api_expand_scramble(TWwdosApp& app) { app.cycleScramble(); }

std::string api_scramble_say(TWwdosApp& app, const std::string& text) {
    if (!app.scrambleWindow) return "err scramble not open";
    // Simulate user sending a message — same as onSubmit
    auto* msgView = app.scrambleWindow->getMessageView();
    if (msgView) msgView->addMessage("you", text);

    // Use async path — response arrives via cmScrambleReply event
    std::string syncResult;
    bool isAsync = app.scrambleEngine.askAsync(text, syncResult,
        [&app](const std::string& response) {
            // Queue for event-loop delivery (never drawView from idle)
            app.pendingScrambleReply = response.empty() ? "(no response from model — try again)" : response;
            TEvent event;
            event.what = evCommand;
            event.message.command = cmScrambleReply;
            event.message.infoPtr = nullptr;
            app.putEvent(event);
        });

    if (!isAsync) {
        // Slash command or fallback — deliver immediately
        app.pendingScrambleReply = syncResult.empty() ? "(no response from model — try again)" : syncResult;
        app.deliverScrambleReply();
        return app.pendingScrambleReply.empty() ? syncResult : syncResult;
    }

    return "*thinking* /ᐠ｡ꞈ｡ᐟ\\";  // Async started — response will arrive via event
}
std::string api_scramble_pet(TWwdosApp& app) {
    if (!app.scrambleWindow) return "err scramble not open";

    static const char* petReactions[] = {
        "...fine. /ᐠ- -ᐟ\\",
        "*allows it* (=^..^=)",
        "adequate petting technique. /ᐠ｡ꞈ｡ᐟ\\",
        "i did not ask for this. and yet. (=^..^=)",
        "*purrs once. stops. stares* /ᐠ°ᆽ°ᐟ\\",
    };
    std::string response = petReactions[std::rand() % 5];

    if (app.scrambleWindow->getView()) {
        app.scrambleWindow->getView()->setPose(spDefault);
        app.scrambleWindow->getView()->say(response);
    }
    auto* msgView = app.scrambleWindow->getMessageView();
    if (msgView) msgView->addMessage("scramble", response);
    return response;
}

std::string api_chat_receive(TWwdosApp& app, const std::string& sender, const std::string& text) {
    // Display a remote chat message in Scramble without AI processing.
    if (!app.scrambleWindow) return "err scramble not open";
    auto* msgView = app.scrambleWindow->getMessageView();
    if (!msgView) return "err no message view";
    msgView->addMessage(sender, text);
    return "ok";
}

static TWibWobWindow* findTargetWibWobWindow(TWwdosApp& app) {
    if (!app.deskTop) return nullptr;

    // Prefer the focused Wib&Wob window so ask/history operate on the same UI.
    if (auto* ww = dynamic_cast<TWibWobWindow*>(app.deskTop->current)) {
        return ww;
    }

    // Fallback: first Wib&Wob window on the desktop.
    TView* v = app.deskTop->first();
    if (!v) return nullptr;
    TView* start = v;
    do {
        if (auto* ww = dynamic_cast<TWibWobWindow*>(v)) {
            return ww;
        }
        v = v->next;
    } while (v != start);
    return nullptr;
}

std::string api_wibwob_ask(TWwdosApp& app, const std::string& text) {
    // Inject a user message into the Wib&Wob chat window, triggering LLM response.
    fprintf(stderr, "[wibwob_ask] called, text_len=%zu text=%.60s\n",
            text.size(), text.c_str());
    // Find the target Wib&Wob window (prefer current/focused).
    TWibWobWindow* chatWin = nullptr;
    int windowCount = 0;
    if (app.deskTop) {
        TView* v = app.deskTop->first();
        if (v) {
            TView* start = v;
            do {
                windowCount++;
                if (!chatWin) chatWin = dynamic_cast<TWibWobWindow*>(v);
                v = v->next;
            } while (v != start);
        }
    }
    if (auto* preferred = findTargetWibWobWindow(app)) {
        chatWin = preferred;
    }
    if (!chatWin) {
        fprintf(stderr, "[wibwob_ask] ERROR: no TWibWobWindow found (%d views on desktop)\n", windowCount);
        return "err no wibwob chat window open";
    }
    fprintf(stderr, "[wibwob_ask] target chatWin=%p, sending window event\n", (void*)chatWin);
    // Send to the chosen Wib&Wob window only. ApiIpcServer::poll() runs on the
    // Turbo Vision thread, so direct delivery is safe and avoids cross-window drift.
    static std::string pendingAsk;
    pendingAsk = text;
    message(chatWin, evBroadcast, 0xF0F0, &pendingAsk); // cmWibWobAskPending
    return "ok queued";
}

std::string api_get_chat_history(TWwdosApp& app) {
    // Use the same target selection as api_wibwob_ask() to avoid reading the
    // history from a different Wib&Wob window than the one that processed input.
    TWibWobWindow* chatWin = findTargetWibWobWindow(app);
    if (!chatWin) return "err no wibwob chat window open";
    auto* msgView = chatWin->getMessageView();
    if (!msgView) return "err no wibwob message view";
    return std::string("{\"messages\":") + msgView->getHistoryJson() + "}";
}

void api_tile(TWwdosApp& app) { app.tile(); }
void api_close_all(TWwdosApp& app) { app.closeAll(); }

void api_set_pattern_mode(TWwdosApp& app, const std::string& mode) {
    bool continuous = (mode == "continuous");
    // Set the mode directly without showing a modal dialog (which blocks the event loop).
    USE_CONTINUOUS_PATTERN = continuous;
}

void api_save_workspace(TWwdosApp& app) {
    // Use saveWorkspacePath instead of saveWorkspace() to avoid modal dialog
    // that blocks the IPC thread when triggered via API.
    mkdir("workspaces", 0755);
    app.saveWorkspacePath("workspaces/last_workspace.json");
    // Also write a timestamped snapshot (matching saveWorkspace behaviour)
    char tsName[32];
    std::time_t t = std::time(nullptr);
    std::tm *lt = std::localtime(&t);
    std::strftime(tsName, sizeof(tsName), "%y%m%d_%H%M", lt);
    std::string snapPath = std::string("workspaces/last_workspace_") + tsName + ".json";
    app.saveWorkspacePath(snapPath);
}
bool api_save_workspace_path(TWwdosApp& app, const std::string& path) { return app.saveWorkspacePath(path); }

bool api_open_workspace_path(TWwdosApp& app, const std::string& path) {
    return app.openWorkspacePath(path);
}

void api_screenshot(TWwdosApp& app) { app.takeScreenshot(false); }

std::string api_take_last_registered_window_id(TWwdosApp& app) {
    std::string out = app.lastRegisteredWindowId_;
    app.lastRegisteredWindowId_.clear();
    return out;
}

static const char* windowTypeName(TWindow* w) {
    const auto& specs = all_window_type_specs();
    for (const auto& spec : specs) {
        if (spec.matches && spec.matches(w))
            return spec.type;
    }
    // Fallback to first registry entry (canonical default type slug).
    return specs.empty() ? "test_pattern" : specs.front().type;
}

std::string api_get_state(TWwdosApp& app) {
    // Collect currently visible windows in desktop Z-order.
    // Do NOT clear winToId/idToWin here — that would reassign new IDs on
    // every call, causing compute_delta to see "new" windows every poll.
    std::vector<TWindow*> activeWins;
    TView *start = app.deskTop->first();
    if (start) {
        TView *v = start;
        do {
            TWindow *w = dynamic_cast<TWindow*>(v);
            if (w) activeWins.push_back(w);
            v = v->next;
        } while (v != start);
    }

    // Purge registry entries for windows that have been closed (stale pointers).
    // Only purge; never clear — existing live windows keep their stable IDs.
    {
        auto it = app.winToId.begin();
        while (it != app.winToId.end()) {
            bool alive = false;
            for (auto* aw : activeWins) { if (aw == it->first) { alive = true; break; } }
            if (!alive) {
                app.idToWin.erase(it->second);
                it = app.winToId.erase(it);
            } else {
                ++it;
            }
        }
    }

    std::stringstream json;
    json << "{\"windows\":[";

    bool first = true;
    int z = 0;
    for (TWindow* w : activeWins) {
        std::string id = app.registerWindow(w, false);
        bool focused = (w == app.deskTop->current);
        if (!first) json << ",";
        json << "{\"id\":\"" << id << "\""
             << ",\"type\":\"" << windowTypeName(w) << "\""
             << ",\"x\":" << w->origin.x
             << ",\"y\":" << w->origin.y
             << ",\"w\":" << w->size.x
             << ",\"h\":" << w->size.y
             << ",\"z\":" << z
             << ",\"focused\":" << (focused ? "true" : "false")
             << ",\"title\":\"";
        if (w->title) {
            std::string title(w->title);
            for (char c : title) {
                if (c == '"') json << "\\\"";
                else if (c == '\\') json << "\\\\";
                else json << c;
            }
        }
        json << "\"";
        // Emit path for file-backed window types (needed for remote create_window)
        if (auto* ttw = dynamic_cast<TTransparentTextWindow*>(w)) {
            const std::string& p = ttw->getFilePath();
            if (!p.empty()) json << ",\"path\":\"" << json_escape(p) << "\"";
        } else if (auto* faw = dynamic_cast<TFrameAnimationWindow*>(w)) {
            const std::string& p = faw->getFilePath();
            if (!p.empty()) json << ",\"path\":\"" << json_escape(p) << "\"";
        }
        json << "}";
        first = false;
        ++z;
    }

    json << "]";

    // Append chat_log for multiplayer relay bridge
    json << ",\"chat_log\":[";
    bool firstChat = true;
    for (const auto& entry : app.chatLog_) {
        if (!firstChat) json << ",";
        json << "{\"seq\":" << entry.seq
             << ",\"sender\":\"" << json_escape(entry.sender) << "\""
             << ",\"text\":\"" << json_escape(entry.text) << "\"}";
        firstChat = false;
    }
    json << "]";

    // Desktop size for proportional layout calculations
    TRect desk = TProgram::deskTop->getExtent();
    json << ",\"desktop\":{\"w\":" << (desk.b.x - desk.a.x)
         << ",\"h\":" << (desk.b.y - desk.a.y)
         << ",\"cell_aspect\":2.0}";

    json << "}";
    return json.str();
}

std::string api_move_window(TWwdosApp& app, const std::string& id, int x, int y) {
    TWindow* w = app.findWindowById(id);
    if (!w) return "{\"error\":\"Window not found\"}";

    TRect newBounds = w->getBounds();
    newBounds.move(x - newBounds.a.x, y - newBounds.a.y);
    TRect desk = TProgram::deskTop->getExtent();
    TRect clamped = clampToDesktop(newBounds, desk);
    w->locate(clamped);

    if (app.ipcServer) {
        std::string payload = std::string("{\"id\":\"") + id + "\"}";
        app.ipcServer->publish_event("state_changed", payload);
    }
    return "{\"success\":true}";
}

std::string api_resize_window(TWwdosApp& app, const std::string& id, int width, int height) {
    TWindow* w = app.findWindowById(id);
    if (!w) return "{\"error\":\"Window not found\"}";

    TRect newBounds = w->getBounds();
    newBounds.b.x = newBounds.a.x + width;
    newBounds.b.y = newBounds.a.y + height;
    TRect desk = TProgram::deskTop->getExtent();
    TRect clamped = clampToDesktop(newBounds, desk);
    w->locate(clamped);

    if (app.ipcServer) {
        std::string payload = std::string("{\"id\":\"") + id + "\"}";
        app.ipcServer->publish_event("state_changed", payload);
    }
    return "{\"success\":true}";
}

std::string api_focus_window(TWwdosApp& app, const std::string& id) {
    TWindow* w = app.findWindowById(id);
    if (!w) return "{\"error\":\"Window not found\"}";
    
    w->select();  // raises to front AND focuses (uses makeFirst → putInFrontOf)
    return "{\"success\":true}";
}

std::string api_raise_window(TWwdosApp& app, const std::string& id) {
    TWindow* w = app.findWindowById(id);
    if (!w) return "{\"error\":\"Window not found\"}";
    w->select();
    return "{\"success\":true}";
}

std::string api_lower_window(TWwdosApp& app, const std::string& id) {
    TWindow* w = app.findWindowById(id);
    if (!w) return "{\"error\":\"Window not found\"}";
    // putInFrontOf(background) sends to back of z-stack but above wallpaper
    if (app.deskTop->background) {
        w->putInFrontOf(app.deskTop->background);
    }
    return "{\"success\":true}";
}

std::string api_close_window(TWwdosApp& app, const std::string& id) {
    TWindow* w = app.findWindowById(id);
    if (!w) return "{\"error\":\"Window not found\"}";

    auto isWindowAlive = [&](TWindow* target) -> bool {
        if (!target) return false;
        TView* start = app.deskTop->first();
        if (!start) return false;
        TView* v = start;
        do {
            if (v == target) return true;
            v = v->next;
        } while (v != start);
        return false;
    };

    // Ask the window to close itself through Turbo Vision's normal flow.
    // This lets destructors run in the correct order (sub-views kill timers,
    // threads, etc.). We do NOT force-remove+destroy if close() is rejected
    // — that path caused UAF with timer callbacks in room_chat and similar.
    w->close();
    if (isWindowAlive(w))
        return "{\"error\":\"Window rejected close\"}";

    // Remove from registry after successful removal.
    app.winToId.erase(w);
    app.idToWin.erase(id);

    if (app.ipcServer) {
        std::string payload = std::string("{\"id\":\"") + id + "\"}";
        app.ipcServer->publish_event("window_closed", payload);
        app.ipcServer->publish_event("state_changed", payload);
    }

    return "{\"success\":true}";
}

std::string api_window_shadow(TWwdosApp& app, const std::string& id, bool on) {
    TWindow* w = app.findWindowById(id);
    if (!w) return "err window not found";
    w->setState(sfShadow, on);
    w->owner->drawView();  // redraw desktop to clear/show shadow
    return "ok";
}

std::string api_window_title(TWwdosApp& app, const std::string& id, const std::string& title) {
    TWindow* w = app.findWindowById(id);
    if (!w) return "err window not found";
    delete[] (char*)w->title;
    w->title = title.empty() ? nullptr : newStr(title);
    w->frame->drawView();
    return "ok";
}

// --- Minimal JSON parsing helpers (subset tailored to our schema) ---
void TWwdosApp::skipWs(const std::string &s, size_t &pos)
{
    while (pos < s.size() && (s[pos] == ' ' || s[pos] == '\n' || s[pos] == '\r' || s[pos] == '\t')) ++pos;
}

bool TWwdosApp::consume(const std::string &s, size_t &pos, char ch)
{
    skipWs(s, pos);
    if (pos < s.size() && s[pos] == ch) { ++pos; return true; }
    return false;
}

bool TWwdosApp::parseString(const std::string &s, size_t &pos, std::string &out)
{
    skipWs(s, pos);
    if (pos >= s.size() || s[pos] != '"') return false;
    ++pos;
    std::string res;
    while (pos < s.size()) {
        char c = s[pos++];
        if (c == '"') { out = res; return true; }
        if (c == '\\') {
            if (pos >= s.size()) return false;
            char e = s[pos++];
            switch (e) {
                case '"': res.push_back('"'); break;
                case '\\': res.push_back('\\'); break;
                case 'n': res.push_back('\n'); break;
                case 'r': res.push_back('\r'); break;
                case 't': res.push_back('\t'); break;
                default: res.push_back(e); break;
            }
        } else res.push_back(c);
    }
    return false;
}

bool TWwdosApp::parseNumber(const std::string &s, size_t &pos, int &out)
{
    skipWs(s, pos);
    bool neg = false;
    if (pos < s.size() && (s[pos] == '-' || s[pos] == '+')) { neg = (s[pos] == '-'); ++pos; }
    long val = 0; bool any=false;
    while (pos < s.size() && s[pos] >= '0' && s[pos] <= '9') { any=true; val = val*10 + (s[pos]-'0'); ++pos; }
    if (!any) return false;
    out = neg ? -int(val) : int(val);
    return true;
}

bool TWwdosApp::parseBool(const std::string &s, size_t &pos, bool &out)
{
    skipWs(s, pos);
    if (s.compare(pos, 4, "true") == 0) { out = true; pos += 4; return true; }
    if (s.compare(pos, 5, "false") == 0) { out = false; pos += 5; return true; }
    return false;
}

bool TWwdosApp::parseKeyedString(const std::string &s, size_t objStart, const char *key, std::string &out)
{
    size_t pos = objStart;
    while (pos < s.size()) {
        skipWs(s, pos);
        if (s[pos] == '}' || s[pos] == ']') return false;
        std::string k; size_t kpos = pos;
        if (!parseString(s, kpos, k)) { ++pos; continue; }
        pos = kpos; skipWs(s, pos);
        if (!consume(s, pos, ':')) continue;
        if (k == key) {
            return parseString(s, pos, out);
        }
        // Skip value
        skipWs(s, pos);
        if (pos>=s.size()) break;
        if (s[pos] == '"') { std::string tmp; parseString(s, pos, tmp); }
        else if ((s[pos] >= '0' && s[pos] <= '9') || s[pos]=='-' || s[pos]=='+') { int dummy; parseNumber(s, pos, dummy); }
        else if (s[pos] == 't' || s[pos] == 'f') { bool db; parseBool(s, pos, db); }
        else if (s[pos] == '{') { int depth=1; ++pos; while (pos<s.size()&&depth){ if(s[pos]=='"'){ ++pos; while(pos<s.size()&&s[pos]!='"'){ if(s[pos]=='\\') ++pos; ++pos;} ++pos; continue;} if(s[pos]=='{')depth++; else if(s[pos]=='}')depth--; ++pos; } }
        else if (s[pos] == '[') { int depth=1; ++pos; while (pos<s.size()&&depth){ if(s[pos]=='"'){ ++pos; while(pos<s.size()&&s[pos]!='"'){ if(s[pos]=='\\') ++pos; ++pos;} ++pos; continue;} if(s[pos]=='[')depth++; else if(s[pos]==']')depth--; ++pos; } }
        skipWs(s, pos); if (pos<s.size() && s[pos]==',') ++pos;
    }
    return false;
}

bool TWwdosApp::parseKeyedNumber(const std::string &s, size_t objStart, const char *key, int &out)
{
    size_t pos = objStart;
    while (pos < s.size()) {
        skipWs(s, pos);
        if (s[pos] == '}' || s[pos] == ']') return false;
        std::string k; size_t kpos = pos;
        if (!parseString(s, kpos, k)) { ++pos; continue; }
        pos = kpos; skipWs(s, pos);
        if (!consume(s, pos, ':')) continue;
        if (k == key) {
            return parseNumber(s, pos, out);
        }
        // Skip value
        skipWs(s, pos);
        if (pos>=s.size()) break;
        if (s[pos] == '"') { std::string tmp; parseString(s, pos, tmp); }
        else if ((s[pos] >= '0' && s[pos] <= '9') || s[pos]=='-' || s[pos]=='+') { int dummy; parseNumber(s, pos, dummy); }
        else if (s[pos] == 't' || s[pos] == 'f') { bool db; parseBool(s, pos, db); }
        else if (s[pos] == '{') { int depth=1; ++pos; while (pos<s.size()&&depth){ if(s[pos]=='"'){ ++pos; while(pos<s.size()&&s[pos]!='"'){ if(s[pos]=='\\') ++pos; ++pos;} ++pos; continue;} if(s[pos]=='{')depth++; else if(s[pos]=='}')depth--; ++pos; } }
        else if (s[pos] == '[') { int depth=1; ++pos; while (pos<s.size()&&depth){ if(s[pos]=='"'){ ++pos; while(pos<s.size()&&s[pos]!='"'){ if(s[pos]=='\\') ++pos; ++pos;} ++pos; continue;} if(s[pos]=='[')depth++; else if(s[pos]==']')depth--; ++pos; } }
        skipWs(s, pos); if (pos<s.size() && s[pos]==',') ++pos;
    }
    return false;
}

bool TWwdosApp::parseKeyedBool(const std::string &s, size_t objStart, const char *key, bool &out)
{
    size_t pos = objStart;
    while (pos < s.size()) {
        skipWs(s, pos);
        if (s[pos] == '}' || s[pos] == ']') return false;
        std::string k; size_t kpos = pos;
        if (!parseString(s, kpos, k)) { ++pos; continue; }
        pos = kpos; skipWs(s, pos);
        if (!consume(s, pos, ':')) continue;
        if (k == key) {
            return parseBool(s, pos, out);
        }
        // Skip value
        skipWs(s, pos);
        if (pos>=s.size()) break;
        if (s[pos] == '"') { std::string tmp; parseString(s, pos, tmp); }
        else if ((s[pos] >= '0' && s[pos] <= '9') || s[pos]=='-' || s[pos]=='+') { int dummy; parseNumber(s, pos, dummy); }
        else if (s[pos] == 't' || s[pos] == 'f') { bool db; parseBool(s, pos, db); }
        else if (s[pos] == '{') { int depth=1; ++pos; while (pos<s.size()&&depth){ if(s[pos]=='"'){ ++pos; while(pos<s.size()&&s[pos]!='"'){ if(s[pos]=='\\') ++pos; ++pos;} ++pos; continue;} if(s[pos]=='{')depth++; else if(s[pos]=='}')depth--; ++pos; } }
        else if (s[pos] == '[') { int depth=1; ++pos; while (pos<s.size()&&depth){ if(s[pos]=='"'){ ++pos; while(pos<s.size()&&s[pos]!='"'){ if(s[pos]=='\\') ++pos; ++pos;} ++pos; continue;} if(s[pos]=='[')depth++; else if(s[pos]==']')depth--; ++pos; } }
        skipWs(s, pos); if (pos<s.size() && s[pos]==',') ++pos;
    }
    return false;
}

bool TWwdosApp::parseBounds(const std::string &s, size_t objStart, int &x,int &y,int &w,int &h)
{
    size_t pos = objStart;
    while (pos < s.size()) {
        skipWs(s, pos);
        if (s[pos] == '}' || s[pos] == ']') return false;
        std::string k; size_t kpos = pos;
        if (!parseString(s, kpos, k)) { ++pos; continue; }
        pos = kpos; skipWs(s, pos);
        if (!consume(s, pos, ':')) continue;
        if (k == "bounds") {
            skipWs(s, pos);
            if (!consume(s, pos, '{')) return false;
            int tx=0,ty=0,tw=0,th=0; bool okX=false,okY=false,okW=false,okH=false;
            while (pos < s.size()) {
                skipWs(s, pos);
                if (s[pos] == '}') { ++pos; break; }
                std::string bk; if (!parseString(s, pos, bk)) return false; if (!consume(s,pos,':')) return false;
                if (bk == "x") { okX = parseNumber(s,pos,tx); }
                else if (bk == "y") { okY = parseNumber(s,pos,ty); }
                else if (bk == "w") { okW = parseNumber(s,pos,tw); }
                else if (bk == "h") { okH = parseNumber(s,pos,th); }
                skipWs(s,pos); if (pos<s.size() && s[pos]==',') ++pos;
            }
            if (okX && okY && okW && okH) { x=tx; y=ty; w=tw; h=th; return true; }
            return false;
        }
        // Skip value
        skipWs(s, pos);
        if (pos>=s.size()) break;
        if (s[pos] == '"') { std::string tmp; parseString(s, pos, tmp); }
        else if ((s[pos] >= '0' && s[pos] <= '9') || s[pos]=='-' || s[pos]=='+') { int dummy; parseNumber(s, pos, dummy); }
        else if (s[pos] == 't' || s[pos] == 'f') { bool db; parseBool(s, pos, db); }
        else if (s[pos] == '{') { int depth=1; ++pos; while (pos<s.size()&&depth){ if(s[pos]=='"'){ ++pos; while(pos<s.size()&&s[pos]!='"'){ if(s[pos]=='\\') ++pos; ++pos;} ++pos; continue;} if(s[pos]=='{')depth++; else if(s[pos]=='}')depth--; ++pos; } }
        else if (s[pos] == '[') { int depth=1; ++pos; while (pos<s.size()&&depth){ if(s[pos]=='"'){ ++pos; while(pos<s.size()&&s[pos]!='"'){ if(s[pos]=='\\') ++pos; ++pos;} ++pos; continue;} if(s[pos]=='[')depth++; else if(s[pos]==']')depth--; ++pos; } }
        skipWs(s, pos); if (pos<s.size() && s[pos]==',') ++pos;
    }
    return false;
}

bool TWwdosApp::loadWorkspaceFromFile(const std::string& path)
{
    std::ifstream in(path);
    if (!in) {
        std::string msg = std::string("Failed to open ") + path;
        messageBox(msg.c_str(), mfError | mfOKButton);
        return false;
    }
    std::string data((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    in.close();

    if (data.find("\"version\"") == std::string::npos || data.find("\"windows\"") == std::string::npos) {
        messageBox("Invalid workspace file.", mfError | mfOKButton);
        return false;
    }

    // Extract globals.patternMode
    bool continuous = USE_CONTINUOUS_PATTERN;
    size_t globalsPos = data.find("\"globals\"");
    if (globalsPos != std::string::npos) {
        size_t pos = data.find('{', globalsPos);
        if (pos != std::string::npos) {
            std::string pm;
            if (parseKeyedString(data, pos+1, "patternMode", pm))
                continuous = (pm == "continuous");
        }
    }

    // Restore desktop state (texture, colour, gallery mode)
    size_t deskPos = data.find("\"desktop\"");
    if (deskPos != std::string::npos) {
        size_t pos = data.find('{', deskPos);
        if (pos != std::string::npos) {
            std::string preset;
            if (parseKeyedString(data, pos+1, "preset", preset)) {
                api_desktop_preset(*this, preset);
            } else {
                // Fall back to individual fields
                std::string ch;
                int fg = -1, bg = -1;
                if (parseKeyedString(data, pos+1, "char", ch) && !ch.empty()) {
                    api_desktop_texture(*this, ch);
                }
                if (parseKeyedNumber(data, pos+1, "fg", fg) && parseKeyedNumber(data, pos+1, "bg", bg)) {
                    api_desktop_color(*this, fg, bg);
                }
            }
            bool gallery = false;
            if (parseKeyedBool(data, pos+1, "gallery", gallery) && gallery) {
                api_desktop_gallery(*this, true);
            }
        }
    }

    // Locate windows array and extract each object substring
    size_t winKey = data.find("\"windows\"");
    if (winKey == std::string::npos) {
        messageBox("No windows in workspace.", mfError | mfOKButton);
        return false;
    }
    size_t arrPos = data.find('[', winKey);
    if (arrPos == std::string::npos) return false;
    std::vector<std::string> objects;
    size_t p = arrPos+1; bool inStr=false; int depth=0;
    while (p < data.size()) {
        char c = data[p];
        if (c == '"') { inStr = !inStr; ++p; continue; }
        if (!inStr) {
            if (c == '{') {
                int d=1; size_t q=p+1;
                while (q<data.size() && d) {
                    if (data[q] == '"') { ++q; while (q<data.size() && data[q] != '"') { if (data[q]=='\\') ++q; ++q; } ++q; continue; }
                    if (data[q] == '{') d++; else if (data[q] == '}') d--; ++q;
                }
                objects.emplace_back(data.substr(p, q-p));
                p = q; continue;
            }
            if (c == ']') break;
        }
        ++p;
    }

    // Close ALL windows for clean workspace restore (including session windows)
    closeAll(false);

    // Apply globals
    USE_CONTINUOUS_PATTERN = continuous;

    // Restore windows
    std::vector<TWindow*> created;
    auto captureWindows = [this]() {
        std::vector<TWindow*> out;
        TView *start = deskTop->first();
        if (!start) return out;
        TView *v = start;
        do {
            if (TWindow *w = dynamic_cast<TWindow*>(v))
                out.push_back(w);
            v = v->next;
        } while (v != start);
        return out;
    };
    for (const auto &obj : objects) {
        std::string type; if (!parseKeyedString(obj, 0, "type", type)) continue;
        std::string title; parseKeyedString(obj, 0, "title", title);
        int x=2,y=1,w=50,h=15; parseBounds(obj, 0, x,y,w,h);
        bool zoomed=false; parseKeyedBool(obj, 0, "zoomed", zoomed);

        // Anchor: "right" = x is offset from right edge; "bottom" = y from bottom
        std::string anchor; parseKeyedString(obj, 0, "anchor", anchor);

        // Clamp and anchor
        TRect ext = deskTop->getExtent();
        int maxW = ext.b.x - ext.a.x;
        int maxH = ext.b.y - ext.a.y;
        if (w < 16) w = 16; if (h < 6) h = 6;
        if (w > maxW) w = maxW; if (h > maxH) h = maxH;
        // Right-anchor: x = desktop_width - x_offset - width
        if (anchor.find("right") != std::string::npos)
            x = std::max(0, maxW - x - w);
        if (anchor.find("bottom") != std::string::npos)
            y = std::max(0, maxH - y - h);
        if (x < 0) x = 0; if (y < 0) y = 0;
        if (x + w > maxW) x = std::max(0, maxW - w);
        if (y + h > maxH) y = std::max(0, maxH - h);
        TRect bounds(x,y,x+w,y+h);

        TWindow *win = nullptr;
        if (type == "test_pattern") {
            win = new TTestPatternWindow(bounds, "");
        } else if (type == "gradient") {
            std::string gtype; // props.gradientType preferred
            size_t propsPos = obj.find("\"props\"");
            if (propsPos != std::string::npos) {
                size_t brace = obj.find('{', propsPos);
                if (brace != std::string::npos)
                    parseKeyedString(obj, brace+1, "gradientType", gtype);
            }
            TGradientWindow::GradientType gt = TGradientWindow::gtHorizontal;
            if (gtype == "vertical") gt = TGradientWindow::gtVertical;
            else if (gtype == "radial") gt = TGradientWindow::gtRadial;
            else if (gtype == "diagonal") gt = TGradientWindow::gtDiagonal;
            win = new TGradientWindow(bounds, "", gt);
        } else if (type == "room_chat") {
            TWindow* rcWin = createRoomChatWindow(bounds);
            if (rcWin) {
                deskTop->insert(rcWin);
                registerWindow(rcWin);
                windowNumber++;
            }
            continue;
        } else if (type == "scramble") {
            std::string stateStr;
            size_t propsPos = obj.find("\"props\"");
            if (propsPos != std::string::npos) {
                size_t brace = obj.find('{', propsPos);
                if (brace != std::string::npos)
                    parseKeyedString(obj, brace+1, "display", stateStr);
            }
            ScrambleDisplayState sds = sdsSmol;
            if (stateStr == "tall") sds = sdsTall;
            else if (stateStr == "hidden") sds = sdsHidden;
            TWindow* sw = createScrambleWindow(bounds, sds);
            if (sw) {
                scrambleWindow = static_cast<TScrambleWindow*>(sw);
                deskTop->insert(sw);
                registerWindow(sw);
                windowNumber++;
            }
            continue;
        } else if (type == "frame_player") {
            std::string path; unsigned pms = 300;
            bool frameless = false, shadowless = false;
            size_t propsPos = obj.find("\"props\"");
            if (propsPos != std::string::npos) {
                size_t brace = obj.find('{', propsPos);
                if (brace != std::string::npos) {
                    parseKeyedString(obj, brace+1, "path", path);
                    std::string pmsStr;
                    parseKeyedString(obj, brace+1, "periodMs", pmsStr);
                    if (!pmsStr.empty()) pms = (unsigned)std::stoul(pmsStr);
                    parseKeyedBool(obj, brace+1, "frameless", frameless);
                    parseKeyedBool(obj, brace+1, "shadowless", shadowless);
                }
            }
            if (!path.empty()) openAnimationFilePath(path, bounds, frameless, shadowless, title);
            continue; // openAnimationFilePath handles insert + register
        } else if (type == "text_view") {
            std::string path;
            size_t propsPos = obj.find("\"props\"");
            if (propsPos != std::string::npos) {
                size_t brace = obj.find('{', propsPos);
                if (brace != std::string::npos)
                    parseKeyedString(obj, brace+1, "path", path);
            }
            if (!path.empty()) { api_open_text_view_path(*this, path, &bounds); continue; }
        } else if (type == "gallery") {
            int tabIndex = 0;
            std::string searchText;
            size_t propsPos = obj.find("\"props\"");
            if (propsPos != std::string::npos) {
                size_t brace = obj.find('{', propsPos);
                if (brace != std::string::npos) {
                    parseKeyedNumber(obj, brace+1, "tab", tabIndex);
                    parseKeyedString(obj, brace+1, "search", searchText);
                }
            }

            const WindowTypeSpec* spec = find_window_type_by_name(type);
            if (!spec || !spec->spawn) continue;

            const std::vector<TWindow*> before = captureWindows();
            std::map<std::string, std::string> kv;
            kv["x"] = std::to_string(x);
            kv["y"] = std::to_string(y);
            kv["w"] = std::to_string(w);
            kv["h"] = std::to_string(h);
            if (!title.empty()) kv["title"] = title;
            const char* err = spec->spawn(*this, kv);
            if (err) continue;

            const std::vector<TWindow*> after = captureWindows();
            for (TWindow* candidate : after) {
                bool existed = false;
                for (TWindow* prior : before) {
                    if (prior == candidate) {
                        existed = true;
                        break;
                    }
                }
                if (!existed) {
                    win = candidate;
                    break;
                }
            }
            if (!win) continue;
            if (auto *gallery = dynamic_cast<TGalleryWindow*>(win)) {
                gallery->setSearchText(searchText);
                gallery->setSelected(tabIndex);
            }
            if (zoomed) win->zoom();
            created.push_back(win);
            continue;
        } else if (type == "figlet_text") {
            std::string ftText, ftFont = "standard", ftFg, ftBg;
            bool ftFrameless = false, ftShadowless = false;
            size_t propsPos = obj.find("\"props\"");
            if (propsPos != std::string::npos) {
                size_t brace = obj.find('{', propsPos);
                if (brace != std::string::npos) {
                    parseKeyedString(obj, brace+1, "text", ftText);
                    parseKeyedString(obj, brace+1, "font", ftFont);
                    parseKeyedString(obj, brace+1, "fg", ftFg);
                    parseKeyedString(obj, brace+1, "bg", ftBg);
                    parseKeyedBool(obj, brace+1, "frameless", ftFrameless);
                    parseKeyedBool(obj, brace+1, "shadowless", ftShadowless);
                }
            }
            if (ftText.empty()) ftText = "Hello";
            TRect r(x, y, x + w, y + h);
            api_spawn_figlet_text(*this, &r, ftText, ftFont, ftFrameless, ftShadowless);
            // Find the newly spawned window
            TView *vv = deskTop->first();
            if (vv) {
                TView *scan = vv;
                do {
                    if (auto *ftw = dynamic_cast<TFigletTextWindow*>(scan)) {
                        if (auto *fv = ftw->getFigletView()) {
                            if (fv->getText() == ftText) {
                                win = ftw;
                                // Apply colours if saved
                                if (!ftFg.empty() || !ftBg.empty()) {
                                    api_figlet_set_color(*this, "", ftFg, ftBg);
                                }
                                break;
                            }
                        }
                    }
                    scan = scan->next;
                } while (scan != vv);
            }
            if (win && zoomed) win->zoom();
            if (win) created.push_back(win);
            continue;
        } else {
            const WindowTypeSpec* spec = find_window_type_by_name(type);
            if (!spec || !spec->spawn) continue;

            const std::vector<TWindow*> before = captureWindows();
            std::map<std::string, std::string> kv;
            kv["x"] = std::to_string(x);
            kv["y"] = std::to_string(y);
            kv["w"] = std::to_string(w);
            kv["h"] = std::to_string(h);
            if (!title.empty()) kv["title"] = title;
            const char* err = spec->spawn(*this, kv);
            if (err) continue;

            const std::vector<TWindow*> after = captureWindows();
            for (TWindow* candidate : after) {
                bool existed = false;
                for (TWindow* prior : before) {
                    if (prior == candidate) {
                        existed = true;
                        break;
                    }
                }
                if (!existed) {
                    win = candidate;
                    break;
                }
            }
            if (!win) continue;
        }
        if (type == "test_pattern" || type == "gradient")
            deskTop->insert(win);
        if (zoomed) win->zoom();
        created.push_back(win);
    }

    // Focus saved
    int focusedIdx = -1;
    size_t fpos = data.find("\"focusedIndex\"");
    if (fpos != std::string::npos) { size_t pos = data.find(':', fpos); if (pos != std::string::npos) { ++pos; parseNumber(data, pos, focusedIdx); } }
    if (focusedIdx >= 0 && focusedIdx < (int)created.size()) created[focusedIdx]->select();

    currentWorkspacePath_ = path;
    return true;
}

void TWwdosApp::openWorkspace()
{
    // Open a dialog rooted at workspaces/ listing JSON files
    char fileName[260];
    std::strncpy(fileName, "workspaces/*.json", sizeof(fileName));
    fileName[sizeof(fileName)-1] = '\0';
    TFileDialog *dlg = new TFileDialog("workspaces/*.json", "Open Workspace", "~N~ame", fdOpenButton, 101);
    ushort res = deskTop->execView(dlg);
    std::string path;
    if (res != cmCancel) {
        dlg->getData(fileName);
        path = fileName;
        // Normalize: if only a filename, prepend workspaces/
        if (!path.empty() && path.find('/') == std::string::npos)
            path = std::string("workspaces/") + path;
    } else {
        path = "workspaces/last_workspace.json";
    }
    destroy(dlg);

    // Fallback if file missing: try default
    std::ifstream test(path.c_str());
    if (!test.good()) {
        test.close();
        path = "workspaces/last_workspace.json";
    } else test.close();

    if (!loadWorkspaceFromFile(path))
        return;
    messageBox("Workspace loaded.", mfInformation | mfOKButton);
}

bool TWwdosApp::openWorkspacePath(const std::string& path)
{
    bool ok = loadWorkspaceFromFile(path);
    fprintf(stderr, "[workspace] open path=%s ok=%s\n", path.c_str(), ok ? "true" : "false");
    return ok;
}

std::string TWwdosApp::buildWorkspaceJson()
{
    // Screen size
    TRect ext = deskTop->getExtent();
    int sw = ext.b.x - ext.a.x;
    int sh = ext.b.y - ext.a.y;

    // Timestamp (basic)
    char ts[64];
    std::time_t t = std::time(nullptr);
    std::tm *lt = std::localtime(&t);
    std::strftime(ts, sizeof(ts), "%Y-%m-%dT%H:%M:%S", lt);

    std::string json;
    json += "{\n";
    json += "  \"version\": 1,\n";
    json += "  \"app\": \"test_pattern\",\n";
    json += std::string("  \"timestamp\": \"") + ts + "\",\n";
    json += "  \"screen\": { \"width\": " + std::to_string(sw) + ", \"height\": " + std::to_string(sh) + " },\n";
    json += std::string("  \"globals\": { \"patternMode\": \"") + (USE_CONTINUOUS_PATTERN ? "continuous" : "tiled") + "\" },\n";

    // Desktop state
    {
        auto* bg = dynamic_cast<TWibWobBackground*>(deskTop->background);
        if (bg) {
            json += "  \"desktop\": { ";
            json += "\"char\": \"";
            char ch = bg->getPattern();
            if (ch == '"') json += "\\\"";
            else if (ch == '\\') json += "\\\\";
            else json += ch;
            json += "\", ";
            json += "\"fg\": " + std::to_string((int)bg->getFg()) + ", ";
            json += "\"bg\": " + std::to_string((int)bg->getBg()) + ", ";
            json += std::string("\"gallery\": ") + (galleryMode_ ? "true" : "false") + ", ";
            json += "\"preset\": \"" + bg->getPresetName() + "\"";
            json += " },\n";
        }
    }

    json += "  \"windows\": [\n";

    // Collect windows in current z-order (child list is circular)
    int idx = 0;
    int focusedIndex = -1;
    TView *vStart = deskTop->first();
    if (vStart) {
    TView *v = vStart;
    do {
        TView *nextV = v->next; // Always advance even on skips
        TWindow *w = dynamic_cast<TWindow*>(v);
        if (!w) { v = nextV; continue; } // Skip non-window views (e.g., wallpaper)
        if (!w->getState(sfVisible)) { v = nextV; continue; }

        // Determine type and props
        std::string type = windowTypeName(w);
        std::string props = "{}";

        if (type == "test_pattern") {
            props = "{}"; // Pattern mode is global in MVP
        } else if (type == "frame_player") {
            // TFrameAnimationWindow stores the path — also expose content dimensions
            if (auto *faw = dynamic_cast<TFrameAnimationWindow*>(w)) {
                const std::string& fp = faw->getFilePath();
                props = "{\"path\": \"" + json_escape(fp) + "\"";
                // Find the child view to get content dimensions
                TView *child = faw->first();
                if (child) {
                    TView *v = child;
                    do {
                        if (auto *tfv = dynamic_cast<TTextFileView*>(v)) {
                            props += ", \"content_lines\": " + std::to_string(tfv->getContentLines());
                            props += ", \"content_width\": " + std::to_string(tfv->getContentWidth());
                            break;
                        } else if (auto *ffpv = dynamic_cast<FrameFilePlayerView*>(v)) {
                            props += ", \"content_lines\": " + std::to_string(ffpv->getContentLines());
                            props += ", \"content_width\": " + std::to_string(ffpv->getContentWidth());
                            props += ", \"frame_count\": " + std::to_string(ffpv->getFrameCount());
                            break;
                        }
                        v = v->nextView();
                    } while (v && v != child);
                }
                props += "}";
            }
        } else if (type == "gradient") {
            // Keep concrete gradient subtype in props for backward compatibility.
            TView *cStart = w->first();
            if (cStart) {
            TView *c = cStart;
            do {
                if (dynamic_cast<THorizontalGradientView*>(c)) {
                    props = "{\"gradientType\": \"horizontal\"}"; break;
                } else if (dynamic_cast<TVerticalGradientView*>(c)) {
                    props = "{\"gradientType\": \"vertical\"}"; break;
                } else if (dynamic_cast<TRadialGradientView*>(c)) {
                    props = "{\"gradientType\": \"radial\"}"; break;
                } else if (dynamic_cast<TDiagonalGradientView*>(c)) {
                    props = "{\"gradientType\": \"diagonal\"}"; break;
                }
                c = c->next;
            } while (c != cStart);
            }
        } else if (type == "text_view") {
            if (auto *ttw = dynamic_cast<TTransparentTextWindow*>(w)) {
                const std::string& fp = ttw->getFilePath();
                if (!fp.empty())
                    props = "{\"path\": \"" + json_escape(fp) + "\"}";
            }
        } else if (type == "gallery") {
            if (auto *gallery = dynamic_cast<TGalleryWindow*>(w)) {
                props = std::string("{\"tab\": ") + std::to_string(gallery->getSelected());
                const std::string& searchText = gallery->getSearchText();
                props += std::string(", \"search\": \"") + json_escape(searchText) + "\"}";
            }
        } else if (type == "figlet_text") {
            if (auto *ftw = dynamic_cast<TFigletTextWindow*>(w)) {
                if (auto *fv = ftw->getFigletView()) {
                    props = "{\"text\": \"" + json_escape(fv->getText()) + "\"";
                    props += ", \"font\": \"" + json_escape(fv->getFont()) + "\"";
                    uint32_t fg = fv->getFgColor();
                    uint32_t bg = fv->getBgColor();
                    char hex[16];
                    snprintf(hex, sizeof(hex), "#%06X", fg);
                    props += std::string(", \"fg\": \"") + hex + "\"";
                    snprintf(hex, sizeof(hex), "#%06X", bg);
                    props += std::string(", \"bg\": \"") + hex + "\"";
                    props += std::string(", \"frameless\": ") + (ftw->isFrameless() ? "true" : "false");
                    props += std::string(", \"shadowless\": ") + ((w->state & sfShadow) ? "false" : "true");
                    props += "}";
                }
            }
        }

        // Bounds (outer window rect)
        TRect b = w->getBounds();
        int x = b.a.x, y = b.a.y, ww = b.b.x - b.a.x, hh = b.b.y - b.a.y;

        // Zoomed: compare to max size from sizeLimits
        TPoint minSz, maxSz;
        w->sizeLimits(minSz, maxSz);
        bool zoomed = (w->size.x == maxSz.x && w->size.y == maxSz.y && w->origin.x == 0 && w->origin.y == 0);

        // Track focused window index (selected)
        if (w->getState(sfSelected))
            focusedIndex = idx; // zero-based

        if (idx++ > 0) json += ",\n";
        json += "    {\n";
        json += "      \"id\": \"w" + std::to_string(idx) + "\",\n";
        json += "      \"type\": \"" + type + "\",\n";
        const char *title = w->getTitle(0);
        std::string titleValue;
        if (title && *title) {
            titleValue = title;
        } else if (type == "frame_player") {
            if (auto *faw = dynamic_cast<TFrameAnimationWindow*>(w)) {
                const std::string& fp = faw->getFilePath();
                if (!fp.empty()) {
                    size_t slash = fp.find_last_of("/\\");
                    size_t start = (slash == std::string::npos) ? 0 : slash + 1;
                    std::string base = fp.substr(start);
                    size_t dot = base.find_last_of('.');
                    if (dot != std::string::npos && dot != 0)
                        base = base.substr(0, dot);
                    titleValue = base;
                }
            }
        }
        std::string safeTitle = json_escape(titleValue);
        json += "      \"title\": \"" + safeTitle + "\",\n";
        json += "      \"bounds\": { \"x\": " + std::to_string(x) + ", \"y\": " + std::to_string(y) + ", \"w\": " + std::to_string(ww) + ", \"h\": " + std::to_string(hh) + " },\n";
        json += std::string("      \"zoomed\": ") + (zoomed ? "true" : "false") + ",\n";
        json += "      \"props\": " + props + "\n";
        json += "    }";
        v = nextV;
    } while (v != vStart);
    }

    json += "\n  ]";
    if (focusedIndex >= 0)
        json += ",\n  \"focusedIndex\": " + std::to_string(focusedIndex);
    json += "\n}";
    return json;
}

void TWwdosApp::saveWorkspace()
{
    // Ensure directory exists
    mkdir("workspaces", 0755);

    std::string json = buildWorkspaceJson();
    const char *path = "workspaces/last_workspace.json";
    const char *tmpPath = "workspaces/last_workspace.json.tmp";
    std::ofstream out(tmpPath, std::ios::out | std::ios::trunc);
    if (!out) {
        std::string msg = std::string("Failed to open ") + tmpPath + " for writing";
        messageBox(msg.c_str(), mfError | mfOKButton);
        return;
    }
    out << json;
    out.close();
    if (!out.good()) {
        std::string msg = std::string("Error writing ") + tmpPath;
        messageBox(msg.c_str(), mfError | mfOKButton);
        return;
    }
    // Atomic replace
    std::remove(path); // ignore errors
    std::rename(tmpPath, path);
    // Also write a timestamped snapshot: YYMMDD_HHMM
    char tsName[32];
    std::time_t t = std::time(nullptr);
    std::tm *lt = std::localtime(&t);
    std::strftime(tsName, sizeof(tsName), "%y%m%d_%H%M", lt);
    std::string snapPath = std::string("workspaces/last_workspace_") + tsName + ".json";
    std::ofstream snap(snapPath.c_str(), std::ios::out | std::ios::trunc);
    if (snap) {
        snap << json;
        snap.close();
    }
    std::string ok = std::string("Workspace saved to ") + path + "\nSnapshot: " + snapPath;
    recentWorkspaces_ = scanRecentWorkspacePaths("workspaces", kMaxRecentWorkspaces);
    currentWorkspacePath_ = path;
    messageBox(ok.c_str(), mfInformation | mfOKButton);
}

void TWwdosApp::saveWorkspaceAs()
{
    // Pre-fill with current workspace name (filename without path/extension)
    std::string defaultName;
    if (!currentWorkspacePath_.empty()) {
        size_t slash = currentWorkspacePath_.find_last_of("/\\");
        defaultName = (slash == std::string::npos) ? currentWorkspacePath_
                                                    : currentWorkspacePath_.substr(slash + 1);
        // Strip .json extension
        if (defaultName.size() > 5 && defaultName.substr(defaultName.size() - 5) == ".json")
            defaultName = defaultName.substr(0, defaultName.size() - 5);
    }

    char name[256] = {};
    if (!defaultName.empty())
        std::strncpy(name, defaultName.c_str(), sizeof(name) - 1);

    if (inputBox("Save Workspace As", "~N~ame:", name, sizeof(name) - 1) != cmOK)
        return;

    std::string nameStr(name);
    if (nameStr.empty()) return;

    // Sanitise: replace non-alphanumeric (except - _ .) with _
    for (char& c : nameStr) {
        if (!std::isalnum(c) && c != '-' && c != '_' && c != '.')
            c = '_';
    }

    mkdir("workspaces", 0755);
    std::string savePath = "workspaces/" + nameStr + ".json";

    // Check for overwrite
    struct stat st;
    if (stat(savePath.c_str(), &st) == 0) {
        std::string msg = nameStr + ".json already exists. Overwrite?";
        if (messageBox(msg.c_str(), mfConfirmation | mfYesButton | mfNoButton) != cmYes)
            return;
    }

    if (saveWorkspacePath(savePath)) {
        currentWorkspacePath_ = savePath;
        recentWorkspaces_ = scanRecentWorkspacePaths("workspaces", kMaxRecentWorkspaces);
        std::string ok = "Workspace saved as: " + nameStr;
        messageBox(ok.c_str(), mfInformation | mfOKButton);
    }
}

// ── Workspace layout preview ──────────────────────────────────────────────────
// Renders a miniature ASCII wireframe of window positions from workspace JSON.

struct WsPreviewWindow {
    std::string type;
    int x, y, w, h;
};

static std::vector<WsPreviewWindow> parseWorkspaceWindows(const std::string& path)
{
    std::vector<WsPreviewWindow> wins;
    std::ifstream in(path);
    if (!in) return wins;
    std::string data((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());

    // Find canvas dimensions
    int canvasW = 80, canvasH = 24;
    {
        size_t cpos = data.find("\"canvas\"");
        if (cpos != std::string::npos) {
            size_t brace = data.find('{', cpos);
            if (brace != std::string::npos) {
                TWwdosApp::parseKeyedNumber(data, brace+1, "width", canvasW);
                TWwdosApp::parseKeyedNumber(data, brace+1, "height", canvasH);
            }
        }
    }

    // Parse windows array
    size_t wpos = data.find("\"windows\"");
    if (wpos == std::string::npos) return wins;

    size_t arrStart = data.find('[', wpos);
    if (arrStart == std::string::npos) return wins;

    size_t pos = arrStart;
    while (true) {
        size_t objStart = data.find('{', pos);
        if (objStart == std::string::npos) break;
        size_t objEnd = data.find('}', objStart);
        if (objEnd == std::string::npos) break;

        // Find nested props brace and skip past it
        std::string obj = data.substr(objStart, objEnd - objStart + 1);
        // Handle nested braces by finding proper end
        int depth = 0;
        size_t realEnd = objStart;
        for (size_t i = objStart; i < data.size(); i++) {
            if (data[i] == '{') depth++;
            else if (data[i] == '}') { depth--; if (depth == 0) { realEnd = i; break; } }
        }
        obj = data.substr(objStart, realEnd - objStart + 1);

        WsPreviewWindow pw;
        pw.x = 0; pw.y = 0; pw.w = 20; pw.h = 10;
        TWwdosApp::parseKeyedString(obj, 0, "type", pw.type);
        TWwdosApp::parseKeyedNumber(obj, 0, "x", pw.x);
        TWwdosApp::parseKeyedNumber(obj, 0, "y", pw.y);
        TWwdosApp::parseKeyedNumber(obj, 0, "w", pw.w);
        TWwdosApp::parseKeyedNumber(obj, 0, "h", pw.h);
        wins.push_back(pw);

        pos = realEnd + 1;
    }
    return wins;
}

// TView that renders a miniature workspace layout preview
class TWorkspacePreview : public TView {
public:
    TWorkspacePreview(const TRect& bounds) : TView(bounds) {
        growMode = gfGrowHiX | gfGrowHiY;
    }

    void setWindows(const std::vector<WsPreviewWindow>& wins, int canvasW = 80, int canvasH = 24) {
        windows_ = wins;
        canvasW_ = canvasW;
        canvasH_ = canvasH;
        drawView();
    }

    virtual void draw() override {
        TDrawBuffer b;
        TColorAttr bgAttr = TColorAttr(TColorRGB(0x55, 0x55, 0x55), TColorRGB(0x11, 0x11, 0x11));
        TColorAttr winAttr = TColorAttr(TColorRGB(0xFF, 0xFF, 0xFF), TColorRGB(0x33, 0x33, 0x55));
        TColorAttr borderAttr = TColorAttr(TColorRGB(0x88, 0x88, 0xCC), TColorRGB(0x33, 0x33, 0x55));
        TColorAttr labelAttr = TColorAttr(TColorRGB(0xFF, 0xFF, 0x88), TColorRGB(0x33, 0x33, 0x55));

        // Build a character grid
        int pw = size.x, ph = size.y;
        std::vector<std::string> grid(ph, std::string(pw, ' '));
        std::vector<std::vector<TColorAttr>> colors(ph, std::vector<TColorAttr>(pw, bgAttr));

        float sx = (canvasW_ > 0) ? (float)pw / canvasW_ : 1.0f;
        float sy = (canvasH_ > 0) ? (float)ph / canvasH_ : 1.0f;

        for (const auto& w : windows_) {
            int x0 = (int)(w.x * sx);
            int y0 = (int)(w.y * sy);
            int x1 = (int)((w.x + w.w) * sx);
            int y1 = (int)((w.y + w.h) * sy);
            // Clamp
            if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0;
            if (x1 > pw) x1 = pw; if (y1 > ph) y1 = ph;
            if (x1 <= x0 || y1 <= y0) continue;

            // Fill interior
            for (int row = y0; row < y1; row++)
                for (int col = x0; col < x1; col++) {
                    grid[row][col] = ' ';
                    colors[row][col] = winAttr;
                }

            // Draw border
            for (int col = x0; col < x1; col++) {
                grid[y0][col] = '\xC4'; colors[y0][col] = borderAttr;  // ─
                if (y1-1 < ph) { grid[y1-1][col] = '\xC4'; colors[y1-1][col] = borderAttr; }
            }
            for (int row = y0; row < y1; row++) {
                grid[row][x0] = '\xB3'; colors[row][x0] = borderAttr;  // │
                if (x1-1 < pw) { grid[row][x1-1] = '\xB3'; colors[row][x1-1] = borderAttr; }
            }
            // Corners
            if (y0 < ph && x0 < pw) { grid[y0][x0] = '\xDA'; colors[y0][x0] = borderAttr; }
            if (y0 < ph && x1-1 < pw) { grid[y0][x1-1] = '\xBF'; colors[y0][x1-1] = borderAttr; }
            if (y1-1 < ph && x0 < pw) { grid[y1-1][x0] = '\xC0'; colors[y1-1][x0] = borderAttr; }
            if (y1-1 < ph && x1-1 < pw) { grid[y1-1][x1-1] = '\xD9'; colors[y1-1][x1-1] = borderAttr; }

            // Type label inside (truncated)
            if (y1 - y0 > 2 && x1 - x0 > 2) {
                std::string label = w.type;
                int maxLen = x1 - x0 - 2;
                if ((int)label.size() > maxLen) label = label.substr(0, maxLen);
                int lx = x0 + 1;
                int ly = y0 + 1;
                for (int i = 0; i < (int)label.size() && lx + i < pw; i++) {
                    grid[ly][lx + i] = label[i];
                    colors[ly][lx + i] = labelAttr;
                }
            }
        }

        // Render grid to draw buffers
        for (int row = 0; row < ph; row++) {
            b.moveChar(0, ' ', bgAttr, pw);
            for (int col = 0; col < pw; col++)
                b.moveChar(col, grid[row][col], colors[row][col], 1);
            writeLine(0, row, pw, 1, b);
        }
    }

private:
    std::vector<WsPreviewWindow> windows_;
    int canvasW_ = 80, canvasH_ = 24;
};

// ── Manage Workspaces dialog ──────────────────────────────────────────────────

static const ushort cmWsLoad   = 281;
static const ushort cmWsRename = 282;
static const ushort cmWsDelete = 283;

// Custom dialog that tracks list focus and updates preview live
class TManageWorkspacesDialog : public TDialog {
public:
    TListBox* listBox;
    TWorkspacePreview* preview;
    std::vector<std::string> paths;
    std::vector<std::string> labels;
    int lastFocused = -1;

    TManageWorkspacesDialog(const TRect& bounds, const char* title)
        : TDialog(bounds, title), TWindowInit(&TDialog::initFrame),
          listBox(nullptr), preview(nullptr) {}

    void updatePreview() {
        int sel = listBox ? listBox->focused : -1;
        if (sel == lastFocused || sel < 0 || sel >= (int)paths.size()) return;
        lastFocused = sel;
        if (preview) {
            auto wins = parseWorkspaceWindows(paths[sel]);
            preview->setWindows(wins);
        }
    }

    void rebuildList(int focusIdx = 0) {
        if (!listBox) return;
        TStringCollection* col = makeStringCollection(labels);
        listBox->newList(col);
        if (focusIdx >= (int)labels.size()) focusIdx = (int)labels.size() - 1;
        if (focusIdx < 0) focusIdx = 0;
        listBox->focusItem(focusIdx);
        lastFocused = -1;  // force preview refresh
        updatePreview();
    }

    virtual void handleEvent(TEvent& event) override {
        // Before processing, snapshot focus to detect change after
        int beforeFocus = listBox ? listBox->focused : -1;

        TDialog::handleEvent(event);

        if (event.what == evCommand) {
            switch (event.message.command) {
                case cmWsLoad:
                case cmWsRename:
                case cmWsDelete:
                    if ((state & sfModal) != 0) {
                        endModal(event.message.command);
                        clearEvent(event);
                    }
                    break;
            }
        }

        // After any event, check if list focus changed
        if (listBox && listBox->focused != beforeFocus) {
            updatePreview();
        }
    }
};

void TWwdosApp::manageWorkspaces()
{
    std::vector<std::string> paths = scanRecentWorkspacePaths("workspaces", 50);
    if (paths.empty()) {
        messageBox("No saved workspaces found.", mfInformation | mfOKButton);
        return;
    }

    std::vector<std::string> labels;
    for (const auto& p : paths) {
        std::string label = recentWorkspaceLabel(p);
        int n = countWindowsInWorkspace(p);
        if (n > 0) label += " (" + std::to_string(n) + ")";
        labels.push_back(label);
    }

    int dlgW = 72, dlgH = 22;
    auto* dlg = new TManageWorkspacesDialog(TRect(0, 0, dlgW, dlgH), "Manage Workspaces");
    dlg->options |= ofCentered;
    dlg->paths = paths;
    dlg->labels = labels;

    // List box (left)
    int listW = 32;
    TScrollBar* sb = new TScrollBar(TRect(listW - 1, 2, listW, dlgH - 4));
    dlg->insert(sb);
    TListBox* lb = new TListBox(TRect(2, 2, listW - 1, dlgH - 4), 1, sb);
    dlg->insert(lb);
    dlg->listBox = lb;

    // Preview (right)
    auto* preview = new TWorkspacePreview(TRect(listW + 1, 2, dlgW - 2, dlgH - 4));
    dlg->insert(preview);
    dlg->preview = preview;

    // Populate and show initial preview
    dlg->rebuildList(0);

    // Buttons
    int btnY = dlgH - 3;
    dlg->insert(new TButton(TRect(2, btnY, 14, btnY + 2), "~L~oad", cmWsLoad, bfDefault));
    dlg->insert(new TButton(TRect(15, btnY, 29, btnY + 2), "~R~ename", cmWsRename, bfNormal));
    dlg->insert(new TButton(TRect(30, btnY, 44, btnY + 2), "~D~elete", cmWsDelete, bfNormal));
    dlg->insert(new TButton(TRect(45, btnY, 57, btnY + 2), "~C~lose", cmCancel, bfNormal));

    // Dialog loop
    bool done = false;
    while (!done) {
        ushort cmd = execView(dlg);

        switch (cmd) {
            case cmWsLoad: {
                int sel = lb->focused;
                if (sel >= 0 && sel < (int)dlg->paths.size()) {
                    std::string loadPath = dlg->paths[sel];
                    destroy(dlg);
                    loadWorkspaceFromFile(loadPath);
                    return;
                }
                break;
            }
            case cmWsRename: {
                int sel = lb->focused;
                if (sel < 0 || sel >= (int)dlg->paths.size()) break;
                std::string oldName = recentWorkspaceLabel(dlg->paths[sel]);
                if (oldName.size() > 5 && oldName.substr(oldName.size() - 5) == ".json")
                    oldName = oldName.substr(0, oldName.size() - 5);
                size_t paren = oldName.find(" (");
                if (paren != std::string::npos) oldName = oldName.substr(0, paren);

                char name[256] = {};
                std::strncpy(name, oldName.c_str(), sizeof(name) - 1);
                if (inputBox("Rename Workspace", "New ~n~ame:", name, sizeof(name) - 1) != cmOK)
                    break;

                std::string newName(name);
                if (newName.empty() || newName == oldName) break;
                for (char& c : newName)
                    if (!std::isalnum(c) && c != '-' && c != '_' && c != '.') c = '_';

                std::string newPath = "workspaces/" + newName + ".json";
                if (std::rename(dlg->paths[sel].c_str(), newPath.c_str()) == 0) {
                    dlg->paths[sel] = newPath;
                    std::string newLabel = newName + ".json";
                    int n = countWindowsInWorkspace(newPath);
                    if (n > 0) newLabel += " (" + std::to_string(n) + ")";
                    dlg->labels[sel] = newLabel;
                    dlg->rebuildList(sel);
                    recentWorkspaces_ = scanRecentWorkspacePaths("workspaces", kMaxRecentWorkspaces);
                }
                break;
            }
            case cmWsDelete: {
                int sel = lb->focused;
                if (sel < 0 || sel >= (int)dlg->paths.size()) break;
                std::string fname = recentWorkspaceLabel(dlg->paths[sel]);
                std::string msg = "Delete " + fname + "?";
                if (messageBox(msg.c_str(), mfConfirmation | mfYesButton | mfNoButton) != cmYes)
                    break;
                std::remove(dlg->paths[sel].c_str());
                dlg->paths.erase(dlg->paths.begin() + sel);
                dlg->labels.erase(dlg->labels.begin() + sel);
                if (dlg->paths.empty()) {
                    destroy(dlg);
                    recentWorkspaces_ = scanRecentWorkspacePaths("workspaces", kMaxRecentWorkspaces);
                    return;
                }
                dlg->rebuildList(sel);
                recentWorkspaces_ = scanRecentWorkspacePaths("workspaces", kMaxRecentWorkspaces);
                break;
            }
            case cmCancel:
            default:
                done = true;
                break;
        }
    }
    destroy(dlg);
}

bool TWwdosApp::saveWorkspacePath(const std::string& path)
{
    if (path.empty())
        return false;

    std::string json = buildWorkspaceJson();
    std::string tmpPath = path + ".tmp";

    std::ofstream out(tmpPath.c_str(), std::ios::out | std::ios::trunc);
    if (!out)
        return false;
    out << json;
    out.close();
    if (!out.good())
        return false;

    std::remove(path.c_str()); // ignore errors
    bool ok = (std::rename(tmpPath.c_str(), path.c_str()) == 0);
    if (ok)
        recentWorkspaces_ = scanRecentWorkspacePaths("workspaces", kMaxRecentWorkspaces);
    fprintf(stderr, "[workspace] save path=%s ok=%s\n", path.c_str(), ok ? "true" : "false");
    return ok;
}

std::string api_get_canvas_size(TWwdosApp& app) {
    TRect desktop = TProgram::deskTop->getBounds();
    std::stringstream json;
    json << "{\"width\":" << desktop.b.x 
         << ",\"height\":" << desktop.b.y
         << ",\"cols\":" << desktop.b.x
         << ",\"rows\":" << desktop.b.y << "}";
    return json.str();
}

void api_spawn_text_editor(TWwdosApp& app, const TRect* bounds, const std::string& title) {
    TRect r;
    if (bounds) {
        r = *bounds;
    } else {
        r = TProgram::deskTop->getBounds();
        r.grow(-5, -3);
    }
    TWindow* window = createTextEditorWindow(r, title.empty() ? "Text Editor" : title.c_str());
    TProgram::deskTop->insert(window);
}

std::string api_send_text(TWwdosApp& app, const std::string& id,
                         const std::string& content, const std::string& mode,
                         const std::string& position) {
    fprintf(stderr, "[api_send_text] START: id=%s, content_len=%zu, mode=%s\n",
            id.c_str(), content.size(), mode.c_str());

    // Special case: if id is "auto" or no text editor exists, create one
    bool autoSpawn = (id == "auto" || id == "text_editor");
    fprintf(stderr, "[api_send_text] autoSpawn=%d\n", autoSpawn);

    // Find existing text editor windows
    fprintf(stderr, "[api_send_text] Searching for existing text editor...\n");
    TView* view = app.deskTop->first();
    TTextEditorWindow* editorWindow = nullptr;

    // Use nextView() to avoid infinite loop on circular linked list
    for (TView* v = view; v; v = v->nextView()) {
        TTextEditorWindow* candidate = dynamic_cast<TTextEditorWindow*>(v);
        if (candidate) {
            editorWindow = candidate;
            fprintf(stderr, "[api_send_text] Found existing text editor\n");
            break; // Found a text editor
        }
    }

    // If no text editor found and auto-spawn is enabled, create one
    if (!editorWindow && autoSpawn) {
        fprintf(stderr, "[api_send_text] Creating new text editor window...\n");
        TRect r = app.deskTop->getBounds();
        r.grow(-5, -3);
        fprintf(stderr, "[api_send_text] Window bounds: (%d,%d)-(%d,%d)\n",
                r.a.x, r.a.y, r.b.x, r.b.y);

        fprintf(stderr, "[api_send_text] Calling createTextEditorWindow...\n");
        TWindow* newWindow = createTextEditorWindow(r);
        fprintf(stderr, "[api_send_text] Window created, inserting into desktop...\n");

        app.deskTop->insert(newWindow);
        fprintf(stderr, "[api_send_text] Window inserted\n");

        editorWindow = dynamic_cast<TTextEditorWindow*>(newWindow);
        fprintf(stderr, "[api_send_text] Cast to TTextEditorWindow: %p\n", (void*)editorWindow);
    }

    // If we have a text editor, send the text
    if (editorWindow) {
        fprintf(stderr, "[api_send_text] Focusing window...\n");
        // Focus the window
        editorWindow->select();
        fprintf(stderr, "[api_send_text] Window focused\n");

        // Send the text
        fprintf(stderr, "[api_send_text] Getting editor view...\n");
        TTextEditorView* editorView = editorWindow->getEditorView();
        fprintf(stderr, "[api_send_text] Editor view: %p\n", (void*)editorView);

        if (editorView) {
            fprintf(stderr, "[api_send_text] Calling sendText with %zu chars...\n", content.size());
            editorView->sendText(content, mode, position);
            fprintf(stderr, "[api_send_text] sendText completed\n");
            return "ok";
        }
    }

    fprintf(stderr, "[api_send_text] FAILED: no text editor available\n");
    return "err no text editor available";
}

std::string api_send_figlet(TWwdosApp& app, const std::string& id, const std::string& text, 
                           const std::string& font, int width, const std::string& mode) {
    // Special case: if id is "auto" or no text editor exists, create one
    bool autoSpawn = (id == "auto" || id == "text_editor");
    
    // Find existing text editor windows
    TView* view = app.deskTop->first();
    TTextEditorWindow* editorWindow = nullptr;

    // Use nextView() to avoid infinite loop on circular linked list
    for (TView* v = view; v; v = v->nextView()) {
        TTextEditorWindow* candidate = dynamic_cast<TTextEditorWindow*>(v);
        if (candidate) {
            editorWindow = candidate;
            break; // Found a text editor
        }
    }
    
    // If no text editor found and auto-spawn is enabled, create one
    if (!editorWindow && autoSpawn) {
        TRect r = app.deskTop->getBounds();
        r.grow(-5, -3);
        TWindow* newWindow = createTextEditorWindow(r);
        app.deskTop->insert(newWindow);
        editorWindow = dynamic_cast<TTextEditorWindow*>(newWindow);
    }
    
    // If we have a text editor, send the figlet text
    if (editorWindow) {
        // Focus the window
        editorWindow->select();
        
        // Send the figlet text
        TTextEditorView* editorView = editorWindow->getEditorView();
        if (editorView) {
            editorView->sendFigletText(text, font, width, mode);
            return "ok";
        }
    }

    return "err no text editor available";
}

void api_spawn_browser(TWwdosApp& app, const TRect* bounds) {
    if (bounds) {
        app.newBrowserWindow(*bounds);
    } else {
        app.newBrowserWindow();
    }
}

void api_spawn_room_chat(TWwdosApp& app, const TRect* bounds) {
    TRect r;
    if (bounds) {
        r = *bounds;
    } else {
        TRect d = app.deskTop->getExtent();
        int dw = d.b.x - d.a.x;
        int dh = d.b.y - d.a.y;
        int width = std::max(10, std::min(100, dw));
        int height = std::max(6, std::min(28, dh));
        int left = d.a.x + (dw - width) / 2;
        int top = d.a.y + (dh - height) / 2;
        r = TRect(left, top, left + width, top + height);
    }
    TWindow* window = createRoomChatWindow(r);
    app.deskTop->insert(window);
    app.registerWindow(window);
}

std::string api_room_chat_receive(TWwdosApp& /*app*/,
                                  const std::string& sender,
                                  const std::string& text,
                                  const std::string& ts) {
    TRoomChatWindow* win = getRoomChatWindow();
    if (!win) return "err no room_chat window open";

    RoomChatMessage msg;
    msg.sender = sender;
    msg.text = text;
    msg.ts = ts.empty() ? "??:??" : ts;

    TEvent ev;
    ev.what = evCommand;
    ev.message.command = cmRoomChatReceive;
    ev.message.infoPtr = new RoomChatMessage(msg);
    TProgram::application->putEvent(ev);
    return "ok";
}

std::string api_room_presence(TWwdosApp& /*app*/,
                              const std::string& participants_json) {
    TRoomChatWindow* win = getRoomChatWindow();
    if (!win) return "err no room_chat window open";

    auto* participants = new std::vector<RoomParticipant>();
    std::string json = participants_json;
    size_t pos = 0;
    while ((pos = json.find("\"id\"", pos)) != std::string::npos) {
        pos = json.find(':', pos);
        if (pos == std::string::npos) break;
        pos = json.find('"', pos);
        if (pos == std::string::npos) break;
        size_t start = pos + 1;
        size_t end = json.find('"', start);
        if (end == std::string::npos) break;
        RoomParticipant p;
        p.id = json.substr(start, end - start);
        p.name = p.id;
        size_t nameField = json.find("\"name\"", end);
        size_t nextEntry = json.find('{', end);
        if (nameField != std::string::npos &&
            (nextEntry == std::string::npos || nameField < nextEntry)) {
            size_t npos2 = json.find(':', nameField);
            npos2 = json.find('"', npos2);
            if (npos2 != std::string::npos) {
                size_t nstart = npos2 + 1;
                size_t nend = json.find('"', nstart);
                if (nend != std::string::npos)
                    p.name = json.substr(nstart, nend - nstart);
            }
        }
        participants->push_back(p);
        pos = end + 1;
    }

    TEvent ev;
    ev.what = evCommand;
    ev.message.command = cmRoomPresence;
    ev.message.infoPtr = participants;
    TProgram::application->putEvent(ev);
    return "ok";
}

std::string api_get_room_chat_pending(TWwdosApp& /*app*/) {
    TRoomChatWindow* win = getRoomChatWindow();
    if (!win) return "[]";
    auto msgs = win->drainPending();
    std::string json = "[";
    for (size_t i = 0; i < msgs.size(); ++i) {
        if (i) json += ",";
        json += "\"";
        for (char c : msgs[i]) {
            if (c == '"') json += "\\\"";
            else if (c == '\\') json += "\\\\";
            else if (c == '\n') json += "\\n";
            else json += c;
        }
        json += "\"";
    }
    json += "]";
    return json;
}

std::string api_get_room_chat_display_name(TWwdosApp& /*app*/) {
    TRoomChatWindow* win = getRoomChatWindow();
    if (!win) return "";
    return win->getDisplayName();
}

// Generative / animated art windows — spawnable via IPC create_window type=X
static TRect api_centered_bounds(TWwdosApp& app, int width, int height) {
    TRect d = app.deskTop->getExtent();
    int dw = d.b.x - d.a.x;
    int dh = d.b.y - d.a.y;
    width  = std::max(10, std::min(width,  dw));
    height = std::max(6,  std::min(height, dh));
    int left = d.a.x + (dw - width)  / 2;
    int top  = d.a.y + (dh - height) / 2;
    return TRect(left, top, left + width, top + height);
}

void api_spawn_verse(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeVerseWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_mycelium(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeMyceliumWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_orbit(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeOrbitWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_torus(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 90, 28);
    TWindow* w = createGenerativeTorusWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_cube(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 90, 28);
    TWindow* w = createGenerativeCubeWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_life(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 90, 28);
    TWindow* w = createGameOfLifeWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_blocks(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 84, 24);
    TWindow* w = createAnimatedBlocksWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_score(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 108, 34);
    TWindow* w = createAnimatedScoreWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_ascii(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createAnimatedAsciiWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_animated_gradient(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 84, 24);
    TWindow* w = createAnimatedGradientWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_monster_cam(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeMonsterCamWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_contour_map(TWwdosApp& app, const TRect* bounds) {
    TRect r;
    if (bounds) {
        r = *bounds;
    } else {
        // 90% of desktop
        TRect desk = app.deskTop->getExtent();
        int w90 = desk.b.x * 90 / 100;
        int h90 = desk.b.y * 90 / 100;
        int x = (desk.b.x - w90) / 2;
        int y = (desk.b.y - h90) / 2;
        r = TRect(x, y, x + w90, y + h90);
    }
    int seed = rand() % 100000;
    // Pass deferLaunch=true so generation waits until window is sized
    TWindow* w = createContourMapWindow(r, seed, 5, 5, false, false);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_generative_lab(TWwdosApp& app, const TRect* bounds) {
    TRect r;
    if (bounds) {
        r = *bounds;
    } else {
        TRect desk = app.deskTop->getExtent();
        int w90 = desk.b.x * 90 / 100;
        int h90 = desk.b.y * 90 / 100;
        int x = (desk.b.x - w90) / 2;
        int y = (desk.b.y - h90) / 2;
        r = TRect(x, y, x + w90, y + h90);
    }
    TWindow* w = createGenerativeLabWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_monster_verse(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeMonsterVerseWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_monster_portal(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeMonsterPortalWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_micropolis_ascii(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 110, 34);
    TWindow* w = createMicropolisAsciiWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_quadra(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 42, 26);
    TWindow* w = createQuadraWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_snake(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 60, 30);
    TWindow* w = createSnakeWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_rogue(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 80, 38);
    TWindow* w = createRogueWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_deep_signal(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 70, 34);
    TWindow* w = createDeepSignalWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_app_launcher(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 63, 20);
    TWindow* w = createAppLauncherWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_gallery(TWwdosApp& app, const TRect* bounds) {
    TRect desk = app.deskTop->getExtent();
    TRect r = bounds ? *bounds : api_centered_bounds(app, desk.b.x * 9 / 10, desk.b.y * 9 / 10);
    TWindow* w = createAsciiGalleryWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

// ── FIGlet text window spawn + control API ────────────────────────────────────

void api_spawn_figlet_text(TWwdosApp& app, const TRect* bounds,
    const std::string& text, const std::string& font,
    bool frameless, bool shadowless) {
    TRect desk = app.deskTop->getExtent();
    TRect r;
    if (bounds) {
        r = *bounds;
    } else {
        // Auto-size: render the figlet text at unlimited width, measure it.
        std::string rendered = figlet::render(text, font, 0);
        int maxW = 0, lines = 0;
        size_t pos = 0;
        while (pos < rendered.size()) {
            size_t nl = rendered.find('\n', pos);
            if (nl == std::string::npos) nl = rendered.size();
            int len = static_cast<int>(nl - pos);
            if (len > maxW) maxW = len;
            ++lines;
            pos = nl + 1;
        }
        // Detect figlet wrapping: if total lines > font char height, the text
        // wrapped into multiple rows. Use only the first row's height.
        int fh = figlet::fontHeight(font);
        if (fh > 0 && lines > fh) {
            lines = fh;  // show one row — window will be sized to fit it
        }
        // Chrome: 2 for window borders + 2 padding so figlet doesn't re-wrap
        int w = std::min(maxW + 6, (int)desk.b.x - 2);
        int h = std::min(lines + 3, (int)desk.b.y - 2);  // +2 border +1 breathing room
        // Centre on desktop
        int x = (desk.b.x - w) / 2;
        int y = (desk.b.y - h) / 2;
        r = TRect(x, y, x + w, y + h);
    }
    TFigletTextWindow* w = new TFigletTextWindow(r, text, font, frameless, shadowless);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_figlet_text_at(TWwdosApp& app,
    const std::string& text, const std::string& font, int x, int y,
    bool frameless, bool shadowless) {
    TRect desk = app.deskTop->getExtent();
    // Auto-size: render at unlimited width, measure
    std::string rendered = figlet::render(text, font, 0);
    int maxW = 0, lines = 0;
    size_t pos = 0;
    while (pos < rendered.size()) {
        size_t nl = rendered.find('\n', pos);
        if (nl == std::string::npos) nl = rendered.size();
        int len = static_cast<int>(nl - pos);
        if (len > maxW) maxW = len;
        ++lines;
        pos = nl + 1;
    }
    int fh = figlet::fontHeight(font);
    if (fh > 0 && lines > fh) lines = fh;
    int w = std::min(maxW + 6, (int)desk.b.x - 2);
    int h = std::min(lines + 3, (int)desk.b.y - 2);
    TRect r(x, y, x + w, y + h);
    TFigletTextWindow* win = new TFigletTextWindow(r, text, font, frameless, shadowless);
    app.deskTop->insert(win);
    app.registerWindow(win);
}

TFigletTextWindow* findFigletWindow(TWwdosApp& app, const std::string& id) {
    // Scan desktop — match by registry ID (w1, w2, ...), title, or "auto" (first match)
    TView* v = app.deskTop->first();
    for (; v; v = v->nextView()) {
        TFigletTextWindow* fw = dynamic_cast<TFigletTextWindow*>(v);
        if (fw) {
            if (id == "auto" || id.empty()) return fw;
            // Check title
            const char* t = fw->getTitle(256);
            if (t && id == t) return fw;
            // Check registry ID via winToId map
            auto it = app.winToId.find(fw);
            if (it != app.winToId.end() && it->second == id) return fw;
        }
    }
    return nullptr;
}

std::string api_figlet_set_text(TWwdosApp& app, const std::string& id, const std::string& text) {
    TFigletTextWindow* w = findFigletWindow(app, id);
    if (!w || !w->getFigletView()) return "err no figlet window found";
    w->getFigletView()->setText(text);
    return "ok";
}

std::string api_figlet_set_font(TWwdosApp& app, const std::string& id, const std::string& font) {
    TFigletTextWindow* w = findFigletWindow(app, id);
    if (!w || !w->getFigletView()) return "err no figlet window found";
    w->getFigletView()->setFont(font);
    return "ok";
}

static uint32_t parseHexColor(const std::string& s) {
    std::string hex = s;
    if (!hex.empty() && hex[0] == '#') hex = hex.substr(1);
    if (hex.size() != 6) return 0;
    return (uint32_t)strtoul(hex.c_str(), nullptr, 16);
}

std::string api_figlet_set_color(TWwdosApp& app, const std::string& id,
                                 const std::string& fg, const std::string& bg) {
    TFigletTextWindow* w = findFigletWindow(app, id);
    if (!w || !w->getFigletView()) return "err no figlet window found";
    TFigletTextView* v = w->getFigletView();
    if (!fg.empty()) {
        uint32_t c = parseHexColor(fg);
        v->setFgColor(TColorRGB((c >> 16) & 0xFF, (c >> 8) & 0xFF, c & 0xFF));
    }
    if (!bg.empty()) {
        uint32_t c = parseHexColor(bg);
        v->setBgColor(TColorRGB((c >> 16) & 0xFF, (c >> 8) & 0xFF, c & 0xFF));
    }
    return "ok";
}

std::string api_figlet_list_fonts() {
    auto fonts = figlet::listFonts();
    std::string json = "{\"fonts\":[";
    for (size_t i = 0; i < fonts.size(); i++) {
        if (i > 0) json += ",";
        json += "\"" + fonts[i] + "\"";
    }
    json += "]}";
    return json;
}

std::string api_gallery_list(TWwdosApp& app, const std::string& tab) {
    (void)app;
    // Find primer dir
    std::string primerDir = findPrimerDir();
    DIR* dir = opendir(primerDir.c_str());
    if (!dir) return "{\"error\":\"no primer directory\"}";

    // Resolve tab filter before scanning
    int tabIdx = -1;
    if (!tab.empty()) {
        if (tab == "#-C" || tab == "1") tabIdx = 0;
        else if (tab == "D-L" || tab == "2") tabIdx = 1;
        else if (tab == "M" || tab == "3") tabIdx = 2;
        else if (tab == "N-S" || tab == "4") tabIdx = 3;
        else if (tab == "T-Z" || tab == "5") tabIdx = 4;
        else {
            closedir(dir);
            return "{\"error\":\"unknown tab filter: " + json_escape(tab) + "\"}";
        }
    }

    std::vector<std::string> files;
    struct dirent* entry;
    while ((entry = readdir(dir)) != nullptr) {
        if (entry->d_name[0] == '.') continue;
        std::string name = entry->d_name;
        if (name.size() < 5 || name.substr(name.size() - 4) != ".txt") continue;

        // Apply tab filter
        if (tabIdx >= 0 && !name.empty()) {
            char c = (char)std::tolower((unsigned char)name[0]);
            bool match = false;
            switch (tabIdx) {
                case 0: match = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'c'); break;
                case 1: match = c >= 'd' && c <= 'l'; break;
                case 2: match = c == 'm'; break;
                case 3: match = c >= 'n' && c <= 's'; break;
                case 4: match = c >= 't' && c <= 'z'; break;
            }
            if (!match) continue;
        }
        files.push_back(name);
    }
    closedir(dir);

    std::sort(files.begin(), files.end());

    std::ostringstream os;
    os << "{\"count\":" << files.size() << ",\"files\":[";
    for (size_t i = 0; i < files.size(); i++) {
        if (i > 0) os << ",";
        // Include content dimensions so agents can size windows in one shot
        std::string fullPath = primerDir + "/" + files[i];
        std::ifstream f(fullPath);
        size_t lines = 0, maxW = 0;
        bool hasFrames = false;
        if (f.is_open()) {
            std::string line;
            while (std::getline(f, line)) {
                ++lines;
                if (line.size() > maxW) maxW = line.size();
                if (line.find("---") == 0 || line.find("===") == 0) hasFrames = true;
            }
        }
        os << "{\"name\":\"" << json_escape(files[i]) << "\""
           << ",\"lines\":" << lines
           << ",\"width\":" << maxW
           << ",\"animated\":" << (hasFrames ? "true" : "false")
           << "}";
    }
    os << "]}";
    return os.str();
}

void api_spawn_wibwob(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : TRect(2, 1, 82, 28);
    app.windowNumber++;
    std::string title = "Wib&Wob Chat " + std::to_string(app.windowNumber);
    TWindow* w = createWibWobWindow(r, title);
    if (w) {
        app.deskTop->insert(w);
        app.registerWindow(w);
        w->select();
    }
}

void api_spawn_terminal(TWwdosApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 80, 24);
    TWindow* w = createTerminalWindow(r);
    if (w) {
        app.deskTop->insert(w);
        app.registerWindow(w);
    }
}

static TWibWobTerminalWindow* find_terminal_by_zorder(TWwdosApp& app) {
    TView* start = app.deskTop->first();
    if (!start) return nullptr;
    TView* v = start;
    do {
        if (auto *tw = dynamic_cast<TWibWobTerminalWindow*>(v))
            return tw;
        v = v->next;
    } while (v != start);
    return nullptr;
}

std::string api_terminal_write(TWwdosApp& app, const std::string& text, const std::string& window_id) {
    TWibWobTerminalWindow* termWin = nullptr;
    if (!window_id.empty()) {
        auto it = app.idToWin.find(window_id);
        if (it != app.idToWin.end())
            termWin = dynamic_cast<TWibWobTerminalWindow*>(it->second);
        if (!termWin) return "err window not found or not a terminal";
    } else {
        termWin = find_terminal_by_zorder(app);
    }
    if (!termWin) return "err no terminal window";
    termWin->sendText(text);
    return "ok";
}

std::string api_terminal_read(TWwdosApp& app, const std::string& window_id) {
    TWibWobTerminalWindow* termWin = nullptr;
    if (!window_id.empty()) {
        auto it = app.idToWin.find(window_id);
        if (it != app.idToWin.end())
            termWin = dynamic_cast<TWibWobTerminalWindow*>(it->second);
        if (!termWin) return "err window not found or not a terminal";
    } else {
        termWin = find_terminal_by_zorder(app);
    }
    if (!termWin) return "err no terminal window";
    return termWin->getOutputText();
}

std::string api_browser_fetch(TWwdosApp& app, const std::string& url) {
    // Find the most recently inserted browser window and trigger a fetch
    TView* start = app.deskTop->first();
    TBrowserWindow* browserWin = nullptr;
    if (start) {
        TView* v = start;
        do {
            TBrowserWindow* candidate = dynamic_cast<TBrowserWindow*>(v);
            if (candidate) {
                browserWin = candidate;
            }
            v = v->next;
        } while (v != start);
    }

    if (!browserWin) {
        return "err no browser window";
    }

    browserWin->fetchUrl(url);
    return "ok";
}

std::string api_set_theme_mode(TWwdosApp& app, const std::string& mode) {
    (void)app;
    if (mode != "light" && mode != "dark")
        return "err invalid theme mode";
    return "ok";
}

std::string api_set_theme_variant(TWwdosApp& app, const std::string& variant) {
    (void)app;
    if (variant != "monochrome" && variant != "dark_pastel")
        return "err invalid theme variant";
    return "ok";
}

std::string api_reset_theme(TWwdosApp& app) {
    (void)app;
    return "ok";
}

// --- Desktop texture, colour & gallery mode ---

static TWibWobBackground* getWibWobBg(TWwdosApp& app) {
    return dynamic_cast<TWibWobBackground*>(app.deskTop->background);
}

std::string api_desktop_preset(TWwdosApp& app, const std::string& preset) {
    auto* bg = getWibWobBg(app);
    if (!bg) return "err no TWibWobBackground";
    // Validate preset name
    for (auto& p : getDesktopPresets()) {
        if (preset == p.name) {
            bg->setPreset(preset);
            return "ok";
        }
    }
    return "err unknown preset";
}

std::string api_desktop_texture(TWwdosApp& app, const std::string& ch) {
    auto* bg = getWibWobBg(app);
    if (!bg) return "err no TWibWobBackground";
    if (ch.empty()) return "err empty char";
    bg->setTexture(ch[0]);
    return "ok";
}

std::string api_desktop_color(TWwdosApp& app, int fg, int bg_color) {
    auto* bg = getWibWobBg(app);
    if (!bg) return "err no TWibWobBackground";
    if (fg < 0 || fg > 15 || bg_color < 0 || bg_color > 15) return "err color out of range 0-15";
    bg->setColor(static_cast<uchar>(fg), static_cast<uchar>(bg_color));
    return "ok";
}

std::string api_desktop_gallery(TWwdosApp& app, bool on) {
    if (!app.menuBar || !app.statusLine) return "err no chrome views";

    app.galleryMode_ = on;
    app.menuBar->setState(sfVisible, !on);
    app.statusLine->setState(sfVisible, !on);

    // Recalculate desktop bounds to fill freed/restored rows
    TRect r = app.getExtent();
    if (!on) {
        r.a.y = 1;       // leave room for menu bar
        r.b.y--;          // leave room for status line
    }
    // else: full extent (row 0 to bottom)
    app.deskTop->changeBounds(r);
    app.deskTop->drawView();

    return "ok";
}

std::string api_desktop_get(TWwdosApp& app) {
    auto* bg = getWibWobBg(app);
    if (!bg) return "{}";
    std::string json = "{";
    json += "\"char\":\"";
    char ch = bg->getPattern();
    if (ch == '"') json += "\\\"";
    else if (ch == '\\') json += "\\\\";
    else json += ch;
    json += "\",";
    json += "\"fg\":" + std::to_string((int)bg->getFg()) + ",";
    json += "\"bg\":" + std::to_string((int)bg->getBg()) + ",";
    json += "\"gallery\":" + std::string(app.galleryMode_ ? "true" : "false") + ",";
    json += "\"preset\":\"" + bg->getPresetName() + "\"";
    json += "}";
    return json;
}

void api_spawn_paint(TWwdosApp& app, const TRect* bounds) {
    TRect r;
    if (bounds) {
        r = *bounds;
    } else {
        // Use getBounds() on the actual desktop view (safer from IPC thread than getExtent()).
        TRect d = app.deskTop->getBounds();
        int dw = d.b.x - d.a.x;
        int dh = d.b.y - d.a.y;
        // Fall back to safe defaults if desktop reports invalid size.
        if (dw <= 0) dw = 80;
        if (dh <= 0) dh = 24;
        int w = std::min((int)(dw * 0.9), dw);
        int h = std::min((int)(dh * 0.9), dh);
        int left = d.a.x + (dw - w) / 2;
        int top  = d.a.y + (dh - h) / 2;
        r = TRect(left, top, left + w, top + h);
    }
    TWindow* pw = createPaintWindow(r);
    app.deskTop->insert(pw);
    app.registerWindow(pw);
}

void api_spawn_paint_with_file(TWwdosApp& app, const std::string& path) {
    api_spawn_paint(app, nullptr);
    // Find the just-created paint window (last inserted)
    TView* v = app.deskTop->last;
    if (!v) return;
    // Walk to find the newest paint window
    TView* p = v;
    do {
        p = p->next;
        auto* pw = dynamic_cast<TPaintWindow*>(p);
        if (pw && pw->getCanvas()) {
            // Load file into it
            std::ifstream in(path);
            if (!in) return;
            std::string data((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());

            auto* canvas = pw->getCanvas();
            if (!loadWwpFromString(data, canvas)) return;
            pw->setFilePath(path);
            canvas->drawView();
            return;
        }
    } while (p != v);
}

TPaintCanvasView* api_find_paint_canvas(TWwdosApp& app, const std::string& id) {
    TWindow* w = app.findWindowById(id);
    if (!w) return nullptr;
    auto *pw = dynamic_cast<TPaintWindow*>(w);
    if (!pw) return nullptr;
    return pw->getCanvas();
}

TGenerativeLabView* api_find_gen_lab_view(TWwdosApp& app, const std::string& id) {
    TWindow* w = app.findWindowById(id);
    if (!w) return nullptr;
    auto *gw = dynamic_cast<TGenerativeLabWindow*>(w);
    if (!gw) return nullptr;
    // Walk children to find the TGenerativeLabView
    TView* v = gw->last;
    if (!v) return nullptr;
    TView* first = v;
    do {
        auto* glv = dynamic_cast<TGenerativeLabView*>(v);
        if (glv) return glv;
        v = v->next;
    } while (v != first);
    return nullptr;
}

// Paint wrappers for command_registry (avoids tvision include dependency)
// Clamp paint coordinates to canvas bounds to prevent crashes
static bool clampXY(TPaintCanvasView* c, int& x, int& y) {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x >= c->getCols()) x = c->getCols() - 1;
    if (y >= c->getRows()) y = c->getRows() - 1;
    return c->getCols() > 0 && c->getRows() > 0;
}

std::string api_paint_cell(TWwdosApp& app, const std::string& id, int x, int y, uint8_t fg, uint8_t bg) {
    auto *canvas = api_find_paint_canvas(app, id);
    if (!canvas) return "err paint window not found";
    if (!clampXY(canvas, x, y)) return "err canvas has zero size";
    canvas->putCell(x, y, fg, bg);
    return "ok";
}

std::string api_paint_text(TWwdosApp& app, const std::string& id, int x, int y, const std::string& text, uint8_t fg, uint8_t bg) {
    auto *canvas = api_find_paint_canvas(app, id);
    if (!canvas) return "err paint window not found";
    if (!clampXY(canvas, x, y)) return "err canvas has zero size";
    canvas->putText(x, y, text, fg, bg);
    return "ok";
}

std::string api_paint_line(TWwdosApp& app, const std::string& id, int x0, int y0, int x1, int y1, bool erase) {
    auto *canvas = api_find_paint_canvas(app, id);
    if (!canvas) return "err paint window not found";
    if (!clampXY(canvas, x0, y0)) return "err canvas has zero size";
    clampXY(canvas, x1, y1);
    canvas->putLine(x0, y0, x1, y1, erase);
    return "ok";
}

std::string api_paint_rect(TWwdosApp& app, const std::string& id, int x0, int y0, int x1, int y1, bool erase) {
    auto *canvas = api_find_paint_canvas(app, id);
    if (!canvas) return "err paint window not found";
    if (!clampXY(canvas, x0, y0)) return "err canvas has zero size";
    clampXY(canvas, x1, y1);
    canvas->putRect(x0, y0, x1, y1, erase);
    return "ok";
}

std::string api_paint_clear(TWwdosApp& app, const std::string& id) {
    auto *canvas = api_find_paint_canvas(app, id);
    if (!canvas) return "err paint window not found";
    canvas->clear();
    canvas->drawView();
    return "ok";
}

std::string api_paint_export(TWwdosApp& app, const std::string& id) {
    auto *canvas = api_find_paint_canvas(app, id);
    if (!canvas) return "err paint window not found";
    return canvas->exportText();
}

std::string api_paint_save(TWwdosApp& app, const std::string& id, const std::string& path) {
    auto *canvas = api_find_paint_canvas(app, id);
    if (!canvas) return "err paint window not found";
    if (path.empty()) return "err path required";

    std::string json = buildWwpJson(canvas);
    if (!saveWwpFile(path, json))
        return "err cannot write file";
    return "ok saved " + path;
}

std::string api_paint_load(TWwdosApp& app, const std::string& id, const std::string& path) {
    auto *canvas = api_find_paint_canvas(app, id);
    if (!canvas) return "err paint window not found";
    if (path.empty()) return "err path required";

    std::ifstream in(path);
    if (!in) return "err cannot open " + path;
    std::string data((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());

    int fileCols = parseIntAfter(data, 0, "cols");
    int fileRows = parseIntAfter(data, 0, "rows");
    if (fileCols <= 0 || fileRows <= 0) return "err invalid wwp (missing cols/rows)";
    if (!loadWwpFromString(data, canvas))
        return "err invalid wwp (missing cells)";
    canvas->drawView();
    return "ok loaded " + path;
}

std::string api_paint_stamp_figlet(TWwdosApp& app, const std::string& id,
    const std::string& text, const std::string& font,
    int x, int y, uint8_t fg, uint8_t bg)
{
    auto *canvas = api_find_paint_canvas(app, id);
    if (!canvas) return "err paint window not found";
    if (text.empty()) return "err text required";

    std::string f = font.empty() ? "standard" : font;
    auto lines = figlet::renderLines(text, f, canvas->getCols());
    if (lines.empty()) return "err figlet render failed";

    int stamped = 0;
    for (int row = 0; row < (int)lines.size(); row++) {
        int cy = y + row;
        if (cy < 0 || cy >= canvas->getRows()) continue;
        const std::string& line = lines[row];
        for (int col = 0; col < (int)line.size(); col++) {
            char ch = line[col];
            if (ch == ' ' || ch == '\0') continue;
            int cx = x + col;
            if (cx < 0 || cx >= canvas->getCols()) continue;
            PaintCell& cell = canvas->cellAt(cx, cy);
            cell.textChar = ch;
            cell.textFg = fg;
            cell.textBg = bg;
            stamped++;
        }
    }
    canvas->drawView();
    return "ok stamped " + std::to_string(stamped) + " chars (" + std::to_string(lines.size()) + " lines)";
}

std::string api_list_figlet_fonts() {
    const auto& fonts = figlet::allFontsSorted();
    std::ostringstream os;
    os << "[";
    for (size_t i = 0; i < fonts.size(); i++) {
        if (i > 0) os << ",";
        os << "\"" << fonts[i] << "\"";
    }
    os << "]";
    return os.str();
}

std::string api_preview_figlet(const std::string& text, const std::string& font, int width) {
    if (width <= 0) width = 80;
    auto lines = figlet::renderLines(text, font, width);
    if (lines.empty()) return "err render failed (bad font?)";
    std::string result;
    for (size_t i = 0; i < lines.size(); i++) {
        if (i > 0) result += '\n';
        result += lines[i];
    }
    return result;
}
