/*---------------------------------------------------------*/
/*                                                         */
/*   text_doc_window.h - New Text Document Window          */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef TEXT_DOC_WINDOW_H
#define TEXT_DOC_WINDOW_H

#define Uses_TEditWindow
#define Uses_TWindow
#define Uses_TRect
#define Uses_TEditor
#include <tvision/tv.h>

#include <string>

// Factory: creates an empty TEditWindow (Untitled) sized to bounds.
class TWindow; TWindow* createTextDocumentWindow(const TRect &bounds, int windowNumber = 0);

// Helper: insert initial UTF-8 content into the editor at the caret.
void initializeTextDocumentFromString(TWindow *w, const std::string &text);

#endif // TEXT_DOC_WINDOW_H

