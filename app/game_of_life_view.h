/*---------------------------------------------------------*/
/*                                                         */
/*   game_of_life_view.h - Conway's Game of Life View     */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef GAME_OF_LIFE_VIEW_H
#define GAME_OF_LIFE_VIEW_H

#define Uses_TView
#define Uses_TDrawBuffer
#define Uses_TRect
#include <tvision/tv.h>
#include <vector>
#include <unordered_set>
#include <unordered_map>

// Coordinate struct for sparse grid representation
struct CellCoord {
    int x, y;
    
    CellCoord(int x_ = 0, int y_ = 0) : x(x_), y(y_) {}
    
    bool operator==(const CellCoord& other) const {
        return x == other.x && y == other.y;
    }
};

// Hash function for CellCoord to use in unordered containers
struct CellCoordHash {
    std::size_t operator()(const CellCoord& coord) const {
        // Combine x and y coordinates into a single hash
        // Using a simple but effective hash combination
        return std::hash<int>()(coord.x) ^ (std::hash<int>()(coord.y) << 1);
    }
};

// Conway's Game of Life cellular automaton view (v2 with sparse grid optimization)
// Implements classic rules: birth (3 neighbors), survival (2-3 neighbors), death (otherwise)
// Performance: O(living_cells) instead of O(grid_width * grid_height)
class TGameOfLifeView : public TView {
public:
    explicit TGameOfLifeView(const TRect &bounds, unsigned periodMs = 400);
    virtual ~TGameOfLifeView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

    void setSpeed(unsigned periodMs_);
    void reset();
    void seedRandom(float density = 0.3f);
    void loadGlider();

private:
    void startTimer();
    void stopTimer();
    void advance();
    void computeNextGeneration();
    int countNeighbors(const CellCoord& coord) const;
    void initGrid();
    bool isAlive(const CellCoord& coord) const;
    void setAlive(const CellCoord& coord, bool alive);
    void addActiveNeighbors(const CellCoord& coord);

    unsigned periodMs;
    TTimerId timerId {0};
    int generation {0};
    
    int gridWidth {0};
    int gridHeight {0};
    
    // Sparse grid representation - only store living cells
    std::unordered_set<CellCoord, CellCoordHash> livingCells;
    std::unordered_set<CellCoord, CellCoordHash> activeCells;  // Cells to evaluate next generation
    std::unordered_map<CellCoord, int, CellCoordHash> cellAges;  // For future age-based rendering
    
    std::vector<TScreenCell> lineBuf;
};

// Factory helper used by the app to avoid direct dependency on the view type.
class TWindow; 
TWindow* createGameOfLifeWindow(const TRect &bounds);

#endif // GAME_OF_LIFE_VIEW_H