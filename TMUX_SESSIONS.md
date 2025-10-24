# 🚀 Web Terminal mit tmux-Session Management

Das Terminal-System wurde erweitert um **tmux-Session Management** mit automatischer Browser-Tab-Erstellung und Query-Parameter-Unterstützung.

## ✨ Neue Funktionalität

### 🎯 title-Kommando mit tmux-Sessions

```bash
# Erstelle/Wechsle zu tmux-Session "server"
title server

# Das passiert automatisch:
# 1. tmux-Session "server" wird erstellt oder bestehende wird verwendet
# 2. Neuer Browser-Tab öffnet sich: http://localhost:3000/?session=server  
# 3. Browser-Titel wird gesetzt: "Terminal: server"
# 4. Automatische Verbindung zur tmux-Session
```

### 📂 URL-Parameter-System

- **Standard-Terminal**: `http://localhost:3000/`
- **Mit Session**: `http://localhost:3000/?session=server`
- **Automatische Erkennung**: Session wird aus URL-Parameter gelesen
- **Window-Title**: Wird automatisch entsprechend gesetzt

### 🔄 Session-Management

1. **Session erstellen**: `title myproject`
   - Neue tmux-Session wird erstellt
   - Browser-Tab öffnet mit `/?session=myproject`
   - Window-Titel: "Terminal: myproject"

2. **Zu Session wechseln**: `title myproject` (bei bestehender Session)
   - Bestehende tmux-Session wird verwendet
   - Neuer Browser-Tab mit Session-Parameter

3. **Mehrere Sessions**: Jede Session bekommt eigenen Browser-Tab
   - `title frontend` → `/?session=frontend`
   - `title backend` → `/?session=backend`
   - `title database` → `/?session=database`

## 🛠️ Technische Details

### Server-Erweiterungen (`server.js`)
- **tmux-Integration**: Automatische Session-Erstellung/Attachment
- **Query-Parameter**: Liest `?session=name` aus URL
- **Session-Redirect**: `TITLE_SESSION:` Signal für Browser-Navigation
- **Fallback**: Bei fehlendem tmux wird normale Shell verwendet

### Client-Erweiterungen (`client.js`)
- **URL-Parameter-Parsing**: Liest Session aus Query-String
- **Window-Title**: Automatische Aktualisierung basierend auf Session
- **Session-Redirect**: Handler für automatische Navigation
- **Status-Anzeige**: Session-Name in Verbindungsstatusdiv

### Chrome Extension-Erweiterungen
- **Session-Parameter**: Query-Parameter werden bei Tab-Erstellung berücksichtigt
- **Verbesserte Gruppierung**: Bessere Erkennung von Terminal-Tabs
- **URL-Handling**: Vollständige URL-Unterstützung mit Parametern

### title-Kommando (`./title`)
- **tmux-Check**: Prüft tmux-Verfügbarkeit
- **Session-Validation**: Validiert Session-Namen
- **Signal-System**: Sendet `TITLE_SESSION:` für Browser-Integration
- **Auto-Attach**: Automatisches Wechseln zu Session

## 📖 Verwendung

### 1. Basic Session-Erstellung
```bash
# Terminal öffnen
title development

# Das erstellt:
# - tmux-Session "development"  
# - Browser-Tab: /?session=development
# - Window-Titel: "Terminal: development"
```

### 2. Mehrere Projekte parallel
```bash
# Frontend-Development
title frontend

# Backend-Development  
title backend

# Database-Management
title database

# Jede Session läuft parallel in eigenen Browser-Tabs
```

### 3. Session-Wiederverwendung
```bash
# Bestehende Session wiederverwenden
title frontend  # Wechselt zu bestehender "frontend" Session
```

### 4. Chrome Extension Integration
- **Cmd+.** (macOS) / **Ctrl+.** (Windows): Öffnet Standard-Terminal
- **Neue Sessions**: Werden automatisch zur Terminal-Tab-Gruppe hinzugefügt
- **Query-Parameter**: Werden in Extension-URLs berücksichtigt

## 🔧 Voraussetzungen

### tmux installieren:
```bash
# macOS
brew install tmux

# Ubuntu/Debian  
sudo apt-get install tmux

# CentOS/RHEL
sudo yum install tmux
```

### Ohne tmux:
- System funktioniert weiterhin
- Fallback auf normale Shell
- Session-Parameter werden ignoriert

## 🎨 Workflow-Beispiele

### Web-Development
```bash
# Frontend (React/Vue/Angular)
title frontend
npm run dev

# Backend (Node.js/Python/etc)  
title backend
npm start

# Database
title database
mysql -u root -p

# Jede Session in eigenem Browser-Tab mit entsprechendem Titel
```

### Server-Management
```bash
# Production Server
title production
ssh user@prod-server

# Staging Server
title staging  
ssh user@staging-server

# Local Development
title local
docker-compose up
```

## 🚀 Erweiterte Features

### Session-Namen-Validierung
- Nur alphanumerische Zeichen, Unterstriche und Bindestriche
- Automatische Fehlerbehandlung bei ungültigen Namen

### Automatische Navigation
- Browser navigiert automatisch zu Session-URL
- Bestehende Verbindung wird sauber getrennt
- Neue Verbindung mit Session-Parameter wird aufgebaut

### Intelligente Tab-Gruppierung
- Sessions werden zur gleichen Terminal-Gruppe hinzugefügt
- Query-Parameter werden in Gruppierung berücksichtigt
- Bestehende Gruppen werden wiederverwendet

Die erweiterte Funktionalität macht das Terminal-System zu einem mächtigen Tool für parallele Session-Management und organisierte Entwicklungsarbeit! 🎉