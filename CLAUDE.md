# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutoLang is a Chrome extension (Manifest V3) that automatically remembers language preferences (Hebrew/English) and switches keyboard layouts. It operates in two modes:

1. **Simple Per-Tab Mode** (default): Tracks language per browser tab
2. **Per-Field Mode**: Tracks language per individual input field (enabled when `SIMPLE_PER_TAB_MODE = false` in [content.js](content.js))

The extension uses an AutoHotkey helper script on Windows to trigger actual OS-level keyboard switching via Alt+Shift.

## Architecture

### Three-Component System

1. **background.js** (Service Worker)
   - Maintains tab-to-language mapping in memory (`tabLanguages` Map)
   - Listens for tab switches and triggers keyboard changes
   - Triggers keyboard switches by downloading trigger files to Downloads folder
   - Updates extension badge (עב/EN) based on current language
   - **Note**: Tab language state is lost on browser restart (stored in memory only)

2. **content.js** (Content Script)
   - Detects language from typed characters (Hebrew: U+0590-U+05FF, English: a-zA-Z)
   - Shows floating visual indicator when language is detected
   - In Simple Per-Tab Mode: Detects Alt+Shift keypresses and updates tab language
   - In Per-Field Mode: Remembers language per field using unique identifiers (URL + field ID/name/position)
   - **Guard Pattern**: All Chrome API calls wrapped in `safe*` helpers to handle extension context invalidation
   - Field language preferences stored in `chrome.storage.local` (persists across restarts)

3. **AutoLangWatcher.ahk** (External Helper)
   - Polls Downloads folder every 400ms for trigger files:
     - `autolang_switch_to_hebrew.txt`
     - `autolang_switch_to_english.txt`
   - Deletes trigger file and sends Alt+Shift to OS when detected
   - Logs activity to `AutoLangWatcher.log` in Downloads folder
   - Auto-detects Downloads path via Windows Shell API

### Communication Flow

**Tab Switch Flow:**
1. User switches to Tab A
2. `background.js` receives `tabs.onActivated` event
3. Looks up language for Tab A in `tabLanguages` Map
4. Downloads trigger file → AutoHotkey presses Alt+Shift
5. Sends message to content script to show indicator

**Typing Flow (Simple Mode):**
1. User presses Alt+Shift in browser
2. `content.js` detects keydown event
3. Toggles `currentLanguage` variable
4. Sends `updateLanguage` message to background (with `triggerSwitch: false`)
5. Background updates `tabLanguages` Map and badge

**Typing Flow (Per-Field Mode):**
1. User types in input field
2. `content.js` detects characters via `input`/`keydown` events
3. Calls `detectLanguage()` to identify Hebrew vs English
4. Generates field identifier using `getFieldIdentifier()`
5. Stores in memory Map and `chrome.storage.local`
6. Sends `updateLanguage` to background with `triggerSwitch: true`
7. Background downloads trigger file

### Field Identification System

When `SIMPLE_PER_TAB_MODE = false`, fields are uniquely identified by:
1. Field `id` attribute (if exists) → `#email-input`
2. Field `name` attribute (if exists) → `[name="subject"]`
3. Parent element ID + tag + class (fallback)
4. Prefixed with URL: `hostname+pathname::identifier`

Example: `gmail.com/mail/u/0::composeto` stores the language for Gmail's "To" field.

## Development Setup

### Testing the Extension

1. Load unpacked extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer Mode"
   - Click "Load unpacked" and select the AutoLang folder

2. Start AutoHotkey watcher (Windows only):
   ```
   AutoLangWatcher.ahk
   ```
   (Double-click or run via AutoHotkey)

3. Open background service worker console:
   - Go to `chrome://extensions/`
   - Find AutoLang → Click "service worker" link
   - View logs for tab switching and keyboard trigger events

4. View content script logs:
   - Open any webpage
   - Press F12 → Console tab
   - See language detection and field focus events

