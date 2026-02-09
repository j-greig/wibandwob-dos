/*---------------------------------------------------------*/
/*                                                         */
/*   generative_monster_cam_view.cpp - Monster Cam (Emoji)*/
/*                                                         */
/*   Reads webcam frames from /tmp/face_monster_cam.sock   */
/*   (Python/OpenCV worker) and renders a minimal 3-line   */
/*   face sprite on an empty background.                   */
/*                                                         */
/*   Controls:                                             */
/*     Space: pause/resume                                  */
/*     +/-   : adjust frame cadence                         */
/*     j/J   : emoji bias up/down                           */
/*     w/W   : whitespace bias up/down                      */
/*     x     : toggle emoji flood                           */
/*     f     : toggle face overlay                          */
/*     r     : reset buffers                                */
/*                                                         */
/*---------------------------------------------------------*/

#include "generative_monster_cam_view.h"
#include "notitle_frame.h"

#define Uses_TWindow
#define Uses_TFrame
#define Uses_TColorAttr
#define Uses_TDrawBuffer
#include <tvision/tv.h>

#include <cmath>
#include <cstring>
#include <algorithm>
#include <string>
#include <vector>
#include <chrono>

#ifndef _WIN32
#include <sys/socket.h>
#include <sys/un.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#endif

namespace {

// no field/noise or emoji sets; minimal sprite only

} // namespace

TGenerativeMonsterCamView::TGenerativeMonsterCamView(const TRect &bounds, unsigned periodMs)
    : TView(bounds), periodMs(periodMs)
{
    options |= ofSelectable;
    growMode = gfGrowHiX | gfGrowHiY;
    eventMask |= evBroadcast | evKeyboard;
}

TGenerativeMonsterCamView::~TGenerativeMonsterCamView(){
    stopTimer();
#ifndef _WIN32
    if (sockFd>=0) { close(sockFd); sockFd=-1; }
#endif
}


void TGenerativeMonsterCamView::startTimer(){ if (!timerId) timerId = setTimer(periodMs, (int)periodMs); }
void TGenerativeMonsterCamView::stopTimer(){ if (timerId){ killTimer(timerId); timerId = 0; } }

void TGenerativeMonsterCamView::advance(){ 
    ++frame; 
    // Only update if we have fresh socket data
    bool hadNewData = pollSocket(); 
    // Stop smoothing if no new face data to prevent autonomous movement
    if (!hadNewData && !hasFace) {
        // Freeze smoothing when no live face data
        return;
    }
}

