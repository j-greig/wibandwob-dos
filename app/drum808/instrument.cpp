#include <cmath>
#include <iostream>
#include "instrument.h"

namespace drum808 {

using std::cout;
using std::endl;

Instrument::~Instrument()
{
    delete m_ampEnv;
    delete m_pitchEnv;
}

int Instrument::getPitch() const
{
    return m_pitch;
}

void Instrument::setPitch(int pitch)
{
    m_pitch = pitch;
}

void Instrument::setLevel(double level)
{
    m_ampEnv->setPeak(level);
}

void Instrument::setAmpEnv(AmpEnv *env)
{
    m_ampEnv = env;
    m_duration = env->getDuration();
}

void Instrument::setPitchEnv(PitchEnv *env)
{
    m_pitchEnv = env;
}

void Instrument::trigger()
{
    m_triggered = true;
    m_playing = true;
    m_elapsed = 0.0;
}

void Instrument::release()
{
    m_triggered = false;
}

bool Instrument::isTriggered() const
{
    return m_triggered;
}

bool Instrument::isPlaying() const
{
    return m_playing;
}

void Instrument::updateBy(double time)
{
    if (!m_triggered) return;

    m_elapsed += time;
    if (m_elapsed > m_duration) {
        m_playing = false;
        m_elapsed = 0.0;
    }
}

double Instrument::getSample()
{
    double value;
    if (m_pitchEnv == nullptr) {
        value = sin(m_pitch * TAU * m_elapsed);
    } else {
        double pitch = m_pitchEnv->getEnvValue(m_elapsed);
        value = sin(pitch * TAU * m_elapsed);
    }

    if (m_ampEnv != nullptr) {
        value *= m_ampEnv->getEnvValue(m_elapsed);
    }

    return value;
}

const std::string &Instrument::getName() const
{
    return m_name;
}

} // namespace drum808
