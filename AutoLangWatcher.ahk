; AutoLangWatcher.ahk - Polls Chrome storage via extension ID and switches keyboard
; Requires AutoHotkey v1.x (https://www.autohotkey.com/)

#NoEnv
#SingleInstance, Force
SetBatchLines, -1
SetTitleMatchMode, 2

; Determine Downloads path for log file
DOWNLOAD_DIR := GetDownloadsPath()
if (!FileExist(DOWNLOAD_DIR)) {
    DOWNLOAD_DIR := A_UserProfile . "\\Downloads"
}

LOG_FILE := DOWNLOAD_DIR . "\\AutoLangWatcher.log"

; Track last seen counter to detect changes
global lastCounter := 0

Log("Started - Polling chrome.storage mode")
Log("Downloads=" . DOWNLOAD_DIR)

SetTimer, PollChromeStorage, 200
Return

PollChromeStorage:
{
    ; Read from Chrome extension's local storage via PowerShell
    ; This reads the LevelDB database where Chrome stores extension data

    ; For now, use a simpler approach: Check if extension writes to a known location
    ; The extension needs to write to: %LOCALAPPDATA%\Google\Chrome\User Data\Default\Local Storage\leveldb
    ; This is complex, so let's use the HTTP approach or file-based trigger

    ; FALLBACK: Keep watching Downloads folder for trigger files as backup
    FILE_HEBREW := DOWNLOAD_DIR . "\\autolang_switch_to_hebrew.trigger"
    FILE_ENGLISH := DOWNLOAD_DIR . "\\autolang_switch_to_english.trigger"

    if (FileExist(FILE_HEBREW))
    {
        Log("Trigger: hebrew (file)")
        FileDelete, %FILE_HEBREW%
        if (ErrorLevel) {
            Log("Delete failed: " . FILE_HEBREW)
        }
        SwitchToLayout(0x040D)
        Log("Switched to Hebrew layout")
    }

    if (FileExist(FILE_ENGLISH))
    {
        Log("Trigger: english (file)")
        FileDelete, %FILE_ENGLISH%
        if (ErrorLevel) {
            Log("Delete failed: " . FILE_ENGLISH)
        }
        SwitchToLayout(0x0409)
        Log("Switched to English layout")
    }
}
Return

; Optional: Hotkey to pause/resume watching
; Global variable for pause state
global paused := false

^!p::
    paused := !paused
    if (paused) {
        SetTimer, PollChromeStorage, Off
        ; TrayTip, AutoLang Watcher, Paused, 3, 1
        Log("Paused")
    } else {
        SetTimer, PollChromeStorage, On
        ; TrayTip, AutoLang Watcher, Resumed, 3, 1
        Log("Resumed")
    }
Return

; Helper: log message to file with timestamp
Log(msg) {
    global LOG_FILE
    FormatTime, now,, yyyy-MM-dd HH:mm:ss
    FileAppend, %now% - %msg%`r`n, %LOG_FILE%
}

; Helper: determine Downloads path using Shell API (reliable), with fallback
GetDownloadsPath() {
    try {
        shell := ComObjCreate("Shell.Application")
        folder := shell.NameSpace("shell:Downloads")
        if (folder) {
            return folder.Self.Path
        }
    } catch e {
        ; ignore and use fallback
    }
    return ""
}

; Helper: Switch to specific keyboard layout by language ID
; layoutID: 0x0409 = English (US), 0x040D = Hebrew, etc.
SwitchToLayout(layoutID) {
    ; Get handle to foreground window
    WinGet, activeHwnd, ID, A

    ; Get thread ID of active window
    threadID := DllCall("GetWindowThreadProcessId", "UInt", activeHwnd, "UInt", 0)

    ; Load the keyboard layout for the language
    ; Format: 0x04090409 for English, 0x040D040D for Hebrew
    fullLayoutID := (layoutID << 16) | layoutID

    ; Send WM_INPUTLANGCHANGEREQUEST message to switch layout
    ; WM_INPUTLANGCHANGEREQUEST = 0x50
    PostMessage, 0x50, 0, %fullLayoutID%, , ahk_id %activeHwnd%

    ; Small delay to ensure switch completes
    Sleep, 10
}


