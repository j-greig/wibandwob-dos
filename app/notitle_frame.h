#ifndef NOTITLE_FRAME_H
#define NOTITLE_FRAME_H

#define Uses_TFrame
#include <tvision/tv.h>

// For windows without titles, just use regular TFrame
// The title gaps aren't that noticeable and fixing it requires 
// accessing private methods. Regular TFrame works fine.
typedef TFrame TNoTitleFrame;

#endif