bool TGenerativeMonsterCamView::pollSocket(){
#ifndef _WIN32
    // Best-effort lazy connect with retry
    if (sockFd < 0){
        static unsigned long lastTryMs = 0;
        auto nowMs = (unsigned long) std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now().time_since_epoch()).count();
        
        // Only retry every 500ms to avoid spamming
        if (nowMs - lastTryMs < 500) return false;
        lastTryMs = nowMs;
        
        int fd = socket(AF_UNIX, SOCK_STREAM, 0);
        if (fd >= 0){
            sockaddr_un addr; std::memset(&addr, 0, sizeof(addr)); addr.sun_family = AF_UNIX; 
            std::snprintf(addr.sun_path, sizeof(addr.sun_path), "%s", "/tmp/face_monster_cam.sock");
            if (connect(fd, (struct sockaddr*)&addr, sizeof(addr)) == 0){
                int flags = fcntl(fd, F_GETFL, 0); fcntl(fd, F_SETFL, flags | O_NONBLOCK);
                sockFd = fd; inHdr.clear(); inPayload.clear(); needBytes = 0;
                connectionStatus = "connected";
            } else { 
                close(fd); 
                connectionStatus = "failed"; 
            }
        } else {
            connectionStatus = "socket_error";
        }
    }
    if (sockFd < 0) return false;

    // Read header line if we don't know expected payload size
    if (needBytes == 0){
        char buf[512]; int n = (int)::read(sockFd, buf, sizeof(buf));
        if (n <= 0) {
            if (n < 0 && errno == EAGAIN) return false; // Non-blocking, no data
            // Connection lost
            close(sockFd); sockFd = -1; connectionStatus = "disconnected";
            return false;
        }
        inHdr.append(buf, buf + n);
        auto pos = inHdr.find('\n');
        if (pos != std::string::npos){
            std::string header = inHdr.substr(0, pos);
            inHdr.erase(0, pos+1);
            // crude parse for w,h,has_face,bbox,blink
            int w=0,h=0; hasFace=false; faceX=faceY=faceW=faceH=0; blink=false;
            auto findInt=[&](const char* key,int &out){ size_t k=header.find(key); if(k==std::string::npos) return; size_t c=header.find(':',k); if(c!=std::string::npos){ out=std::atoi(header.c_str()+c+1);} };
            auto findBool=[&](const char* key,bool &out){ size_t k=header.find(key); if(k==std::string::npos) return; size_t c=header.find(':',k); if(c!=std::string::npos){ out= (header.find("true",c)!=std::string::npos); } };
            findInt("\"w\"", w); findInt("\"h\"", h); findBool("\"has_face\"", hasFace); findBool("\"blink\"", blink);
            if (hasFace){
                size_t b=header.find("\"bbox\""); if(b!=std::string::npos){ size_t lb=header.find('[',b); size_t rb=header.find(']',lb); if(lb!=std::string::npos && rb!=std::string::npos){ std::string arr=header.substr(lb+1, rb-lb-1); sscanf(arr.c_str(), "%d,%d,%d,%d", &faceX,&faceY,&faceW,&faceH); } }
                // update last seen time for sticky tracking
                unsigned long nowMs = (unsigned long) std::chrono::duration_cast<std::chrono::milliseconds>(
                    std::chrono::steady_clock::now().time_since_epoch()).count();
                lastFaceSeenMs = nowMs;
            }
            if (w>0 && h>0){
                camW=w; camH=h; needBytes = w*h; inPayload.clear(); inPayload.reserve(needBytes);
                // Move any leftover bytes from inHdr (which could be start of payload) into inPayload
                if (!inHdr.empty()){
                    size_t take = std::min((size_t)needBytes, inHdr.size());
                    inPayload.insert(inPayload.end(), (unsigned char*)inHdr.data(), (unsigned char*)inHdr.data()+take);
                    inHdr.erase(0, take);
                }
            }
            return true; // Successfully processed header
        }
    }
    // Read payload
    if (needBytes > 0){
        unsigned char buf[4096]; int n = (int)::read(sockFd, buf, std::min<int>(sizeof(buf), needBytes - (int)inPayload.size()));
        if (n < 0 && errno == EAGAIN) return false; // Non-blocking, no data
        if (n <= 0) {
            // Connection lost
            close(sockFd); sockFd = -1; connectionStatus = "disconnected";
            return false;
        }
        inPayload.insert(inPayload.end(), buf, buf+n);
        if ((int)inPayload.size() >= needBytes){ cam.swap(inPayload); needBytes = 0; ++framesRx; ++framesSinceTick; return true; }
    }
#endif
    return false;
}

