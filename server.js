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

// JSON-Body parsen (für /api/chat)
app.use(express.json({ limit: '2mb' }));

// Hauptroute
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: tmux-Sessions auflisten
app.get('/api/tmux-sessions', (req, res) => {
  try {
    const { execSync } = require('child_process');
    const output = execSync(
      `tmux list-sessions -F "#{session_name}" 2>/dev/null`,
      { encoding: 'utf8' }
    );
    const sessions = output
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    res.json({ sessions });
  } catch (error) {
    // Kein tmux oder keine Sessions
    res.json({ sessions: [] });
  }
});

// API: OpenAI-Responses-Proxy (umgeht CORS, hält den API-Key aus dem Cross-Origin-Request).
// Nutzt /v1/responses, damit das hosted web_search-Tool verfügbar ist.
// Body: { apiKey?, model, input, tools?, instructions?, previous_response_id? }
app.post('/api/chat', async (req, res) => {
  const { apiKey, model, input, tools, instructions, previous_response_id } = req.body || {};
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    return res.status(400).json({ error: { message: 'Kein OpenAI API-Key angegeben.' } });
  }
  if (!input) {
    return res.status(400).json({ error: { message: 'Kein input übergeben.' } });
  }
  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: model || 'gpt-5.5',
        input,
        tools: Array.isArray(tools) && tools.length ? tools : undefined,
        instructions: instructions || undefined,
        previous_response_id: previous_response_id || undefined
      })
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (error) {
    console.error('OpenAI-Proxy-Fehler:', error);
    res.status(502).json({ error: { message: 'Proxy-Fehler: ' + error.message } });
  }
});

// API: Gespeicherte OpenAI-Responses löschen (beim Leeren des Chats).
// Body: { apiKey?, ids: [responseId, …] }
app.post('/api/chat/delete', async (req, res) => {
  const { apiKey, ids } = req.body || {};
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key || !Array.isArray(ids) || ids.length === 0) {
    return res.json({ deleted: 0 });
  }
  let deleted = 0;
  await Promise.all(
    ids.map(async (id) => {
      try {
        const r = await fetch(`https://api.openai.com/v1/responses/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${key}` }
        });
        if (r.ok) deleted++;
      } catch (error) {
        // best-effort – einzelne Fehler ignorieren
      }
    })
  );
  res.json({ deleted });
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
server.listen(PORT,'127.0.0.1', () => {
  console.log(`Web Terminal Server läuft auf http://localhost:${PORT}`);
});