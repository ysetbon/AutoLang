# AutoLang Workflow Diagram

```mermaid
flowchart TD
    Start([User Types in Browser Tab]) --> Detect[Content Script Detects Language<br/>Hebrew/English Characters]
    Detect --> Store[Background Script Stores<br/>Tab → Language Mapping]
    Store --> Wait[Extension Waits...]
    
    Wait --> Switch([User Switches to Different Tab])
    Switch --> Lookup[Background Script Looks Up<br/>Language for New Tab]
    Lookup --> Check{Language Different<br/>from Current?}
    
    Check -->|No| NoAction[No Action Needed]
    Check -->|Yes| Download[Create Trigger File<br/>in Downloads Folder]
    
    Download --> Poll[AutoHotkey Script<br/>Polling Every 200ms]
    Poll --> Found{Trigger File<br/>Detected?}
    
    Found -->|Yes| Delete[Delete Trigger File]
    Delete --> API[Call Windows API:<br/>ActivateKeyboardLayout]
    API --> Switch[Directly Activate<br/>Hebrew 0x040D / English 0x0409]
    Switch --> Done([User Can Type in<br/>Correct Language])
    
    Found -->|No| Poll
    
    style Start fill:#a5d6a7,stroke:#2e7d32,stroke-width:3px
    style Done fill:#a5d6a7,stroke:#2e7d32,stroke-width:3px
    style Detect fill:#90caf9,stroke:#1976d2,stroke-width:2px
    style Store fill:#90caf9,stroke:#1976d2,stroke-width:2px
    style Lookup fill:#90caf9,stroke:#1976d2,stroke-width:2px
    style Wait fill:#e0e0e0,stroke:#616161,stroke-width:2px
    style Switch fill:#fff59d,stroke:#f9a825,stroke-width:3px
    style Check fill:#fff59d,stroke:#f57f17,stroke-width:2px
    style NoAction fill:#e0e0e0,stroke:#757575,stroke-width:2px
    style Download fill:#ffcc80,stroke:#e65100,stroke-width:2px
    style Poll fill:#1565c0,stroke:#0d47a1,stroke-width:2px,color:#fff
    style Found fill:#ffd54f,stroke:#f57f17,stroke-width:2px
    style Delete fill:#e64a19,stroke:#bf360c,stroke-width:2px,color:#fff
    style API fill:#6a1b9a,stroke:#4a148c,stroke-width:2px,color:#fff
    style Switch fill:#6a1b9a,stroke:#4a148c,stroke-width:2px,color:#fff
```

## Component Roles

- **Content Script (content.js)**: Detects typed language from Hebrew/English characters
- **Background Script (background.js)**: Manages tab-to-language mapping & creates trigger files
- **AutoHotkey Script (AutoLangWatcher.ahk)**: Polls Downloads folder & calls Windows API
- **Windows API**: `ActivateKeyboardLayout()` directly switches to specific language layout (0x040D for Hebrew, 0x0409 for English)

## Technical Details

### Trigger File Format
- **Filename**: `autolang_switch_to_hebrew.trigger` or `autolang_switch_to_english.trigger`
- **Content**: Simple text with language name
- **Location**: User's Downloads folder
- **Lifecycle**: Created by Chrome → Detected by AutoHotkey → Immediately deleted

### Keyboard Switching Method
AutoHotkey uses three methods for maximum compatibility:
1. `ActivateKeyboardLayout(HKL, 0)` - Activates layout for current thread
2. `PostMessage(WM_INPUTLANGCHANGEREQUEST)` - Sends message to active window
3. `LoadKeyboardLayout(layoutStr, KLF_ACTIVATE)` - Loads and activates layout

This ensures reliable switching across different Windows versions and configurations.
