// Background service worker for AutoLang extension

// Store language preferences per tab
const tabLanguages = new Map();

console.log('═══════════════════════════════════════════════════');
console.log('[AutoLang] Background service worker STARTED');
console.log('[AutoLang] Time:', new Date().toLocaleTimeString());
console.log('═══════════════════════════════════════════════════');

// Restore tab languages from storage on startup
chrome.storage.local.get(['tabLanguages'], (result) => {
  if (result.tabLanguages) {
    console.log('[AutoLang] DEBUG: Raw storage data:', result.tabLanguages);
    const restored = Object.entries(result.tabLanguages);
    restored.forEach(([tabId, language]) => {
      const numericTabId = parseInt(tabId);
      console.log('[AutoLang] DEBUG: Restoring tab', tabId, '(string) as', numericTabId, '(number) →', language);
      tabLanguages.set(numericTabId, language);
    });
    console.log('[AutoLang] ✓ Restored', restored.length, 'tab languages from storage');
    console.log('[AutoLang] DEBUG: Map after restore:');
    Array.from(tabLanguages.entries()).forEach(([id, lang]) => {
      console.log('[AutoLang] DEBUG:   Tab', id, '(type:', typeof id, ') →', lang);
    });
  } else {
    console.log('[AutoLang] No saved tab languages found');
  }
});

// Detect if text is Hebrew
function isHebrew(text) {
  const hebrewRegex = /[\u0590-\u05FF]/;
  return hebrewRegex.test(text);
}

// Save tab languages to storage (for persistence across browser restarts)
function saveTabLanguagesToStorage() {
  const tabLangsObj = Object.fromEntries(tabLanguages);
  chrome.storage.local.set({ tabLanguages: tabLangsObj }, () => {
    if (chrome.runtime.lastError) {
      console.log('[AutoLang] ✗ Failed to save tab languages:', chrome.runtime.lastError.message);
    }
  });
}

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tabId = activeInfo.tabId;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[AutoLang] TAB SWITCHED!');
  console.log('[AutoLang] Time:', new Date().toLocaleTimeString());
  console.log('[AutoLang] New Tab ID:', tabId);
  
  // Get tab info
  try {
    const tab = await chrome.tabs.get(tabId);
    console.log('[AutoLang] Tab URL:', tab.url || 'unknown');
    console.log('[AutoLang] Tab Title:', tab.title || 'unknown');
  } catch (e) {
    console.log('[AutoLang] Could not get tab info:', e.message);
  }
  
  // Get stored language for this tab
  const storedLang = tabLanguages.get(tabId);

  // DEBUG: Show what's in the map
  console.log('[AutoLang] DEBUG: Looking for tab', tabId, '(type:', typeof tabId, ')');
  const entries = Array.from(tabLanguages.entries());
  console.log('[AutoLang] DEBUG: Map has', entries.length, 'entries:');
  entries.forEach(([id, lang]) => {
    console.log('[AutoLang] DEBUG:   Tab', id, '(type:', typeof id, ') →', lang, '| Match?', id === tabId);
  });
  console.log('[AutoLang] DEBUG: Found language:', storedLang || 'none');

  if (storedLang) {
    console.log('[AutoLang] ✓ Found remembered language for this tab:', storedLang);
    console.log('[AutoLang] >> TRIGGERING KEYBOARD SWITCH TO:', storedLang);

    // Trigger keyboard switch immediately when switching to this tab
    triggerKeyboardSwitch(storedLang, `tab switch to ${tabId}`);

    // Send message to content script to update its language state
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'setLanguage',
        language: storedLang
      });
      console.log('[AutoLang] ✓ Sent language update to content script');
    } catch (error) {
      console.log('[AutoLang] ✗ Tab not ready for message:', error.message);
    }
  } else {
    console.log('[AutoLang] ⚠ No remembered language for this tab yet');
    console.log('[AutoLang] (Will learn when you start typing)');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[AutoLang] ← Received message:', request.action);

  if (request.action === 'updateLanguage') {
    const tabId = sender.tab.id;
    const oldLang = tabLanguages.get(tabId);
    const newLang = request.language;

    console.log('┌────────────────────────────────────────────────');
    console.log('│ [AutoLang] LANGUAGE UPDATE');
    console.log('│ Tab ID:', tabId, '(type:', typeof tabId, ')');
    console.log('│ Tab URL:', sender.tab.url);
    console.log('│ Old Language:', oldLang || 'none');
    console.log('│ New Language:', newLang);
    console.log('│ Changed?', oldLang !== newLang);

    console.log('│ DEBUG: BEFORE SET - Map contents:');
    Array.from(tabLanguages.entries()).forEach(([id, lang]) => {
      console.log('│   Tab', id, '(type:', typeof id, ') →', lang);
    });

    tabLanguages.set(tabId, newLang);

    console.log('│ DEBUG: AFTER SET - Map contents:');
    Array.from(tabLanguages.entries()).forEach(([id, lang]) => {
      console.log('│   Tab', id, '(type:', typeof id, ') →', lang);
    });

    saveTabLanguagesToStorage();

    // Badge disabled - user doesn't want visual indicators
    // chrome.action.setBadgeText({
    //   text: newLang === 'hebrew' ? 'עב' : 'EN',
    //   tabId: tabId
    // });

    // chrome.action.setBadgeBackgroundColor({
    //   color: newLang === 'hebrew' ? '#0066cc' : '#00aa00',
    //   tabId: tabId
    // });

    console.log('│ (Badge display disabled)');
    
    // Trigger keyboard switch if requested
    if (request.triggerSwitch) {
      console.log('│ >> TRIGGERING KEYBOARD SWITCH');
      triggerKeyboardSwitch(newLang, 'user typing');
    } else {
      console.log('│ (No keyboard switch requested)');
    }
    
    console.log('└────────────────────────────────────────────────');
    
    sendResponse({ success: true });
  } else if (request.action === 'switchKeyboard') {
    // Direct request to switch keyboard
    console.log('[AutoLang] >> Direct keyboard switch request:', request.language);
    triggerKeyboardSwitch(request.language, 'direct request');
    sendResponse({ success: true });
  } else if (request.action === 'updateLanguageForTab') {
    // Manual update from popup
    const tabId = request.tabId;
    const language = request.language;

    console.log('[AutoLang] Manual language update from popup');
    console.log('[AutoLang] Tab:', tabId, 'Language:', language);

    tabLanguages.set(tabId, language);
    saveTabLanguagesToStorage();

    // Badge disabled - user doesn't want visual indicators
    // chrome.action.setBadgeText({
    //   text: language === 'hebrew' ? 'עב' : 'EN',
    //   tabId: tabId
    // });

    // chrome.action.setBadgeBackgroundColor({
    //   color: language === 'hebrew' ? '#0066cc' : '#00aa00',
    //   tabId: tabId
    // });
    
    sendResponse({ success: true });
  } else if (request.action === 'getLanguage') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      const language = tabLanguages.get(tabId) || 'english';
      console.log('[AutoLang] ← Language query for tab', tabId, '→ Responding with:', language);
      console.log('[AutoLang]   Current tabLanguages Map has', tabLanguages.size, 'entries');
      sendResponse({ language: language });
    } else {
      console.log('[AutoLang] ⚠ Language query without tab ID, defaulting to english');
      sendResponse({ language: 'english' });
    }
  } else if (request.action === 'getLanguageForTab') {
    // Request from popup for specific tab
    const tabId = request.tabId;
    const language = tabLanguages.get(tabId) || 'english';
    console.log('[AutoLang] Language query for tab', tabId, ':', language);
    sendResponse({ language: language });
  } else if (request.action === 'debugState') {
    // Debug command to see current state
    const state = {
      tabCount: tabLanguages.size,
      tabs: Array.from(tabLanguages.entries()).map(([id, lang]) => ({ id, lang }))
    };
    console.log('[AutoLang] ═══ DEBUG STATE ═══');
    console.log('[AutoLang] Total tabs tracked:', state.tabCount);
    state.tabs.forEach(t => console.log('[AutoLang]   Tab', t.id, '→', t.lang));
    console.log('[AutoLang] ═══════════════════');
    sendResponse(state);
  }

  return true; // Keep message channel open for async response
});

