#include "clap.h"
#include "closed_hat.h"
#include "kick.h"
#include "sequencer.h"
#include "snare.h"

namespace drum808 {

#define MS_PER_MINUTE 60000.0

void Sequencer::init()
{
    stop();
    for (auto &row : m_pattern) {
        row.fill(false);
    }

    m_instruments.clear();
    m_instruments.reserve(4);

    std::unique_ptr<Kick> kick(new Kick());
    kick->setDefaults();
    m_instruments.push_back(std::move(kick));

    std::unique_ptr<Snare> snare(new Snare());
    snare->setDefaults();
    m_instruments.push_back(std::move(snare));

    std::unique_ptr<Clap> clap(new Clap());
    clap->setDefaults();
    m_instruments.push_back(std::move(clap));

    std::unique_ptr<ClosedHat> closedHat(new ClosedHat());
    closedHat->setDefaults();
    m_instruments.push_back(std::move(closedHat));
}

void Sequencer::setTempo(double tempo)
{
    m_tempo = tempo;
    if (tempo <= 0.0) {
        m_tempoStep = 0.0;
        return;
    }
    m_tempoStep = MS_PER_MINUTE / (tempo * 4.0) / 1000.0;
}

double Sequencer::getTempo() const
{
    return m_tempo;
}

void Sequencer::toggleNote(int instrumentIndex, int step)
{
    if (!isValidInstrumentIndex(instrumentIndex) || !isValidStep(step)) {
        return;
    }
    std::size_t i = static_cast<std::size_t>(instrumentIndex);
    std::size_t s = static_cast<std::size_t>(step);
    m_pattern[i][s] = !m_pattern[i][s];
}

int Sequencer::getPosition() const
{
    return m_pos;
}

int Sequencer::getInstrumentCount() const
{
    return static_cast<int>(m_instruments.size());
}

const char *Sequencer::getInstrumentName(int index) const
{
    if (!isValidInstrumentIndex(index)) return "";
    return m_instruments[static_cast<std::size_t>(index)]->getName().c_str();
}

bool Sequencer::getNoteState(int instrumentIndex, int step) const
{
    if (!isValidInstrumentIndex(instrumentIndex) || !isValidStep(step)) return false;
    return m_pattern[static_cast<std::size_t>(instrumentIndex)][static_cast<std::size_t>(step)];
}

void Sequencer::start()
{
    if (m_tempoStep <= 0.0) return;
    m_playing = true;
    m_elapsed = 0.0;
    m_pos = 0;
    m_activeSamples.clear();
    triggerCurrentStep();
}

void Sequencer::stop()
{
    m_playing = false;
    m_elapsed = 0.0;
    m_pos = 0;
    m_activeSamples.clear();
}

void Sequencer::updateBy(double time)
{
    if (!m_playing) return;

    for (auto it = m_activeSamples.begin(); it != m_activeSamples.end();) {
        Instrument *inst = *it;
        inst->updateBy(time);
        if (!inst->isPlaying()) {
            inst->release();
            it = m_activeSamples.erase(it);
        } else {
            ++it;
        }
    }

    if (m_tempoStep <= 0.0) return;

    m_elapsed += time;
    while (m_elapsed > m_tempoStep) {
        m_elapsed -= m_tempoStep;
        ++m_pos;
        if (m_pos >= SUBDIVISION) m_pos = 0;
        triggerCurrentStep();
    }
}

const std::vector<Instrument *> &Sequencer::getActiveSamples() const
{
    return m_activeSamples;
}

bool Sequencer::isPlaying() const
{
    return m_playing;
}

void Sequencer::triggerCurrentStep()
{
    for (std::size_t instrumentIndex = 0; instrumentIndex < m_instruments.size(); ++instrumentIndex) {
        if (!m_pattern[instrumentIndex][static_cast<std::size_t>(m_pos)]) {
            continue;
        }

        Instrument *inst = m_instruments[instrumentIndex].get();
        if (inst == nullptr) continue;

        inst->trigger();

        bool found = false;
        for (Instrument *active : m_activeSamples) {
            if (active == inst) {
                found = true;
                break;
            }
        }
        if (!found) {
            m_activeSamples.push_back(inst);
        }
    }
}

bool Sequencer::isValidInstrumentIndex(int index) const
{
    return index >= 0 && index < static_cast<int>(m_instruments.size());
}

bool Sequencer::isValidStep(int step) const
{
    return step >= 0 && step < SUBDIVISION;
}

} // namespace drum808
