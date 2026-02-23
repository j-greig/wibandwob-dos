#include <cmath>
#include <iostream>
#include "kick.h"

namespace drum808 {

Kick::Kick() : Instrument()
{
    m_name = m_defaultName;
    m_pitch = m_defaultPitch;
}

void Kick::setDefaults()
{
    AmpEnv::AmpEnvSettings envSettings{};
    envSettings.startAmp = 0.0;
    envSettings.peakAmp = 0.8;
    envSettings.releaseAmp = 0.0;
    envSettings.attack = 0.0;
    envSettings.decay = 0.25;
    AmpEnv *ampEnv = new AmpEnv(envSettings);
    setAmpEnv(ampEnv);

    PitchEnv::EnvSettings pitchEnvSettings{};
    pitchEnvSettings.startPitch = (double)getPitch();
    pitchEnvSettings.peakPitch = getPitch() + SEMITONE_HZ * 48.0;
    pitchEnvSettings.releasePitch = (double)getPitch();
    pitchEnvSettings.attack = 0.0;
    pitchEnvSettings.decay = 0.02;
    PitchEnv *pitchEnv = new PitchEnv(pitchEnvSettings);
    setPitchEnv(pitchEnv);
}

} // namespace drum808
