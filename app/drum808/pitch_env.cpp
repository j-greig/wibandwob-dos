#include <iostream>
#include "pitch_env.h"

namespace drum808 {

PitchEnv::PitchEnv(EnvSettings &settings)
: Envelope()
{
    m_attack = settings.attack;
    m_decay = settings.decay;
    m_duration = settings.attack + settings.decay;

    m_start = settings.startPitch;
    m_peak = settings.peakPitch;
    m_release = settings.releasePitch;
}

} // namespace drum808
