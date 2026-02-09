#include "mech_config.h"

#define Uses_TSItem
#define Uses_TStaticText
#define Uses_MsgBox
#include <tvision/tv.h>
#include <sstream>

TMechConfigDialog::TMechConfigDialog() : 
    TDialog(TRect(0, 0, 50, 18), "Mech Grid Configuration"),
    TWindowInit(&TMechConfigDialog::initFrame),
    rowsInput_(nullptr),
    colsInput_(nullptr),
    styleButtons_(nullptr),
    previewButton_(nullptr)
{
    options |= ofCentered;
    
    // Rows input
    insert(new TLabel(TRect(3, 2, 8, 3), "~R~ows:", 0));
    rowsInput_ = new TInputLine(TRect(9, 2, 13, 3), 2, new TRangeValidator(1, 6));
    rowsInput_->setData("3");
    insert(rowsInput_);
    
    // Cols input  
    insert(new TLabel(TRect(3, 4, 8, 5), "~C~ols:", rowsInput_));
    colsInput_ = new TInputLine(TRect(9, 4, 13, 5), 2, new TRangeValidator(1, 6));
    colsInput_->setData("3");
    insert(colsInput_);
    
    // Border style radio buttons
    insert(new TLabel(TRect(3, 6, 15, 7), "Border Style:", colsInput_));
    
    styleButtons_ = new TRadioButtons(TRect(3, 7, 25, 12),
        new TSItem("~S~ingle",
        new TSItem("~D~ouble", 
        new TSItem("~R~ound",
        new TSItem("~F~at",
        new TSItem("Single-Dou~b~le", nullptr))))));
    
    styleButtons_->setValue(0); // Default to Single
    insert(styleButtons_);
    
    // Preview button
    previewButton_ = new TButton(TRect(30, 7, 42, 9), "~P~review", cmMechPreview, bfNormal);
    insert(previewButton_);
    
    // Dialog buttons
    insert(new TButton(TRect(15, 14, 25, 16), "~O~K", cmOK, bfDefault));
    insert(new TButton(TRect(27, 14, 37, 16), "~C~ancel", cmCancel, bfNormal));
    
    // Set initial config
    config_.rows = 3;
    config_.cols = 3;
    config_.borderStyle = BorderStyle::SINGLE;
}

TMechConfigDialog::~TMechConfigDialog() {
    // TDialog destructor will handle child cleanup
}

void TMechConfigDialog::handleEvent(TEvent& event) {
    TDialog::handleEvent(event);
    
    if (event.what == evCommand) {
        switch (event.message.command) {
            case cmMechPreview:
                if (validateInput()) {
                    updatePreview();
                }
                clearEvent(event);
                break;
                
            case cmOK:
                if (validateInput()) {
                    // Update config from form
                    char rowsStr[4], colsStr[4];
                    rowsInput_->getData(rowsStr);
                    colsInput_->getData(colsStr);
                    
                    config_.rows = std::atoi(rowsStr);
                    config_.cols = std::atoi(colsStr);
                    config_.borderStyle = static_cast<BorderStyle>(styleButtons_->value);
                    
                    endModal(cmOK);
                    clearEvent(event);
                }
                break;
        }
    }
}

void TMechConfigDialog::getData(void* data) {
    if (data) {
        *static_cast<MechGridConfig*>(data) = config_;
    }
}

void TMechConfigDialog::setData(void* data) {
    if (data) {
        config_ = *static_cast<MechGridConfig*>(data);
        
        // Update form controls
        char rowsStr[4], colsStr[4];
        std::sprintf(rowsStr, "%d", config_.rows);
        std::sprintf(colsStr, "%d", config_.cols);
        
        rowsInput_->setData(rowsStr);
        colsInput_->setData(colsStr);
        styleButtons_->setValue(static_cast<int>(config_.borderStyle));
        
        drawView();
    }
}

MechGridConfig TMechConfigDialog::getConfig() const {
    return config_;
}

void TMechConfigDialog::setConfig(const MechGridConfig& config) {
    config_ = config;
    setData(&config_);
}

void TMechConfigDialog::updatePreview() {
    // Generate a single mech as preview
    TMech previewMech;
    previewMech.generate();
    previewMech.applyBorderStyle(config_.borderStyle);
    
    // Show preview in a message box
    std::stringstream preview;
    preview << "Preview " << config_.rows << "x" << config_.cols << " grid:\n\n";
    
    for (int i = 0; i < TMech::CANVAS_HEIGHT && i < 7; ++i) {
        preview << previewMech.getLine(i).substr(0, 15) << "\n";
    }
    
    messageBox(preview.str().c_str(), mfInformation | mfOKButton);
}

bool TMechConfigDialog::validateInput() {
    char rowsStr[4], colsStr[4];
    rowsInput_->getData(rowsStr);
    colsInput_->getData(colsStr);
    
    int rows = std::atoi(rowsStr);
    int cols = std::atoi(colsStr);
    
    if (rows < 1 || rows > 6) {
        messageBox("Rows must be between 1 and 6", mfError | mfOKButton);
        rowsInput_->select();
        return false;
    }
    
    if (cols < 1 || cols > 6) {
        messageBox("Cols must be between 1 and 6", mfError | mfOKButton);
        colsInput_->select();
        return false;
    }
    
    return true;
}