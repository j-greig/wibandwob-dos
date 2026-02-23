#ifndef DRUM_ENGINE_H
#define DRUM_ENGINE_H

#include <cstdint>
#include "sequencer.h"

namespace drum808 {

class DrumEngine
{
public:
    DrumEngine();
    ~DrumEngine() = default;

    void fillBuffer(int16_t* output, int numSamples);

    void start();
    void stop();
    bool isPlaying() const;

    void setTempo(double bpm);
    double getTempo() const;

    void toggleNote(int instrument, int step);
    int getPosition() const;
    int getInstrumentCount() const;
    const char* getInstrumentName(int index) const;
    bool getNoteState(int instrumentIndex, int step) const;

private:
    Sequencer m_sequencer;
};

} // namespace drum808

#endif
