#include <cstdint>
#include <limits>
#include "drum_engine.h"

namespace drum808 {

namespace {
double clampSample(double value)
{
    if (value > 1.0) return 1.0;
    if (value < -1.0) return -1.0;
    return value;
}
} // namespace

DrumEngine::DrumEngine()
{
    m_sequencer.init();
    m_sequencer.setTempo(120.0);
}

void DrumEngine::fillBuffer(int16_t* output, int numSamples)
{
    if (output == nullptr || numSamples <= 0) return;

    const double dt = 1.0 / static_cast<double>(SAMPLE_RATE);
    for (int i = 0; i < numSamples; ++i) {
        double mix = 0.0;
        if (m_sequencer.isPlaying()) {
            m_sequencer.updateBy(dt);
            for (Instrument* inst : m_sequencer.getActiveSamples()) {
                if (inst != nullptr) {
                    mix += inst->getSample();
                }
            }
        }

        output[i] = static_cast<int16_t>(
            clampSample(mix) * static_cast<double>(std::numeric_limits<int16_t>::max()));
    }
}

void DrumEngine::start()
{
    m_sequencer.start();
}

void DrumEngine::stop()
{
    m_sequencer.stop();
}

bool DrumEngine::isPlaying() const
{
    return m_sequencer.isPlaying();
}

void DrumEngine::setTempo(double bpm)
{
    m_sequencer.setTempo(bpm);
}

double DrumEngine::getTempo() const
{
    return m_sequencer.getTempo();
}

void DrumEngine::toggleNote(int instrument, int step)
{
    m_sequencer.toggleNote(instrument, step);
}

int DrumEngine::getPosition() const
{
    return m_sequencer.getPosition();
}

int DrumEngine::getInstrumentCount() const
{
    return m_sequencer.getInstrumentCount();
}

const char* DrumEngine::getInstrumentName(int index) const
{
    return m_sequencer.getInstrumentName(index);
}

bool DrumEngine::getNoteState(int instrumentIndex, int step) const
{
    return m_sequencer.getNoteState(instrumentIndex, step);
}

} // namespace drum808
