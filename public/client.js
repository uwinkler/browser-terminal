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
const themeSelect = document.getElementById('theme-select');
const sessionSwitcher = document.getElementById('session-switcher');
const switcherToggle = document.getElementById('switcher-toggle');
const sessionAddBtn = document.getElementById('session-add');
const fontDecBtn = document.getElementById('font-dec');
const fontIncBtn = document.getElementById('font-inc');
const fontSizeDisplay = document.getElementById('font-size-display');
const mcpIndicator = document.getElementById('mcp-indicator');
const mcpText = document.getElementById('mcp-text');

// ── Output-Buffer (für WebMCP) ─────────────────────────────────────────────
const MAX_BUFFER_LINES = 500;
const outputBuffer = [];
let lastOutputAt = Date.now(); // Zeitpunkt der letzten Terminal-Ausgabe

// Wartet auf die Ausgabe eines gerade gesendeten Befehls:
//   1. zuerst, bis überhaupt neue Ausgabe eintrifft (lastOutputAt ändert sich
//      gegenüber baseline) – höchstens noOutputMs (für Befehle ohne Ausgabe wie cd);
//   2. dann, bis die Ausgabe für quietMs "still" ist.
// Insgesamt nie länger als maxMs. So wird nicht abgebrochen, BEVOR Output da war.
function waitForCommandOutput(baseline, { quietMs = 700, maxMs = 10000, noOutputMs = 1500 } = {}) {
    return new Promise((resolve) => {
        const start = Date.now();
        const tick = () => {
            const now = Date.now();
            if (now - start >= maxMs) return resolve('timeout');
            const arrived = lastOutputAt !== baseline;
            if (!arrived) {
                if (now - start >= noOutputMs) return resolve('no-output');
                return setTimeout(tick, 80);
            }
            if (now - lastOutputAt >= quietMs) return resolve('idle');
            setTimeout(tick, 80);
        };
        setTimeout(tick, 80);
    });
}

function stripAnsi(str) {
    return str
        .replace(/\x1b\[[\d;]*[mGKHJABCDEFhlsurinsulp]/g, '')
        .replace(/\x1b\][^\x07]*\x07/g, '')
        .replace(/\x1b[()][AB012]/g, '')
        .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, '');
}

function appendToBuffer(data) {
    const clean = stripAnsi(String(data));
    const lines = clean.split(/\r?\n/);
    // Letzte Zeile im Buffer ggf. mit erstem Segment zusammenführen (Partial Lines)
    if (outputBuffer.length > 0 && lines.length > 0) {
        outputBuffer[outputBuffer.length - 1] += lines.shift();
    }
    outputBuffer.push(...lines);
    if (outputBuffer.length > MAX_BUFFER_LINES) {
        outputBuffer.splice(0, outputBuffer.length - MAX_BUFFER_LINES);
    }
}

// Liest die letzten `count` Zeilen aus dem ECHT gerenderten xterm-Buffer.
// Anders als outputBuffer (roher, linear angehängter Stream) entspricht das dem,
// was tatsächlich auf dem Schirm steht – inkl. korrekt verarbeiteter Cursor-
// Positionierung. Wichtig für tmux/Vollbild-Apps, die den Schirm neu zeichnen.
function getTerminalLines(count) {
    if (!terminal || !terminal.buffer || !terminal.buffer.active) return [];
    const buf = terminal.buffer.active;
    const total = buf.length;
    const start = Math.max(0, total - count);
    const lines = [];
    for (let i = start; i < total; i++) {
        const line = buf.getLine(i);
        lines.push(line ? line.translateToString(true) : '');
    }
    // Leerzeilen am Ende (leerer Viewport-Bereich) entfernen
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines;
}

