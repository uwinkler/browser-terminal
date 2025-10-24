# Web Terminal Launcher - Chrome Extension

Eine Chrome-Extension, die es ermöglicht, mit **Cmd+.** (macOS) oder **Ctrl+.** (Windows/Linux) ein neues Web-Terminal zu öffnen. Alle Terminal-Tabs werden automatisch in einer Tab-Gruppe organisiert.

## 🚀 Features

- **⌨️ Globale Shortcuts**: Cmd+. oder Ctrl+. von jeder Webseite aus
- **📂 Automatische Tab-Gruppierung**: Alle Terminal-Tabs werden gruppiert
- **🎨 Anpassbare Einstellungen**: URL, Shortcuts und Gruppierung konfigurierbar
- **🖱️ Context Menu**: Rechtsklick-Option zum Terminal öffnen
- **⚡ Schnell & Leichtgewicht**: Minimaler Ressourcenverbrauch

## 📦 Installation

### Schritt 1: Extension laden

1. Öffne Chrome und gehe zu `chrome://extensions/`
2. Aktiviere den "Entwicklermodus" (oben rechts)
3. Klicke auf "Entpackte Erweiterung laden"
4. Wähle den `chrome-extension` Ordner aus

### Schritt 2: Berechtigungen bestätigen

Die Extension benötigt folgende Berechtigungen:

- **Tabs**: Zum Öffnen neuer Terminal-Tabs
- **Tab Groups**: Für automatische Gruppierung
- **Storage**: Zum Speichern der Einstellungen
- **Active Tab**: Für Context-Menu Integration

### Schritt 3: Terminal-Server starten

Stelle sicher, dass dein Web-Terminal-Server läuft:

```bash
cd /path/to/terminal-project
npm start
```

Standard-URL: `http://localhost:3000`

## 🎛️ Konfiguration

### Extension-Einstellungen öffnen:

1. **Über Icon**: Klicke auf das Extension-Icon → "⚙️ Konfiguration öffnen"
2. **Über Chrome**: `chrome://extensions/` → "Details" → "Erweiterungsoptionen"
3. **Über Popup**: Rechtsklick auf Extension-Icon → "Optionen"

### Verfügbare Einstellungen:

#### 🌐 Terminal Einstellungen

- **Terminal URL**: Die URL deines Web-Terminal Servers
  - Standard: `http://localhost:3000`
  - Beispiel: `https://terminal.meinserver.com`

#### ⌨️ Tastenkombinationen

- **Standard-Shortcut**: Cmd+. (macOS) / Ctrl+. (Windows/Linux)
- **Custom Shortcut**: Eigene Tastenkombination definieren
  - Beispiele: `Ctrl+Alt+T`, `Cmd+Shift+Period`, `Alt+F1`
- **Shortcut-Tester**: Tastenkombinationen live testen

#### 📂 Tab-Gruppierung

- **Automatische Gruppierung**: Ein/Aus schalten
- **Gruppen-Name**: Name der Tab-Gruppe (Standard: "🖥️ Terminals")
- **Gruppen-Farbe**: 8 verschiedene Farben verfügbar

## 📖 Verwendung

### Terminal öffnen:

1. **Tastenkombination**: Drücke `Cmd+.` (macOS) oder `Ctrl+.` (Windows/Linux)
2. **Extension-Icon**: Klicke auf das Icon in der Toolbar
3. **Context-Menu**: Rechtsklick auf Webseite → "🖥️ Neues Terminal öffnen"

### Automatische Funktionen:

- **Tab-Gruppierung**: Alle Terminal-Tabs werden automatisch gruppiert
- **Gruppe beibehalten**: Neue Terminals werden zur bestehenden Gruppe hinzugefügt
- **Auto-Reorganisation**: Wenn Gruppe gelöscht wird, wird sie neu erstellt

## ⌨️ Shortcut-Referenz

### Standard-Shortcuts:

- `Cmd+.` (macOS) - Terminal öffnen
- `Ctrl+.` (Windows/Linux) - Terminal öffnen

### Custom Shortcut Beispiele:

```
Ctrl+Alt+T          # Klassischer Terminal-Shortcut
Cmd+Shift+Period    # Alternative für macOS
Alt+F1              # Function-Key Kombination
Ctrl+Shift+`        # Backtick (VSCode-Style)
```

### Popup-Shortcuts:

- `Enter` - Terminal öffnen
- `Escape` - Popup schließen
- `O` - Optionen öffnen

## 🔧 Entwicklung & Debugging

### Debug-Informationen:

- **Background Script**: `chrome://extensions/` → Details → "Hintergrundseite überprüfen"
- **Content Script**: Browser DevTools Console
- **Popup**: Rechtsklick auf Icon → "Popup überprüfen"

### Häufige Probleme:

#### Extension reagiert nicht:

1. Prüfe, ob Extension aktiviert ist
2. Lade Extension neu (`chrome://extensions/`)
3. Überprüfe Konsole auf Fehler

#### Terminal öffnet sich nicht:

1. Prüfe Terminal-URL in den Einstellungen
2. Stelle sicher, dass Terminal-Server läuft
3. Teste URL direkt im Browser

#### Shortcuts funktionieren nicht:

1. Prüfe, ob andere Extensions gleiche Shortcuts verwenden
2. Teste Custom Shortcut in den Einstellungen
3. Lade Webseite neu

### Logs aktivieren:

```javascript
// In Browser DevTools Console:
localStorage.setItem('terminalExtensionDebug', 'true')
```

## 🎨 Anpassung

### Icon ändern:

Ersetze die Dateien in `/icons/`:

- `icon16.png` (16x16px)
- `icon32.png` (32x32px)
- `icon48.png` (48x48px)
- `icon128.png` (128x128px)

### Erweiterte Konfiguration:

Die Extension speichert Einstellungen in `chrome.storage.sync`:

```javascript
{
  terminalUrl: 'http://localhost:3000',
  customShortcut: '',
  autoGroup: true,
  groupName: '🖥️ Terminals',
  groupColor: 'blue'
}
```

## 📝 Changelog

### Version 1.0.0

- ✅ Globale Shortcuts (Cmd+. / Ctrl+.)
- ✅ Automatische Tab-Gruppierung
- ✅ Konfigurierbare Einstellungen
- ✅ Context-Menu Integration
- ✅ Custom Shortcuts
- ✅ Shortcut-Tester
- ✅ Multi-Color Tab-Gruppen

## 🤝 Support

Bei Problemen oder Fragen:

1. Prüfe diese README
2. Überprüfe Browser-Konsole auf Fehler
3. Teste mit Standard-Einstellungen
4. Lade Extension neu

## 📄 Lizenz

MIT License - Frei zur Verwendung und Modifikation.
