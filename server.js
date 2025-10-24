const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const pty = require('node-pty');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Statische Dateien bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Hauptroute
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Terminal-Sessions verwalten
const terminals = {};

// tmux-Session erstellen oder attachen
function createTmuxSession(sessionName) {
  console.log('tmux-Session:', sessionName);
  
  // Prüfe ob tmux verfügbar ist
  try {
    const { execSync } = require('child_process');
    
    // Prüfe ob Session bereits existiert
    try {
      execSync(`tmux has-session -t "${sessionName}" 2>/dev/null`);
      console.log(`Attache zu existierender tmux-Session: ${sessionName}`);
    } catch (error) {
      // Session existiert nicht, erstelle neue
      console.log(`Erstelle neue tmux-Session: ${sessionName}`);
      execSync(`tmux new-session -d -s "${sessionName}"`);
    }
    
    // Terminal mit tmux attach erstellen
    const terminal = pty.spawn('tmux', ['attach-session', '-t', sessionName], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME || process.env.USERPROFILE || '/tmp',
      env: process.env
    });
    
    return terminal;
    
  } catch (error) {
    console.error('tmux nicht verfügbar, verwende Standard-Shell:', error.message);
    
    // Fallback zu normaler Shell
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'fish';
    return pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME || process.env.USERPROFILE || '/tmp',
      env: process.env
    });
  }
}

io.on('connection', (socket) => {
  console.log('Client verbunden:', socket.id);

  // Neues Terminal erstellen
  socket.on('create-terminal', (data) => {
    console.log('Erstelle neues Terminal für:', socket.id, 'mit Session:', data?.session);
    
    const sessionName = data?.session;
    let terminal;
    
    if (sessionName) {
      // tmux-Session verwenden
      terminal = createTmuxSession(sessionName);
    } else {
      // Standard Shell
      const shell = os.platform() === 'win32' ? 'powershell.exe' : 'fish';
      terminal = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME || process.env.USERPROFILE || '/tmp',
        env: process.env
      });
    }

    // Terminal-Session speichern
    terminals[socket.id] = terminal;
    terminals[socket.id].sessionName = sessionName;

    // Terminal-Output an Client weiterleiten
    terminal.on('data', (data) => {
      // Prüfe auf xterm title escape sequence
      const titleMatch = data.toString().match(/\x1b\]0;([^\x07]*)\x07/);
      if (titleMatch) {
        const newTitle = titleMatch[1];
        socket.emit('set-title', newTitle);
      }
      
      // Prüfe auf title-Kommando in der Ausgabe
      const titleCommandMatch = data.toString().match(/TITLE_SESSION:([^\r\n]+)/);
      if (titleCommandMatch) {
        const sessionName = titleCommandMatch[1].trim();
        console.log('Title-Kommando erkannt, Session:', sessionName);
        
        // Neue tmux-Session starten und URL mit Query-Parameter senden
        socket.emit('redirect-to-session', {
          session: sessionName,
          url: `/?session=${encodeURIComponent(sessionName)}`
        });
        return;
      }
      
      socket.emit('terminal-output', data);
    });

    // Terminal-Ende behandeln
    terminal.on('exit', (code) => {
      console.log('Terminal beendet mit Code:', code);
      delete terminals[socket.id];
      socket.emit('terminal-exit', code);
    });

    console.log('Terminal erstellt für:', socket.id);
  });

  // Input vom Client an Terminal weiterleiten
  socket.on('terminal-input', (data) => {
    if (terminals[socket.id]) {
      terminals[socket.id].write(data);
    }
  });

  // Terminal-Größe ändern
  socket.on('terminal-resize', (data) => {
    if (terminals[socket.id]) {
      terminals[socket.id].resize(data.cols, data.rows);
    }
  });

  // Client-Disconnect behandeln
  socket.on('disconnect', () => {
    console.log('Client getrennt:', socket.id);
    if (terminals[socket.id]) {
      terminals[socket.id].kill();
      delete terminals[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Web Terminal Server läuft auf http://localhost:${PORT}`);
});