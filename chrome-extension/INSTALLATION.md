# 🚀 Chrome Extension Installation - Schritt für Schritt

## ✅ Installations-Checkliste

### 1. Terminal-Server vorbereiten

- [ ] Terminal-Server läuft auf `http://localhost:3000`
- [ ] Terminal ist im Browser erreichbar
- [ ] Teste: `title "Test"` funktioniert

### 2. Extension laden

- [ ] Öffne Chrome: `chrome://extensions/`
- [ ] Aktiviere "Entwicklermodus" (Toggle oben rechts)
- [ ] Klicke "Entpackte Erweiterung laden"
- [ ] Wähle den `chrome-extension` Ordner
- [ ] Extension erscheint in der Liste

### 3. Berechtigungen bestätigen

- [ ] "Tabs" - ✅ Bestätigt
- [ ] "Tab Groups" - ✅ Bestätigt
- [ ] "Storage" - ✅ Bestätigt
- [ ] "Active Tab" - ✅ Bestätigt

### 4. Funktionstest

- [ ] Extension-Icon ist in der Toolbar sichtbar
- [ ] Klick auf Icon öffnet Popup
- [ ] `Cmd+.` (macOS) / `Ctrl+.` (Windows) öffnet Terminal
- [ ] Mehrere Terminals werden gruppiert
- [ ] Context-Menu (Rechtsklick) zeigt Terminal-Option

### 5. Einstellungen konfigurieren

- [ ] Öffne Extension-Optionen
- [ ] Terminal-URL korrekt gesetzt
- [ ] Custom Shortcuts getestet (optional)
- [ ] Tab-Gruppierung aktiviert
- [ ] Gruppen-Name und -Farbe angepasst

## 🎯 Schnelltest

1. **Extension laden**: Drag & Drop den `chrome-extension` Ordner auf `chrome://extensions/`
2. **Shortcut testen**: Drücke `Cmd+.` auf jeder beliebigen Webseite
3. **Gruppierung prüfen**: Öffne mehrere Terminals → automatische Gruppierung
4. **Einstellungen**: Klick Extension-Icon → "Konfiguration öffnen"

## 🔧 Fehlerbehebung

### Extension lädt nicht:

- Prüfe, dass `manifest.json` vorhanden ist
- Aktiviere Entwicklermodus
- Lade Extension neu

### Shortcuts funktionieren nicht:

- Lade Webseite neu
- Prüfe andere Extensions mit gleichen Shortcuts
- Teste in Inkognito-Modus

### Terminal öffnet nicht:

- Server läuft? → `npm start` im Terminal-Projekt
- URL korrekt? → Prüfe Extension-Einstellungen
- Popup-Blocker? → Erlaube Pop-ups für Chrome

## 🎉 Erfolgreich installiert!

Die Extension ist bereit wenn:

- ✅ Icon in Toolbar sichtbar
- ✅ `Cmd+.` / `Ctrl+.` öffnet Terminal
- ✅ Terminals werden automatisch gruppiert
- ✅ Einstellungen sind zugänglich

**Viel Spaß mit deiner neuen Terminal-Extension!** 🖥️✨
