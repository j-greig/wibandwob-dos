#ifndef KICK_H
#define KICK_H

#include "instrument.h"

namespace drum808 {

class Kick : public Instrument
{
public:
    Kick();
    ~Kick() = default;

    void setDefaults() override;

private:
    const std::string m_defaultName = "Kick";
    const int m_defaultPitch = 47;
};


} // namespace drum808
#endif
