// Options Page JavaScript

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupEventListeners();
    setupKeyboardTester();
});

let currentSettings = null;

// Default Settings
const DEFAULT_SETTINGS = {
    terminalUrl: 'http://localhost:3000',
    shortcut: 'Command+Period',
    customShortcut: '',
    autoGroup: true,
    groupName: '🖥️ Terminals',
    groupColor: 'blue'
};

// Event Listeners Setup
function setupEventListeners() {
    // Save Settings
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    
    // Reset Settings
    document.getElementById('resetSettings').addEventListener('click', resetSettings);
    
    // Test Terminal
    document.getElementById('testTerminal').addEventListener('click', testTerminal);
    
    // Color Picker
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', () => {
            selectColor(option.dataset.color);
        });
    });
    
    // Auto-save on input changes
    const inputs = ['terminalUrl', 'customShortcut', 'groupName', 'autoGroup'];
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', debounce(autoSave, 1000));
            element.addEventListener('change', debounce(autoSave, 1000));
        }
    });
}

// Keyboard Tester Setup
function setupKeyboardTester() {
    const tester = document.getElementById('keyboardTester');
    
    document.addEventListener('keydown', (event) => {
        if (document.activeElement === tester || tester.contains(document.activeElement)) {
            return; // Skip if focused on tester
        }
        
        // Show keyboard combination
        const combo = buildKeyCombo(event);
        if (combo && (event.ctrlKey || event.metaKey || event.altKey)) {
            event.preventDefault();
            
            tester.textContent = combo;
            tester.classList.add('active');
            
            // Auto-fill custom shortcut field
            document.getElementById('customShortcut').value = combo;
            
            setTimeout(() => {
                tester.classList.remove('active');
            }, 2000);
        }
    });
    
    // Click to focus
    tester.addEventListener('click', () => {
        tester.textContent = 'Drücke jetzt eine Tastenkombination...';
        tester.focus();
    });
}

// Build key combination string
function buildKeyCombo(event) {
    const parts = [];
    
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Cmd');
    
    // Add main key
    const key = getKeyName(event);
    if (key && !['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        parts.push(key);
    }
    
    return parts.length > 1 ? parts.join('+') : null;
}

// Get human-readable key name
function getKeyName(event) {
    const keyMap = {
        'Period': '.',
        'Comma': ',',
        'Semicolon': ';',
        'Slash': '/',
        'Backquote': '`',
        'Minus': '-',
        'Equal': '=',
        'BracketLeft': '[',
        'BracketRight': ']',
        'Backslash': '\\',
        'Quote': "'",
        'Space': 'Space',
        'Enter': 'Enter',
        'Tab': 'Tab',
        'Escape': 'Escape',
        'Backspace': 'Backspace',
        'Delete': 'Delete',
        'Insert': 'Insert',
        'Home': 'Home',
        'End': 'End',
        'PageUp': 'PageUp',
        'PageDown': 'PageDown',
        'ArrowUp': 'ArrowUp',
        'ArrowDown': 'ArrowDown',
        'ArrowLeft': 'ArrowLeft',
        'ArrowRight': 'ArrowRight'
    };
    
    // Function keys
    if (event.code.startsWith('F') && event.code.match(/^F([1-9]|1[0-2])$/)) {
        return event.code;
    }
    
    // Letter keys
    if (event.code.startsWith('Key')) {
        return event.code.substring(3);
    }
    
    // Number keys
    if (event.code.startsWith('Digit')) {
        return event.code.substring(5);
    }
    
    return keyMap[event.code] || event.key;
}

// Load Settings
async function loadSettings() {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'getSettings'
        });
        
        if (response && response.settings) {
            currentSettings = { ...DEFAULT_SETTINGS, ...response.settings };
            updateUI();
        } else {
            currentSettings = { ...DEFAULT_SETTINGS };
            updateUI();
        }
    } catch (error) {
        console.error('Fehler beim Laden der Settings:', error);
        showStatus('❌ Fehler beim Laden der Einstellungen', 'error');
    }
}

// Update UI
function updateUI() {
    if (!currentSettings) return;
    
    // Form fields
    document.getElementById('terminalUrl').value = currentSettings.terminalUrl || '';
    document.getElementById('customShortcut').value = currentSettings.customShortcut || '';
    document.getElementById('groupName').value = currentSettings.groupName || '';
    document.getElementById('autoGroup').checked = currentSettings.autoGroup !== false;
    
    // Color selection
    selectColor(currentSettings.groupColor || 'blue');
}

// Select Color
function selectColor(color) {
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    const selectedOption = document.querySelector(`[data-color="${color}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
}

// Save Settings
async function saveSettings() {
    try {
        const settings = {
            terminalUrl: document.getElementById('terminalUrl').value || DEFAULT_SETTINGS.terminalUrl,
            customShortcut: document.getElementById('customShortcut').value || '',
            groupName: document.getElementById('groupName').value || DEFAULT_SETTINGS.groupName,
            autoGroup: document.getElementById('autoGroup').checked,
            groupColor: document.querySelector('.color-option.selected')?.dataset.color || 'blue'
        };
        
        const response = await chrome.runtime.sendMessage({
            action: 'saveSettings',
            settings: settings
        });
        
        if (response && response.success) {
            currentSettings = settings;
            showStatus('✅ Einstellungen erfolgreich gespeichert!', 'success');
            
            // Notify content scripts about settings update
            notifyContentScripts();
        } else {
            showStatus('❌ Fehler beim Speichern der Einstellungen', 'error');
        }
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        showStatus('❌ Verbindungsfehler beim Speichern', 'error');
    }
}

// Auto Save (debounced)
function autoSave() {
    saveSettings();
}

// Reset Settings
async function resetSettings() {
    if (confirm('Alle Einstellungen auf Standardwerte zurücksetzen?')) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'saveSettings',
                settings: DEFAULT_SETTINGS
            });
            
            if (response && response.success) {
                currentSettings = { ...DEFAULT_SETTINGS };
                updateUI();
                showStatus('🔄 Einstellungen zurückgesetzt', 'success');
                notifyContentScripts();
            }
        } catch (error) {
            console.error('Fehler beim Zurücksetzen:', error);
            showStatus('❌ Fehler beim Zurücksetzen', 'error');
        }
    }
}

// Test Terminal
async function testTerminal() {
    try {
        showStatus('🧪 Terminal wird getestet...', 'info');
        
        const response = await chrome.runtime.sendMessage({
            action: 'openTerminal'
        });
        
        if (response && response.success) {
            showStatus('✅ Terminal erfolgreich geöffnet!', 'success');
        } else {
            showStatus('❌ Fehler beim Öffnen des Terminals', 'error');
        }
    } catch (error) {
        console.error('Fehler beim Testen:', error);
        showStatus('❌ Testfehler', 'error');
    }
}

// Show Status
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // Auto-hide nach 4 Sekunden
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 4000);
}

// Notify Content Scripts
async function notifyContentScripts() {
    try {
        const tabs = await chrome.tabs.query({});
        
        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    action: 'settingsUpdated'
                });
            } catch (error) {
                // Ignore errors for tabs that don't have content script
            }
        }
    } catch (error) {
        console.error('Fehler beim Benachrichtigen der Content Scripts:', error);
    }
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}