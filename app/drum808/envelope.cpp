#include <iostream>
#include "envelope.h"

namespace drum808 {

double Envelope::getDuration()
{
    return m_duration;
}

void Envelope::setAttack(double attack)
{
    m_attack = attack;
}

void Envelope::setDecay(double decay)
{
    m_decay = decay;
}

void Envelope::setStart(double start)
{
    m_start = start;
}

void Envelope::setPeak(double peak)
{
    m_peak = peak;
}

void Envelope::setRelease(double release)
{
    m_release = release;
}

double Envelope::getEnvValue(double time)
{
    if (time > m_duration) return m_release;

    if (m_attack <= 0.0) {
        if (m_decay <= 0.0) return m_release;
        return decayRamp(time);
    }

    if (time <= m_attack) {
        return attackRamp(time);
    } else if (time <= (m_attack + m_decay)) {
        return decayRamp(time);
    } else {
        std::cout << "ERROR: Invalid time for envelope" << std::endl;
        return m_release;
    }
}

double Envelope::attackRamp(double time)
{
    if (m_attack <= 0.0) return m_peak;
    return (m_peak - m_start) / m_attack * time + m_start;
}

double Envelope::decayRamp(double time)
{
    if (m_decay <= 0.0) return m_release;
    return (m_release - m_peak) / m_decay * (time - m_attack) + m_peak;
}

} // namespace drum808
