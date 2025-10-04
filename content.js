// Content script for AutoLang extension

let currentLanguage = 'english';
let indicator = null;
let hideTimeout = null;
let fieldLanguages = new Map(); // Store language per field
let currentField = null;

// Simple per-tab mode: track language per tab via Alt+Shift, disable per-field logic
const SIMPLE_PER_TAB_MODE = true;

// WhatsApp per-contact mode: remember language for each WhatsApp contact
const WHATSAPP_PER_CONTACT_MODE = true;

// Detect if we're on WhatsApp Web
function isWhatsAppWeb() {
  return window.location.hostname === 'web.whatsapp.com';
}

console.log('═══════════════════════════════════════════════════');
console.log('[AutoLang Content] Script loaded on:', window.location.href);
console.log('[AutoLang Content] Time:', new Date().toLocaleTimeString());
console.log('[AutoLang Content] Mode:', SIMPLE_PER_TAB_MODE ? 'SIMPLE_PER_TAB' : 'PER_FIELD');
console.log('[AutoLang Content] WhatsApp Mode:', isWhatsAppWeb() && WHATSAPP_PER_CONTACT_MODE ? 'ENABLED' : 'DISABLED');
console.log('═══════════════════════════════════════════════════');

// WhatsApp contact tracking
let whatsappContactLanguages = new Map(); // contactId -> language
let currentWhatsAppContact = null;
let lastWhatsAppContactCheck = 0;

// Get current WhatsApp contact/chat identifier
function getCurrentWhatsAppContact() {
  if (!isWhatsAppWeb()) return null;

  // Method 1: Try to get from header (contact name or group name)
  const headerSelectors = [
    'header [role="button"] span[dir="auto"]', // Contact/group name in header
    'header span[title]', // Alternative selector
    'div[data-tab="1"] span.x1iyjqo2', // Active chat name
  ];

  for (const selector of headerSelectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent && element.textContent.trim()) {
      const contactName = element.textContent.trim();
      console.log('[AutoLang WhatsApp] 🎯 Found contact via selector:', selector);
      console.log('[AutoLang WhatsApp] Contact name:', contactName);
      return contactName;
    }
  }

  // Method 2: Try to get from URL (chat ID)
  const urlMatch = window.location.href.match(/web.whatsapp.com\/.*?\/([^\/]+)/);
  if (urlMatch && urlMatch[1]) {
    console.log('[AutoLang WhatsApp] 🎯 Found contact via URL:', urlMatch[1]);
    return urlMatch[1];
  }

  // Method 3: Try to find from active chat element
  const activeChat = document.querySelector('[data-tab="1"]');
  if (activeChat) {
    // Look for any identifying text in the active chat
    const chatId = activeChat.getAttribute('data-id') ||
                   activeChat.getAttribute('data-testid') ||
                   'unknown-chat';
    console.log('[AutoLang WhatsApp] 🎯 Found chat ID from element:', chatId);
    return chatId;
  }

  console.log('[AutoLang WhatsApp] ⚠ Could not identify current contact');
  return null;
}

