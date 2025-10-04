# WhatsApp Per-Contact Language Memory

## Feature Overview

The extension now remembers the language you use with **each WhatsApp contact** individually. When you switch between contacts, it automatically switches your keyboard to the language you last used with that person.

## How It Works

### Automatic Contact Detection
1. When you open WhatsApp Web, the extension detects you're on WhatsApp
2. It identifies the current contact from the chat header or URL
3. Checks if you have a saved language for this contact
4. If yes → automatically switches keyboard to that language
5. If no → learns the language as you type

### Language Learning
1. You type in Hebrew with Contact A → Extension saves: "Contact A = Hebrew"
2. You type in English with Contact B → Extension saves: "Contact B = English"
3. Next time you click on Contact A → Keyboard auto-switches to Hebrew
4. Next time you click on Contact B → Keyboard auto-switches to English

### Storage
- Contact languages are saved in both:
  - Memory (for fast access during current session)
  - Chrome storage (persists across browser restarts)
- Storage key format: `whatsapp_contact_[contact_name]`

## Testing Instructions

### Step 1: Reload Extension
1. Go to `chrome://extensions/`
2. Find AutoLang
3. Click "Reload"
4. **Refresh WhatsApp Web tab** (F5)

### Step 2: Open WhatsApp Web
1. Navigate to `https://web.whatsapp.com`
2. Open DevTools (F12)
3. You should see in console:
   ```
   [AutoLang Content] WhatsApp Mode: ENABLED
   ```

### Step 3: Test Basic Flow

**A. First Contact (Hebrew):**
1. Click on a contact (e.g., "Mom")
2. Console should show:
   ```
   ╔═══════════════════════════════════════════════════╗
   ║ [AutoLang WhatsApp] CONTACT SWITCHED              ║
   ║ Current: Mom                                      ║
   ║ ⚠ No language remembered for this contact        ║
   ╚═══════════════════════════════════════════════════╝
   ```
3. Press Alt+Shift to switch to Hebrew
4. Type Hebrew message: "שלום"
5. Console should show:
   ```
   [AutoLang WhatsApp] 💾 Saving language for contact: Mom → hebrew
   ```

**B. Second Contact (English):**
1. Click on different contact (e.g., "Work Group")
2. Console shows contact switched
3. Press Alt+Shift to switch to English
4. Type English message: "hello"
5. Console saves: "Work Group → english"

**C. Switch Back to First Contact:**
1. Click back on "Mom"
2. **Watch the magic happen:**
   ```
   ╔═══════════════════════════════════════════════════╗
   ║ [AutoLang WhatsApp] CONTACT SWITCHED              ║
   ║ Current: Mom                                      ║
   ║ ✓ Found in memory: hebrew                        ║
   ║ >> SWITCHING KEYBOARD TO: hebrew                 ║
   ╚═══════════════════════════════════════════════════╝
   ```
3. Your keyboard should auto-switch to Hebrew!
4. Indicator shows: 🔤 עברית

### Step 4: Test Persistence
1. Close and reopen WhatsApp Web tab
2. Click on a contact you previously messaged
3. Extension should load language from storage and switch keyboard

## Debug Commands

Open console (F12) on WhatsApp Web and use these commands:

### Check Current Contact
```javascript
autoLangDebug.whatsapp.getCurrentContact()
```
Shows the current contact name/ID that the extension detected.

### Show All Saved Contacts
```javascript
autoLangDebug.whatsapp.showContactLanguages()
```
Lists all contacts and their saved languages.

### Show Full State
```javascript
autoLangDebug.showState()
```
Shows complete state including WhatsApp mode and contact info.

### Force Contact Switch Check
```javascript
autoLangDebug.whatsapp.forceContactSwitch()
```
Manually trigger contact detection (useful if auto-detection misses it).

### Clear Contact Memory
```javascript
autoLangDebug.whatsapp.clearContactMemory()
```
Clears all saved contact languages (for testing).

## How Contact Identification Works

The extension tries multiple methods to identify contacts (in order):

### Method 1: Chat Header
Looks for contact name in the chat header:
- `header [role="button"] span[dir="auto"]`
- `header span[title]`

### Method 2: Active Chat Element
Looks for active chat indicators:
- `div[data-tab="1"] span.x1iyjqo2`

### Method 3: URL Pattern
Extracts chat ID from URL:
- `web.whatsapp.com/.../[chat_id]`

### Method 4: DOM Attributes
Looks for data attributes on active chat element:
- `data-id`
- `data-testid`

## Expected Behavior

### ✅ Should Work:
- Auto-detect contact when clicking on chat
- Auto-switch keyboard when contact is recognized
- Remember language per individual contact
- Show visual indicator when switching
- Persist across browser restarts
- Work with both contacts and groups

### ⚠️ Limitations:
- WhatsApp Web must be fully loaded
- Contact must be identifiable (has name or ID)
- Requires at least 3 typed characters before saving language
- DOM selectors may need updates if WhatsApp changes their structure

## Troubleshooting

### Contact Not Detected
Check console for:
```
[AutoLang WhatsApp] ⚠ Could not identify current contact
```

**Solutions:**
1. Make sure chat is fully loaded
2. Try clicking on the contact name in header
3. Use `autoLangDebug.whatsapp.getCurrentContact()` to debug
4. Check if contact name appears in header

### Language Not Switching
Check console for:
```
[AutoLang WhatsApp] CONTACT SWITCHED
```

**If you don't see this:**
1. Click detection might be delayed → wait 300ms
2. Use `autoLangDebug.whatsapp.forceContactSwitch()` to manually trigger
3. Check if contact name changed (WhatsApp might be using different identifier)

### Language Not Remembered
1. Check if you typed at least 3 characters (minimum for saving)
2. Check storage: DevTools → Application → Storage → Extension Storage
3. Look for keys like: `whatsapp_contact_Mom`
4. Use `autoLangDebug.whatsapp.showContactLanguages()` to see memory

### AutoHotkey Not Switching
1. Make sure AutoHotkey script is running
2. Check `Downloads/AutoLangWatcher.log` for activity
3. Verify trigger files are being created

## Technical Details

### Throttling
Contact detection is throttled to 500ms to avoid excessive DOM queries.

### Storage Format
```
Key: whatsapp_contact_[contact_name]
Value: 'hebrew' or 'english'
```

### Event Listeners
- `click` events (with 300ms delay for DOM update)
- `focusin` events on message input (contenteditable)

### Language Detection Buffer
Requires 3+ characters in buffer before saving to avoid accidental single-key saves.

## Integration with Tab Mode

WhatsApp per-contact mode works **alongside** the regular per-tab mode:

- **On WhatsApp Web**: Uses per-contact memory
- **On other sites**: Uses per-tab memory
- Both modes coexist peacefully
- Self-correcting language detection works on all sites

## Example Session

```
1. Open WhatsApp Web
   → Extension detects WhatsApp mode enabled

2. Click on "Alice"
   → No saved language, waits for typing
   → Type in Hebrew
   → Saves: Alice = hebrew

3. Click on "Bob"
   → No saved language
   → Type in English
   → Saves: Bob = english

4. Click on "Charlie"
   → No saved language
   → Type in Hebrew
   → Saves: Charlie = hebrew

5. Click back on "Alice"
   → Found: Alice = hebrew
   → Auto-switch keyboard to Hebrew ✓

6. Click on "Bob"
   → Found: Bob = english
   → Auto-switch keyboard to English ✓

7. Click on "Charlie"
   → Found: Charlie = hebrew
   → Auto-switch keyboard to Hebrew ✓
```

Perfect! Now you can message different contacts without manually switching keyboards! 🎉
