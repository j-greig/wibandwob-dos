/*---------------------------------------------------------*/
/*                                                         */
/*   generative_monster_cam_view.h - Monster Cam (Emoji)  */
/*                                                         */
/*   Webcam-driven Verse-like emoji renderer with          */
/*   width-aware emitter and graceful fallback.           */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef GENERATIVE_MONSTER_CAM_VIEW_H
#define GENERATIVE_MONSTER_CAM_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#include <tvision/tv.h>

#include <vector>
#include <string>

class TGenerativeMonsterCamView : public TView {
public:
    explicit TGenerativeMonsterCamView(const TRect &bounds, unsigned periodMs = 80);
    virtual ~TGenerativeMonsterCamView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

private:
    void startTimer();
    void stopTimer();
    void advance();
    bool pollSocket();

    // Rendering params
    unsigned periodMs;
    TTimerId timerId {0};
    int frame {0};
    // Minimal POC: tiny face on empty background
    bool minimalSprite {true};
    bool debugHud {true};

    // Latest frame buffer (luminance 0..255)
    int camW {0}, camH {0};
    std::vector<unsigned char> cam;
    bool hasFace {false};
    int faceX {0}, faceY {0}, faceW {0}, faceH {0};
    bool blink {false};

    // Socket state
    int sockFd {-1};
    std::string inHdr;
    std::vector<unsigned char> inPayload;
    int needBytes {0};
    std::string connectionStatus {"connecting"};

    // Stats
    unsigned long framesRx {0};
    unsigned long framesSinceTick {0};
    unsigned long lastTickMs {0};
    float rxFps {0.f};

    // Smoothed face tracking (view-space)
    float smVX {-1.f}, smVY {-1.f};
    unsigned long lastFaceSeenMs {0};
    int faceStickyMs {900};
    // Output stabilization
    float deadbandCols {1.0f};
    float deadbandRows {1.0f};
    int outVX {-1};
    int outVY {-1};
};

class TWindow; TWindow* createGenerativeMonsterCamWindow(const TRect &bounds);

#endif // GENERATIVE_MONSTER_CAM_VIEW_H