// Check if we switched to a different WhatsApp contact
function checkWhatsAppContactSwitch() {
  if (!isWhatsAppWeb() || !WHATSAPP_PER_CONTACT_MODE) return false;

  // Throttle checks to avoid excessive DOM queries
  const now = Date.now();
  if (now - lastWhatsAppContactCheck < 500) return false;
  lastWhatsAppContactCheck = now;

  const contact = getCurrentWhatsAppContact();
  if (!contact) return false;

  if (contact !== currentWhatsAppContact) {
    const oldContact = currentWhatsAppContact;
    currentWhatsAppContact = contact;

    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║ [AutoLang WhatsApp] CONTACT SWITCHED              ║');
    console.log('╠═══════════════════════════════════════════════════╣');
    console.log('║ Previous:', (oldContact || 'none').padEnd(40), '║');
    console.log('║ Current:', contact.padEnd(41), '║');

    // Check if we have a remembered language for this contact
    const storageKey = `whatsapp_contact_${contact}`;

    // First check memory
    if (whatsappContactLanguages.has(contact)) {
      const rememberedLang = whatsappContactLanguages.get(contact);
      console.log('║ ✓ Found in memory:', rememberedLang.padEnd(30), '║');
      console.log('║ >> SWITCHING KEYBOARD TO:', rememberedLang.padEnd(24), '║');
      console.log('╚═══════════════════════════════════════════════════╝');

      currentLanguage = rememberedLang;
      showIndicator(rememberedLang, false);
      requestKeyboardSwitch(rememberedLang);
      return true;
    }

    // Then check storage
    safeStorageGet([storageKey], (result) => {
      if (result && result[storageKey]) {
        const rememberedLang = result[storageKey];
        whatsappContactLanguages.set(contact, rememberedLang);
        console.log('║ ✓ Found in storage:', rememberedLang.padEnd(30), '║');
        console.log('║ >> SWITCHING KEYBOARD TO:', rememberedLang.padEnd(24), '║');
        console.log('╚═══════════════════════════════════════════════════╝');

        currentLanguage = rememberedLang;
        showIndicator(rememberedLang, false);
        requestKeyboardSwitch(rememberedLang);
      } else {
        console.log('║ ⚠ No language remembered for this contact        ║');
        console.log('║ (Will learn when you start typing)               ║');
        console.log('╚═══════════════════════════════════════════════════╝');
      }
    });

    return true;
  }

  return false;
}

// Save language for current WhatsApp contact
function saveWhatsAppContactLanguage(language) {
  if (!isWhatsAppWeb() || !WHATSAPP_PER_CONTACT_MODE) return;

  const contact = getCurrentWhatsAppContact();
  if (!contact) return;

  // Only save if we have typed enough characters (avoid saving on accidental single char)
  if (languageDetectionBuffer.length < 3) return;

  // Check if this is a new language for this contact
  const existingLang = whatsappContactLanguages.get(contact);
  if (existingLang === language) return; // Already saved

  console.log('[AutoLang WhatsApp] 💾 Saving language for contact:', contact, '→', language);
  whatsappContactLanguages.set(contact, language);

  // Save to persistent storage
  const storageKey = `whatsapp_contact_${contact}`;
  safeStorageSet(storageKey, language);
}

// Detect if text contains Hebrew characters
function isHebrew(text) {
  const hebrewRegex = /[\u0590-\u05FF]/;
  return hebrewRegex.test(text);
}

// Detect if text contains English characters
function isEnglish(text) {
  const englishRegex = /[a-zA-Z]/;
  return englishRegex.test(text);
}

// ----- Safe Chrome API helpers to avoid "Extension context invalidated" -----
function isExtensionContextValid() {
  try {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  } catch (e) {
    return false;
  }
}

function safeSendMessage(message, callback) {
  if (!isExtensionContextValid()) {
    console.log('[AutoLang Content] (skip) sendMessage: extension context invalid');
    return;
  }
  try {
    chrome.runtime.sendMessage(message, (response) => {
      // Swallow lastError to prevent console exceptions during reloads
      const err = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
      if (err) {
        console.log('[AutoLang Content] sendMessage lastError:', err);
      }
      if (typeof callback === 'function') {
        try { callback(response); } catch (e) {}
      }
    });
  } catch (e) {
    console.log('[AutoLang Content] sendMessage threw (likely reload):', e && e.message ? e.message : e);
  }
}

function safeStorageSet(key, value) {
  if (!isExtensionContextValid() || !chrome.storage || !chrome.storage.local) {
    console.log('[AutoLang Content] (skip) storage.set: extension context invalid');
    return;
  }
  try {
    chrome.storage.local.set({ [key]: value }, () => {
      const err = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
      if (err) {
        console.log('[AutoLang Content] storage.set lastError:', err);
      } else {
        console.log('[AutoLang Content] ✓ Saved to storage:', key, '=', value);
      }
    });
  } catch (e) {
    console.log('[AutoLang Content] storage.set threw:', e && e.message ? e.message : e);
  }
}