// Trigger keyboard switch - simplified to just use Downloads API
// Chrome security is blocking, so we'll try a minimal approach
function triggerKeyboardSwitch(language, reason, retryCount = 0) {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║ [AutoLang] TRIGGERING KEYBOARD SWITCH         ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log('║ Target Language:', language.padEnd(32), '║');
  console.log('║ Reason:', reason.padEnd(39), '║');

  const filename = language === 'hebrew'
    ? 'autolang_switch_to_hebrew.trigger'
    : 'autolang_switch_to_english.trigger';

  // Super simple text content
  const content = language;

  // Try text/plain with simple base64
  const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`;

  chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: false,
    conflictAction: 'overwrite'
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.log('║ ✗ Download blocked by Chrome security        ║');
      console.log('║', chrome.runtime.lastError.message.substring(0, 44).padEnd(44), '║');
      console.log('╚════════════════════════════════════════════════╝');
    } else if (downloadId) {
      console.log('║ ✓ Download initiated (ID:', String(downloadId).padEnd(23), ')║');
      console.log('╚════════════════════════════════════════════════╝');
    }
  });
}

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const hadLanguage = tabLanguages.has(tabId);
  tabLanguages.delete(tabId);
  if (hadLanguage) {
    console.log('[AutoLang] Tab', tabId, 'closed, removed from memory');
    console.log('[AutoLang] Remaining tabs:', tabLanguages.size);
    saveTabLanguagesToStorage();
  }
});

// Listen for tab updates (page navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const storedLang = tabLanguages.get(tabId);
    if (storedLang) {
      // Badge disabled - user doesn't want visual indicators
      // chrome.action.setBadgeText({
      //   text: storedLang === 'hebrew' ? 'עב' : 'EN',
      //   tabId: tabId
      // });

      // chrome.action.setBadgeBackgroundColor({
      //   color: storedLang === 'hebrew' ? '#0066cc' : '#00aa00',
      //   tabId: tabId
      // });
    }
  }
});

// Try to disable download shelf (may not work in all Chrome versions)
if (chrome.downloads && chrome.downloads.setShelfEnabled) {
  chrome.downloads.setShelfEnabled(false);
  console.log('[AutoLang] Download shelf disabled');
}

console.log('[AutoLang] Background service worker initialized ✓');
console.log('[AutoLang] Listening for tab switches and language updates...');
