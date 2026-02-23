#ifndef AMP_ENV_H
#define AMP_ENV_H

#include "envelope.h"

namespace drum808 {

class AmpEnv : public Envelope
{
public:
    struct AmpEnvSettings {
        double startAmp;
        double peakAmp;
        double releaseAmp;

        double attack;
        double decay;
    };

    AmpEnv(AmpEnvSettings &);
    ~AmpEnv() = default;
};


} // namespace drum808
#endif
