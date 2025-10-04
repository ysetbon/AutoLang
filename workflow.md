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
    Delete --> Send[Send Alt+Shift<br/>to Windows]
    Send --> OS[Windows Switches<br/>Keyboard Layout]
    OS --> Done([User Can Type in<br/>Correct Language])
    
    Found -->|No| Poll
    
    style Start fill:#e1f5e1
    style Done fill:#e1f5e1
    style Detect fill:#e3f2fd
    style Store fill:#e3f2fd
    style Lookup fill:#e3f2fd
    style Download fill:#fff3e0
    style Poll fill:#fce4ec
    style Send fill:#f3e5f5
    style OS fill:#f3e5f5
```

## Component Roles

- **Content Script (content.js)**: Detects typed language
- **Background Script (background.js)**: Manages tab languages & triggers switches
- **AutoHotkey Script**: Monitors Downloads folder & sends keyboard shortcuts
- **Windows OS**: Executes keyboard layout switch
