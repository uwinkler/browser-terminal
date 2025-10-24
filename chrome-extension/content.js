// Content Script für Keyboard Shortcuts
// Läuft auf allen Webseiten und fängt Tastenkombinationen ab

let settings = null;

// Einstellungen beim Start laden
loadSettings();

// Keyboard Event Listener
document.addEventListener('keydown', handleKeydown, true);

// Tastenkombination verarbeiten
function handleKeydown(event) {
  if (!settings) return;
  
  // Standard-Shortcut: Cmd+. (macOS) oder Ctrl+. (Windows/Linux)
  const isMainShortcut = (
    ((event.metaKey && navigator.platform.includes('Mac')) || 
     (event.ctrlKey && !navigator.platform.includes('Mac'))) &&
    event.code === 'Period' &&
    !event.shiftKey &&
    !event.altKey
  );
  
  // Custom Shortcut prüfen (falls konfiguriert)
  const isCustomShortcut = checkCustomShortcut(event);
  
  if (isMainShortcut || isCustomShortcut) {
    event.preventDefault();
    event.stopPropagation();
    
    // Terminal öffnen über Background Script
    chrome.runtime.sendMessage({
      action: 'openTerminal'
    }, (response) => {
      if (response && response.success) {
        console.log('Terminal erfolgreich geöffnet');
      } else {
        console.error('Fehler beim Öffnen des Terminals');
      }
    });
  }
}

// Custom Shortcut prüfen
function checkCustomShortcut(event) {
  if (!settings.customShortcut) return false;
  
  try {
    const shortcut = parseShortcut(settings.customShortcut);
    
    return (
      event.ctrlKey === shortcut.ctrl &&
      event.altKey === shortcut.alt &&
      event.shiftKey === shortcut.shift &&
      event.metaKey === shortcut.meta &&
      event.code === shortcut.key
    );
  } catch (error) {
    console.error('Fehler beim Parsen des Custom Shortcuts:', error);
    return false;
  }
}

// Shortcut-String parsen (z.B. "Ctrl+Alt+T")
function parseShortcut(shortcutString) {
  const parts = shortcutString.split('+').map(part => part.trim());
  
  const shortcut = {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
    key: null
  };
  
  for (const part of parts) {
    switch (part.toLowerCase()) {
      case 'ctrl':
      case 'control':
        shortcut.ctrl = true;
        break;
      case 'alt':
        shortcut.alt = true;
        break;
      case 'shift':
        shortcut.shift = true;
        break;
      case 'cmd':
      case 'command':
      case 'meta':
        shortcut.meta = true;
        break;
      default:
        // Key mapping
        shortcut.key = mapKeyToCode(part);
    }
  }
  
  return shortcut;
}

// Key-Namen zu KeyCodes mappen
function mapKeyToCode(keyName) {
  const keyMap = {
    '.': 'Period',
    ',': 'Comma',
    ';': 'Semicolon',
    '/': 'Slash',
    '`': 'Backquote',
    '-': 'Minus',
    '=': 'Equal',
    '[': 'BracketLeft',
    ']': 'BracketRight',
    '\\': 'Backslash',
    "'": 'Quote',
    'space': 'Space',
    'enter': 'Enter',
    'tab': 'Tab',
    'escape': 'Escape',
    'backspace': 'Backspace',
    'delete': 'Delete',
    'insert': 'Insert',
    'home': 'Home',
    'end': 'End',
    'pageup': 'PageUp',
    'pagedown': 'PageDown',
    'arrowup': 'ArrowUp',
    'arrowdown': 'ArrowDown',
    'arrowleft': 'ArrowLeft',
    'arrowright': 'ArrowRight'
  };
  
  // Einzelne Buchstaben
  if (keyName.length === 1 && keyName.match(/[a-zA-Z]/)) {
    return 'Key' + keyName.toUpperCase();
  }
  
  // Zahlen
  if (keyName.length === 1 && keyName.match(/[0-9]/)) {
    return 'Digit' + keyName;
  }
  
  // F-Tasten
  if (keyName.match(/^f([1-9]|1[0-2])$/i)) {
    return 'F' + keyName.substring(1);
  }
  
  return keyMap[keyName.toLowerCase()] || keyName;
}

// Einstellungen laden
async function loadSettings() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getSettings'
    });
    
    if (response && response.settings) {
      settings = response.settings;
      console.log('Settings geladen:', settings);
    }
  } catch (error) {
    console.error('Fehler beim Laden der Settings:', error);
  }
}

// Settings-Updates überwachen
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'settingsUpdated') {
    loadSettings();
    sendResponse({ success: true });
  }
});

// Hilfe-Modal für Shortcuts (optional)
function showShortcutHelp() {
  const helpModal = document.createElement('div');
  helpModal.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #2d2d2d;
    color: #fff;
    padding: 15px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 300px;
  `;
  
  helpModal.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 10px;">🖥️ Terminal Shortcuts</div>
    <div>Standard: <kbd>Cmd+.</kbd> (macOS) / <kbd>Ctrl+.</kbd> (Windows)</div>
    <div style="margin-top: 5px; font-size: 10px; opacity: 0.7;">
      Extension: Web Terminal Launcher
    </div>
  `;
  
  document.body.appendChild(helpModal);
  
  setTimeout(() => {
    if (helpModal.parentNode) {
      helpModal.parentNode.removeChild(helpModal);
    }
  }, 3000);
}

// Debug: Keyboard events loggen (nur in Development)
if (process.env.NODE_ENV === 'development') {
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey) {
      console.log('Key pressed:', {
        code: event.code,
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey
      });
    }
  });
}