#pragma once

#define Uses_TView
#define Uses_TRect
#include <tvision/tv.h>

#include <string>
#include <vector>

class BrowserWindow : public TView {
public:
    explicit BrowserWindow(const TRect& bounds);
    virtual void draw() override;
    virtual void handleEvent(TEvent& ev) override;

    void setUrl(const std::string& url);
    void setContent(const std::string& content);

private:
    std::string currentUrl;
    std::string renderedContent;
    int scrollY = 0;
};