void TGenerativeMonsterCamView::draw(){
    int W=size.x,H=size.y; if (W<=0||H<=0) return;
    // Column-accurate emitter; neutral color on pure black bg
    TColorAttr ca(TColorRGB(210,210,210), TColorRGB(0,0,0));
    TAttrPair ap{ca, ca};

    // Derive sampling size
    int srcW = camW, srcH = camH; bool haveCam = (srcW>0 && srcH>0 && (int)cam.size()==srcW*srcH);
    if (!haveCam){ srcW = W; srcH = H; }

    // Update FPS once per ~1s for HUD
    auto nowMs = (unsigned long) std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
    if (lastTickMs == 0) lastTickMs = nowMs;
    unsigned long dt = nowMs - lastTickMs;
    if (dt >= 900) { rxFps = dt ? (framesSinceTick * 1000.0f / (float)dt) : 0.f; framesSinceTick = 0; lastTickMs = nowMs; }

    // Always draw a tiny face on empty background.
    // Deadband variables for HUD display
    float dbx = std::max(1.0f, 0.01f * W);   // at least 1 col, 1% of width
    float dby = std::max(1.0f, 0.02f * H);   // at least 1 row, 2% of height
    {
        // Clear background
        for (int y=0; y<H; ++y){ TDrawBuffer b; b.moveChar(0, ' ', ca, W); writeLine(0,y,W,1,b); }
        if (minimalSprite) {
    // Minimal 3-line face; track both X and Y
    static const char* S0 = u8"    👁️═👁️  ";
    static const char* S1 = u8"∿∿∿👃∿∿∿";
    static const char* S2 = u8"    👅    ";
    // Compose first line depending on blink; hide eyes when blink is true.
    const char* S0_BLINK = "      ═    ";
    const char* SPR3[3] = { blink ? S0_BLINK : S0, S1, S2 };
            int SH = 3; int SW = 0; for (int i=0;i<SH;++i) SW = std::max(SW, strwidth(SPR3[i]));

    // Compute target Vx,Vy from face center; clamp Vy so 3-line sprite fits
    bool faceNow = haveCam && hasFace;
    int targetVX = (outVX>=0? outVX : W/2);
    int targetVY = (outVY>=0? outVY : std::max(0, std::min(H-3, H/2 - 1)));
    if (faceNow) {
        int cx = faceX + faceW/2;
        int cy = faceY + faceH/2;
        // Mirror X coordinate to match natural movement (move right = sprite right)  
        targetVX = std::max(0, std::min(W-1, W-1 - (int)std::round(cx * (W/(float)srcW))));
        targetVY = std::max(0, std::min(H-3, (int)std::round(cy * (H/(float)srcH)) - 1));
    } else {
        // Don't freeze - let smoothing naturally settle to avoid replaying movements
        // Just keep current smooth position as target
        targetVX = (smVX >= 0) ? (int)std::round(smVX) : targetVX;
        targetVY = (smVY >= 0) ? (int)std::round(smVY) : targetVY;
    }
    // Smooth both axes
    if (smVX < 0.f || smVY < 0.f) { smVX = (float)targetVX; smVY = (float)targetVY; }
    else { float a=0.12f; smVX = smVX + a * (targetVX - smVX); smVY = smVY + a * (targetVY - smVY); }
    // Deadband quantization to reduce jitter (scaled with window size, use outer scope variables)
    int qx = (outVX<0)? (int)std::round(smVX) : outVX;
    int qy = (outVY<0)? (int)std::round(smVY) : outVY;
    if (std::fabs(smVX - qx) >= dbx) qx = (int)std::round(smVX);
    if (std::fabs(smVY - qy) >= dby) qy = (int)std::round(smVY);
    qx = std::max(0, std::min(W-1, qx));
    qy = std::max(0, std::min(H-3, qy));
    outVX = qx; outVY = qy;
    int baseX = std::max(0, std::min(W - SW, qx - SW/2));
    int baseY = qy;
            for (int i=0;i<SH;++i){ int y = baseY + i; if (y<0||y>=H) continue; TDrawBuffer b; int col = baseX; ushort w = b.moveCStr(col, SPR3[i], ap, W - col); col += (w>0?w:0); if (col < W) b.moveChar(col, ' ', ca, (ushort)(W-col)); writeLine(0,y,W,1,b); }
        } else {
            // Big monster sprite (original)
            static const char* SPR[] = {
                u8"                     ░▓███▓░",
                u8"                  ░▓██👁██▓░",
                u8"                ░▓██👁███👁██▓░",
                u8"              ░▓██👁██████👁██▓░",
                u8"            ░▓██👁████████████👁██▓░",
                u8"          ░▓██👁██████◊◊██████👁██▓░",
                u8"        ░▓██👁████◊◊████◊◊████👁██▓░",
                u8"      ░▓██👁██◊◊██████████████◊◊👁██▓░",
                u8"    ░▓██👁██◊◊████⚡⚡⚡⚡████◊◊██👁██▓░",
                u8"  ░▓██👁██◊◊██⚡⚡██████████⚡⚡██◊◊██👁██▓░",
                u8"░▓██👁██◊◊██⚡⚡████🔺🔺🔺🔺████⚡⚡██◊◊██👁██▓░",
                u8"██👁██◊◊██⚡⚡██🔺🔺██████🔺🔺██⚡⚡██◊◊██👁██",
                u8"██👁██◊◊██⚡⚡██🔺🔺██👄👄██🔺🔺██⚡⚡██◊◊██👁██",
                u8"██👁██◊◊██⚡⚡██🔺🔺██👄👄██🔺🔺██⚡⚡██◊◊██👁██",
                u8"██👁██◊◊██⚡⚡██🔺🔺████████🔺🔺██⚡⚡██◊◊██👁██",
                u8"░▓██👁██◊◊██⚡⚡████🔺🔺🔺🔺████⚡⚡██◊◊██👁██▓░",
                u8"  ░▓██👁██◊◊██⚡⚡██████████⚡⚡██◊◊██👁██▓░",
                u8"    ░▓██👁██◊◊████⚡⚡⚡⚡████◊◊██👁██▓░",
                u8"      ░▓██👁██◊◊██████████████◊◊👁██▓░",
                u8"        ░▓██👁████◊◊████◊◊████👁██▓░",
                u8"          ░▓██👁██████◊◊██████👁██▓░",
                u8"            ░▓██👁████████████👁██▓░",
                u8"              ░▓██👁██████👁██▓░",
                u8"                ░▓██👁███👁██▓░",
                u8"                  ░▓██👁██▓░",
            };
            int SH = (int)(sizeof(SPR)/sizeof(SPR[0]));
            int SW = 0; for (int i=0;i<SH;++i) SW = std::max(SW, strwidth(SPR[i]));
            // Compute target from face detection, with sticky + smoothing
            bool faceNow = haveCam && hasFace;
            int targetVX = W/2, targetVY = H/2;
            if (faceNow) {
                int cx = faceX + faceW/2; int cy = faceY + faceH/2;
                targetVX = std::max(0, std::min(W-1, (int)std::round(cx * (W/(float)srcW))));
                targetVY = std::max(0, std::min(H-1, (int)std::round(cy * (H/(float)srcH))));
            } else if (nowMs - lastFaceSeenMs < (unsigned long)faceStickyMs && smVX >= 0.f && smVY >= 0.f) {
                targetVX = (int)std::round(smVX);
                targetVY = (int)std::round(smVY);
            }
            if (smVX < 0.f || smVY < 0.f) { smVX = (float)targetVX; smVY = (float)targetVY; }
            else { float a = 0.25f; smVX = smVX + a * (targetVX - smVX); smVY = smVY + a * (targetVY - smVY); }
            int vx = std::max(0, std::min(W-1, (int)std::round(smVX)));
            int vy = std::max(0, std::min(H-1, (int)std::round(smVY)));
            int baseX = std::max(0, std::min(W - SW, vx - SW/2));
            int baseY = std::max(0, std::min(H - SH, vy - SH/2));
            for (int i=0;i<SH;++i){ int y = baseY + i; if (y<0||y>=H) continue; TDrawBuffer b; int col = baseX; ushort w = b.moveCStr(col, SPR[i], ap, W - col); col += (w>0?w:0); if (col < W) b.moveChar(col, ' ', ca, (ushort)(W-col)); writeLine(0,y,W,1,b); }
        }
        // Draw debug HUD on top if enabled continues below
    }

    // Field pattern removed.

    // Draw debug HUD overlay on top-left
    if (debugHud){
        char buf0[128]; char buf1[128]; char buf2[128]; char buf3[128];
        std::snprintf(buf0, sizeof(buf0), "MonsterCam | sock:%s cam:%dx%d fps:%.1f",
                      connectionStatus.c_str(), camW, camH, rxFps);
        std::snprintf(buf1, sizeof(buf1), "face:%s blink:%s bbox:%d,%d %dx%d sm:(%.1f,%.1f) out:(%d,%d)",
                      (hasFace?"yes":"no"), (blink?"yes":"no"), faceX, faceY, faceW, faceH, smVX, smVY, outVX, outVY);
        std::snprintf(buf2, sizeof(buf2), "deadband col=%.1f row=%.1f", dbx, dby);
        std::snprintf(buf3, sizeof(buf3), "keys: v=HUD +/- speed Space=pause r=reset");
        const char* lines[4] = { buf0, buf1, buf2, buf3 };
        for (int i=0;i<4 && i<H; ++i){ TDrawBuffer b; int col=0; ushort w = b.moveCStr(col, lines[i], ap, W - col); col += (w>0?w:0); if (col<W) b.moveChar(col, ' ', ca, (ushort)(W-col)); writeLine(0,i,W,1,b); }
    }
}

