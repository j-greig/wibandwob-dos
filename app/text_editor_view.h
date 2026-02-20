/*---------------------------------------------------------*/
/*                                                         */
/*   text_editor_view.h - API-Controllable Text Editor    */
/*                                                         */
/*   Multi-line text editor that can receive content      */
/*   via API calls for dynamic text/ASCII art display     */
/*                                                         */
/*---------------------------------------------------------*/

#ifndef TEXT_EDITOR_VIEW_H
#define TEXT_EDITOR_VIEW_H

#define Uses_TView
#define Uses_TRect
#define Uses_TDrawBuffer
#define Uses_TEvent
#define Uses_TColorAttr
#define Uses_TScrollBar
#define Uses_TWindow
#define Uses_TFrame
#define Uses_TKeys
#include <tvision/tv.h>

#include <vector>
#include <string>

class TTextEditorView : public TView {
public:
    explicit TTextEditorView(const TRect &bounds);
    virtual ~TTextEditorView();

    virtual void draw() override;
    virtual void handleEvent(TEvent &ev) override;
    virtual void setState(ushort aState, Boolean enable) override;
    virtual void changeBounds(const TRect& bounds) override;

    // API-controlled content methods
    void sendText(const std::string& content, const std::string& mode = "append", const std::string& position = "end");
    void sendFigletText(const std::string& text, const std::string& font = "standard", int width = 0, const std::string& mode = "append");
    void clearContent();
    const std::vector<std::string>& getLines() const { return lines; }
    
    // Window ID for API targeting
    void setWindowId(const std::string& id) { windowId = id; }
    const std::string& getWindowId() const { return windowId; }

private:
    void insertText(const std::string& content, size_t lineIndex, size_t colIndex);
    void appendText(const std::string& content);
    void replaceContent(const std::string& content);
    void scrollToEnd();
    std::string runFiglet(const std::string& text, const std::string& font, int width);
    void scrollToCursor();
    void updateScrollBars();

    // Text content storage
    std::vector<std::string> lines;
    
    // Cursor position
    size_t cursorLine;
    size_t cursorCol;
    
    // Scroll position
    size_t scrollTop;
    size_t scrollLeft;
    
    // Window identification for API
    std::string windowId;
    
    // UI state
    bool readOnly;
    bool showCursor;
    
    // Scroll bars
    TScrollBar *hScrollBar;
    TScrollBar *vScrollBar;
    
    // Colors
    TColorAttr normalColor;
    TColorAttr selectedColor;
};

class TTextEditorWindow : public TWindow {
public:
    TTextEditorWindow(const TRect &r, const char *title = "Text Editor");
    void setup();
    virtual void changeBounds(const TRect& b) override;
    
    // Get the editor view for API access
    TTextEditorView* getEditorView() { return editorView; }
    
private:
    static TFrame* initFrame(TRect r);
    TTextEditorView* editorView;
};

// Factory function
TWindow* createTextEditorWindow(const TRect &bounds, const char *title = "Text Editor");

#endif // TEXT_EDITOR_VIEW_H
