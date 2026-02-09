/*---------------------------------------------------------*/
/*                                                         */
/*   ansi_view.cpp - Minimal ANSI art viewer (MVP)        */
/*                                                         */
/*   Notes                                                 */
/*   - Parser: SGR 0/1/30–37/40–47 + 39/49, CR/LF, tabs.   */
/*     Ignores cursor moves/clears; adequate for our       */
/*     samples (rainbow_title, boxes, pixel art).          */
/*   - Rendering: Pre-parsed into lines of (text, attr)    */
/*     segments; TScroller draws visible region.           */
/*   - Samples: If input uses C-style escapes ("\x1b"),    */
/*     we unescape to real bytes before parsing.           */
/*   - Reintegrate: Include ansi_view.h and create         */
/*     TAnsiMiniWindow with a chosen file path.            */
/*                                                         */
/*---------------------------------------------------------*/

#include "ansi_view.h"

#include <fstream>

static void appendSegment(AnsiLine &line, const std::string &text, TColorAttr attr) {
    if (text.empty()) return;
    if (!line.segs.empty() && line.segs.back().attr == attr) {
        line.segs.back().text += text;
    } else {
        line.segs.push_back(AnsiSegment{text, attr});
    }
    line.length += (int)text.size();
}

TAnsiMiniView::TAnsiMiniView(const TRect& bounds, TScrollBar* hScroll, TScrollBar* vScroll)
    : TScroller(bounds, hScroll, vScroll)
{
    options |= ofFramed;
    state = AttrState{}; // default fg=7,bg=0
}

TColorAttr TAnsiMiniView::makeAttr(const AttrState &st)
{
    int fg = st.fg;
    if (st.bold && fg < 8) fg += 8; // treat bold as bright fg
    unsigned char attr = (unsigned char)((st.bg & 0x0F) << 4 | (fg & 0x0F));
    return TColorAttr{attr};
}

void TAnsiMiniView::setLimitsFromDoc()
{
    docHeight = (int)lines.size();
    docWidth = 0;
    for (const auto &ln : lines)
        if (ln.length > docWidth) docWidth = ln.length;
    setLimit(docWidth, docHeight);
}

