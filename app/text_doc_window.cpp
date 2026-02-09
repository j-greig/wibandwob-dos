/*---------------------------------------------------------*/
/*                                                         */
/*   text_doc_window.cpp - New Text Document Window        */
/*                                                         */
/*---------------------------------------------------------*/

#include "text_doc_window.h"
#define Uses_TFileEditor
#define Uses_TEditor
#include <tvision/tv.h>

TWindow* createTextDocumentWindow(const TRect &bounds, int windowNumber)
{
    // Pass empty file name to create an Untitled editor window.
    return new TEditWindow(bounds, TStringView(""), windowNumber);
}

void initializeTextDocumentFromString(TWindow *w, const std::string &text)
{
    if (!w) return;
    // TEditWindow hosts a TFileEditor, which is a TEditor.
    if (auto *ew = dynamic_cast<TEditWindow*>(w)) {
        if (ew->editor) {
            ew->editor->insertText(text.c_str(), (uint)text.size(), False);
            ew->editor->trackCursor(True);
            ew->editor->drawView();
        }
    }
}
