#ifndef PITCH_ENV_H
#define PITCH_ENV_H

#include "envelope.h"

namespace drum808 {

class PitchEnv : public Envelope
{
public:
    struct EnvSettings {
        double startPitch;
        double peakPitch;
        double releasePitch;

        double attack;
        double decay;
    };

    PitchEnv(EnvSettings &);
    ~PitchEnv() = default;
};


} // namespace drum808
#endif
