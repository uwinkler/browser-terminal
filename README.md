# Web Terminal

Eine webbasierte Terminal-Anwendung mit xterm.js, die über WebSockets eine echte Shell-Verbindung zu localhost bereitstellt.

## Features

- 🖥️ **Echtes Terminal**: Vollständige Shell-Funktionalität über den Browser
- 🌐 **WebSocket-Verbindung**: Echtzeit-Kommunikation zwischen Browser und Server
- 🎨 **Modernes Design**: Dunkles Theme mit professionellem Terminal-Look
- 📱 **Responsive**: Funktioniert auf Desktop und mobilen Geräten
- 🔗 **Web-Links**: Automatische Erkennung und Verlinkung von URLs
- ⌨️ **Keyboard Shortcuts**:
  - `Ctrl+L`: Terminal leeren
  - `Ctrl+R`: Verbindung wiederherstellen

## Installation

1. **Abhängigkeiten installieren:**

   ```bash
   npm install
   ```

2. **Server starten:**

   ```bash
   npm start
   ```

3. **Browser öffnen:**
   Navigiere zu `http://localhost:3000`

## Technische Details

### Backend (Node.js)

- **Express**: Web-Server für statische Dateien
- **Socket.IO**: WebSocket-Kommunikation
- **node-pty**: Pseudo-Terminal für echte Shell-Verbindungen

### Frontend

- **xterm.js**: Terminal-Emulation im Browser
- **Socket.IO Client**: WebSocket-Verbindung zum Server
- **Responsive CSS**: Modernes Terminal-Design

### Projektstruktur

```
/
├── server.js              # Hauptserver mit WebSocket-Logik
├── package.json           # NPM-Abhängigkeiten
├── public/                # Statische Web-Dateien
│   ├── index.html        # Haupt-HTML-Seite
│   ├── style.css         # Terminal-Styling
│   └── client.js         # Client-seitiges JavaScript
└── README.md             # Dokumentation
```

## Verwendung

1. **Terminal starten**: Server automatisch beim Laden der Seite
2. **Befehle eingeben**: Wie in einem normalen Terminal
3. **Verbindungsstatus**: Grüner Punkt = verbunden, roter Punkt = getrennt
4. **Clear Button**: Terminal-Inhalt löschen
5. **Reconnect Button**: Neue Terminal-Session starten

## Sicherheitshinweise

⚠️ **Wichtig**: Diese Anwendung stellt eine direkte Shell-Verbindung bereit.

- Nur in vertrauenswürdigen Netzwerken verwenden
- Nicht ungeschützt im Internet bereitstellen
- Für Produktionsumgebungen Authentifizierung hinzufügen

## Entwicklung

### Features hinzufügen

- Benutzerauthentifizierung
- Mehrere Terminal-Tabs
- Datei-Upload/Download
- Session-Speicherung
- Befehlshistorie

### Debugging

- Server-Logs in der Konsole
- Browser-Entwicklertools für Client-seitige Fehler
- WebSocket-Verbindung in den Netzwerk-Tools prüfen

## Lizenz

MIT License - Frei zur Verwendung und Modifikation.