void TGenerativeMonsterCamView::handleEvent(TEvent &ev){
    TView::handleEvent(ev);
    if (ev.what==evBroadcast && ev.message.command==cmTimerExpired){ if (timerId && ev.message.infoPtr==timerId){ advance(); drawView(); clearEvent(ev);} }
    else if (ev.what==evKeyDown){ char ch=ev.keyDown.charScan.charCode; bool handled=false; switch(ch){
        case ' ': if (timerId) stopTimer(); else startTimer(); handled=true; break;
        case '+': case '=': periodMs = std::min(200u, periodMs+5); stopTimer(); startTimer(); handled=true; break;
        case '-': case '_': periodMs = std::max(20u, periodMs>5?periodMs-5:periodMs); stopTimer(); startTimer(); handled=true; break;
        case 'v': case 'V': debugHud = !debugHud; handled=true; break;
        case 'r': 
            // Reset everything including socket connection
            cam.clear(); camW=camH=0; hasFace=false;
            if (sockFd >= 0) { close(sockFd); sockFd = -1; }
            connectionStatus = "connecting";
            inHdr.clear(); inPayload.clear(); needBytes = 0;
            handled=true; break;
        default: break; }
        if (handled){ drawView(); clearEvent(ev);} }
}

void TGenerativeMonsterCamView::setState(ushort s, Boolean en){ TView::setState(s,en); if ((s&sfExposed)!=0){ if (en){ frame=0; startTimer(); drawView(); } else stopTimer(); }}
void TGenerativeMonsterCamView::changeBounds(const TRect& b){ TView::changeBounds(b); drawView(); }

class TGenerativeMonsterCamWindow : public TWindow{
public:
    explicit TGenerativeMonsterCamWindow(const TRect &r):TWindow(r, "", wnNoNumber), TWindowInit(&TGenerativeMonsterCamWindow::initFrame){}
    void setup(unsigned ms){ options|=ofTileable; TRect c=getExtent(); c.grow(-1,-1); insert(new TGenerativeMonsterCamView(c, ms)); }
    virtual void changeBounds(const TRect& b) override { TWindow::changeBounds(b); setState(sfExposed, True); redraw(); }
private: static TFrame* initFrame(TRect r){ return new TNoTitleFrame(r);} };

TWindow* createGenerativeMonsterCamWindow(const TRect &bounds){ auto *w=new TGenerativeMonsterCamWindow(bounds); w->setup(80); return w; }
