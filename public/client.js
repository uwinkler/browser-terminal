// Terminal und Socket.IO Initialisierung
let terminal;
let socket;
let fitAddon;
let currentSession = null;

// DOM-Elemente
const terminalContainer = document.getElementById('terminal');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const sessionSelect = document.getElementById('session-select');
const sessionRefreshBtn = document.getElementById('session-refresh');

// tmux-Sessions vom Server laden und Dropdown füllen
async function loadTmuxSessions() {
    try {
        const res = await fetch('/api/tmux-sessions');
        const data = await res.json();
        const sessions = Array.isArray(data.sessions) ? data.sessions : [];

        // Dropdown leeren
        sessionSelect.innerHTML = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = sessions.length
            ? '— Session wählen —'
            : '— keine Sessions —';
        sessionSelect.appendChild(placeholder);

        const current = getCurrentSession();
        let currentFound = false;

        sessions.forEach((name) => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            if (name === current) {
                opt.selected = true;
                currentFound = true;
            }
            sessionSelect.appendChild(opt);
        });

        // Aktuelle Session anzeigen, auch wenn (noch) nicht in Liste
        if (current && !currentFound) {
            const opt = document.createElement('option');
            opt.value = current;
            opt.textContent = `${current} (aktiv)`;
            opt.selected = true;
            sessionSelect.appendChild(opt);
        }
    } catch (e) {
        console.error('Fehler beim Laden der tmux-Sessions:', e);
    }
}

// Session-Wechsel: Navigation per URL-Parameter
function switchToSession(name) {
    if (!name) return;
    const current = getCurrentSession();
    if (name === current) return;
    window.location.href = `${window.location.origin}/?session=${encodeURIComponent(name)}`;
}

if (sessionSelect) {
    sessionSelect.addEventListener('change', (e) => {
        switchToSession(e.target.value);
    });
}
if (sessionRefreshBtn) {
    sessionRefreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        loadTmuxSessions();
    });
}

// URL-Parameter lesen
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Session aus URL-Parameter lesen
function getCurrentSession() {
    return getUrlParameter('session');
}

// Terminal initialisieren
function initTerminal() {
    // xterm.js Terminal erstellen
    terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        theme: {
            background: '#000000',
            foreground: '#ffffff',
            cursor: '#ffffff',
            cursorAccent: '#000000',
            selection: 'rgba(255, 255, 255, 0.3)',
            black: '#000000',
            red: '#e06c75',
            green: '#98c379',
            yellow: '#d19a66',
            blue: '#61afef',
            magenta: '#c678dd',
            cyan: '#56b6c2',
            white: '#abb2bf',
            brightBlack: '#5c6370',
            brightRed: '#e06c75',
            brightGreen: '#98c379',
            brightYellow: '#d19a66',
            brightBlue: '#61afef',
            brightMagenta: '#c678dd',
            brightCyan: '#56b6c2',
            brightWhite: '#ffffff'
        },
        fontSize: 14,
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        allowTransparency: true,
        scrollback: 1000
    });

    // Fit-Addon für automatische Größenanpassung
    fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);

    // Web-Links Addon
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    terminal.loadAddon(webLinksAddon);

    // Terminal in DOM einbinden
    terminal.open(terminalContainer);
    
    // Terminal-Größe anpassen
    fitAddon.fit();

    // Eingaben verarbeiten
    terminal.onData((data) => {
        if (socket && socket.connected) {
            socket.emit('terminal-input', data);
        }
    });

    // Window Resize Event
    window.addEventListener('resize', () => {
        fitAddon.fit();
        if (socket && socket.connected) {
            socket.emit('terminal-resize', {
                cols: terminal.cols,
                rows: terminal.rows
            });
        }
    });

    console.log('Terminal initialisiert');
}

