# AutoLang - Smart Hebrew/English Keyboard Switcher

A Chrome extension that automatically remembers and switches between Hebrew and English keyboard layouts based on your browsing tabs.

## 🌟 Features

- **Per-Tab Language Memory**: Automatically remembers which language you use in each browser tab
- **Automatic Keyboard Switching**: Switches your OS keyboard layout when you change tabs
- **Per-Field Mode**: Optional mode to remember language preferences for individual input fields
- **WhatsApp Integration**: Special per-contact language memory for WhatsApp Web
- **Visual Indicators**: Shows floating notifications when language is detected
- **Zero Configuration**: Works out of the box with sensible defaults

## 🚀 How It Works

AutoLang operates in two modes:

### 1. Simple Per-Tab Mode (Default)
- Detects which language you're typing in each tab
- Remembers your language preference per tab
- Automatically switches keyboard layout when you switch tabs
- Uses AutoHotkey (Windows) to trigger Alt+Shift for OS-level switching

### 2. Per-Field Mode
- Tracks language preference for each individual input field
- Perfect for forms with mixed-language content
- Stores preferences in browser storage (persists across sessions)

## 📦 Installation

### Prerequisites
- Windows OS (for AutoHotkey integration)
- Chrome or Chromium-based browser
- [AutoHotkey v1.x](https://www.autohotkey.com/) installed

### Steps

1. **Clone this repository**
   ```bash
   git clone https://github.com/ysetbon/AutoLang.git
   cd AutoLang
   ```

2. **Load the Chrome extension**
   - Open Chrome and navigate to chrome://extensions/
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the AutoLang folder

3. **Start the AutoHotkey watcher**
   - Double-click AutoLangWatcher.ahk to run it
   - The script will run in the background (check system tray)

4. **Configure Chrome downloads** (Important!)
   - Go to chrome://settings/downloads
   - Disable "Ask where to save each file before downloading"
   - This allows the extension to create trigger files automatically

## 🎯 Usage

1. **Simple Per-Tab Mode** (default):
   - Open a tab and start typing in Hebrew or English
   - The extension detects your language automatically
   - Switch to another tab - the keyboard switches automatically!

2. **Per-Field Mode**:
   - Set SIMPLE_PER_TAB_MODE = false in content.js line 10
   - Reload the extension
   - Now each input field remembers its own language preference

3. **Manual Language Toggle**:
   - Press Alt+Shift to manually switch keyboard layout
   - The extension will remember your choice

## 🛠️ Architecture

### Components

1. **background.js** (Service Worker)
   - Maintains tab-to-language mapping in memory
   - Triggers keyboard switches via download mechanism
   - Updates extension badge with current language

2. **content.js** (Content Script)
   - Detects language from typed characters
   - Shows visual indicators
   - Handles per-field language memory
   - Guards against extension context invalidation

3. **AutoLangWatcher.ahk** (Windows Helper)
   - Monitors Downloads folder for trigger files
   - Sends Alt+Shift to OS when trigger detected
   - Polls every 200ms for fast response
   - Logs activity to AutoLangWatcher.log

### Communication Flow

Tab Switch → background.js → Downloads trigger file → AutoHotkey → Alt+Shift → OS

## 📝 Configuration

### Change Keyboard Shortcut

Edit AutoLangWatcher.ahk line 41 and 56:
```autohotkey
Send, !+  ; Change this to your preferred shortcut
```

### Adjust Polling Interval

Edit AutoLangWatcher.ahk line 27:
```autohotkey
SetTimer, WatchDownloads, 200  ; Change 200 to desired milliseconds
```

### Enable/Disable Badge

Edit background.js line 5:
```javascript
const SHOW_BADGE = true;  // Set to false to hide badge
```

### Enable/Disable Per-Field Mode

Edit content.js line 10:
```javascript
const SIMPLE_PER_TAB_MODE = false;  // Set to false for per-field tracking
```

## 🐛 Troubleshooting

### Extension not switching keyboard?

1. **Check AutoHotkey is running**: Look for AutoHotkey icon in system tray
2. **Check logs**: Open Downloads\AutoLangWatcher.log to see trigger detections
3. **Check Chrome console**: Right-click extension → "Inspect service worker"
4. **Verify downloads setting**: Make sure "Ask where to save" is disabled
5. **Check permissions**: Extension needs download permissions

### "Extension context invalidated" errors?

- Refresh the webpage (F5) after reloading the extension
- This happens when the extension updates while pages are open

### Downloads failing with FILE_SECURITY_CHECK_FAILED?

- This is a known Chrome security issue with some configurations
- Check your antivirus/security software
- Try disabling Chrome's "Safe Browsing" temporarily for testing

## 📊 Language Detection

- **Hebrew**: Unicode range U+0590–U+05FF
- **English**: Pattern [a-zA-Z]
- **Mixed text**: Majority language wins
- **Single character**: Immediate detection

## 🔒 Privacy

- All language preferences stored locally in browser
- No data sent to external servers
- Tab languages stored in memory only (cleared on browser restart)
- Field languages stored in chrome.storage.local (persists)

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use and modify as needed

## 🙏 Acknowledgments

Built with ❤️ for bilingual users who are tired of manual keyboard switching!

---

**Note**: Currently Windows-only due to AutoHotkey dependency. macOS/Linux support could be added using AppleScript/xdotool respectively.
