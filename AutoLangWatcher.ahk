; AutoLangWatcher.ahk - Watches Downloads for trigger files and presses Alt+Shift
; Requires AutoHotkey v1.x (https://www.autohotkey.com/)

; Enable logging and dynamic Downloads path detection
#NoEnv
#SingleInstance, Force
SetBatchLines, -1
SetTitleMatchMode, 2

; Determine Downloads path via registry (Windows 10/11) with fallbacks
DOWNLOAD_DIR := GetDownloadsPath()
if (!FileExist(DOWNLOAD_DIR)) {
    DOWNLOAD_DIR := A_UserProfile . "\\Downloads"
}

; Log file in Downloads (change if preferred)
LOG_FILE := DOWNLOAD_DIR . "\\AutoLangWatcher.log"

; File names created by the Chrome extension
FILE_HEBREW := DOWNLOAD_DIR . "\\autolang_switch_to_hebrew.txt"
FILE_ENGLISH := DOWNLOAD_DIR . "\\autolang_switch_to_english.txt"

Log("Started. Downloads=" . DOWNLOAD_DIR)
; TrayTip disabled - user doesn't want popups
; TrayTip, AutoLang Watcher, Watching for language switch triggers..., 5, 1

SetTimer, WatchDownloads, 200
Return

WatchDownloads:
{
    ; Check for Hebrew trigger
    if (FileExist(FILE_HEBREW))
    {
        Log("Trigger: hebrew")
        FileDelete, %FILE_HEBREW%
        if (ErrorLevel) {
            Log("Delete failed: " . FILE_HEBREW)
        }
        ; Send Alt+Shift to toggle keyboard layout
        Send, !+
        Log("Sent Alt+Shift (hebrew)")
        ; TrayTip disabled - user doesn't want popups
        ; TrayTip, AutoLang Watcher, Switched (Alt+Shift) → target: Hebrew, 3, 1
    }

    ; Check for English trigger
    if (FileExist(FILE_ENGLISH))
    {
        Log("Trigger: english")
        FileDelete, %FILE_ENGLISH%
        if (ErrorLevel) {
            Log("Delete failed: " . FILE_ENGLISH)
        }
        ; Send Alt+Shift to toggle keyboard layout
        Send, !+
        Log("Sent Alt+Shift (english)")
        ; TrayTip disabled - user doesn't want popups
        ; TrayTip, AutoLang Watcher, Switched (Alt+Shift) → target: English, 3, 1
    }
}
Return

; Optional: Hotkey to pause/resume watching
; Global variable for pause state
global paused := false

^!p::
    paused := !paused
    if (paused) {
        SetTimer, WatchDownloads, Off
        ; TrayTip, AutoLang Watcher, Paused, 3, 1
        Log("Paused")
    } else {
        SetTimer, WatchDownloads, On
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


