// Popup JavaScript

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupEventListeners();
});

let currentSettings = null;

// Event Listeners
function setupEventListeners() {
    // Terminal öffnen Button
    document.getElementById('openTerminal').addEventListener('click', () => {
        openTerminal();
    });
    
    // Options öffnen Button
    document.getElementById('openOptions').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
    });
    
    // Help Link
    document.getElementById('helpLink').addEventListener('click', (e) => {
        e.preventDefault();
        showHelp();
    });
}

// Terminal öffnen
async function openTerminal() {
    try {
        showStatus('Terminal wird geöffnet...', 'info');
        
        const response = await chrome.runtime.sendMessage({
            action: 'openTerminal'
        });
        
        if (response && response.success) {
            showStatus('✅ Terminal erfolgreich geöffnet!', 'success');
            setTimeout(() => {
                window.close();
            }, 1000);
        } else {
            showStatus('❌ Fehler beim Öffnen des Terminals', 'error');
        }
    } catch (error) {
        console.error('Fehler:', error);
        showStatus('❌ Verbindungsfehler', 'error');
    }
}

// Einstellungen laden
async function loadSettings() {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'getSettings'
        });
        
        if (response && response.settings) {
            currentSettings = response.settings;
            updateUI();
        }
    } catch (error) {
        console.error('Fehler beim Laden der Settings:', error);
    }
}

// UI aktualisieren
function updateUI() {
    if (!currentSettings) return;
    
    // Shortcut anzeigen
    const shortcutDisplay = document.getElementById('shortcutDisplay');
    if (currentSettings.customShortcut) {
        shortcutDisplay.textContent = currentSettings.customShortcut;
    } else {
        // Standard-Shortcut anzeigen
        const isMac = navigator.platform.includes('Mac');
        shortcutDisplay.textContent = isMac ? 'Cmd + .' : 'Ctrl + .';
    }
}

// Status anzeigen
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // Auto-hide nach 3 Sekunden
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

// Hilfe anzeigen
function showHelp() {
    const helpContent = `
🖥️ Web Terminal Launcher - Hilfe

SHORTCUTS:
• Standard: Cmd+. (macOS) / Ctrl+. (Windows)
• Funktioniert auf jeder Webseite
• Konfigurierbar in den Einstellungen

FUNKTIONEN:
• Automatische Tab-Gruppierung
• Anpassbare Terminal-URL
• Custom Shortcuts
• Context-Menu Integration

VERWENDUNG:
1. Drücke die Tastenkombination auf jeder Webseite
2. Neues Terminal öffnet sich automatisch
3. Alle Terminal-Tabs werden gruppiert

Weitere Einstellungen in der Konfiguration verfügbar.
    `;
    
    alert(helpContent);
}

// Keyboard Shortcuts im Popup
document.addEventListener('keydown', (event) => {
    // ESC zum Schließen
    if (event.key === 'Escape') {
        window.close();
    }
    
    // Enter für Terminal öffnen
    if (event.key === 'Enter') {
        openTerminal();
    }
    
    // 'o' für Options
    if (event.key === 'o' || event.key === 'O') {
        chrome.runtime.openOptionsPage();
        window.close();
    }
});