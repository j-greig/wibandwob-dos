/*---------------------------------------------------------*/
/*                                                         */
/*   test_pattern_app.cpp - Test Pattern Window Spawner   */
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
#define Uses_TMenuBar
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
#include "gradient.h"
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
// Generative art: Monster Cam (Emoji)
#include "generative_monster_cam_view.h"
#include "game_of_life_view.h"
#include "animated_ascii_view.h"
// Generative art: ASCII Cam
// DISABLED: #include "generative_ascii_cam_view.h"
// API-controllable text editor
#include "text_editor_view.h"
// Wib&Wob AI chat interface
#include "wibwob_view.h"
// Scrollbar fix prototypes (test versions)
#include "wibwob_scroll_test.h"
// Custom frame for windows without titles
#include "notitle_frame.h"
// Transparent background text view
#include "transparent_text_view.h"
// TUI Browser window
#include "browser_view.h"
// Scramble cat presence
#include "scramble_view.h"
#include "scramble_engine.h"
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
// Local API IPC bridge (Unix domain socket)
#include "api_ipc.h"
#include "command_registry.h"

// Find first existing primer directory across module paths.
// Checks modules-private/*/primers/ then modules/*/primers/ then legacy app/primers/.
static std::string findPrimerDir() {
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
// Future File commands
const ushort cmOpenAnsiArt = 112;
const ushort cmNewPaintCanvas = 113;
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
const ushort cmScrambleExpand = 181;  // Scramble expand/shrink

// Help menu commands
const ushort cmAbout = 129;
const ushort cmKeyboardShortcuts = 130;
const ushort cmDebugInfo = 131;

// Glitch menu commands
const ushort cmToggleGlitchMode = 140;
const ushort cmGlitchScatter = 141;
const ushort cmGlitchColorBleed = 142;
const ushort cmGlitchRadialDistort = 143;
const ushort cmGlitchDiagonalScatter = 144;
const ushort cmCaptureGlitchedFrame = 145;
const ushort cmResetGlitchParams = 146;
const ushort cmGlitchSettings = 147;

// Forward declarations
class TTestPatternView;
class TTestPatternWindow;
class TGradientWindow;
class TFrameAnimationWindow;
class TTestPatternApp;
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
        // Try common status line color indices for hotkeys
        switch(index) {
            case 1:  // Try index 1
            case 2:  // Try index 2  
            case 3:  // Try index 3
            case 4:  // Try index 4
                return TColorAttr(trueBlack, trueWhite);  // BLACK ON TRUE WHITE
            default:
                return TStatusLine::mapColor(index);  // Use parent's mapping for others
        }
    }
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
/* TFrameAnimationWindow - Window containing animation    */
/*---------------------------------------------------------*/

class TFrameAnimationWindow : public TWindow
{
public:
    TFrameAnimationWindow(const TRect& bounds, const char* aTitle, const std::string& filePath) :
        TWindow(bounds, aTitle, wnNoNumber),
        TWindowInit(&TFrameAnimationWindow::initFrame)
    {
        options |= ofTileable;  // Enable cascade/tile functionality
        
        // Get the interior bounds (excluding frame)
        TRect interior = getExtent();
        interior.grow(-1, -1);
        
        // Check if file has frame delimiters to decide which view to use
        if (hasFrameDelimiters(filePath)) {
            // Animation file - use frame player
            FrameFilePlayerView* animView = new FrameFilePlayerView(interior, filePath);
            insert(animView);
        } else {
            // Regular text file - use scrollable text viewer
            TTextFileView* textView = new TTextFileView(interior, filePath);
            insert(textView);
        }
    }
    
    // Override changeBounds to fix tile redraw issue
    virtual void changeBounds(const TRect& bounds) override
    {
        TWindow::changeBounds(bounds);
        
        // Force complete redraw after window is resized/moved (e.g., by tile operations)
        setState(sfExposed, True);
        
        // Ensure child views are properly notified of resize for text content redraw
        forEach([](TView* view, void*) {
            if (auto* textView = dynamic_cast<TTextFileView*>(view)) {
                // Force text view to redraw its content
                textView->drawView();
            }
        }, nullptr);
        
        redraw();
    }
    
    // Custom frame initializer
    static TFrame *initFrame(TRect r)
    {
        return new TNoTitleFrame(r);
    }
};

/*---------------------------------------------------------*/
/* TTestPatternApp - Main application class               */
/*---------------------------------------------------------*/
class TTestPatternApp : public TApplication
{
public:
    TTestPatternApp();
    virtual void handleEvent(TEvent& event);
    virtual void idle();
    virtual void run();
    virtual TPalette& getPalette() const;
    static TMenuBar* initMenuBar(TRect);
    static TStatusLine* initStatusLine(TRect);
    static TDeskTop* initDeskTop(TRect);
    
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
    void openAnimationFile();
    void openAnimationFilePath(const std::string& path);
    void openAnimationFilePath(const std::string& path, const TRect& bounds);
    void openTransparentTextFile();
    void openMonodrawFile(const char* fileName);
    void openWorkspace();
    bool openWorkspacePath(const std::string& path);
    void cascade();
    void tile();
    void closeAll();
    void takeScreenshot(bool showDialog = true);
    void setPatternMode(bool continuous);
    void showApiKeyDialog();
    void saveWorkspace();
    bool saveWorkspacePath(const std::string& path);
    TRect calculateWindowBounds(const std::string& filePath);
    std::string buildWorkspaceJson();
    static std::string jsonEscape(const std::string& s);
    bool loadWorkspaceFromFile(const std::string& path);
    static bool parseBool(const std::string &s, size_t &pos, bool &out);
    static bool parseString(const std::string &s, size_t &pos, std::string &out);
    static bool parseNumber(const std::string &s, size_t &pos, int &out);
    static void skipWs(const std::string &s, size_t &pos);
    static bool consume(const std::string &s, size_t &pos, char ch);
    static bool parseKeyedString(const std::string &s, size_t objStart, const char *key, std::string &out);
    static bool parseKeyedBool(const std::string &s, size_t objStart, const char *key, bool &out);
    static bool parseBounds(const std::string &s, size_t objStart, int &x,int &y,int &w,int &h);
    
    int windowNumber;
    static const int maxWindows = 99;

    // Scramble cat overlay
    TScrambleWindow* scrambleWindow;
    ScrambleEngine scrambleEngine;
    ScrambleDisplayState scrambleState;
    void toggleScramble();
    void toggleScrambleExpand();
    void wireScrambleInput();

    // Runtime API key (shared across all chat windows)
    static std::string runtimeApiKey;
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
    
    std::string registerWindow(TWindow* w) {
        if (!w) return std::string();
        auto it = winToId.find(w);
        if (it != winToId.end()) return it->second;
        char buf[32];
        std::snprintf(buf, sizeof(buf), "w%d", apiIdCounter++);
        std::string id(buf);
        winToId[w] = id;
        idToWin[id] = w;
        // Notify event subscribers that state has changed.
        if (ipcServer) {
            std::string payload = std::string("{\"id\":\"") + id + "\"}";
            ipcServer->publish_event("state_changed", payload);
        }
        return id;
    }
    
