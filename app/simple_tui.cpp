/*---------------------------------------------------------*/
/*                                                         */
/*   SimpleTUI - Turbo Vision MVP Test Application        */
/*   Demonstrates core TUI framework capabilities         */
/*                                                         */
/*---------------------------------------------------------*/

#define Uses_TKeys
#define Uses_TApplication
#define Uses_TEvent
#define Uses_TRect
#define Uses_TDialog
#define Uses_TStaticText
#define Uses_TButton
#define Uses_TMenuBar
#define Uses_TSubMenu
#define Uses_TMenuItem
#define Uses_TStatusLine
#define Uses_TStatusItem
#define Uses_TStatusDef
#define Uses_TDeskTop
#define Uses_TInputLine
#define Uses_TLabel
#define Uses_THistory
#define Uses_TRadioButtons
#define Uses_TSItem
#define Uses_TCheckBoxes
#define Uses_TListBox
#define Uses_TScrollBar
#define Uses_TStringCollection
#include <tvision/tv.h>

#include <string>
#include <sstream>

// Command constants
const int cmShowMainDialog = 100;
const int cmShowAbout = 101;
const int cmTestAction = 102;

class TSimpleApp : public TApplication
{
public:
    TSimpleApp();
    virtual void handleEvent(TEvent& event);
    static TMenuBar *initMenuBar(TRect);
    static TStatusLine *initStatusLine(TRect);

private:
    void showMainDialog();
    void showAboutDialog();
    void showResultDialog(const std::string& title, const std::string& message);
};

TSimpleApp::TSimpleApp() :
    TProgInit(&TSimpleApp::initStatusLine,
              &TSimpleApp::initMenuBar,
              &TSimpleApp::initDeskTop)
{
}

void TSimpleApp::handleEvent(TEvent& event)
{
    TApplication::handleEvent(event);
    
    if (event.what == evCommand)
    {
        switch (event.message.command)
        {
            case cmShowMainDialog:
                showMainDialog();
                clearEvent(event);
                break;
            case cmShowAbout:
                showAboutDialog();
                clearEvent(event);
                break;
            default:
                break;
        }
    }
}

TMenuBar *TSimpleApp::initMenuBar(TRect r)
{
    r.b.y = r.a.y + 1;
    
    return new TMenuBar(r,
        *new TSubMenu("~F~ile", kbAltF) +
            *new TMenuItem("~M~ain Dialog...", cmShowMainDialog, kbAltM) +
            newLine() +
            *new TMenuItem("E~x~it", cmQuit, cmQuit, hcNoContext, "Alt-X") +
        *new TSubMenu("~T~est", kbAltT) +
            *new TMenuItem("~T~est Action", cmTestAction, kbAltT) +
            *new TMenuItem("~R~un Demo", cmShowMainDialog, kbAltR) +
        *new TSubMenu("~H~elp", kbAltH) +
            *new TMenuItem("~A~bout...", cmShowAbout, kbAltA)
    );
}

TStatusLine *TSimpleApp::initStatusLine(TRect r)
{
    r.a.y = r.b.y - 1;
    return new TStatusLine(r,
        *new TStatusDef(0, 0xFFFF) +
            *new TStatusItem("~Alt-X~ Exit", kbAltX, cmQuit) +
            *new TStatusItem("~Alt-M~ Main Dialog", kbAltM, cmShowMainDialog) +
            *new TStatusItem("~F10~ Menu", kbF10, cmMenu) +
            *new TStatusItem(0, kbAltF3, cmClose)
    );
}

