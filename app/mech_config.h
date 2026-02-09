#pragma once

#define Uses_TDialog
#define Uses_TButton
#define Uses_TInputLine
#define Uses_TRadioButtons
#define Uses_TLabel
#define Uses_TRect
#define Uses_TEvent
#define Uses_TValidator
#define Uses_TRangeValidator
#include <tvision/tv.h>

#include "mech.h"

// Dialog command constants
const int
    cmMechConfigOK = 2001,
    cmMechConfigCancel = 2002,
    cmMechPreview = 2003;

// Configuration structure for passing data
struct MechGridConfig {
    int rows = 3;
    int cols = 3;
    BorderStyle borderStyle = BorderStyle::SINGLE;
};

class TMechConfigDialog : public TDialog {
public:
    TMechConfigDialog();
    ~TMechConfigDialog();
    
    virtual void handleEvent(TEvent& event) override;
    virtual void getData(void* data) override;
    virtual void setData(void* data) override;
    
    MechGridConfig getConfig() const;
    void setConfig(const MechGridConfig& config);
    
private:
    TInputLine* rowsInput_;
    TInputLine* colsInput_;
    TRadioButtons* styleButtons_;
    TButton* previewButton_;
    
    MechGridConfig config_;
    
    void updatePreview();
    bool validateInput();
};