bool TAnsiMiniView::loadFile(const std::string &path)
{
    std::ifstream in(path, std::ios::binary);
    if (!in) return false;
    std::string data((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    in.close();


    // If the file contains C-style escapes (e.g., "\x1b", "\n"), unescape to real bytes.
    auto isHex = [](char c){ return (c>='0'&&c<='9')||(c>='a'&&c<='f')||(c>='A'&&c<='F'); };
    auto hexVal = [](char c)->int{ if(c>='0'&&c<='9')return c-'0'; if(c>='a'&&c<='f')return 10+(c-'a'); if(c>='A'&&c<='F')return 10+(c-'A'); return 0; };
    bool looksEscaped = (data.find("\x1b") != std::string::npos) || (data.find("\n") != std::string::npos);
    if (looksEscaped) {
        std::string out; out.reserve(data.size());
        for (size_t i = 0; i < data.size();) {
            char c = data[i++];
            if (c == '\\' && i < data.size()) {
                char e = data[i++];
                if (e == 'x' || e == 'X') {
                    if (i + 1 < data.size() && isHex(data[i]) && isHex(data[i+1])) {
                        int v = (hexVal(data[i]) << 4) | hexVal(data[i+1]);
                        out.push_back((char)v);
                        i += 2;
                    } else {
                        // Not a valid hex escape; keep literally
                        out.push_back('\\');
                        out.push_back(e);
                    }
                } else if (e == 'n') out.push_back('\n');
                else if (e == 'r') out.push_back('\r');
                else if (e == 't') out.push_back('\t');
                else if (e == '\\') out.push_back('\\');
                else { out.push_back('\\'); out.push_back(e); }
            } else {
                out.push_back(c);
            }
        }
        data.swap(out);
    }
lines.clear();
    state = AttrState{};
    AnsiLine cur;
    std::string buf;
    size_t i = 0, n = data.size();
    auto flush_text = [&]() {
        if (!buf.empty()) {
            appendSegment(cur, buf, makeAttr(state));
            buf.clear();
        }
    };

    while (i < n) {
        unsigned char c = data[i++];
        if (c == '\r') {
            // CR: look ahead for LF; treat CRLF as newline once
            if (i < n && data[i] == '\n') { ++i; }
            flush_text();
            lines.push_back(cur); cur = AnsiLine{};
            continue;
        } else if (c == '\n') {
            flush_text();
            lines.push_back(cur); cur = AnsiLine{};
            continue;
        } else if (c == '\t') {
            int col = cur.length + (int)buf.size();
            int spaces = 8 - (col % 8);
            buf.append(spaces, ' ');
            continue;
        } else if (c == 0x1B) { // ESC
            // Expect CSI '[' ... 'm'
            if (i < n && data[i] == '[') {
                ++i; // skip '['
                // read until 'm' or end
                std::string num;
                std::vector<int> params;
                while (i < n) {
                    char ch = data[i++];
                    if ((ch >= '0' && ch <= '9')) { num.push_back(ch); }
                    else if (ch == ';') {
                        params.push_back(num.empty() ? 0 : std::stoi(num));
                        num.clear();
                    } else if (ch == 'm') {
                        if (!num.empty()) { params.push_back(std::stoi(num)); num.clear(); }
                        if (params.empty()) params.push_back(0);
                        // Apply SGR
                        for (int p : params) {
                            if (p == 0) { state = AttrState{}; }
                            else if (p == 1) { state.bold = true; }
                            else if (p == 22) { state.bold = false; }
                            else if (p >= 30 && p <= 37) { state.fg = p - 30; }
                            else if (p == 39) { state.fg = 7; state.bold = false; }
                            else if (p >= 40 && p <= 47) { state.bg = p - 40; }
                            else if (p == 49) { state.bg = 0; }
                            // ignore others in MVP
                        }
                        break;
                    } else {
                        // Unknown CSI; stop processing
                        break;
                    }
                }
                continue;
            }
            // else: ignore bare ESC
            continue;
        }
        // Regular byte, append (assume UTF-8 compatible)
        buf.push_back((char)c);
    }
    flush_text();
    lines.push_back(cur);

    setLimitsFromDoc();
    drawView();
    return true;
}

void TAnsiMiniView::draw()
{
    TDrawBuffer b;
    const int W = size.x;
    const int H = size.y;
    int y0 = delta.y;
    int x0 = delta.x;
    for (int row = 0; row < H; ++row) {
        int li = y0 + row;
        int filled = 0;
        if (li >= 0 && li < (int)lines.size()) {
            const auto &ln = lines[li];
            int x = 0;
            for (const auto &seg : ln.segs) {
                if (x + (int)seg.text.size() <= x0) { x += (int)seg.text.size(); continue; }
                // visible part
                int start = std::max(0, x0 - x);
                int remain = (int)seg.text.size() - start;
                if (remain <= 0) { x += (int)seg.text.size(); continue; }
                int toWrite = std::min(remain, W - filled);
                if (toWrite > 0) {
                    std::string slice = seg.text.substr(start, toWrite);
                    b.moveStr(filled, slice.c_str(), seg.attr);
                    filled += toWrite;
                    if (filled >= W) break;
                }
                x += (int)seg.text.size();
            }
        }
        if (filled < W)
            b.moveChar(filled, ' ', TColorAttr{0x07}, W - filled);
        writeLine(0, row, W, 1, b);
    }
}

TAnsiMiniWindow::TAnsiMiniWindow(const TRect &bounds, const char *title, const std::string &path)
    : TWindow(bounds, title, wnNoNumber), TWindowInit(&TAnsiMiniWindow::initFrame)
{
    options |= ofTileable;
    TRect client = getExtent(); client.grow(-1, -1);
    // Create scrollbars
    TScrollBar *v = standardScrollBar(sbVertical | sbHandleKeyboard);
    TScrollBar *h = standardScrollBar(sbHorizontal | sbHandleKeyboard);
    // Adjust client for scrollbars (TScroller manages it)
    TAnsiMiniView *view = new TAnsiMiniView(client, h, v);
    insert(view);
    view->loadFile(path);
}
