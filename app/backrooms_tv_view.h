/*---------------------------------------------------------*/
/*                                                         */
/*   backrooms_tv_view.h - Live ASCII art generator view   */
/*                                                         */
/*   Streams output from wibandwob-backrooms v3 CLI into   */
/*   a scrolling text buffer. Jet black background, white  */
/*   text, 3-cell padding on all edges.                    */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef BACKROOMS_TV_VIEW_H
#define BACKROOMS_TV_VIEW_H

#define Uses_TView
#define Uses_TScroller
#define Uses_TScrollBar
#define Uses_TDrawBuffer
#define Uses_TRect
#include <tvision/tv.h>
#include <vector>
#include <string>
#include <deque>

// ---------------------------------------------------------------------------
// BackroomsBridge — manages the cli-v3.ts subprocess lifecycle.
// ---------------------------------------------------------------------------

struct BackroomsChannel {
    std::string theme       = "liminal spaces";
    std::string primers;    // comma-separated primer names (empty = none)
    int         turns       = 3;
    std::string model       = "sonnet";
};

class BackroomsBridge {
public:
    BackroomsBridge();
    ~BackroomsBridge();

    // Spawn the generator subprocess. Returns true if launched OK.
    bool start(const BackroomsChannel &channel);

    // Kill current subprocess if running.
    void stop();

    // Non-blocking read from child stdout. Appends to `out`.
    // Returns number of bytes read (0 = nothing available, -1 = EOF/error).
    int readAvailable(std::string &out);

    bool isRunning() const { return pid_ > 0; }
    pid_t pid() const { return pid_; }

    std::string resolveBackroomsPath() const;

private:
    pid_t pid_  = -1;
    int   fd_   = -1;   // stdout pipe read-end
};

// ---------------------------------------------------------------------------
// TBackroomsTvView — scrolling text view fed by BackroomsBridge pipe.
// ---------------------------------------------------------------------------

class TBackroomsTvView : public TScroller {
public:
    static const int kPadding = 3;      // cells of padding on each edge
    static const int kMaxLines = 500;   // ring buffer cap

    TBackroomsTvView(const TRect &bounds, TScrollBar *vsb);
    virtual ~TBackroomsTvView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect &bounds) override;

    // Channel control
    void play(const BackroomsChannel &channel);
    void pause();
    void resume();
    void next();        // restart with same channel config
    bool isPaused() const { return paused_; }
    const BackroomsChannel &channel() const { return channel_; }

private:
    void startTimer();
    void stopTimer();
    void pollPipe();
    void appendText(const std::string &text);
    void updateScrollLimit();
    void scrollToBottom();
    void openLogFile();
    void writeToLog(const std::string &text);

    BackroomsBridge bridge_;
    BackroomsChannel channel_;
    std::string logPath_;              // path to session log file
    int logFd_ = -1;                   // log file descriptor

    std::deque<std::string> lines_;     // ring buffer of display lines
    std::string partial_;               // incomplete line accumulator
    bool autoScroll_ = true;            // snap to bottom on new content
    bool paused_ = false;

    unsigned periodMs_ = 50;
    TTimerId timerId_ = 0;
};

// Factory — creates a titled, tileable window hosting the view.
class TWindow;
TWindow* createBackroomsTvWindow(const TRect &bounds);
TWindow* createBackroomsTvWindow(const TRect &bounds, const BackroomsChannel &channel);

// Config dialog — returns true if user clicked Play, fills channel config.
// Reads primer list from the backrooms repo primers/ directory.
bool showBackroomsTvDialog(BackroomsChannel &outChannel);

// Scan modules-private/*/primers/ and symlink any new files into the
// backrooms primers/ dir. Call once at app startup so module primers are
// immediately available without opening the config dialog first.
void syncModulePrimers();

#endif // BACKROOMS_TV_VIEW_H