function safeStorageGet(keys, callback) {
  if (!isExtensionContextValid() || !chrome.storage || !chrome.storage.local) {
    console.log('[AutoLang Content] (skip) storage.get: extension context invalid');
    return;
  }
  try {
    chrome.storage.local.get(keys, (result) => {
      const err = chrome.runtime && chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
      if (err) {
        console.log('[AutoLang Content] storage.get lastError:', err);
        return;
      }
      try { callback(result); } catch (e) {}
    });
  } catch (e) {
    console.log('[AutoLang Content] storage.get threw:', e && e.message ? e.message : e);
  }
}

// Generate unique identifier for a field
function getFieldIdentifier(element) {
  // Try to create a stable identifier for this field
  let identifier = '';
  
  // Use ID if available
  if (element.id) {
    identifier = `#${element.id}`;
  } 
  // Use name attribute
  else if (element.name) {
    identifier = `[name="${element.name}"]`;
  }
  // Use combination of tag, class, and position
  else {
    const tag = element.tagName.toLowerCase();
    const className = element.className ? `.${element.className.split(' ')[0]}` : '';
    
    // Try to get a stable path
    let parent = element.parentElement;
    let parentId = '';
    
    // Look for parent with ID (up to 3 levels)
    for (let i = 0; i < 3 && parent; i++) {
      if (parent.id) {
        parentId = `#${parent.id} `;
        break;
      }
      parent = parent.parentElement;
    }
    
    identifier = `${parentId}${tag}${className}`;
  }
  
  // Add page URL to make it unique per page
  const url = window.location.hostname + window.location.pathname;
  return `${url}::${identifier}`;
}

// Create floating indicator - DISABLED
function createIndicator() {
  // Completely disabled - user doesn't want visual indicators
  return;
}

// Show indicator with language
function showIndicator(language, temporary = false) {
  // DISABLED: User finds it annoying
  return;

  createIndicator();

  const isHeb = language === 'hebrew';
  indicator.textContent = isHeb ? '🔤 עברית' : '🔤 English';
  indicator.style.background = isHeb
    ? 'linear-gradient(135deg, #0066cc 0%, #0099ff 100%)'
    : 'linear-gradient(135deg, #00aa00 0%, #00dd00 100%)';
  indicator.style.opacity = '1';

  // Clear existing timeout
  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }

  // Auto-hide after 2 seconds if temporary
  if (temporary) {
    hideTimeout = setTimeout(() => {
      if (indicator) {
        indicator.style.opacity = '0';
      }
    }, 2000);
  }
}

// Hide indicator
function hideIndicator() {
  if (indicator) {
    indicator.style.opacity = '0';
  }
}

// Detect language from typed text
function detectLanguage(text) {
  if (!text || text.length < 1) return null;
  
  const hasHebrew = isHebrew(text);
  const hasEnglish = isEnglish(text);
  
  // Determine dominant language - even from single character
  if (hasHebrew && !hasEnglish) {
    return 'hebrew';
  } else if (hasEnglish && !hasHebrew) {
    return 'english';
  } else if (hasHebrew && hasEnglish) {
    // Mixed text - count characters
    const hebrewCount = (text.match(/[\u0590-\u05FF]/g) || []).length;
    const englishCount = (text.match(/[a-zA-Z]/g) || []).length;
    return hebrewCount > englishCount ? 'hebrew' : 'english';
  }
  
  return null;
}

// Update current language and notify background
function updateLanguage(newLanguage, fieldElement) {
  if (newLanguage && newLanguage !== currentLanguage) {
    console.log('[AutoLang Content] Language changed:', currentLanguage, '→', newLanguage);
    currentLanguage = newLanguage;
    
    // If we have a specific field, remember the language for this field
    if (fieldElement) {
      const fieldId = getFieldIdentifier(fieldElement);
      fieldLanguages.set(fieldId, newLanguage);
      
      console.log('[AutoLang Content] ✓ Saved to memory:', fieldId, '=', newLanguage);
      
      // Save to chrome storage (guarded)
      const storageKey = `field_${fieldId}`;
      safeStorageSet(storageKey, newLanguage);
    }
    
    // Notify background script to trigger keyboard switch
    console.log('[AutoLang Content] → Sending update to background...');
    safeSendMessage({
      action: 'updateLanguage',
      language: newLanguage,
      triggerSwitch: true
    }, (response) => {
      if (response && response.success) {
        console.log('[AutoLang Content] ✓ Background acknowledged');
      }
    });
    
    // Show indicator briefly
    showIndicator(newLanguage, true);
  }
}

