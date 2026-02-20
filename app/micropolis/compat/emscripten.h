#pragma once

#ifndef __EMSCRIPTEN__

namespace emscripten {
class val {
public:
    val() = default;
    val(const val &) = default;
    val &operator=(const val &) = default;

    template <typename T>
    explicit val(const T &) {}

    static val null() { return val(); }
};
} // namespace emscripten

#ifndef EMSCRIPTEN_KEEPALIVE
#define EMSCRIPTEN_KEEPALIVE
#endif

#ifndef EM_ASM
#define EM_ASM(...) ((void)0)
#endif

#ifndef EM_ASM_
#define EM_ASM_(...) ((void)0)
#endif

#endif // __EMSCRIPTEN__
