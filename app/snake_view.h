/*---------------------------------------------------------*/
/*                                                         */
/*   snake_view.h - Classic Snake game                     */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef SNAKE_VIEW_H
#define SNAKE_VIEW_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TRect
#include <tvision/tv.h>
#include <deque>
#include <vector>
#include <cstdint>

enum class Dir : uint8_t { Up, Down, Left, Right };

struct Pos {
    int x, y;
    bool operator==(const Pos& o) const { return x == o.x && y == o.y; }
    bool operator!=(const Pos& o) const { return !(*this == o); }
};

class TSnakeView : public TView {
public:
    explicit TSnakeView(const TRect &bounds, unsigned periodMs = 120);
    virtual ~TSnakeView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

private:
    void startTimer();
    void stopTimer();
    void restartTimer();
    void tick();
    void newGame();
    void spawnFood();
    bool isSnake(const Pos& p) const;
    unsigned currentSpeed() const;

    // Board dimensions (derived from view size, with 1-cell border)
    int boardW() const { return size.x - HUD_WIDTH; }
    int boardH() const { return size.y; }

    static constexpr int HUD_WIDTH = 18;  // right-side HUD

    // Snake state
    std::deque<Pos> body;  // front = head, back = tail
    Dir dir {Dir::Right};
    Dir nextDir {Dir::Right};

    // Food
    Pos food {0, 0};
    int foodAnim {0};     // animation frame counter for food sparkle

    // Game state
    bool gameOver {false};
    bool paused {false};
    int score {0};
    int highScore {0};
    int eaten {0};         // food eaten this game
    int deathFlash {0};    // countdown for death animation

    // Timer
    unsigned basePeriodMs;
    TTimerId timerId {0};

    // Rendering
    std::vector<TScreenCell> lineBuf;
};

// Factory
class TWindow;
TWindow* createSnakeWindow(const TRect &bounds);

#endif // SNAKE_VIEW_H