// Request keyboard switch when clicking into field with remembered language
function requestKeyboardSwitch(language) {
  console.log('[AutoLang Content] → Requesting keyboard switch to:', language);
  safeSendMessage({
    action: 'switchKeyboard',
    language: language
  }, (response) => {
    if (response && response.success) {
      console.log('[AutoLang Content] ✓ Switch request sent to background');
    }
  });
}

// Listen for keyboard input
let typingBuffer = '';
let typingTimeout = null;

document.addEventListener('input', (event) => {
  if (SIMPLE_PER_TAB_MODE) {
    return; // Disable per-field detection in simple mode
  }
  const target = event.target;
  
  // Only process input fields
  if (target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.isContentEditable) {
    
    currentField = target;
    
    // Get the text that was just typed
    const text = target.value || target.textContent || '';
    
    // Detect immediately from the input
    if (text.length > 0) {
      const detected = detectLanguage(text);
      if (detected) {
        console.log('[AutoLang Content] ⌨ Typing detected:', detected, '| Text sample:', text.substring(0, 20));
        updateLanguage(detected, target);
      }
    }
  }
});

// Track last typed characters to detect actual keyboard language
let lastTypedChars = [];
let languageDetectionBuffer = '';

document.addEventListener('keydown', (event) => {
  // Ignore special keys (but NOT Alt or Shift alone)
  if (event.ctrlKey || event.metaKey) {
    return;
  }

  // Simple per-tab mode: detect Alt+Shift toggle and update tab language
  if (SIMPLE_PER_TAB_MODE) {
    const isAltShiftToggle =
      (event.key === 'Shift' && event.altKey) ||
      (event.key === 'Alt' && event.shiftKey);
    if (isAltShiftToggle) {
      const toggled = currentLanguage === 'hebrew' ? 'english' : 'hebrew';
      currentLanguage = toggled;
      console.log('[AutoLang Content] ⌨ Alt+Shift detected → toggled to:', toggled);
      // Update background but do NOT trigger switch (user already did it)
      safeSendMessage({
        action: 'updateLanguage',
        language: toggled,
        triggerSwitch: false
      }, (response) => {
        if (response && response.success) {
          console.log('[AutoLang Content] ✓ Background updated for tab language');
        }
      });
      showIndicator(toggled, true);
      // Clear detection buffer when user manually switches
      languageDetectionBuffer = '';
      return;
    }

    // CRITICAL: Detect actual language from typed characters
    // This is the REAL language detection - what keyboard layout is actually active
    if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      const typedChar = event.key;
      languageDetectionBuffer += typedChar;

      // Keep only last 10 characters
      if (languageDetectionBuffer.length > 10) {
        languageDetectionBuffer = languageDetectionBuffer.slice(-10);
      }

      const detectedLang = detectLanguage(typedChar);
      if (detectedLang && detectedLang !== currentLanguage) {
        console.log('╔════════════════════════════════════════════════╗');
        console.log('║ [AutoLang Content] LANGUAGE MISMATCH DETECTED  ║');
        console.log('╠════════════════════════════════════════════════╣');
        console.log('║ We thought language was:', currentLanguage.padEnd(23), '║');
        console.log('║ But user typed:', detectedLang.padEnd(30), '║');
        console.log('║ Typed character:', typedChar.padEnd(29), '║');
        console.log('║ → CORRECTING OUR UNDERSTANDING                 ║');
        console.log('╚════════════════════════════════════════════════╝');

        currentLanguage = detectedLang;
        safeSendMessage({
          action: 'updateLanguage',
          language: detectedLang,
          triggerSwitch: false // User is already in this language!
        }, (response) => {
          if (response && response.success) {
            console.log('[AutoLang Content] ✓ Background corrected to actual language');
          }
        });
        showIndicator(detectedLang, true);

        // Save to WhatsApp contact memory if applicable
        saveWhatsAppContactLanguage(detectedLang);
      } else if (detectedLang && detectedLang === currentLanguage) {
        // Language confirmed - still save to WhatsApp contact
        saveWhatsAppContactLanguage(detectedLang);
      }
    }

    return; // Skip per-field detection path
  }
  
  const key = event.key;
  const target = event.target;
  
  // Only process input fields
  if (target && (target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.isContentEditable)) {
    
    currentField = target;
    
    // Detect immediately from the key pressed
    if (key.length === 1) {
      const detected = detectLanguage(key);
      if (detected) {
        console.log('[AutoLang Content] ⌨ Key detected:', detected, '| Key:', key);
        updateLanguage(detected, target);
      }
    }
  }
});

