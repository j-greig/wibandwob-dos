#ifndef ENVELOPE_H
#define ENVELOPE_H

namespace drum808 {

/**
 * This abstract class is the base for all ADSR implementations.
 *
 * For now it only supports attack and decay stages.
 **/
class Envelope
{
public:
    Envelope() = default;
    virtual ~Envelope() = default;

    double getDuration();

    void setAttack(double attack);
    void setDecay(double decay);

    void setStart(double start);
    void setPeak(double peak);
    void setRelease(double release);

    double getEnvValue(double time);

protected:
    double m_attack = 0.0;
    double m_decay = 0.0;
    double m_duration = 0.0;

    double m_start = 0.0;
    double m_peak = 0.0;
    double m_release = 0.0;

private:
    double attackRamp(double time);

    double decayRamp(double time);

};


} // namespace drum808
#endif
