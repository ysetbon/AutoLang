// Popup script for AutoLang extension

document.addEventListener('DOMContentLoaded', async () => {
  const currentLanguageEl = document.getElementById('currentLanguage');
  const btnHebrew = document.getElementById('btnHebrew');
  const btnEnglish = document.getElementById('btnEnglish');
  
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Function to update display
  function updateDisplay(language) {
    if (language === 'hebrew') {
      currentLanguageEl.textContent = '🔤 עברית';
      currentLanguageEl.className = 'status-value language-hebrew';
    } else {
      currentLanguageEl.textContent = '🔤 English';
      currentLanguageEl.className = 'status-value language-english';
    }
  }
  
  // Request language from background script for this specific tab
  chrome.runtime.sendMessage({ 
    action: 'getLanguageForTab',
    tabId: tab.id
  }, (response) => {
    if (response && response.language) {
      updateDisplay(response.language);
    } else {
      // Default to English if no language set yet
      updateDisplay('english');
    }
  });
  
  // Set language to Hebrew
  btnHebrew.addEventListener('click', async () => {
    try {
      // Send to background script
      chrome.runtime.sendMessage({
        action: 'updateLanguageForTab',
        tabId: tab.id,
        language: 'hebrew'
      });
      
      // Try to also send to content script
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'setLanguage',
          language: 'hebrew'
        });
      } catch (e) {
        // Content script might not be ready
      }
      
      updateDisplay('hebrew');
      
      // Show feedback
      btnHebrew.textContent = '✓ עברית';
      setTimeout(() => {
        btnHebrew.textContent = 'עברית';
      }, 1000);
    } catch (error) {
      console.error('Error setting Hebrew:', error);
    }
  });
  
  // Set language to English
  btnEnglish.addEventListener('click', async () => {
    try {
      // Send to background script
      chrome.runtime.sendMessage({
        action: 'updateLanguageForTab',
        tabId: tab.id,
        language: 'english'
      });
      
      // Try to also send to content script
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'setLanguage',
          language: 'english'
        });
      } catch (e) {
        // Content script might not be ready
      }
      
      updateDisplay('english');
      
      // Show feedback
      btnEnglish.textContent = '✓ English';
      setTimeout(() => {
        btnEnglish.textContent = 'English';
      }, 1000);
    } catch (error) {
      console.error('Error setting English:', error);
    }
  });
});
