/*---------------------------------------------------------*/
/*                                                         */
/*   generative_monster_portal_view.h - Monster Portal    */
/*                                                         */
/*   Tiled emoji portal pattern (from primer) on black     */
/*   background. Alternate rows offset 50% (brick).        */
/*   Over time the tile degrades (glitches) and drifts.    */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef GENERATIVE_MONSTER_PORTAL_VIEW_H
#define GENERATIVE_MONSTER_PORTAL_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#include <tvision/tv.h>

class TGenerativeMonsterPortalView : public TView {
public:
    explicit TGenerativeMonsterPortalView(const TRect &bounds, unsigned periodMs = 90);
    virtual ~TGenerativeMonsterPortalView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

private:
    void startTimer();
    void stopTimer();
    void advance();

    unsigned periodMs;
    TTimerId timerId {0};
    int frame {0};
    float glitch {0.f};    // 0..1 growing
    float glitchSpeed {0.0025f};
    int scroll {0};        // horizontal drift

    // Episode system (BREATHE -> HAUNT -> FLAME -> COLLAPSE)
    enum Episode { EP_BREATHE=0, EP_HAUNT=1, EP_FLAME=2, EP_COLLAPSE=3 };
    Episode episode {EP_BREATHE};
    int epFrame {0};
    int epDuration {1200}; // ~108s at 90ms (~1.8m per episode)

    // Layout controls
    int tileW {32};
    int tileH {12};
    float density {0.55f};    // overall emoji density cap (0..1)
    float crownRigidity {0.8f}; // 0..1 higher = straighter rails
    float whitespaceBias {0.35f}; // higher -> more spaces/punctuation

    // Smooth temporal evolution
    float time {0.f};
    float timeSpeed {0.0015f}; // lower = slower evolution (very slow by default)
    float cellLatchRate {0.2f}; // Hz-equivalent per-cell update rate (0.2 => ~1 update/5s)
};

class TWindow; TWindow* createGenerativeMonsterPortalWindow(const TRect &bounds);

#endif // GENERATIVE_MONSTER_PORTAL_VIEW_H