// Listen for clicks on WhatsApp contacts (to detect contact switches)
document.addEventListener('click', (event) => {
  if (isWhatsAppWeb() && WHATSAPP_PER_CONTACT_MODE) {
    // Check if contact switched after a short delay (DOM needs to update)
    setTimeout(() => checkWhatsAppContactSwitch(), 300);
  }
}, true);

// Also check on focusin for WhatsApp message input
document.addEventListener('focusin', async (event) => {
  const target = event.target;

  // WhatsApp specific: check for contact switch when focusing on message input
  if (isWhatsAppWeb() && WHATSAPP_PER_CONTACT_MODE) {
    const isMessageInput = target.getAttribute('contenteditable') === 'true' ||
                          target.getAttribute('role') === 'textbox' ||
                          target.classList.contains('selectable-text');

    if (isMessageInput) {
      console.log('[AutoLang WhatsApp] 📝 Focused on message input');
      checkWhatsAppContactSwitch();
    }
  }
  
  if (SIMPLE_PER_TAB_MODE) {
    // In simple mode, just show current tab language when focusing any field
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable) {
      showIndicator(currentLanguage, true);
    }
    return;
  }
  
  if (target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.isContentEditable) {
    
    currentField = target;
    const fieldId = getFieldIdentifier(target);
    
    console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
    console.log('┃ [AutoLang Content] FIELD FOCUSED            ┃');
    console.log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫');
    console.log('  Field Type:', target.tagName);
    console.log('  Field ID:', target.id || 'none');
    console.log('  Field Name:', target.name || 'none');
    console.log('  Unique ID:', fieldId);
    console.log('  Time:', new Date().toLocaleTimeString());
    
    // First check in-memory cache
    if (fieldLanguages.has(fieldId)) {
      const rememberedLang = fieldLanguages.get(fieldId);
      currentLanguage = rememberedLang;
      
      console.log('  ✓ REMEMBERED LANGUAGE:', rememberedLang);
      console.log('  >> REQUESTING KEYBOARD SWITCH TO:', rememberedLang);
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      showIndicator(rememberedLang, false); // Keep showing
      
      // REQUEST AUTOMATIC KEYBOARD SWITCH!
      requestKeyboardSwitch(rememberedLang);
      return;
    }
    
    console.log('  ⚠ No remembered language (checking storage...)');
    
    // Then check chrome storage
  const storageKey = `field_${fieldId}`;
  safeStorageGet([storageKey], (result) => {
    if (result && result[storageKey]) {
        const rememberedLang = result[storageKey];
        fieldLanguages.set(fieldId, rememberedLang);
        currentLanguage = rememberedLang;
        
        console.log('  ✓ FOUND IN STORAGE:', rememberedLang);
        console.log('  >> REQUESTING KEYBOARD SWITCH TO:', rememberedLang);
        console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
        
        showIndicator(rememberedLang, false); // Keep showing
        
        // REQUEST AUTOMATIC KEYBOARD SWITCH!
        requestKeyboardSwitch(rememberedLang);
        return;
      }
      
      console.log('  ⚠ No stored language for this field');
      console.log('  (Will learn when you start typing)');
      console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
      
      // If no stored language, try to detect from existing text
      const existingText = target.value || target.textContent || '';
      if (existingText.length > 3) {
        const detected = detectLanguage(existingText);
        if (detected) {
          console.log('  ✓ Detected from existing text:', detected);
          updateLanguage(detected, target);
        }
      }
    });
  }
});