// Color Themes Configuration
const themes = {
    classic: {
        xterm: {
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
        page: {
            bg: '#121212',
            bgAlpha: 'rgba(18, 18, 18, 0.85)',
            containerBg: '#1e1e1e',
            text: '#ffffff',
            border: 'rgba(64, 64, 64, 0.6)',
            controlBg: '#2d2d2d',
            controlText: '#ffffff',
            controlBorder: '#444'
        }
    },
    dracula: {
        xterm: {
            background: '#282a36',
            foreground: '#f8f8f2',
            cursor: '#f8f8f0',
            cursorAccent: '#282a36',
            selection: 'rgba(255, 255, 255, 0.3)',
            black: '#21222c',
            red: '#ff5555',
            green: '#50fa7b',
            yellow: '#f1fa8c',
            blue: '#bd93f9',
            magenta: '#ff79c6',
            cyan: '#8be9fd',
            white: '#f8f8f2',
            brightBlack: '#6272a4',
            brightRed: '#ff6e6e',
            brightGreen: '#69ff94',
            brightYellow: '#ffffa5',
            brightBlue: '#d6acff',
            brightMagenta: '#ff92df',
            brightCyan: '#a4ffff',
            brightWhite: '#ffffff'
        },
        page: {
            bg: '#1e1f29',
            bgAlpha: 'rgba(30, 31, 41, 0.85)',
            containerBg: '#282a36',
            text: '#f8f8f2',
            border: '#44475a',
            controlBg: '#21222c',
            controlText: '#f8f8f2',
            controlBorder: '#44475a'
        }
    },
    onedark: {
        xterm: {
            background: '#282c34',
            foreground: '#abb2bf',
            cursor: '#528bff',
            cursorAccent: '#282c34',
            selection: 'rgba(171, 178, 191, 0.3)',
            black: '#282c34',
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
        page: {
            bg: '#21252b',
            bgAlpha: 'rgba(33, 37, 43, 0.85)',
            containerBg: '#282c34',
            text: '#abb2bf',
            border: '#3e4451',
            controlBg: '#21252b',
            controlText: '#abb2bf',
            controlBorder: '#3e4451'
        }
    },
    nord: {
        xterm: {
            background: '#2e3440',
            foreground: '#d8dee9',
            cursor: '#d8dee9',
            cursorAccent: '#2e3440',
            selection: 'rgba(143, 188, 187, 0.3)',
            black: '#3b4252',
            red: '#bf616a',
            green: '#a3be8c',
            yellow: '#ebcb8b',
            blue: '#81a1c1',
            magenta: '#b48ead',
            cyan: '#88c0d0',
            white: '#e5e9f0',
            brightBlack: '#4c566a',
            brightRed: '#bf616a',
            brightGreen: '#a3be8c',
            brightYellow: '#ebcb8b',
            brightBlue: '#81a1c1',
            brightMagenta: '#b48ead',
            brightCyan: '#8fbcbb',
            brightWhite: '#eceff4'
        },
        page: {
            bg: '#242933',
            bgAlpha: 'rgba(36, 41, 51, 0.85)',
            containerBg: '#2e3440',
            text: '#d8dee9',
            border: '#3b4252',
            controlBg: '#242933',
            controlText: '#d8dee9',
            controlBorder: '#3b4252'
        }
    },
    gruvbox: {
        xterm: {
            background: '#282828',
            foreground: '#ebdbb2',
            cursor: '#a89984',
            cursorAccent: '#282828',
            selection: 'rgba(168, 153, 132, 0.3)',
            black: '#282828',
            red: '#cc241d',
            green: '#98971a',
            yellow: '#d79921',
            blue: '#458588',
            magenta: '#b16286',
            cyan: '#689d6a',
            white: '#a89984',
            brightBlack: '#928374',
            brightRed: '#fb4934',
            brightGreen: '#b8bb26',
            brightYellow: '#fabd2f',
            brightBlue: '#83a598',
            brightMagenta: '#d3869b',
            brightCyan: '#8ec07c',
            brightWhite: '#ebdbb2'
        },
        page: {
            bg: '#1d2021',
            bgAlpha: 'rgba(29, 32, 33, 0.85)',
            containerBg: '#282828',
            text: '#ebdbb2',
            border: '#3c3836',
            controlBg: '#1d2021',
            controlText: '#ebdbb2',
            controlBorder: '#3c3836'
        }
    },
    'solarized-dark': {
        xterm: {
            background: '#002b36',
            foreground: '#839496',
            cursor: '#93a1a1',
            cursorAccent: '#002b36',
            selection: 'rgba(7, 54, 66, 0.5)',
            black: '#073642',
            red: '#dc322f',
            green: '#859900',
            yellow: '#b58900',
            blue: '#268bd2',
            magenta: '#d33682',
            cyan: '#2aa198',
            white: '#eee8d5',
            brightBlack: '#002b36',
            brightRed: '#cb4b16',
            brightGreen: '#586e75',
            brightYellow: '#657b83',
            brightBlue: '#839496',
            brightMagenta: '#6c71c4',
            brightCyan: '#93a1a1',
            brightWhite: '#fdf6e3'
        },
        page: {
            bg: '#001b21',
            bgAlpha: 'rgba(0, 27, 33, 0.85)',
            containerBg: '#002b36',
            text: '#839496',
            border: '#073642',
            controlBg: '#001b21',
            controlText: '#839496',
            controlBorder: '#073642'
        }
    },
    'solarized-light': {
        xterm: {
            background: '#fdf6e3',
            foreground: '#657b83',
            cursor: '#586e75',
            cursorAccent: '#fdf6e3',
            selection: 'rgba(238, 232, 213, 0.5)',
            black: '#eee8d5',
            red: '#dc322f',
            green: '#859900',
            yellow: '#b58900',
            blue: '#268bd2',
            magenta: '#d33682',
            cyan: '#2aa198',
            white: '#073642',
            brightBlack: '#fdf6e3',
            brightRed: '#cb4b16',
            brightGreen: '#93a1a1',
            brightYellow: '#839496',
            brightBlue: '#657b83',
            brightMagenta: '#6c71c4',
            brightCyan: '#586e75',
            brightWhite: '#002b36'
        },
        page: {
            bg: '#eee8d5',
            bgAlpha: 'rgba(238, 232, 213, 0.85)',
            containerBg: '#fdf6e3',
            text: '#657b83',
            border: '#d5cbb4',
            controlBg: '#eee8d5',
            controlText: '#657b83',
            controlBorder: '#d5cbb4'
        }
    },
    'retro-amber': {
        xterm: {
            background: '#0d0f0d',
            foreground: '#ffb000',
            cursor: '#ffb000',
            cursorAccent: '#0d0f0d',
            selection: 'rgba(255, 176, 0, 0.3)',
            black: '#000000',
            red: '#ffb000',
            green: '#ffb000',
            yellow: '#ffb000',
            blue: '#ffb000',
            magenta: '#ffb000',
            cyan: '#ffb000',
            white: '#ffb000',
            brightBlack: '#5c6370',
            brightRed: '#ffb000',
            brightGreen: '#ffb000',
            brightYellow: '#ffb000',
            brightBlue: '#ffb000',
            brightMagenta: '#ffb000',
            brightCyan: '#ffb000',
            brightWhite: '#ffb000'
        },
        page: {
            bg: '#050605',
            bgAlpha: 'rgba(5, 6, 5, 0.85)',
            containerBg: '#0d0f0d',
            text: '#ffb000',
            border: '#ffb00033',
            controlBg: '#050605',
            controlText: '#ffb000',
            controlBorder: '#ffb00066'
        }
    },
    'retro-green': {
        xterm: {
            background: '#0c100c',
            foreground: '#33ff33',
            cursor: '#33ff33',
            cursorAccent: '#0c100c',
            selection: 'rgba(51, 255, 51, 0.3)',
            black: '#000000',
            red: '#33ff33',
            green: '#33ff33',
            yellow: '#33ff33',
            blue: '#33ff33',
            magenta: '#33ff33',
            cyan: '#33ff33',
            white: '#33ff33',
            brightBlack: '#5c6370',
            brightRed: '#33ff33',
            brightGreen: '#33ff33',
            brightYellow: '#33ff33',
            brightBlue: '#33ff33',
            brightMagenta: '#33ff33',
            brightCyan: '#33ff33',
            brightWhite: '#33ff33'
        },
        page: {
            bg: '#050805',
            bgAlpha: 'rgba(5, 8, 5, 0.85)',
            containerBg: '#0c100c',
            text: '#33ff33',
            border: '#33ff3333',
            controlBg: '#050805',
            controlText: '#33ff33',
            controlBorder: '#33ff3366'
        }
    },
    'github-light': {
        xterm: {
            background: '#ffffff',
            foreground: '#24292f',
            cursor: '#0969da',
            cursorAccent: '#ffffff',
            selection: 'rgba(9, 105, 218, 0.2)',
            black: '#24292f',
            red: '#cf222e',
            green: '#116329',
            yellow: '#4d2d00',
            blue: '#0969da',
            magenta: '#8250df',
            cyan: '#059970',
            white: '#6e7781',
            brightBlack: '#57606a',
            brightRed: '#a40e26',
            brightGreen: '#1a7f37',
            brightYellow: '#6f42c1',
            brightBlue: '#218bff',
            brightMagenta: '#a475f9',
            brightCyan: '#1fdbac',
            brightWhite: '#eaeef2'
        },
        page: {
            bg: '#f6f8fa',
            bgAlpha: 'rgba(246, 248, 250, 0.85)',
            containerBg: '#ffffff',
            text: '#24292f',
            border: '#d0d7de',
            controlBg: '#f6f8fa',
            controlText: '#24292f',
            controlBorder: '#d0d7de'
        }
    },
    onelight: {
        xterm: {
            background: '#fafafa',
            foreground: '#383a42',
            cursor: '#526fff',
            cursorAccent: '#fafafa',
            selection: 'rgba(82, 111, 255, 0.25)',
            black: '#383a42',
            red: '#e45649',
            green: '#50a14f',
            yellow: '#c18401',
            blue: '#4078f2',
            magenta: '#a626a4',
            cyan: '#0184bc',
            white: '#a0a1a7',
            brightBlack: '#4f525d',
            brightRed: '#e45649',
            brightGreen: '#50a14f',
            brightYellow: '#c18401',
            brightBlue: '#4078f2',
            brightMagenta: '#a626a4',
            brightCyan: '#0184bc',
            brightWhite: '#ffffff'
        },
        page: {
            bg: '#eaeaea',
            bgAlpha: 'rgba(234, 234, 234, 0.85)',
            containerBg: '#fafafa',
            text: '#383a42',
            border: '#cccccc',
            controlBg: '#eaeaea',
            controlText: '#383a42',
            controlBorder: '#cccccc'
        }
    },
    'gruvbox-light': {
        xterm: {
            background: '#fbf1c7',
            foreground: '#3c3836',
            cursor: '#928374',
            cursorAccent: '#fbf1c7',
            selection: 'rgba(146, 131, 116, 0.25)',
            black: '#fbf1c7',
            red: '#9d0006',
            green: '#79740e',
            yellow: '#b57614',
            blue: '#076678',
            magenta: '#8f3f71',
            cyan: '#427b58',
            white: '#3c3836',
            brightBlack: '#928374',
            brightRed: '#9d0006',
            brightGreen: '#79740e',
            brightYellow: '#b57614',
            brightBlue: '#076678',
            brightMagenta: '#8f3f71',
            brightCyan: '#427b58',
            brightWhite: '#3c3836'
        },
        page: {
            bg: '#f2e5bc',
            bgAlpha: 'rgba(242, 229, 188, 0.85)',
            containerBg: '#fbf1c7',
            text: '#3c3836',
            border: '#d5c4a1',
            controlBg: '#f2e5bc',
            controlText: '#3c3836',
            controlBorder: '#d5c4a1'
        }
    },
    'papercolor-light': {
        xterm: {
            background: '#eeeeee',
            foreground: '#444444',
            cursor: '#005faf',
            cursorAccent: '#eeeeee',
            selection: 'rgba(0, 95, 175, 0.2)',
            black: '#eeeeee',
            red: '#af0000',
            green: '#008700',
            yellow: '#5f8700',
            blue: '#005faf',
            magenta: '#878700',
            cyan: '#005f87',
            white: '#444444',
            brightBlack: '#bcbcbc',
            brightRed: '#af0000',
            brightGreen: '#008700',
            brightYellow: '#5f8700',
            brightBlue: '#005faf',
            brightMagenta: '#878700',
            brightCyan: '#005f87',
            brightWhite: '#eeeeee'
        },
        page: {
            bg: '#e4e4e4',
            bgAlpha: 'rgba(228, 228, 228, 0.85)',
            containerBg: '#eeeeee',
            text: '#444444',
            border: '#d0d0d0',
            controlBg: '#e4e4e4',
            controlText: '#444444',
            controlBorder: '#d0d0d0'
        }
    }
};

function applyTheme(themeKey) {
    const theme = themes[themeKey] || themes.classic;
    
    // Xterm.js Theme anpassen (falls initialisiert)
    if (terminal) {
        terminal.options.theme = theme.xterm;
    }
    
    // CSS-Variablen auf dem Root-Element setzen
    const root = document.documentElement;
    root.style.setProperty('--bg-color', theme.page.bg);
    root.style.setProperty('--container-bg-color', theme.page.containerBg);
    root.style.setProperty('--terminal-bg-color', theme.xterm.background);
    root.style.setProperty('--text-color', theme.page.text);
    root.style.setProperty('--border-color', theme.page.border);
    root.style.setProperty('--control-bg-color', theme.page.controlBg);
    root.style.setProperty('--control-bg-color-alpha', theme.page.bgAlpha);
    root.style.setProperty('--control-text-color', theme.page.controlText);
    root.style.setProperty('--control-border-color', theme.page.controlBorder);
    
    // Im localStorage speichern
    localStorage.setItem('selected-theme', themeKey);
}

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
    const savedTheme = localStorage.getItem('selected-theme') || 'classic';
    const themeConfig = themes[savedTheme] || themes.classic;
    const savedFontSize = parseInt(localStorage.getItem('terminal-font-size')) || 14;

    // xterm.js Terminal erstellen
    terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        theme: themeConfig.xterm,
        fontSize: savedFontSize,
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
        appendToBuffer(data);
        lastOutputAt = Date.now();
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
    if (!statusIndicator || !statusText) return;
    statusIndicator.className = `status-dot ${status}`;
    statusText.textContent = text;
}

// WebMCP Status-Anzeige aktualisieren
function updateWebMCPIndicator(active) {
    if (!mcpIndicator || !mcpText) return;
    if (active) {
        mcpIndicator.className = 'status-dot mcp-active';
        mcpText.style.opacity = '1';
        mcpText.title = 'WebMCP aktiv – 7 Tools registriert';
    } else {
        mcpIndicator.className = 'status-dot mcp-inactive';
        mcpText.style.opacity = '0.4';
        mcpText.title = 'WebMCP nicht verfügbar (Chrome 146+ + Flag benötigt)';
    }
}

// ── Terminal-Tools ─────────────────────────────────────────────────────────
// Gemeinsame Tool-Definitionen. Werden zweifach genutzt:
//   1. WebMCP (navigator.modelContext) für Chromes eingebauten Agenten
//   2. postMessage-Bridge für das KI-Chat-Side-Panel der Extension
const TERMINAL_TOOLS = {
    'get-current-state': {
        description:
            'Gibt den aktuellen Status des Web Terminals zurück: ' +
            'aktive tmux-Session, Farbschema, Schriftgröße und Verbindungsstatus.',
        inputSchema: { type: 'object', properties: {} },
        execute() {
            return {
                session: getCurrentSession() || null,
                theme: localStorage.getItem('selected-theme') || 'classic',
                fontSize: parseInt(localStorage.getItem('terminal-font-size')) || 14,
                connected: socket?.connected ?? false,
                buffered_lines: outputBuffer.length,
                url: window.location.href
            };
        },
        annotations: { readOnlyHint: true }
    },

    'get-terminal-output': {
        description:
            'Liest die letzten Zeilen des AKTUELL sichtbaren Terminal-Inhalts (gerenderter ' +
            'xterm-Schirm inkl. Scrollback). Spiegelt den echten Stand wider, auch bei ' +
            'tmux/Vollbild-Apps. Max. 500 Zeilen.',
        inputSchema: {
            type: 'object',
            properties: {
                lines: {
                    type: 'number',
                    description: 'Anzahl der zurückzugebenden Zeilen. Standard: 50, Maximum: 500.'
                }
            }
        },
        execute({ lines = 50 } = {}) {
            const count = Math.min(Math.max(1, Math.floor(lines)), 500);
            const out = getTerminalLines(count);
            return {
                lines: out,
                returned: out.length
            };
        },
        annotations: { readOnlyHint: true }
    },

    'run-command': {
        description:
            'Führt einen Shell-Befehl im aktiven Terminal aus (mit Enter) und wartet auf die Ausgabe. ' +
            'Gibt anschließend den aktuell sichtbaren Terminal-Inhalt (gerenderter Schirm) zurück. ' +
            'Bei langlaufenden Befehlen wird nach einem Timeout der bis dahin sichtbare Stand geliefert.',
        inputSchema: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'Der auszuführende Shell-Befehl, z. B. "ls -la" oder "echo hello".'
                }
            },
            required: ['command']
        },
        async execute({ command }) {
            if (!socket?.connected) {
                return { error: 'Terminal ist nicht verbunden.' };
            }
            if (!command?.trim()) {
                return { error: 'Kein Befehl angegeben.' };
            }
            const baseline = lastOutputAt; // echter Marker: ändert sich, sobald Ausgabe eintrifft
            socket.emit('terminal-input', command + '\n');
            const reason = await waitForCommandOutput(baseline, { quietMs: 700, maxMs: 10000, noOutputMs: 1500 });
            // Aktuell gerenderten Schirm lesen (statt linearem Roh-Buffer)
            const output = getTerminalLines(200);
            return {
                sent: command,
                output,
                still_running: reason === 'timeout'
            };
        }
    },

    'send-input': {
        description:
            'Tippt Text in das aktive Terminal, OHNE ihn auszuführen (kein Enter). ' +
            'Nützlich, damit der Nutzer einen vorgeschlagenen Befehl vor dem Ausführen prüfen kann.',
        inputSchema: {
            type: 'object',
            properties: {
                text: {
                    type: 'string',
                    description: 'Der einzufügende Text (ohne abschließendes Enter).'
                }
            },
            required: ['text']
        },
        execute({ text }) {
            if (!socket?.connected) {
                return { error: 'Terminal ist nicht verbunden.' };
            }
            if (typeof text !== 'string' || text.length === 0) {
                return { error: 'Kein Text angegeben.' };
            }
            socket.emit('terminal-input', text);
            return { pasted: text };
        }
    },

    'list-sessions': {
        description: 'Listet alle verfügbaren tmux-Sessions auf dem Server auf.',
        inputSchema: { type: 'object', properties: {} },
        async execute() {
            const res = await fetch('/api/tmux-sessions');
            const data = await res.json();
            return {
                sessions: data.sessions,
                current: getCurrentSession() || null
            };
        },
        annotations: { readOnlyHint: true }
    },

    'switch-session': {
        description:
            'Wechselt zu einer bestehenden tmux-Session. ' +
            'Die Seite wird mit der gewählten Session neu geladen.',
        inputSchema: {
            type: 'object',
            properties: {
                session: {
                    type: 'string',
                    description: 'Name der tmux-Session, zu der gewechselt werden soll.'
                }
            },
            required: ['session']
        },
        execute({ session }) {
            if (!session?.trim()) return { error: 'Kein Session-Name angegeben.' };
            switchToSession(session.trim());
            return { switching_to: session.trim() };
        }
    },

    'create-session': {
        description:
            'Erstellt eine neue tmux-Session und wechselt zu ihr. ' +
            'Erlaubte Zeichen im Namen: Buchstaben, Zahlen, Bindestriche, Unterstriche.',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Name der neuen tmux-Session, z. B. "dev" oder "build-2".'
                }
            },
            required: ['name']
        },
        execute({ name }) {
            const clean = name.trim().replace(/[^a-zA-Z0-9_-]/g, '');
            if (!clean) {
                return { error: 'Ungültiger Session-Name. Nur Buchstaben, Zahlen, - und _ erlaubt.' };
            }
            switchToSession(clean);
            return { creating_and_switching_to: clean };
        }
    },

    'set-theme': {
        description: 'Ändert das Farbschema des Web Terminals.',
        get inputSchema() {
            return {
                type: 'object',
                properties: {
                    theme: {
                        type: 'string',
                        description:
                            'Name des Farbschemas. Verfügbar: ' +
                            Object.keys(themes).join(', ')
                    }
                },
                required: ['theme']
            };
        },
        execute({ theme }) {
            if (!themes[theme]) {
                return {
                    error: `Unbekanntes Schema '${theme}'.`,
                    available: Object.keys(themes)
                };
            }
            applyTheme(theme);
            if (themeSelect) themeSelect.value = theme;
            return { theme_set: theme };
        }
    }
};

