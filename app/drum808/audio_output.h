#ifndef DRUM808_AUDIO_OUTPUT_H
#define DRUM808_AUDIO_OUTPUT_H

#include "drum_engine.h"

namespace drum808 {

// Platform audio output — calls engine.fillBuffer() from audio thread
class AudioOutput {
public:
    AudioOutput(DrumEngine& engine);
    ~AudioOutput();

    bool start();
    void stop();
    bool isRunning() const;

private:
    DrumEngine& m_engine;
    void* m_impl; // opaque platform handle
    bool m_running;
};

} // namespace drum808

#endif
