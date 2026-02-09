/*---------------------------------------------------------*/
/*                                                         */
/*   clipboard_read.h - Read system clipboard (best-effort)*/
/*                                                         */
/*---------------------------------------------------------*/

#ifndef CLIPBOARD_READ_H
#define CLIPBOARD_READ_H

#include <string>

// Attempts to read UTF-8 text from the system clipboard.
// Returns true on success, false otherwise. On failure, 'err' describes why.
bool readClipboard(std::string &out, std::string &err);

#endif // CLIPBOARD_READ_H