// Für den In-Page-Chat (chat.js) zugänglich machen
window.TERMINAL_TOOLS = TERMINAL_TOOLS;
window.focusTerminal = () => { if (terminal) terminal.focus(); };

// WebMCP Tools registrieren
function initWebMCP() {
    if (!('modelContext' in navigator && 'registerTool' in navigator.modelContext)) {
        console.info(
            '%c[WebMCP] Nicht verfügbar – benötigt Chrome 146+ mit\n' +
            'chrome://flags/#enable-webmcp-testing',
            'color: #a855f7; font-weight: bold;'
        );
        updateWebMCPIndicator(false);
        return;
    }

    for (const [name, tool] of Object.entries(TERMINAL_TOOLS)) {
        navigator.modelContext.registerTool({
            name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            execute: tool.execute,
            ...(tool.annotations ? { annotations: tool.annotations } : {})
        });
    }

    const count = Object.keys(TERMINAL_TOOLS).length;
    console.info(
        `%c[WebMCP] ${count} Terminal-Tools registriert ✓`,
        'color: #a855f7; font-weight: bold;'
    );
    updateWebMCPIndicator(true);
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
    // Klicks auf Session-Switcher und KI-Chat nicht in Terminal-Focus umleiten
    if (e.target.closest && e.target.closest('.session-switcher, .chat-panel, .chat-toggle')) {
        return;
    }
    if (terminal) {
        terminal.focus();
    }
});
// reconnectBtn.addEventListener('click', reconnect);

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // Terminal-Shortcuts nicht auslösen, während im KI-Chat getippt wird
    if (e.target.closest && e.target.closest('.chat-panel')) {
        return;
    }

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
    
    // Collapsible Settings Menu Logik
    if (switcherToggle && sessionSwitcher) {
        const isCollapsed = localStorage.getItem('menu-collapsed') === 'true';
        if (isCollapsed) {
            sessionSwitcher.classList.add('collapsed');
        }
        
        switcherToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const nowCollapsed = sessionSwitcher.classList.toggle('collapsed');
            localStorage.setItem('menu-collapsed', nowCollapsed);
            if (terminal) {
                terminal.focus();
            }
        });
    }

    // Neue tmux-Session erstellen Button Logik
    if (sessionAddBtn) {
        sessionAddBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sessionName = prompt('Geben Sie den Namen für die neue tmux-Session ein:');
            if (sessionName && sessionName.trim()) {
                const cleanName = sessionName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
                if (cleanName) {
                    switchToSession(cleanName);
                } else {
                    alert('Ungültiger Name. Nur Buchstaben, Zahlen, Unterstriche und Bindestriche sind erlaubt.');
                }
            }
        });
    }

    // Font-Size Adjustment Logik
    let currentFontSize = parseInt(localStorage.getItem('terminal-font-size')) || 14;
    function updateFontSize(newSize) {
        if (newSize < 10 || newSize > 24) return;
        currentFontSize = newSize;
        localStorage.setItem('terminal-font-size', currentFontSize);
        if (fontSizeDisplay) {
            fontSizeDisplay.textContent = currentFontSize;
        }
        if (terminal) {
            terminal.options.fontSize = currentFontSize;
            if (fitAddon) {
                fitAddon.fit();
                if (socket && socket.connected) {
                    socket.emit('terminal-resize', {
                        cols: terminal.cols,
                        rows: terminal.rows
                    });
                }
            }
        }
    }

    if (fontSizeDisplay) {
        fontSizeDisplay.textContent = currentFontSize;
    }

    if (fontDecBtn) {
        fontDecBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            updateFontSize(currentFontSize - 1);
        });
    }

    if (fontIncBtn) {
        fontIncBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            updateFontSize(currentFontSize + 1);
        });
    }

    // Theme Event Listener einrichten
    const savedTheme = localStorage.getItem('selected-theme') || 'classic';
    if (themeSelect) {
        themeSelect.value = savedTheme;
        themeSelect.addEventListener('change', (e) => {
            applyTheme(e.target.value);
            if (terminal) {
                terminal.focus();
            }
        });
    }
    
    // Theme auf Page anwenden vor Terminal-Init
    applyTheme(savedTheme);
    
    initTerminal();
    initSocket();
    loadTmuxSessions();
    initWebMCP();

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