// Check if user is typing in wrong language
function checkLanguageMismatch(typedChar, expectedLang) {
  const isHebrewChar = isHebrew(typedChar);
  const isEnglishChar = isEnglish(typedChar);
  
  if (expectedLang === 'hebrew' && isEnglishChar) {
    return 'english'; // User typed English but field expects Hebrew
  } else if (expectedLang === 'english' && isHebrewChar) {
    return 'hebrew'; // User typed Hebrew but field expects English
  }
  
  return null; // No mismatch
}

// Show big warning overlay - DISABLED
function showLanguageWarning(expectedLang, typedLang) {
  // Completely disabled - user doesn't want any popups
  return;

  // Create warning overlay
  let warningOverlay = document.getElementById('autolang-warning');
  
  if (!warningOverlay) {
    warningOverlay = document.createElement('div');
    warningOverlay.id = 'autolang-warning';
    warningOverlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 40px 60px;
      background: linear-gradient(135deg, #ff4444 0%, #cc0000 100%);
      color: white;
      border-radius: 16px;
      font-family: Arial, sans-serif;
      font-size: 32px;
      font-weight: bold;
      z-index: 9999999;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      text-align: center;
      animation: shake 0.5s;
      border: 4px solid white;
    `;
    document.body.appendChild(warningOverlay);
    
    // Add shake animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
        25% { transform: translate(-50%, -50%) rotate(-5deg); }
        75% { transform: translate(-50%, -50%) rotate(5deg); }
      }
    `;
    document.head.appendChild(style);
  }
  
  const expectedName = expectedLang === 'hebrew' ? 'עברית' : 'English';
  const typedName = typedLang === 'hebrew' ? 'עברית' : 'English';
  
  warningOverlay.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px;">⚠️ WRONG LANGUAGE! ⚠️</div>
    <div style="font-size: 24px; margin-bottom: 15px;">
      This field expects: <span style="color: #ffff00;">${expectedName}</span>
    </div>
    <div style="font-size: 24px; margin-bottom: 25px;">
      You're typing in: <span style="color: #ffaaaa;">${typedName}</span>
    </div>
    <div style="font-size: 36px; background: white; color: #cc0000; padding: 15px; border-radius: 8px; animation: pulse 1s infinite;">
      ⌨️ PRESS ALT+SHIFT NOW! ⌨️
    </div>
  `;
  
  warningOverlay.style.display = 'block';
  
  // Add pulse animation
  const pulseStyle = document.createElement('style');
  pulseStyle.textContent = `
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
  `;
  document.head.appendChild(pulseStyle);
}

// Hide warning
function hideLanguageWarning() {
  const warningOverlay = document.getElementById('autolang-warning');
  if (warningOverlay) {
    warningOverlay.style.display = 'none';
  }
}

// Listen for messages from background script
try {
  if (isExtensionContextValid()) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('[AutoLang Content] ← Received message:', request.action, '| language:', request.language);

      if (request.action === 'showLanguageIndicator') {
        currentLanguage = request.language;
        console.log('[AutoLang Content] Updated currentLanguage to:', currentLanguage);
        showIndicator(request.language, true);
        sendResponse({ success: true });
      } else if (request.action === 'setLanguage') {
        // Manual language change from popup OR tab switch from background
        const oldLang = currentLanguage;
        currentLanguage = request.language;
        console.log('[AutoLang Content] Language updated:', oldLang, '→', currentLanguage);
        showIndicator(request.language, true);
        sendResponse({ success: true });
      }
      return true;
    });
  }
} catch (e) {
  console.log('[AutoLang Content] onMessage listener not attached:', e && e.message ? e.message : e);
}

// Get initial language for this tab (guarded) - with retry logic
function initializeLanguage(retries = 3) {
  console.log('[AutoLang Content] Requesting initial language from background...');
  safeSendMessage({ action: 'getLanguage' }, (response) => {
    if (response && response.language) {
      currentLanguage = response.language;
      console.log('[AutoLang Content] ✓ Initial language set to:', currentLanguage);
      showIndicator(currentLanguage, true);
    } else if (retries > 0) {
      console.log('[AutoLang Content] ⚠ No response, retrying... (', retries, 'left)');
      setTimeout(() => initializeLanguage(retries - 1), 200);
    } else {
      console.log('[AutoLang Content] ✗ Failed to get initial language, defaulting to english');
      currentLanguage = 'english';
    }
  });
}

// Initialize after a short delay to ensure background is ready
setTimeout(() => initializeLanguage(), 100);

// Listen for page visibility changes to re-sync language state
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('[AutoLang Content] ━━━ Page became visible ━━━');
    console.log('[AutoLang Content] Re-syncing language state...');
    // Re-query the background for current tab language
    initializeLanguage(1);
  }
});

// Add global debug functions
window.autoLangDebug = {
  getCurrentLanguage: () => {
    console.log('═══════════════════════════════════════════════════');
    console.log('[AutoLang Debug] Current Language:', currentLanguage);
    console.log('[AutoLang Debug] Detection Buffer:', languageDetectionBuffer);
    console.log('═══════════════════════════════════════════════════');
    return currentLanguage;
  },
  setLanguage: (lang) => {
    if (lang !== 'hebrew' && lang !== 'english') {
      console.error('[AutoLang Debug] Invalid language. Use "hebrew" or "english"');
      return;
    }
    currentLanguage = lang;
    console.log('[AutoLang Debug] Manually set language to:', lang);
    safeSendMessage({
      action: 'updateLanguage',
      language: lang,
      triggerSwitch: false
    });
    showIndicator(lang, true);
  },
  showState: () => {
    console.log('═══════════════════════════════════════════════════');
    console.log('[AutoLang Debug] Current State:');
    console.log('  Mode:', SIMPLE_PER_TAB_MODE ? 'SIMPLE_PER_TAB' : 'PER_FIELD');
    console.log('  Current Language:', currentLanguage);
    console.log('  Detection Buffer:', languageDetectionBuffer);
    console.log('  Page URL:', window.location.href);
    if (isWhatsAppWeb() && WHATSAPP_PER_CONTACT_MODE) {
      console.log('  WhatsApp Mode: ENABLED');
      console.log('  Current Contact:', currentWhatsAppContact || 'none');
      console.log('  Contacts Tracked:', whatsappContactLanguages.size);
      if (whatsappContactLanguages.size > 0) {
        console.log('  Contact Languages:');
        whatsappContactLanguages.forEach((lang, contact) => {
          console.log('    -', contact.substring(0, 30), '→', lang);
        });
      }
    }
    console.log('═══════════════════════════════════════════════════');
  },
  // WhatsApp specific commands
  whatsapp: {
    getCurrentContact: () => {
      const contact = getCurrentWhatsAppContact();
      console.log('[AutoLang WhatsApp Debug] Current contact:', contact);
      return contact;
    },
    showContactLanguages: () => {
      console.log('═══════════════════════════════════════════════════');
      console.log('[AutoLang WhatsApp Debug] Saved Contact Languages:');
      console.log('Total contacts:', whatsappContactLanguages.size);
      whatsappContactLanguages.forEach((lang, contact) => {
        console.log('  ', contact, '→', lang);
      });
      console.log('═══════════════════════════════════════════════════');
    },
    forceContactSwitch: () => {
      console.log('[AutoLang WhatsApp Debug] Forcing contact switch check...');
      checkWhatsAppContactSwitch();
    },
    clearContactMemory: () => {
      whatsappContactLanguages.clear();
      console.log('[AutoLang WhatsApp Debug] Contact memory cleared');
    }
  }
};

console.log('[AutoLang Content] Content script initialization complete');
console.log('[AutoLang Content] 💡 Debug commands available:');
console.log('[AutoLang Content]    autoLangDebug.getCurrentLanguage()');
console.log('[AutoLang Content]    autoLangDebug.setLanguage("hebrew" or "english")');
console.log('[AutoLang Content]    autoLangDebug.showState()');
if (isWhatsAppWeb() && WHATSAPP_PER_CONTACT_MODE) {
  console.log('[AutoLang Content] 💡 WhatsApp commands:');
  console.log('[AutoLang Content]    autoLangDebug.whatsapp.getCurrentContact()');
  console.log('[AutoLang Content]    autoLangDebug.whatsapp.showContactLanguages()');
  console.log('[AutoLang Content]    autoLangDebug.whatsapp.forceContactSwitch()');
}
