/*---------------------------------------------------------*/
/*                                                         */
/*   quadra_view.h - Quadra falling blocks game            */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef QUADRA_VIEW_H
#define QUADRA_VIEW_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TRect
#include <tvision/tv.h>
#include <vector>
#include <array>
#include <cstdint>

// Tetromino piece types
enum class PieceType : uint8_t {
    I = 0, O, T, S, Z, J, L,
    COUNT
};

// A piece: type + rotation + position
struct Piece {
    PieceType type;
    int rotation;  // 0-3
    int x, y;      // board coords (top-left of 4x4 bounding box)
};

// Board cell: 0 = empty, 1-7 = piece color
using Cell = uint8_t;

class TQuadraView : public TView {
public:
    static constexpr int BOARD_W = 10;
    static constexpr int BOARD_H = 20;
    static constexpr int CELL_W  = 2;  // each cell is 2 chars wide for square look

    explicit TQuadraView(const TRect &bounds, unsigned periodMs = 500);
    virtual ~TQuadraView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

private:
    void startTimer();
    void stopTimer();
    void tick();
    void spawnPiece();
    bool tryMove(int dx, int dy);
    bool tryRotate(int dir);
    void lockPiece();
    int clearLines();
    void applyGravity();
    bool collides(const Piece& p) const;
    void getCells(const Piece& p, int out[4][2]) const;
    void newGame();

    // Board state
    std::array<std::array<Cell, BOARD_W>, BOARD_H> board {};
    Piece current {};
    Piece next {};
    bool gameOver {false};
    bool paused {false};

    // Scoring
    int score {0};
    int lines {0};
    int level {1};
    int chainCount {0};

    // Timer
    unsigned periodMs;
    TTimerId timerId {0};

    // Piece bag for fair randomness
    std::vector<PieceType> bag;
    PieceType nextFromBag();

    // Rendering
    std::vector<TScreenCell> lineBuf;
};

// Factory
class TWindow;
TWindow* createQuadraWindow(const TRect &bounds);

#endif // QUADRA_VIEW_H
