#include <CoreGraphics/CoreGraphics.h>
#include <stdio.h>
#include <string.h>

int main() {
    CFArrayRef windowList = CGWindowListCopyWindowInfo(
        kCGWindowListOptionOnScreenOnly, kCGNullWindowID);
    CFIndex count = CFArrayGetCount(windowList);
    
    for (CFIndex i = 0; i < count; i++) {
        CFDictionaryRef window = CFArrayGetValueAtIndex(windowList, i);
        
        CFStringRef ownerName;
        CFDictionaryGetValueIfPresent(window, kCGWindowOwnerName, (const void **)&ownerName);
        
        if (ownerName) {
            char name[256];
            CFStringGetCString(ownerName, name, sizeof(name), kCFStringEncodingUTF8);
            if (strcmp(name, "Ghostty") == 0) {
                CGWindowID wid;
                CFNumberRef widRef;
                CFDictionaryGetValueIfPresent(window, kCGWindowNumber, (const void **)&widRef);
                CFNumberGetValue(widRef, kCFNumberIntType, &wid);
                
                CFDictionaryRef bounds;
                CFDictionaryGetValueIfPresent(window, kCGWindowBounds, (const void **)&bounds);
                CGRect rect;
                CGRectMakeWithDictionaryRepresentation(bounds, &rect);
                
                printf("%d %.0f %.0f %.0f %.0f\n", wid, rect.origin.x, rect.origin.y, rect.size.width, rect.size.height);
            }
        }
    }
    CFRelease(windowList);
    return 0;
}