// Socket.IO Verbindung initialisieren
function initSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Socket verbunden');
        updateStatus('connected', 'Verbunden');
        
        // Session aus URL-Parameter lesen
        currentSession = getCurrentSession();
        
        // Terminal-Session erstellen (mit optionalem Session-Parameter)
        socket.emit('create-terminal', { session: currentSession });
        
        // Terminal-Größe senden
        socket.emit('terminal-resize', {
            cols: terminal.cols,
            rows: terminal.rows
        });
        
        // Window-Title setzen wenn Session vorhanden
        if (currentSession) {
            document.title = `Terminal: ${currentSession}`;
            updateStatus('connected', `Verbunden (${currentSession})`);
        }
        
        // Terminal fokussieren nach Verbindung
        setTimeout(() => {
            if (terminal) {
                terminal.focus();
            }
        }, 200);
    });

    socket.on('disconnect', () => {
        console.log('Socket getrennt');
        updateStatus('disconnected', 'Verbindung getrennt');
    });

    socket.on('connect_error', (error) => {
        console.error('Verbindungsfehler:', error);
        updateStatus('disconnected', 'Verbindungsfehler');
    });

    // Terminal-Output empfangen
    socket.on('terminal-output', (data) => {
        terminal.write(data);
    });

    // Terminal beendet
    socket.on('terminal-exit', (code) => {
        terminal.write(`\r\n\x1b[31mTerminal beendet mit Code: ${code}\x1b[0m\r\n`);
        terminal.write('\x1b[33mDrücke Reconnect um eine neue Session zu starten.\x1b[0m\r\n');
    });

    // Browser-Titel setzen
    socket.on('set-title', (title) => {
        document.title = title || 'Web Terminal';
    });
    
    // Session-Redirect (für title-Kommando)
    socket.on('redirect-to-session', (data) => {
        console.log('Redirect zu Session:', data.session);
        
        // URL mit Session-Parameter erstellen
        const newUrl = `${window.location.origin}${data.url}`;
        
        // Zu neuer Session navigieren
        window.location.href = newUrl;
    });

    console.log('Socket initialisiert');
}

// Status aktualisieren
function updateStatus(status, text) {
    statusIndicator.className = `status-dot ${status}`;
    statusText.textContent = text;
}

// Terminal leeren
function clearTerminal() {
    terminal.clear();
}

// Verbindung wiederherstellen
function reconnect() {
    updateStatus('connecting', 'Verbindung wird hergestellt...');
    
    if (socket) {
        socket.disconnect();
    }
    
    setTimeout(() => {
        initSocket();
    }, 1000);
}

// Event Listeners
// Global click listener - Terminal fokussieren
document.addEventListener('click', (e) => {
    // Klicks auf den Session-Switcher nicht in Terminal-Focus umleiten
    if (e.target.closest && e.target.closest('.session-switcher')) {
        return;
    }
    if (terminal) {
        terminal.focus();
    }
});
// reconnectBtn.addEventListener('click', reconnect);

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+L für Clear
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        clearTerminal();
    }
    
    // Ctrl+R für Reconnect
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        reconnect();
    }
});

// Beim Laden der Seite initialisieren
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM geladen, initialisiere Terminal...');
    updateStatus('connecting', 'Terminal wird initialisiert...');
    
    initTerminal();
    initSocket();
    loadTmuxSessions();
    
    // Terminal automatisch fokussieren
    setTimeout(() => {
        if (terminal) {
            terminal.focus();
        }
    }, 100);
});

// Beim Verlassen der Seite
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.disconnect();
    }
});

// Resize Observer für bessere Responsive-Unterstützung
if (window.ResizeObserver) {
    const resizeObserver = new ResizeObserver(() => {
        if (terminal && fitAddon) {
            fitAddon.fit();
            if (socket && socket.connected) {
                socket.emit('terminal-resize', {
                    cols: terminal.cols,
                    rows: terminal.rows
                });
            }
        }
    });
    
    resizeObserver.observe(terminalContainer);
}