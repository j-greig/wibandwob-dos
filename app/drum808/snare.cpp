#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <ctime>
#include <iostream>
#include "snare.h"

namespace drum808 {

Snare::Snare() : Instrument()
{
    m_name = m_defaultName;
    m_pitch = m_defaultPitch;
}

void Snare::setDefaults()
{
    AmpEnv::AmpEnvSettings toneAmpEnvSettings{};
    toneAmpEnvSettings.startAmp = 0.0;
    toneAmpEnvSettings.peakAmp = 0.1;
    toneAmpEnvSettings.releaseAmp = 0.0;
    toneAmpEnvSettings.attack = 0.01;
    toneAmpEnvSettings.decay = 0.25;
    AmpEnv *toneEnv = new AmpEnv(toneAmpEnvSettings);
    setAmpEnv(toneEnv);

    PitchEnv::EnvSettings pitchEnvSettings{};
    pitchEnvSettings.startPitch = (double)getPitch();
    pitchEnvSettings.peakPitch = getPitch() + SEMITONE_HZ * 24.0;
    pitchEnvSettings.releasePitch = (double)getPitch();
    pitchEnvSettings.attack = 0.0;
    pitchEnvSettings.decay = 0.04;
    PitchEnv *pitchEnv = new PitchEnv(pitchEnvSettings);
    setPitchEnv(pitchEnv);

    AmpEnv::AmpEnvSettings noiseAmpEnvSettings{};
    noiseAmpEnvSettings.startAmp = 0.0;
    noiseAmpEnvSettings.peakAmp = 0.6;
    noiseAmpEnvSettings.releaseAmp = 0.0;
    noiseAmpEnvSettings.attack = 0.0;
    noiseAmpEnvSettings.decay = 0.25;
    AmpEnv *noiseEnv = new AmpEnv(noiseAmpEnvSettings);
    setNoiseEnv(noiseEnv);

    m_duration = std::max(
        (toneAmpEnvSettings.attack + toneAmpEnvSettings.decay),
        (noiseAmpEnvSettings.attack + noiseAmpEnvSettings.decay)
    );

    Filter *bandPass = new Filter(BANDPASS);
    bandPass->setFilter(2000.0, 2.0);
    setBandPassFilter(bandPass);

    // FIXME: adding this filter results in no audio
    // Filter *highPass = new Filter(HIGHPASS);
    // highPass->setFilter(200, 2.0),
    // setHighPassFilter(highPass);
}

void Snare::setSnappy(double snappy)
{
    m_noiseEnv->setPeak(snappy);
}

void Snare::setNoiseEnv(AmpEnv *env)
{
    m_noiseEnv = env;
}

void Snare::setBandPassFilter(Filter *filter)
{
    m_bandPass = filter;
}

void Snare::setHighPassFilter(Filter *filter)
{
    m_highPass = filter;
}

double Snare::getSample()
{
    double pitch = m_pitchEnv == nullptr ? m_pitch : m_pitchEnv->getEnvValue(m_elapsed);
    double tone = sin(pitch * TAU * m_elapsed);
    double toneAmp = m_ampEnv->getEnvValue(m_elapsed);

    if (m_bandPass == nullptr || m_noiseEnv == nullptr) {
        return tone * toneAmp;
    }
    double noise = m_bandPass->filter((double)rand() / RAND_MAX);
    double noiseAmp = m_noiseEnv->getEnvValue(m_elapsed);
    return (tone * toneAmp) + (noise * noiseAmp);
}

} // namespace drum808
