#ifndef SEQUENCER_H
#define SEQUENCER_H

#include <array>
#include <memory>
#include <vector>
#include "instrument.h"

namespace drum808 {

#define SUBDIVISION 16

const int SAMPLE_RATE = 44100;

class Sequencer
{
public:
    Sequencer() = default;
    ~Sequencer() = default;

    void init();

    void setTempo(double tempo);
    double getTempo() const;

    void toggleNote(int instrumentIndex, int step);
    int getPosition() const;
    int getInstrumentCount() const;
    const char* getInstrumentName(int index) const;
    bool getNoteState(int instrumentIndex, int step) const;

    void start();
    void stop();
    void updateBy(double time);

    const std::vector<Instrument *> &getActiveSamples() const;

    bool isPlaying() const;

private:
    void triggerCurrentStep();
    bool isValidInstrumentIndex(int index) const;
    bool isValidStep(int step) const;

    std::array<std::array<bool, SUBDIVISION>, 4> m_pattern{};
    std::vector<std::unique_ptr<Instrument>> m_instruments;
    std::vector<Instrument *> m_activeSamples;

    bool m_playing {false};

    double m_tempo {};
    double m_tempoStep {};
    double m_elapsed {};

    int m_pos {};
};

} // namespace drum808
#endif
