#include <cmath>
#include <cstdlib>
#include <ctime>
#include <iostream>
#include "clap.h"

namespace drum808 {

Clap::Clap() : Instrument()
{
    m_name = m_defaultName;
    m_pitch = m_defaultPitch;

    srand(time(0));
}

void Clap::setDefaults()
{
    AmpEnv::AmpEnvSettings envSettings{};
    envSettings.startAmp = 0.0;
    envSettings.peakAmp = 0.8;
    envSettings.releaseAmp = 0.0;
    envSettings.attack = 0.0;
    envSettings.decay = 0.3;
    AmpEnv *ampEnv = new AmpEnv(envSettings);
    setAmpEnv(ampEnv);

    Filter *bandPass = new Filter(BANDPASS);
    bandPass->setFilter(1500.0, 1.5);
    setBandPassFilter(bandPass);

    Filter *highPass = new Filter(HIGHPASS);
    highPass->setFilter(800.0, 5.0);
    setHighPassFilter(highPass);
}

void Clap::setBandPassFilter(Filter *filter)
{
    m_bandPass = filter;
}

void Clap::setHighPassFilter(Filter *filter)
{
    m_highPass = filter;
}

double Clap::getSample()
{
    double sample = 0.0;
    if (m_elapsed > m_duration) return sample;

    double amp = 0.5;
    double noise = amp * (double)rand() / RAND_MAX;
    if (m_elapsed < m_interval * 2) {
        for (double n = 1.0; n <= 40; n++) {
            sample += sin(n * TAU * 100 * m_elapsed) / n;
        }
        sample *= noise * (2.0 / M_PI);
    } else {
        // TODO: replace with exponential AmpEnv decay
        double decay = amp * pow(m_duration * 0.001, m_elapsed);
        sample = noise * decay;
    }

    if (m_bandPass == nullptr || m_highPass == nullptr) return sample;
    return m_highPass->filter(m_bandPass->filter(sample));
}

} // namespace drum808
