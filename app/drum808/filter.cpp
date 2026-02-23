#include <cmath>
#include "filter.h"

namespace drum808 {

Filter::Filter(int type)
: m_type(type)
{}

void Filter::setFilter(double freq, double q)
{
    m_freq = freq / (double)m_sampleRate;
    m_q = q;
    calcFilter();
}

double Filter::filter(double input)
{
    double output = input * a0 + z1;
    z1 = input * a1 + z2 - b1 * output;
    z2 = input * a2 - b2 * output;
    return output;
}

void Filter::calcFilter()
{
    double norm;
    double K = std::tan(M_PI * m_freq);
    switch (m_type)
    {
    case BANDPASS:
        norm = 1 / (1 + K / m_q + K * K);
        a0 = K / m_q * norm;
        a1 = 0;
        a2 = -a0;
        b1 = 2 * (K * K - 1) * norm;
        b2 = (1 - K / m_q + K * K) * norm;
        break;

    case HIGHPASS:
        norm = 1 / (1 + K / m_q + K * K);
        a0 = 1 * norm;
        a1 = -2 * a0;
        a2 = a0;
        b1 = 2 * (K * K - 1) *norm;
        b2 = (1 - K / m_q + K * K) * norm;
        break;

    default:
        break;
    }
}

} // namespace drum808
