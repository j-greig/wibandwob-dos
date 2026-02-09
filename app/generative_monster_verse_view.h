/*---------------------------------------------------------*/
/*                                                         */
/*   generative_monster_verse_view.h - Monster Verse      */
/*                                                         */
/*   Verse-style smooth flow/swirl/weave fields with      */
/*   emoji-monster glyph mapping + sparse portal motifs.  */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef GENERATIVE_MONSTER_VERSE_VIEW_H
#define GENERATIVE_MONSTER_VERSE_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#include <tvision/tv.h>

class TGenerativeMonsterVerseView : public TView {
public:
    enum Mode { mdFlow=0, mdSwirl=1, mdWeave=2 };

    explicit TGenerativeMonsterVerseView(const TRect &bounds, unsigned periodMs = 60);
    virtual ~TGenerativeMonsterVerseView();

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
    int paletteIndex {0};
    Mode mode {mdFlow};

    // Glyph mix knobs
    float whitespaceBias {0.18f}; // slightly more blank by default
    float emojiBias {0.80f};      // more emoji by default
    int headDensity {4};          // larger = sparser head overlays
    bool emojiFlood {false};       // force high emoji presence when true
};

class TWindow; TWindow* createGenerativeMonsterVerseWindow(const TRect &bounds);

#endif // GENERATIVE_MONSTER_VERSE_VIEW_H
