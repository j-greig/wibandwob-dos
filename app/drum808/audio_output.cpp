/*
 * audio_output.cpp — CoreAudio (AudioQueue) backend for drum808
 * macOS only. Falls back to no-op on other platforms.
 */
#include "audio_output.h"

#ifdef __APPLE__
#include <AudioToolbox/AudioToolbox.h>

namespace drum808 {

static const int NUM_BUFFERS = 3;
static const int BUFFER_SAMPLES = 1024;

struct AudioOutputImpl {
    AudioQueueRef queue;
    AudioQueueBufferRef buffers[NUM_BUFFERS];
    DrumEngine* engine;
};

static void audioCallback(void* userData, AudioQueueRef queue, AudioQueueBufferRef buf)
{
    auto* impl = static_cast<AudioOutputImpl*>(userData);
    int numSamples = buf->mAudioDataBytesCapacity / sizeof(int16_t);
    auto* out = static_cast<int16_t*>(buf->mAudioData);

    impl->engine->fillBuffer(out, numSamples);

    buf->mAudioDataByteSize = numSamples * sizeof(int16_t);
    AudioQueueEnqueueBuffer(queue, buf, 0, nullptr);
}

AudioOutput::AudioOutput(DrumEngine& engine)
    : m_engine(engine), m_impl(nullptr), m_running(false)
{
}

AudioOutput::~AudioOutput()
{
    stop();
}

bool AudioOutput::start()
{
    if (m_running) return true;

    auto* impl = new AudioOutputImpl();
    impl->engine = &m_engine;

    AudioStreamBasicDescription fmt = {};
    fmt.mSampleRate = SAMPLE_RATE;
    fmt.mFormatID = kAudioFormatLinearPCM;
    fmt.mFormatFlags = kLinearPCMFormatFlagIsSignedInteger | kLinearPCMFormatFlagIsPacked;
    fmt.mBitsPerChannel = 16;
    fmt.mChannelsPerFrame = 1;
    fmt.mBytesPerFrame = 2;
    fmt.mFramesPerPacket = 1;
    fmt.mBytesPerPacket = 2;

    OSStatus err = AudioQueueNewOutput(&fmt, audioCallback, impl,
                                        nullptr, nullptr, 0, &impl->queue);
    if (err != noErr) {
        delete impl;
        return false;
    }

    for (int i = 0; i < NUM_BUFFERS; i++) {
        AudioQueueAllocateBuffer(impl->queue, BUFFER_SAMPLES * sizeof(int16_t), &impl->buffers[i]);
        impl->buffers[i]->mAudioDataByteSize = BUFFER_SAMPLES * sizeof(int16_t);
        memset(impl->buffers[i]->mAudioData, 0, impl->buffers[i]->mAudioDataByteSize);
        AudioQueueEnqueueBuffer(impl->queue, impl->buffers[i], 0, nullptr);
    }

    err = AudioQueueStart(impl->queue, nullptr);
    if (err != noErr) {
        AudioQueueDispose(impl->queue, true);
        delete impl;
        return false;
    }

    m_impl = impl;
    m_running = true;
    return true;
}

void AudioOutput::stop()
{
    if (!m_running || !m_impl) return;
    auto* impl = static_cast<AudioOutputImpl*>(m_impl);

    AudioQueueStop(impl->queue, true);
    AudioQueueDispose(impl->queue, true);

    delete impl;
    m_impl = nullptr;
    m_running = false;
}

bool AudioOutput::isRunning() const
{
    return m_running;
}

} // namespace drum808

#else
// Non-Apple stub
namespace drum808 {

AudioOutput::AudioOutput(DrumEngine& engine)
    : m_engine(engine), m_impl(nullptr), m_running(false) {}
AudioOutput::~AudioOutput() {}
bool AudioOutput::start() { return false; }
void AudioOutput::stop() {}
bool AudioOutput::isRunning() const { return false; }

} // namespace drum808

#endif
