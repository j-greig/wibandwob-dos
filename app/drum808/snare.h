#ifndef SNARE_H
#define SNARE_H

#include "filter.h"
#include "instrument.h"

namespace drum808 {

class Snare : public Instrument
{
public:
    Snare();
    ~Snare() = default;

    void setDefaults() override;

    void setSnappy(double snappy);

    void setNoiseEnv(AmpEnv *);

    void setBandPassFilter(Filter *);
    void setHighPassFilter(Filter *);

    double getSample() override;

private:
    AmpEnv *m_noiseEnv = nullptr;

    const std::string m_defaultName = "Snare";
    const int m_defaultPitch = 160;

    Filter *m_bandPass = nullptr;
    Filter *m_highPass = nullptr;

};


} // namespace drum808
#endif