5. After modifying the extension:
   - Click "Reload" button in `chrome://extensions/`
   - **Important**: Refresh all open tabs (F5) to reload content scripts
   - Re-open service worker console (old one becomes invalidated)

### Common Development Tasks

**Testing Simple Per-Tab Mode:**
- Ensure `SIMPLE_PER_TAB_MODE = true` in [content.js:10](content.js#L10)
- Open two tabs, type in each to set different languages
- Switch between tabs → observe Alt+Shift trigger and badge changes
- Check Downloads folder for trigger files being created/deleted

**Testing Per-Field Mode:**
- Set `SIMPLE_PER_TAB_MODE = false` in [content.js:10](content.js#L10)
- Reload extension and refresh test pages
- Focus on different input fields and type
- Check `chrome.storage.local` in DevTools (Application → Storage → Extension Storage)
- Look for keys like `field_gmail.com/mail::#to`

**Debugging Keyboard Switching:**
1. Enable AutoHotkey logging (already enabled by default)
2. Check `Downloads/AutoLangWatcher.log` for trigger detection
3. Verify trigger files appear in Downloads (may delete quickly)
4. Check background console for download success/failure
5. Ensure Chrome has permission to download without "Save As" dialog

**Debugging "Extension context invalidated" errors:**
- This happens when extension is reloaded while pages are open
- All `chrome.runtime.sendMessage` calls will fail
- Solution: Refresh the webpage (F5) to reload content script
- The `safe*` wrapper functions in [content.js:29-95](content.js#L29-95) prevent console spam

## Key Technical Constraints

### Chrome Extension Limitations
- **Cannot directly control OS keyboard layout**: Must use external helper (AutoHotkey)
- **Service worker state is ephemeral**: Tab languages reset on browser restart
- **Content script context invalidation**: Happens on extension reload/update
- **Download API workaround**: Uses data URLs to trigger file downloads without actual files

### Language Detection Logic
- Single character detection: Immediate classification as Hebrew or English
- Mixed text: Counts Hebrew vs English characters, majority wins
- Hebrew range: U+0590-U+05FF (Hebrew Unicode block)
- English detection: [a-zA-Z] pattern
- Located in [content.js:18-215](content.js#L18-215)

### AutoHotkey Integration
- **Platform-specific**: Windows only
- **Polling interval**: 400ms (balance between responsiveness and CPU usage)
- **Alt+Shift assumption**: Script assumes Alt+Shift toggles keyboard layout (common Windows default)
- **Downloads path detection**: Uses Windows Shell API with fallback to `%USERPROFILE%\Downloads`
- If user has different keyboard shortcut, modify line 40/54 in [AutoLangWatcher.ahk](AutoLangWatcher.ahk)

## File Structure

```
AutoLang/
├── manifest.json          # Extension configuration (Manifest V3)
├── background.js          # Service worker: tab management & keyboard triggers
├── content.js             # Language detection & field memory
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic for manual language setting
├── AutoLangWatcher.ahk    # AutoHotkey script for OS keyboard switching
├── icons/                 # Extension icons (16, 48, 128px)
└── README.md              # User documentation
```

## Important Code Patterns

### Safe Chrome API Calls
Always use the wrapper functions when calling Chrome APIs from content script:
- `isExtensionContextValid()` - Check if extension context is alive
- `safeSendMessage(msg, callback)` - Send message to background
- `safeStorageSet(key, value)` - Write to chrome.storage.local
- `safeStorageGet(keys, callback)` - Read from chrome.storage.local

These prevent crashes when extension is reloaded while pages are open.

### Mode-Specific Behavior
Check `SIMPLE_PER_TAB_MODE` constant before implementing field-related features:
```javascript
if (SIMPLE_PER_TAB_MODE) {
  // Tab-level logic
} else {
  // Field-level logic
}
```

### Keyboard Switch Trigger
When implementing features that need keyboard switching:
```javascript
chrome.runtime.sendMessage({
  action: 'switchKeyboard',
  language: 'hebrew' // or 'english'
});
```
Background script will download the trigger file for AutoHotkey to detect.
