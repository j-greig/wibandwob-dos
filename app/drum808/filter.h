#ifndef FILTER_H
#define FILTER_H

namespace drum808 {

enum {
    BANDPASS = 0,
    HIGHPASS,
};

class Filter
{
public:
    Filter(int type);
    ~Filter() = default;

    void setFilter(double freq, double q);

    double filter(double input);

private:
    static const int m_sampleRate = 44100;

    int m_type;
    double m_freq;
    double m_q;

    double a0 = 0.0, a1 = 0.0, a2 = 0.0, b1 = 0.0, b2 = 0.0;
    double z1 = 0.0, z2 = 0.0;

    void calcFilter();
};


} // namespace drum808
#endif