void TSimpleApp::showMainDialog()
{
    TDialog *dialog = new TDialog(TRect(10, 3, 70, 20), "SimpleTUI Main Dialog");
    
    // Add static text label
    dialog->insert(new TStaticText(TRect(3, 2, 57, 3), 
        "Welcome to SimpleTUI - Turbo Vision Test Application"));
    
    // Add input field with label
    TInputLine *nameInput = new TInputLine(TRect(15, 4, 55, 5), 80);
    dialog->insert(nameInput);
    dialog->insert(new TLabel(TRect(3, 4, 14, 5), "~N~ame:", nameInput));
    
    // Add second input field with label
    TInputLine *emailInput = new TInputLine(TRect(15, 6, 55, 7), 80);
    dialog->insert(emailInput);
    dialog->insert(new TLabel(TRect(3, 6, 14, 7), "~E~mail:", emailInput));
    
    // Add radio buttons
    TSItem *radioItems = new TSItem("Option 1",
                         new TSItem("Option 2", 
                         new TSItem("Option 3", 0)));
    TRadioButtons *radioButtons = new TRadioButtons(TRect(3, 8, 25, 11), radioItems);
    dialog->insert(radioButtons);
    dialog->insert(new TStaticText(TRect(3, 7, 25, 8), "Select Option:"));
    
    // Add check boxes
    TSItem *checkItems = new TSItem("Enable Feature A",
                        new TSItem("Enable Feature B",
                        new TSItem("Enable Feature C", 0)));
    TCheckBoxes *checkBoxes = new TCheckBoxes(TRect(30, 8, 55, 11), checkItems);
    dialog->insert(checkBoxes);
    dialog->insert(new TStaticText(TRect(30, 7, 55, 8), "Features:"));
    
    // Add action buttons
    dialog->insert(new TButton(TRect(10, 13, 22, 15), "~O~K", cmOK, bfDefault));
    dialog->insert(new TButton(TRect(24, 13, 36, 15), "~T~est", cmTestAction, bfNormal));
    dialog->insert(new TButton(TRect(38, 13, 50, 15), "~C~ancel", cmCancel, bfNormal));
    
    // Select first input field
    dialog->selectNext(False);
    
    // Execute dialog
    ushort result = deskTop->execView(dialog);
    
    if (result == cmOK)
    {
        // Get values from input fields
        char nameBuffer[81] = {0};
        char emailBuffer[81] = {0};
        nameInput->getData(nameBuffer);
        emailInput->getData(emailBuffer);
        
        // Get radio button selection
        ushort radioSelection;
        radioButtons->getData(&radioSelection);
        
        // Get checkbox states
        ushort checkStates;
        checkBoxes->getData(&checkStates);
        
        // Build result message
        std::stringstream msg;
        msg << "Form submitted successfully!\n\n";
        msg << "Name: " << nameBuffer << "\n";
        msg << "Email: " << emailBuffer << "\n";
        msg << "Selected Option: " << (radioSelection + 1) << "\n";
        msg << "Features enabled: ";
        if (checkStates & 1) msg << "A ";
        if (checkStates & 2) msg << "B ";
        if (checkStates & 4) msg << "C ";
        
        showResultDialog("Form Results", msg.str());
    }
    else if (result == cmTestAction)
    {
        showResultDialog("Test Action", "Test button was clicked!");
    }
    
    destroy(dialog);
}

void TSimpleApp::showAboutDialog()
{
    TDialog *dialog = new TDialog(TRect(20, 6, 60, 15), "About SimpleTUI");
    
    dialog->insert(new TStaticText(TRect(3, 2, 37, 3), "SimpleTUI v1.0"));
    dialog->insert(new TStaticText(TRect(3, 3, 37, 4), "Turbo Vision Test Application"));
    dialog->insert(new TStaticText(TRect(3, 5, 37, 6), "Built with Turbo Vision 2.0"));
    dialog->insert(new TStaticText(TRect(3, 6, 37, 7), "Running on macOS"));
    
    dialog->insert(new TButton(TRect(15, 8, 25, 10), "~O~K", cmOK, bfDefault));
    
    deskTop->execView(dialog);
    destroy(dialog);
}

void TSimpleApp::showResultDialog(const std::string& title, const std::string& message)
{
    // Calculate dialog size based on message
    int width = 50;
    int height = 10;
    
    TDialog *dialog = new TDialog(TRect(15, 5, 15 + width, 5 + height), title.c_str());
    
    // Split message into lines and add as static text
    std::istringstream stream(message);
    std::string line;
    int y = 2;
    while (std::getline(stream, line) && y < height - 3)
    {
        dialog->insert(new TStaticText(TRect(3, y, width - 3, y + 1), line.c_str()));
        y++;
    }
    
    dialog->insert(new TButton(TRect(width/2 - 5, height - 3, width/2 + 5, height - 1), 
                               "~O~K", cmOK, bfDefault));
    
    deskTop->execView(dialog);
    destroy(dialog);
}

int main()
{
    TSimpleApp app;
    app.run();
    return 0;
}