    TWindow* findWindowById(const std::string& id) {
        auto it = idToWin.find(id);
        if (it != idToWin.end()) return it->second;
        // Fallback: scan desktop for windows that haven't been registered yet.
        // IMPORTANT: do NOT clear existing maps — that would reassign IDs for
        // already-known windows and cause multiplayer desync.
        TView *start = deskTop->first();
        if (start) {
            TView *v = start;
            do {
                TWindow *w = dynamic_cast<TWindow*>(v);
                if (w && winToId.find(w) == winToId.end()) {
                    // Unregistered window — give it a stable ID without firing an event.
                    char buf[32];
                    std::snprintf(buf, sizeof(buf), "w%d", apiIdCounter++);
                    std::string new_id(buf);
                    winToId[w] = new_id;
                    idToWin[new_id] = w;
                }
                v = v->next;
            } while (v != start);
        }
        it = idToWin.find(id);
        if (it != idToWin.end()) return it->second;
        return nullptr;
    }
    
    // IPC server
    ApiIpcServer* ipcServer = nullptr;
    
    // Friend API helper functions implemented below to bridge IPC calls.
    friend void api_spawn_test(TTestPatternApp&);
    friend void api_spawn_gradient(TTestPatternApp&, const std::string&);
    friend void api_open_animation_path(TTestPatternApp&, const std::string&);
    friend void api_open_text_view_path(TTestPatternApp&, const std::string&, const TRect* bounds);
    friend void api_spawn_test(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_gradient(TTestPatternApp&, const std::string&, const TRect* bounds);
    friend void api_open_animation_path(TTestPatternApp&, const std::string&, const TRect* bounds);
    friend void api_cascade(TTestPatternApp&);
    friend void api_toggle_scramble(TTestPatternApp&);
    friend void api_expand_scramble(TTestPatternApp&);
    friend std::string api_scramble_say(TTestPatternApp&, const std::string&);
    friend std::string api_scramble_pet(TTestPatternApp&);
    friend std::string api_chat_receive(TTestPatternApp&, const std::string&, const std::string&);
    friend void api_tile(TTestPatternApp&);
    friend void api_close_all(TTestPatternApp&);
    friend void api_set_pattern_mode(TTestPatternApp&, const std::string&);
    friend void api_save_workspace(TTestPatternApp&);
    friend bool api_save_workspace_path(TTestPatternApp&, const std::string&);
    friend bool api_open_workspace_path(TTestPatternApp&, const std::string&);
    friend void api_screenshot(TTestPatternApp&);
    friend std::string api_get_state(TTestPatternApp&);
    friend std::string api_move_window(TTestPatternApp&, const std::string&, int, int);
    friend std::string api_resize_window(TTestPatternApp&, const std::string&, int, int);
    friend std::string api_focus_window(TTestPatternApp&, const std::string&);
    friend std::string api_close_window(TTestPatternApp&, const std::string&);
    friend std::string api_get_canvas_size(TTestPatternApp&);
    friend void api_spawn_text_editor(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_browser(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_verse(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_mycelium(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_orbit(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_torus(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_cube(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_life(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_blocks(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_score(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_ascii(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_animated_gradient(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_monster_cam(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_monster_verse(TTestPatternApp&, const TRect* bounds);
    friend void api_spawn_monster_portal(TTestPatternApp&, const TRect* bounds);
    friend std::string api_browser_fetch(TTestPatternApp&, const std::string& url);
    friend std::string api_send_text(TTestPatternApp&, const std::string&, const std::string&, 
                                     const std::string&, const std::string&);
    friend std::string api_send_figlet(TTestPatternApp&, const std::string&, const std::string&, 
                                       const std::string&, int, const std::string&);
};

// Static member definition
std::string TTestPatternApp::runtimeApiKey;

// Accessor for runtime API key (used by wibwob_view.cpp)
std::string getAppRuntimeApiKey() {
    return TTestPatternApp::runtimeApiKey;
}

TTestPatternApp::TTestPatternApp() :
    TProgInit(&TTestPatternApp::initStatusLine,
              &TTestPatternApp::initMenuBar,
              &TTestPatternApp::initDeskTop),
    windowNumber(0),
    scrambleWindow(nullptr),
    scrambleState(sdsHidden)
{
    // Start IPC server for local API control (best-effort; ignore failures)
    ipcServer = new ApiIpcServer(this);

    // Derive socket path from WIBWOB_INSTANCE env var.
    // Unset or empty: legacy path for backward compat.
    std::string sockPath = "/tmp/test_pattern_app.sock";
    const char* inst = std::getenv("WIBWOB_INSTANCE");
    if (inst && inst[0] != '\0') {
        sockPath = std::string("/tmp/wibwob_") + inst + ".sock";
        fprintf(stderr, "[wibwob] instance=%s socket=%s\n", inst, sockPath.c_str());
    } else {
        fprintf(stderr, "[wibwob] instance=(none) socket=%s\n", sockPath.c_str());
    }
    if (!ipcServer->start(sockPath)) {
        fprintf(stderr, "[wibwob] ERROR: IPC server failed to start on %s\n", sockPath.c_str());
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

    // Init Scramble engine (KB + Haiku client).
    scrambleEngine.init(".");
}

void TTestPatternApp::handleEvent(TEvent& event)
{
    TApplication::handleEvent(event);
    
    if (event.what == evCommand)
    {
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
                openAnimationFile();
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
                
            // View menu commands  
            case cmZoomIn:
                messageBox("Zoom In coming soon!", mfInformation | mfOKButton);
                clearEvent(event);
                break;
            case cmZoomOut:
                messageBox("Zoom Out coming soon!", mfInformation | mfOKButton);
                clearEvent(event);
                break;
            case cmActualSize:
                messageBox("Actual Size coming soon!", mfInformation | mfOKButton);
                clearEvent(event);
                break;
            case cmFullScreen:
                messageBox("Full Screen mode coming soon!", mfInformation | mfOKButton);
                clearEvent(event);
                break;
            case cmTextEditor: {
                TRect r = deskTop->getExtent();
                r.grow(-5, -3); // Leave some margin
                deskTop->insert(createTextEditorWindow(r));
                clearEvent(event);
                break;
            }
            case cmBrowser:
                newBrowserWindow();
                clearEvent(event);
                break;
            case cmScrambleCat:
                toggleScramble();
                clearEvent(event);
                break;
            case cmScrambleExpand:
                toggleScrambleExpand();
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
            case cmWindowBgColor: {
                // Find the focused window and check if it supports background color
                TView *focused = deskTop ? deskTop->current : nullptr;
                if (!focused) {
                    messageBox("No window is currently focused.", mfInformation | mfOKButton);
                    break;
                }
                
                // Check if it's a text view or frame player view
                auto *textView = dynamic_cast<TTextFileView*>(focused);
                auto *frameView = dynamic_cast<FrameFilePlayerView*>(focused);
                
                if (!textView && !frameView) {
                    // Try looking inside the window if it's a TWindow
                    if (auto *window = dynamic_cast<TWindow*>(focused)) {
                        auto findTarget = [](TView *p, void *out) -> Boolean {
                            if (!p) return False;
                            TView **pp = (TView**)out;
                            if (*pp) return False;
                            if (dynamic_cast<TTextFileView*>(p) || dynamic_cast<FrameFilePlayerView*>(p)) {
                                *pp = p; return True;
                            }
                            return False;
                        };
                        TView *target = nullptr;
                        window->firstThat(findTarget, &target);
                        textView = dynamic_cast<TTextFileView*>(target);
                        frameView = dynamic_cast<FrameFilePlayerView*>(target);
                    }
                }
                
                if (textView) {
                    textView->openBackgroundDialog();
                } else if (frameView) {
                    frameView->openBackgroundDialog();
                } else {
                    messageBox("The focused window doesn't support background color customization.", mfInformation | mfOKButton);
                }
                clearEvent(event);
                break;
            }
                
            // Tools menu commands
            case cmWibWobChat:
                newWibWobWindow();
                clearEvent(event);
                break;
            case cmWibWobTestA:
                newWibWobTestWindowA();
                clearEvent(event);
                break;
            case cmWibWobTestB:
                newWibWobTestWindowB();
                clearEvent(event);
                break;
            case cmWibWobTestC:
                newWibWobTestWindowC();
                clearEvent(event);
                break;
            case cmRepaint:
                if (deskTop) {
                    deskTop->drawView();
                }
                clearEvent(event);
                break;
            case cmAnsiEditor:
                messageBox("ANSI Editor coming soon!", mfInformation | mfOKButton);
                clearEvent(event);
                break;
            case cmPaintTools:
                messageBox("Paint Tools coming soon!", mfInformation | mfOKButton);
                clearEvent(event);
                break;
            case cmAnimationStudio:
                messageBox("Animation Studio coming soon!", mfInformation | mfOKButton);
                clearEvent(event);
                break;
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
                
            // Glitch menu commands
            case cmToggleGlitchMode: {
                bool currentMode = getGlitchEngine().isGlitchModeEnabled();
                getGlitchEngine().enableGlitchMode(!currentMode);
                std::string msg = !currentMode ? 
                    "Glitch mode ENABLED! Visual corruption effects are now active." :
                    "Glitch mode disabled. Normal rendering restored.";
                messageBox(msg.c_str(), mfInformation | mfOKButton);
                // Update menu checkmark (would need menu refresh)
                clearEvent(event);
                break;
            }
            case cmGlitchScatter: {
                if (!getGlitchEngine().isGlitchModeEnabled()) {
                    messageBox("Enable Glitch Mode first to use scatter effects.", mfWarning | mfOKButton);
                } else {
                    GlitchParams params = getGlitchEngine().getGlitchParams();
                    params.scatterIntensity = 0.8f;
                    params.scatterRadius = 8;
                    getGlitchEngine().setGlitchParams(params);
                    messageBox("Scatter pattern applied! Characters will scatter during resize.", mfInformation | mfOKButton);
                }
                clearEvent(event);
                break;
            }
            case cmGlitchColorBleed: {
                if (!getGlitchEngine().isGlitchModeEnabled()) {
                    messageBox("Enable Glitch Mode first to use color bleeding.", mfWarning | mfOKButton);
                } else {
                    GlitchParams params = getGlitchEngine().getGlitchParams();
                    params.colorBleedChance = 0.6f;
                    params.colorBleedDistance = 5;
                    getGlitchEngine().setGlitchParams(params);
                    messageBox("Color bleed applied! Colors will bleed across character positions.", mfInformation | mfOKButton);
                }
                clearEvent(event);
                break;
            }
            case cmGlitchRadialDistort: {
                if (!getGlitchEngine().isGlitchModeEnabled()) {
                    messageBox("Enable Glitch Mode first to use radial distortion.", mfWarning | mfOKButton);
                } else {
                    // Apply radial distortion to current active window
                    if (TView* activeView = deskTop->current) {
                        TRect bounds = activeView->getBounds();
                        int centerX = bounds.a.x + (bounds.b.x - bounds.a.x) / 2;
                        int centerY = bounds.a.y + (bounds.b.y - bounds.a.y) / 2;
                        // Note: This would need integration with drawing system
                        messageBox("Radial distortion applied from window center!", mfInformation | mfOKButton);
                    } else {
                        messageBox("No active window for radial distortion.", mfWarning | mfOKButton);
                    }
                }
                clearEvent(event);
                break;
            }
            case cmGlitchDiagonalScatter: {
                if (!getGlitchEngine().isGlitchModeEnabled()) {
                    messageBox("Enable Glitch Mode first to use diagonal scatter.", mfWarning | mfOKButton);
                } else {
                    GlitchParams params = getGlitchEngine().getGlitchParams();
                    params.scatterIntensity = 0.5f;
                    params.enableCoordinateOffset = true;
                    params.dimensionCorruption = 0.3f;
                    getGlitchEngine().setGlitchParams(params);
                    messageBox("Diagonal scatter applied! Creates diagonal streaking effects.", mfInformation | mfOKButton);
                }
                clearEvent(event);
                break;
            }
            case cmCaptureGlitchedFrame: {
                TView* activeView = deskTop->current;
                std::string captured = captureGlitchedFrame(activeView);
                
                // Save to file with timestamp
                auto now = std::chrono::system_clock::now();
                auto time_t = std::chrono::system_clock::to_time_t(now);
                std::ostringstream filename;
                filename << "glitched_frame_" << std::put_time(std::localtime(&time_t), "%Y%m%d_%H%M%S") << ".txt";
                
                if (getFrameCapture().saveFrame(getFrameCapture().captureScreen(), filename.str(), 
                                               CaptureOptions{CaptureFormat::AnsiEscapes, true, false, true, true, true})) {
                    messageBox(("Frame captured to: " + filename.str()).c_str(), mfInformation | mfOKButton);
                } else {
                    messageBox("Failed to capture frame.", mfError | mfOKButton);
                }
                clearEvent(event);
                break;
            }
            case cmResetGlitchParams: {
                getGlitchEngine().resetCorruption();
                GlitchParams defaultParams;
                getGlitchEngine().setGlitchParams(defaultParams);
                messageBox("Glitch parameters reset to defaults.", mfInformation | mfOKButton);
                clearEvent(event);
                break;
            }
            case cmGlitchSettings:
                messageBox("Glitch Settings dialog coming soon!\n\nUse menu items to adjust parameters for now.", mfInformation | mfOKButton);
                clearEvent(event);
                break;
                
            // Future File commands
            case cmOpenAnsiArt:
                messageBox("ANSI Art file opening coming soon!", mfInformation | mfOKButton);
                clearEvent(event);
                break;
            case cmNewPaintCanvas:
                messageBox("Paint Canvas creation coming soon!", mfInformation | mfOKButton);
                clearEvent(event);
                break;
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

void TTestPatternApp::newTestWindow()
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

void TTestPatternApp::newTestWindow(const TRect& bounds)
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

void TTestPatternApp::newBrowserWindow()
{
    TRect r = deskTop->getExtent();
    r.grow(-3, -2);
    TWindow* window = createBrowserWindow(r);
    deskTop->insert(window);
    registerWindow(window);
    if (auto* browser = dynamic_cast<TBrowserWindow*>(window))
        browser->fetchUrl("https://symbient.life");
}

void TTestPatternApp::newBrowserWindow(const TRect& bounds)
{
    TWindow* window = createBrowserWindow(bounds);
    deskTop->insert(window);
    registerWindow(window);
    if (auto* browser = dynamic_cast<TBrowserWindow*>(window))
        browser->fetchUrl("https://symbient.life");
}

void TTestPatternApp::wireScrambleInput()
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

        // Query engine (free text + engine slash commands)
        std::string response = scrambleEngine.ask(input);
        if (response.empty()) {
            response = "... (=^..^=)";
        }

        // Show response in bubble and history
        if (scrambleWindow->getView()) {
            scrambleWindow->getView()->setPose(spCurious);
            scrambleWindow->getView()->say(response);
        }
        if (scrambleWindow->getMessageView()) {
            scrambleWindow->getMessageView()->addMessage("scramble", response);
        }
    };
}

void TTestPatternApp::toggleScramble()
{
    if (scrambleWindow) {
        // Remove existing Scramble window
        destroy(scrambleWindow);
        scrambleWindow = nullptr;
        scrambleState = sdsHidden;
    } else {
        // Create at bottom-right corner of desktop in smol mode
        TRect desktop = deskTop->getExtent();
        int w = 28;
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
    }
}

void TTestPatternApp::toggleScrambleExpand()
{
    if (!scrambleWindow) {
        // Not visible — create in tall mode directly
        TRect desktop = deskTop->getExtent();
        int w = 30;
        TRect r(desktop.b.x - w - 1, desktop.a.y,
                desktop.b.x - 1,     desktop.b.y);
        scrambleWindow = static_cast<TScrambleWindow*>(createScrambleWindow(r, sdsTall));
        scrambleState = sdsTall;
        if (scrambleWindow->getView()) {
            scrambleWindow->getView()->setEngine(&scrambleEngine);
        }
        wireScrambleInput();
        deskTop->insert(scrambleWindow);
        scrambleWindow->focusInput();
        // Welcome message in message history
        if (scrambleWindow->getMessageView()) {
            scrambleWindow->getMessageView()->addMessage("scramble", "mrrp! ask me anything (=^..^=)");
        }
    } else if (scrambleState == sdsSmol) {
        // Expand: smol -> tall
        TRect desktop = deskTop->getExtent();
        int w = 30;
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
        // Shrink: tall -> smol
        TRect desktop = deskTop->getExtent();
        int w = 28;
        int h = 14;
        TRect r(desktop.b.x - w - 1, desktop.b.y - h,
                desktop.b.x - 1,     desktop.b.y);
        scrambleWindow->setDisplayState(sdsSmol);
        scrambleWindow->changeBounds(r);
        scrambleState = sdsSmol;
        // Put behind other windows
        if (deskTop->background) {
            scrambleWindow->putInFrontOf((TView*)deskTop->background);
        }
    }
}

void TTestPatternApp::cascade()
{
    deskTop->cascade(deskTop->getExtent());
}

void TTestPatternApp::tile()
{
    deskTop->tile(deskTop->getExtent());
}

void TTestPatternApp::closeAll()
{
    // Close all regular windows on the desktop (iterating safely over circular list)
    std::vector<TWindow*> toClose;
    TView *start = deskTop->first();
    if (start) {
        TView *v = start;
        do {
            TView *nextV = v->next; // cache next to avoid invalidation issues
            if (TWindow *w = dynamic_cast<TWindow*>(v)) {
                // Skip non-user windows if any (none expected here)
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

void TTestPatternApp::newGradientWindow(TGradientWindow::GradientType type)
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

void TTestPatternApp::newGradientWindow(TGradientWindow::GradientType type, const TRect& bounds)
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

// void TTestPatternApp::newMechWindow()
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

void TTestPatternApp::newDonutWindow()
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
    TFrameAnimationWindow* window = new TFrameAnimationWindow(bounds, "", "donut.txt");
    deskTop->insert(window);
    registerWindow(window);
}

void TTestPatternApp::newWibWobWindow()
{
    // Create window title
    windowNumber++;
    std::stringstream title;
    title << "Wib&Wob Chat " << windowNumber;
    
    // Calculate window position (cascade effect) - make it much larger for chat
    int offset = (windowNumber - 1) % 10;
    TRect bounds(
        2 + offset * 2,           // left
        1 + offset,               // top  
        82 + offset * 2,          // right (much wider for chat)
        28 + offset               // bottom (much taller for chat)
    );

    std::string windowTitle = title.str();
    TWindow* window = createWibWobWindow(bounds, windowTitle);
    if (!window) {
        messageBox("Failed to create Wib&Wob Chat window.", mfError | mfOKButton);
        return;
    }

    deskTop->insert(window);
    registerWindow(window);
    window->select();
}

void TTestPatternApp::newWibWobTestWindowA()
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

void TTestPatternApp::newWibWobTestWindowB()
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

void TTestPatternApp::newWibWobTestWindowC()
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

void TTestPatternApp::openAnimationFile()
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

void TTestPatternApp::openAnimationFilePath(const std::string& filePath)
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

void TTestPatternApp::openAnimationFilePath(const std::string& filePath, const TRect& bounds)
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
    
    // Create and insert window with provided bounds
    TFrameAnimationWindow* window = new TFrameAnimationWindow(bounds, "", filePath);
    deskTop->insert(window);
    registerWindow(window);
}

void TTestPatternApp::openTransparentTextFile()
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

void TTestPatternApp::openMonodrawFile(const char* fileName)
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

void TTestPatternApp::setPatternMode(bool continuous)
{
    USE_CONTINUOUS_PATTERN = continuous;

    // Show confirmation message
    std::string mode = continuous ? "Continuous (Diagonal)" : "Tiled (Cropped)";
    std::stringstream msg;
    msg << "Pattern mode set to: " << mode;
    messageBox(msg.str().c_str(), mfInformation | mfOKButton);
}


void TTestPatternApp::showApiKeyDialog()
{
    // Build dialog
    TRect dlgRect(0, 0, 56, 10);
    dlgRect.move((TProgram::deskTop->size.x - 56) / 2,
                 (TProgram::deskTop->size.y - 10) / 2);

    TDialog* dlg = new TDialog(dlgRect, "API Key");

    dlg->insert(new TLabel(TRect(3, 2, 53, 3), "Anthropic API key (sk-ant-...):", nullptr));

    TRect inputRect(3, 3, 53, 4);
    TInputLine* input = new TInputLine(inputRect, 256);
    dlg->insert(input);

    // Status line showing current key state
    std::string status = runtimeApiKey.empty() ? "No key set" : "Key configured";
    dlg->insert(new TStaticText(TRect(3, 5, 53, 6), status.c_str()));

    TRect okRect(12, 7, 24, 9);
    TRect cancelRect(30, 7, 42, 9);
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
            // Also wire to Scramble engine so it can use Haiku immediately.
            scrambleEngine.setApiKey(key);
            fprintf(stderr, "[app] api key set via dialog (len=%zu) — wired to runtimeApiKey + scrambleEngine\n",
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

void TTestPatternApp::takeScreenshot(bool showDialog)
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

    CaptureOptions ansiOpts;
    ansiOpts.format = CaptureFormat::AnsiEscapes;
    ansiOpts.addTimestamp = true;
    ansiOpts.includeMetadata = true;
    bool ansiOk = getFrameCapture().saveFrame(frame, ansiPath, ansiOpts);

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

TPalette& TTestPatternApp::getPalette() const
{
    static TPalette palette(cpMonochrome, sizeof(cpMonochrome)-1);
    return palette;
}

TMenuBar* TTestPatternApp::initMenuBar(TRect r)
{
    r.b.y = r.a.y + 1;
    
    return new TCustomMenuBar(r,
        *new TSubMenu("~F~ile", kbAltF) +
            *new TMenuItem("New ~T~est Pattern", cmNewWindow, kbCtrlN) +
            *new TMenuItem("New ~H~-Gradient", cmNewGradientH, kbNoKey) +
            *new TMenuItem("New ~V~-Gradient", cmNewGradientV, kbNoKey) +
            *new TMenuItem("New ~R~adial Gradient", cmNewGradientR, kbNoKey) +
            *new TMenuItem("New ~D~iagonal Gradient", cmNewGradientD, kbNoKey) +
            *new TMenuItem("New ~M~echs Grid", cmNewMechs, kbCtrlM) +
            *new TMenuItem("New ~A~nimation", cmNewDonut, kbCtrlD) +
            newLine() +
            *new TMenuItem("~O~pen Text/Animation...", cmOpenAnimation, kbCtrlO) +
            *new TMenuItem("Open I~m~age...", cmOpenImageFile, kbNoKey) +
            *new TMenuItem("Open Monodra~w~...", cmOpenMonodraw, kbNoKey) +
            newLine() +
            *new TMenuItem("~S~ave Workspace", cmSaveWorkspace, kbCtrlS) +
            *new TMenuItem("Open ~W~orkspace...", cmOpenWorkspace, kbNoKey) +
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
        *new TSubMenu("~V~iew", kbAltV) +
            *new TMenuItem("~A~SCII Grid Demo", cmAsciiGridDemo, kbNoKey) +
            *new TMenuItem("~A~nimated Blocks", cmAnimatedBlocks, kbNoKey) +
            *new TMenuItem("Animated ~G~radient", cmAnimatedGradient, kbNoKey) +
            *new TMenuItem("Animated S~c~ore", cmAnimatedScore, kbNoKey) +
            *new TMenuItem("Score ~B~G Color...", cmScoreBgColor, kbNoKey) +
            *new TMenuItem("~V~erse Field (Generative)", cmVerseField, kbNoKey) +
            *new TMenuItem("~O~rbit Field (Generative)", cmOrbitField, kbNoKey) +
            *new TMenuItem("~M~ycelium Field (Generative)", cmMyceliumField, kbNoKey) +
            *new TMenuItem("~T~orus Field (Generative)", cmTorusField, kbNoKey) +
            *new TMenuItem("~C~ube Spinner (Generative)", cmCubeField, kbNoKey) +
            *new TMenuItem("~M~onster Portal (Generative)", cmMonsterPortal, kbNoKey) +
            *new TMenuItem("Monster ~V~erse (Generative)", cmMonsterVerse, kbNoKey) +
            *new TMenuItem("Monster ~C~am (Emoji)", cmMonsterCam, kbNoKey) +
            // DISABLED: *new TMenuItem("ASCII ~C~am", cmASCIICam, kbNoKey) +
            *new TMenuItem("Zoom ~I~n", cmZoomIn, kbNoKey) +
            *new TMenuItem("Zoom ~O~ut", cmZoomOut, kbNoKey) +
            *new TMenuItem("~A~ctual Size", cmActualSize, kbNoKey) +
            *new TMenuItem("~F~ull Screen", cmFullScreen, kbF11) +
            newLine() +
            *new TMenuItem("Scra~m~ble Cat", cmScrambleCat, kbF8) +
            *new TMenuItem("Scramble E~x~pand", cmScrambleExpand, kbShiftF8) +
        *new TSubMenu("~W~indow", kbAltW) +
            *new TMenuItem("~E~dit Text Editor", cmTextEditor, kbNoKey) +
            *new TMenuItem("~B~rowser", cmBrowser, kbCtrlB) +
            newLine() +
            *new TMenuItem("~O~pen Text File (Transparent BG)...", cmOpenTransparentText, kbNoKey) +
            newLine() +
            *new TMenuItem("~C~ascade", cmCascade, kbNoKey) +
            *new TMenuItem("~T~ile", cmTile, kbNoKey) +
            *new TMenuItem("Send to ~B~ack", cmSendToBack, kbNoKey) +
            newLine() +
            *new TMenuItem("~N~ext", cmNext, kbF6) +
            *new TMenuItem("~P~revious", cmPrev, kbShiftF6) +
            newLine() +
            *new TMenuItem("Close", cmClose, kbAltF3) +
            *new TMenuItem("C~l~ose All", cmCloseAll, kbNoKey) +
            newLine() +
            *new TMenuItem("Background ~C~olor...", cmWindowBgColor, kbNoKey) +
        *new TSubMenu("~T~ools", kbAltT) +
            *new TMenuItem("~W~ib&Wob Chat", cmWibWobChat, kbF12) +
            *new TMenuItem("  Test A (stdScrollBar)", cmWibWobTestA, kbNoKey) +
            *new TMenuItem("  Test B (TScroller)", cmWibWobTestB, kbNoKey) +
            *new TMenuItem("  Test C (Split Arch)", cmWibWobTestC, kbNoKey) +
            newLine() +
            (TMenuItem&) (
                *new TSubMenu("~G~litch Effects", kbNoKey) +
                    *new TMenuItem(getGlitchEngine().isGlitchModeEnabled() ? "\x04 ~E~nable Glitch Mode" : "  ~E~nable Glitch Mode", 
                                  cmToggleGlitchMode, kbCtrlG) +
                    newLine() +
                    *new TMenuItem("~S~catter Pattern", cmGlitchScatter, kbNoKey) +
                    *new TMenuItem("~C~olor Bleed", cmGlitchColorBleed, kbNoKey) +
                    *new TMenuItem("~R~adial Distort", cmGlitchRadialDistort, kbNoKey) +
                    *new TMenuItem("~D~iagonal Scatter", cmGlitchDiagonalScatter, kbNoKey) +
                    newLine() +
                    *new TMenuItem("Ca~p~ture Frame", cmCaptureGlitchedFrame, kbF9) +
                    *new TMenuItem("R~e~set Parameters", cmResetGlitchParams, kbNoKey) +
                    *new TMenuItem("Glitch Se~t~tings...", cmGlitchSettings, kbNoKey)
            ) +
            newLine() +
            *new TMenuItem("~A~NSI Editor", cmAnsiEditor, kbNoKey) +
            *new TMenuItem("~P~aint Tools", cmPaintTools, kbNoKey) +
            *new TMenuItem("Animation ~S~tudio", cmAnimationStudio, kbNoKey) +
            newLine() +
            *new TMenuItem("~Q~uantum Printer", cmQuantumPrinter, kbF11) +
            newLine() +
            *new TMenuItem("API ~K~ey...", cmApiKey, kbNoKey) +
        *new TSubMenu("~H~elp", kbAltH) +
            *new TMenuItem("~A~bout WIBWOBWORLD", cmAbout, kbNoKey)
    );
}

TStatusLine* TTestPatternApp::initStatusLine(TRect r)
{
    r.a.y = r.b.y - 1;
    return new TCustomStatusLine(r,
        *new TStatusDef(0, 0xFFFF) +
            *new TStatusItem("~Alt-X~ Exit", kbAltX, cmQuit) +
            *new TStatusItem("~Ctrl-N~ New Window", kbCtrlN, cmNewWindow) +
        *new TStatusItem("~F5~ Repaint", kbF5, cmRepaint) +
            *new TStatusItem("~F6~ Next", kbF6, cmNext) +
            *new TStatusItem("~Alt-F3~ Close", kbAltF3, cmClose) +
            *new TStatusItem("~F8~ Scramble", kbF8, cmScrambleCat) +
            *new TStatusItem("~F10~ Menu", kbF10, cmMenu) +
            *new TStatusItem("~F11~ Quantum Printer", kbF11, cmMenu)
    );
}

TDeskTop* TTestPatternApp::initDeskTop(TRect r)
{
    r.a.y = 1;
    r.b.y--;
    // Create desktop with standard constructor (plain background)
    TDeskTop* desktop = new TDeskTop(r);
    return desktop;
}


void TTestPatternApp::run()
{
    // Call parent run to initialize everything first
    TApplication::run();
}

TRect TTestPatternApp::calculateWindowBounds(const std::string& filePath)
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

void TTestPatternApp::idle()
{
    TApplication::idle();
    // Poll IPC server for incoming API commands
    if (ipcServer) ipcServer->poll();

    // DISABLED: Update animated kaomoji in menu bar (causing crashes + freezes)
    // if (menuBar) {
    //     auto* customMenuBar = dynamic_cast<TCustomMenuBar*>(menuBar);
    //     if (customMenuBar) {
    //         customMenuBar->update();
    //     }
    // }

    // Idle: no default content window or wallpaper.
}

int main()
{
    TTestPatternApp app;
    app.run();
    return 0;
}

// ---- IPC API helper functions (friend) ----
// Backward compatibility overloads
void api_spawn_test(TTestPatternApp& app) { app.newTestWindow(); }
void api_spawn_gradient(TTestPatternApp& app, const std::string& kind) {
    if (kind == "horizontal") app.newGradientWindow(TGradientWindow::gtHorizontal);
    else if (kind == "vertical") app.newGradientWindow(TGradientWindow::gtVertical);
    else if (kind == "radial") app.newGradientWindow(TGradientWindow::gtRadial);
    else if (kind == "diagonal") app.newGradientWindow(TGradientWindow::gtDiagonal);
    else app.newGradientWindow(TGradientWindow::gtHorizontal);
}
void api_open_animation_path(TTestPatternApp& app, const std::string& path) {
    app.openAnimationFilePath(path);
}

// New overloads with bounds support
void api_spawn_test(TTestPatternApp& app, const TRect* bounds) { 
    if (bounds) {
        app.newTestWindow(*bounds);
    } else {
        app.newTestWindow();
    }
}

void api_spawn_gradient(TTestPatternApp& app, const std::string& kind, const TRect* bounds) {
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

void api_open_text_view_path(TTestPatternApp& app, const std::string& path, const TRect* bounds) {
    if (bounds) {
        int width = bounds->b.x - bounds->a.x;
        int height = bounds->b.y - bounds->a.y;
        
        if (width > 0 && height > 0) {
            // Use provided bounds if width/height are positive
            app.openAnimationFilePath(path, *bounds);
        } else {
            // Auto-size based on content, but use provided position
            TRect autoBounds = app.calculateWindowBounds(path);
            // Keep the original position, but use auto-calculated size
            TRect finalBounds(
                bounds->a.x, 
                bounds->a.y, 
                bounds->a.x + (autoBounds.b.x - autoBounds.a.x), 
                bounds->a.y + (autoBounds.b.y - autoBounds.a.y)
            );
            app.openAnimationFilePath(path, finalBounds);
        }
    } else {
        // No bounds provided - full auto-sizing (cascade position + content size)
        app.openAnimationFilePath(path);
    }
}

void api_open_animation_path(TTestPatternApp& app, const std::string& path, const TRect* bounds) {
    if (bounds) {
        app.openAnimationFilePath(path, *bounds);
    } else {
        app.openAnimationFilePath(path);
    }
}

void api_cascade(TTestPatternApp& app) { app.cascade(); }
void api_toggle_scramble(TTestPatternApp& app) { app.toggleScramble(); }
void api_expand_scramble(TTestPatternApp& app) { app.toggleScrambleExpand(); }

std::string api_scramble_say(TTestPatternApp& app, const std::string& text) {
    if (!app.scrambleWindow) return "err scramble not open";
    // Simulate user sending a message — same as onSubmit
    auto* msgView = app.scrambleWindow->getMessageView();
    if (msgView) msgView->addMessage("you", text);

    std::string response = app.scrambleEngine.ask(text);
    if (response.empty()) response = "... (=^..^=)";

    if (app.scrambleWindow->getView()) {
        app.scrambleWindow->getView()->setPose(spCurious);
        app.scrambleWindow->getView()->say(response);
    }
    if (msgView) msgView->addMessage("scramble", response);
    return response;
}
std::string api_scramble_pet(TTestPatternApp& app) {
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

std::string api_chat_receive(TTestPatternApp& app, const std::string& sender, const std::string& text) {
    // Display a remote chat message in Scramble without AI processing.
    if (!app.scrambleWindow) return "err scramble not open";
    auto* msgView = app.scrambleWindow->getMessageView();
    if (!msgView) return "err no message view";
    msgView->addMessage(sender, text);
    return "ok";
}

void api_tile(TTestPatternApp& app) { app.tile(); }
void api_close_all(TTestPatternApp& app) { app.closeAll(); }

void api_set_pattern_mode(TTestPatternApp& app, const std::string& mode) {
    bool continuous = (mode == "continuous");
    app.setPatternMode(continuous);
}

void api_save_workspace(TTestPatternApp& app) { app.saveWorkspace(); }
bool api_save_workspace_path(TTestPatternApp& app, const std::string& path) { return app.saveWorkspacePath(path); }

bool api_open_workspace_path(TTestPatternApp& app, const std::string& path) {
    return app.openWorkspacePath(path);
}

void api_screenshot(TTestPatternApp& app) { app.takeScreenshot(false); }

static const char* windowTypeName(TWindow* w) {
    if (!w) return "test_pattern";

    // Directly-typed windows whose classes are visible in this TU.
    if (dynamic_cast<TTestPatternWindow*>(w))    return "test_pattern";
    if (dynamic_cast<TGradientWindow*>(w))        return "gradient";
    if (dynamic_cast<TBrowserWindow*>(w))         return "browser";
    if (dynamic_cast<TTextEditorWindow*>(w))      return "text_editor";
    if (dynamic_cast<TTransparentTextWindow*>(w)) return "text_view";
    if (dynamic_cast<TFrameAnimationWindow*>(w))  return "frame_player";
    if (dynamic_cast<TWibWobWindow*>(w))          return "wibwob";
    if (dynamic_cast<TScrambleWindow*>(w))        return "scramble";

    // Generative/animated window wrapper classes are local to their .cpp files
    // and cannot be dynamic_cast from here. Identify them by their hosted
    // child view type instead.
#define HAS_CHILD_VIEW(ViewType) \
    ([&]() -> bool { \
        TView *_s = w->first(); \
        if (!_s) return false; \
        TView *_v = _s; \
        do { if (dynamic_cast<ViewType*>(_v)) return true; _v = _v->next; } while (_v != _s); \
        return false; \
    }())

    if (HAS_CHILD_VIEW(TGenerativeVerseView))         return "verse";
    if (HAS_CHILD_VIEW(TGenerativeMyceliumView))      return "mycelium";
    if (HAS_CHILD_VIEW(TGenerativeOrbitView))         return "orbit";
    if (HAS_CHILD_VIEW(TGenerativeTorusView))         return "torus";
    if (HAS_CHILD_VIEW(TGenerativeCubeView))          return "cube";
    if (HAS_CHILD_VIEW(TGameOfLifeView))              return "life";
    if (HAS_CHILD_VIEW(TAnimatedBlocksView))          return "blocks";
    if (HAS_CHILD_VIEW(TAnimatedScoreView))           return "score";
    if (HAS_CHILD_VIEW(TAnimatedAsciiView))           return "ascii";
    if (HAS_CHILD_VIEW(TAnimatedHGradientView))       return "animated_gradient";
    if (HAS_CHILD_VIEW(TGenerativeMonsterCamView))    return "monster_cam";
    if (HAS_CHILD_VIEW(TGenerativeMonsterVerseView))  return "monster_verse";
    if (HAS_CHILD_VIEW(TGenerativeMonsterPortalView)) return "monster_portal";

#undef HAS_CHILD_VIEW
    return "test_pattern";
}

std::string api_get_state(TTestPatternApp& app) {
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
    for (TWindow* w : activeWins) {
        std::string id = app.registerWindow(w);
        if (!first) json << ",";
        json << "{\"id\":\"" << id << "\""
             << ",\"type\":\"" << windowTypeName(w) << "\""
             << ",\"x\":" << w->origin.x
             << ",\"y\":" << w->origin.y
             << ",\"w\":" << w->size.x
             << ",\"h\":" << w->size.y
             << ",\"title\":\"";
        if (w->title) {
            std::string title(w->title);
            for (char c : title) {
                if (c == '"') json << "\\\"";
                else if (c == '\\') json << "\\\\";
                else json << c;
            }
        }
        json << "\"}";
        first = false;
    }

    json << "]";

    // Append chat_log for multiplayer relay bridge
    json << ",\"chat_log\":[";
    bool firstChat = true;
    for (const auto& entry : app.chatLog_) {
        if (!firstChat) json << ",";
        json << "{\"seq\":" << entry.seq
             << ",\"sender\":\"" << TTestPatternApp::jsonEscape(entry.sender) << "\""
             << ",\"text\":\"" << TTestPatternApp::jsonEscape(entry.text) << "\"}";
        firstChat = false;
    }
    json << "]}";
    return json.str();
}

std::string api_move_window(TTestPatternApp& app, const std::string& id, int x, int y) {
    TWindow* w = app.findWindowById(id);
    if (!w) return "{\"error\":\"Window not found\"}";

    TRect newBounds = w->getBounds();
    newBounds.move(x - newBounds.a.x, y - newBounds.a.y);
    w->locate(newBounds);

    if (app.ipcServer) {
        std::string payload = std::string("{\"id\":\"") + id + "\"}";
        app.ipcServer->publish_event("state_changed", payload);
    }
    return "{\"success\":true}";
}

std::string api_resize_window(TTestPatternApp& app, const std::string& id, int width, int height) {
    TWindow* w = app.findWindowById(id);
    if (!w) return "{\"error\":\"Window not found\"}";

    TRect newBounds = w->getBounds();
    newBounds.b.x = newBounds.a.x + width;
    newBounds.b.y = newBounds.a.y + height;
    w->locate(newBounds);

    if (app.ipcServer) {
        std::string payload = std::string("{\"id\":\"") + id + "\"}";
        app.ipcServer->publish_event("state_changed", payload);
    }
    return "{\"success\":true}";
}

std::string api_focus_window(TTestPatternApp& app, const std::string& id) {
    TWindow* w = app.findWindowById(id);
    if (!w) return "{\"error\":\"Window not found\"}";
    
    app.deskTop->setCurrent(w, TDeskTop::normalSelect);
    return "{\"success\":true}";
}

std::string api_close_window(TTestPatternApp& app, const std::string& id) {
    TWindow* w = app.findWindowById(id);
    if (!w) return "{\"error\":\"Window not found\"}";

    // Remove from registry
    app.winToId.erase(w);
    app.idToWin.erase(id);

    // Notify subscribers before closing
    if (app.ipcServer) {
        std::string payload = std::string("{\"id\":\"") + id + "\"}";
        app.ipcServer->publish_event("window_closed", payload);
    }

    // Close the window
    w->close();
    return "{\"success\":true}";
}

// --- Minimal JSON parsing helpers (subset tailored to our schema) ---
void TTestPatternApp::skipWs(const std::string &s, size_t &pos)
{
    while (pos < s.size() && (s[pos] == ' ' || s[pos] == '\n' || s[pos] == '\r' || s[pos] == '\t')) ++pos;
}

bool TTestPatternApp::consume(const std::string &s, size_t &pos, char ch)
{
    skipWs(s, pos);
    if (pos < s.size() && s[pos] == ch) { ++pos; return true; }
    return false;
}

bool TTestPatternApp::parseString(const std::string &s, size_t &pos, std::string &out)
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

bool TTestPatternApp::parseNumber(const std::string &s, size_t &pos, int &out)
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

bool TTestPatternApp::parseBool(const std::string &s, size_t &pos, bool &out)
{
    skipWs(s, pos);
    if (s.compare(pos, 4, "true") == 0) { out = true; pos += 4; return true; }
    if (s.compare(pos, 5, "false") == 0) { out = false; pos += 5; return true; }
    return false;
}

bool TTestPatternApp::parseKeyedString(const std::string &s, size_t objStart, const char *key, std::string &out)
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

bool TTestPatternApp::parseKeyedBool(const std::string &s, size_t objStart, const char *key, bool &out)
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

bool TTestPatternApp::parseBounds(const std::string &s, size_t objStart, int &x,int &y,int &w,int &h)
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

bool TTestPatternApp::loadWorkspaceFromFile(const std::string& path)
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

    // Close current windows
    closeAll();

    // Apply globals
    USE_CONTINUOUS_PATTERN = continuous;

    // Restore windows
    std::vector<TWindow*> created;
    for (const auto &obj : objects) {
        std::string type; if (!parseKeyedString(obj, 0, "type", type)) continue;
        std::string title; parseKeyedString(obj, 0, "title", title);
        int x=2,y=1,w=50,h=15; parseBounds(obj, 0, x,y,w,h);
        bool zoomed=false; parseKeyedBool(obj, 0, "zoomed", zoomed);

        // Clamp
        TRect ext = deskTop->getExtent();
        int maxW = ext.b.x - ext.a.x;
        int maxH = ext.b.y - ext.a.y;
        if (w < 16) w = 16; if (h < 6) h = 6;
        if (w > maxW) w = maxW; if (h > maxH) h = maxH;
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
        } else {
            continue;
        }
        deskTop->insert(win);
        if (zoomed) win->zoom();
        created.push_back(win);
    }

    // Focus saved
    int focusedIdx = -1;
    size_t fpos = data.find("\"focusedIndex\"");
    if (fpos != std::string::npos) { size_t pos = data.find(':', fpos); if (pos != std::string::npos) { ++pos; parseNumber(data, pos, focusedIdx); } }
    if (focusedIdx >= 0 && focusedIdx < (int)created.size()) created[focusedIdx]->select();

    return true;
}

void TTestPatternApp::openWorkspace()
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

bool TTestPatternApp::openWorkspacePath(const std::string& path)
{
    bool ok = loadWorkspaceFromFile(path);
    fprintf(stderr, "[workspace] open path=%s ok=%s\n", path.c_str(), ok ? "true" : "false");
    return ok;
}

// Minimal JSON helpers
std::string TTestPatternApp::jsonEscape(const std::string& s)
{
    std::string out;
    out.reserve(s.size() + 8);
    for (unsigned char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    char buf[7];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", c);
                    out += buf;
                } else out += char(c);
        }
    }
    return out;
}

std::string TTestPatternApp::buildWorkspaceJson()
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
        std::string type = "custom";
        std::string props = "{}";

        if (dynamic_cast<TTestPatternWindow*>(w)) {
            type = "test_pattern";
            props = "{}"; // Pattern mode is global in MVP
        } else {
            // Try to detect gradient by scanning child views (circular list)
            bool isGradient = false;
            TView *cStart = w->first();
            if (cStart) {
            TView *c = cStart;
            do {
                if (dynamic_cast<THorizontalGradientView*>(c)) {
                    type = "gradient"; props = "{\"gradientType\": \"horizontal\"}"; isGradient = true; break;
                } else if (dynamic_cast<TVerticalGradientView*>(c)) {
                    type = "gradient"; props = "{\"gradientType\": \"vertical\"}"; isGradient = true; break;
                } else if (dynamic_cast<TRadialGradientView*>(c)) {
                    type = "gradient"; props = "{\"gradientType\": \"radial\"}"; isGradient = true; break;
                } else if (dynamic_cast<TDiagonalGradientView*>(c)) {
                    type = "gradient"; props = "{\"gradientType\": \"diagonal\"}"; isGradient = true; break;
                }
                c = c->next;
            } while (c != cStart);
            }
            if (!isGradient) {
                // Unknown window type: keep as 'custom' with empty props
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
        std::string safeTitle = title ? jsonEscape(title) : std::string("");
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

void TTestPatternApp::saveWorkspace()
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
    messageBox(ok.c_str(), mfInformation | mfOKButton);
}

bool TTestPatternApp::saveWorkspacePath(const std::string& path)
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
    fprintf(stderr, "[workspace] save path=%s ok=%s\n", path.c_str(), ok ? "true" : "false");
    return ok;
}

std::string api_get_canvas_size(TTestPatternApp& app) {
    TRect desktop = TProgram::deskTop->getBounds();
    std::stringstream json;
    json << "{\"width\":" << desktop.b.x 
         << ",\"height\":" << desktop.b.y
         << ",\"cols\":" << desktop.b.x
         << ",\"rows\":" << desktop.b.y << "}";
    return json.str();
}

void api_spawn_text_editor(TTestPatternApp& app, const TRect* bounds) {
    TRect r;
    if (bounds) {
        r = *bounds;
    } else {
        r = TProgram::deskTop->getBounds();
        r.grow(-5, -3);
    }
    TWindow* window = createTextEditorWindow(r);
    TProgram::deskTop->insert(window);
}

std::string api_send_text(TTestPatternApp& app, const std::string& id,
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

std::string api_send_figlet(TTestPatternApp& app, const std::string& id, const std::string& text, 
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

void api_spawn_browser(TTestPatternApp& app, const TRect* bounds) {
    if (bounds) {
        app.newBrowserWindow(*bounds);
    } else {
        app.newBrowserWindow();
    }
}

// Generative / animated art windows — spawnable via IPC create_window type=X
static TRect api_centered_bounds(TTestPatternApp& app, int width, int height) {
    TRect d = app.deskTop->getExtent();
    int dw = d.b.x - d.a.x;
    int dh = d.b.y - d.a.y;
    width  = std::max(10, std::min(width,  dw));
    height = std::max(6,  std::min(height, dh));
    int left = d.a.x + (dw - width)  / 2;
    int top  = d.a.y + (dh - height) / 2;
    return TRect(left, top, left + width, top + height);
}

void api_spawn_verse(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeVerseWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_mycelium(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeMyceliumWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_orbit(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeOrbitWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_torus(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 90, 28);
    TWindow* w = createGenerativeTorusWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_cube(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 90, 28);
    TWindow* w = createGenerativeCubeWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_life(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 90, 28);
    TWindow* w = createGameOfLifeWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_blocks(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 84, 24);
    TWindow* w = createAnimatedBlocksWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_score(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 108, 34);
    TWindow* w = createAnimatedScoreWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_ascii(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createAnimatedAsciiWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_animated_gradient(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 84, 24);
    TWindow* w = createAnimatedGradientWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_monster_cam(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeMonsterCamWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_monster_verse(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeMonsterVerseWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

void api_spawn_monster_portal(TTestPatternApp& app, const TRect* bounds) {
    TRect r = bounds ? *bounds : api_centered_bounds(app, 96, 30);
    TWindow* w = createGenerativeMonsterPortalWindow(r);
    app.deskTop->insert(w);
    app.registerWindow(w);
}

std::string api_browser_fetch(TTestPatternApp& app, const std::string& url) {
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

std::string api_set_theme_mode(TTestPatternApp& app, const std::string& mode) {
    (void)app;
    if (mode != "light" && mode != "dark")
        return "err invalid theme mode";
    return "ok";
}

std::string api_set_theme_variant(TTestPatternApp& app, const std::string& variant) {
    (void)app;
    if (variant != "monochrome" && variant != "dark_pastel")
        return "err invalid theme variant";
    return "ok";
}

std::string api_reset_theme(TTestPatternApp& app) {
    (void)app;
    return "ok";
}
