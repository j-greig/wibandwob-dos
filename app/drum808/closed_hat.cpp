#include <iostream>
#include "closed_hat.h"

namespace drum808 {

using std::cout;
using std::endl;

ClosedHat::ClosedHat()
: Instrument()
{
    m_name = m_defaultName;

    m_harmonics[0] = m_basePitch * 2.0;
    m_harmonics[1] = m_basePitch * 3.0;
    m_harmonics[2] = m_basePitch * 4.16;
    m_harmonics[3] = m_basePitch * 5.43;
    m_harmonics[4] = m_basePitch * 6.79;
    m_harmonics[5] = m_basePitch * 8.21;
}

void ClosedHat::setDefaults()
{
    AmpEnv::AmpEnvSettings envSettings{};
    envSettings.startAmp = 0.0;
    envSettings.peakAmp = 0.8;
    envSettings.releaseAmp = 0.0;
    envSettings.attack = 0.0;
    envSettings.decay = 0.2;
    AmpEnv *ampEnv = new AmpEnv(envSettings);
    setAmpEnv(ampEnv);

    Filter *bandPass = new Filter(BANDPASS);
    bandPass->setFilter(8000.0, 8.0);
    setBandPassFilter(bandPass);
    Filter *highPass = new Filter(HIGHPASS);
    highPass->setFilter(7000.0, 1.0);
    setHighPassFilter(highPass);
}

void ClosedHat::setBandPassFilter(Filter *filter)
{
    m_bandPass = filter;
}

void ClosedHat::setHighPassFilter(Filter *filter)
{
    m_highPass = filter;
}

double ClosedHat::getSample()
{
    double amp = 0.0;
    for (auto f : m_harmonics) {
        double value = sin(f * TAU * m_elapsed) > 0 ? 1.0 : 0.0;
        amp += value;
    }
    amp /= m_harmonics.size();
    if (m_bandPass == nullptr || m_highPass == nullptr || m_ampEnv == nullptr) {
        return amp;
    }
    double firstStep = m_bandPass->filter(amp);
    double secondStep = m_highPass->filter(firstStep);
    return secondStep * m_ampEnv->getEnvValue(m_elapsed);
}

} // namespace drum808
