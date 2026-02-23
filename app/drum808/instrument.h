#ifndef INSTRUMENT_H
#define INSTRUMENT_H

#include <cmath>
#include <string>
#include "amp_env.h"
#include "pitch_env.h"

namespace drum808 {

#define SEMITONE_HZ 1.06

class Instrument
{
public:
    Instrument() = default;
    virtual ~Instrument();

    int getPitch() const;
    void setPitch(int pitch);

    void setLevel(double level);

    virtual void setDefaults() = 0;

    void setAmpEnv(AmpEnv *);

    void setPitchEnv(PitchEnv *);

    void trigger();
    void release();
    bool isTriggered() const;
    bool isPlaying() const;

    void updateBy(double time);

    virtual double getSample();

    const std::string &getName() const;

    static constexpr double TAU = M_PI * 2.0;

protected:
    AmpEnv *m_ampEnv = nullptr;
    PitchEnv *m_pitchEnv = nullptr;

    double m_duration = 0.0;
    double m_elapsed = 0.0;

    int m_pitch = 0;

    bool m_triggered = false;
    bool m_playing = false;

    std::string m_name;
};


} // namespace drum808
#endif
