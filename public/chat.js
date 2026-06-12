// In-Page KI-Chat für das Web-Terminal
// - Läuft direkt in der Seite (keine Extension nötig)
// - Nutzt die in client.js definierten TERMINAL_TOOLS direkt (window.TERMINAL_TOOLS)
// - OpenAI-Aufrufe gehen über den Server-Proxy /api/chat (umgeht CORS)
(function () {
  'use strict';

  const BUFFER_LINES = 200;
  const MAX_TOOL_ROUNDS = 8;
  const LS_KEY = 'openai-api-key';
  const LS_MODEL = 'openai-model';

  const SYSTEM_PROMPT =
    'Du bist ein Assistent, der direkt in einem Web-Terminal eingebettet ist. ' +
    'Du hilfst dem Nutzer bei Shell-Befehlen, tmux-Sessions und der Analyse der Terminal-Ausgabe. ' +
    'Vor jeder Nutzernachricht erhältst du den aktuellen Terminal-Buffer (letzte Zeilen) als Kontext. ' +
    'Du kannst die bereitgestellten Tools nutzen, um den Zustand zu lesen, Befehle auszuführen oder ' +
    'Sessions zu verwalten. Wenn die Ausgabe eines Befehls leer oder unvollständig wirkt (z. B. weil ' +
    'der Befehl länger lief), rufe get-terminal-output auf, um die neuesten Zeilen nachzulesen, bevor ' +
    'du antwortest. Wenn du dem Nutzer einen Befehl empfiehlst, gib ihn als Code-Block ' +
    '(```bash … ```) aus, damit er ihn per Klick übernehmen kann. Antworte auf Deutsch, knapp und präzise.\n\n' +
    'Schlage am Ende deiner Antwort 2–4 sinnvolle nächste Aktionen vor – jede als kurze, klickbare ' +
    'Anweisung in der Ich-/Befehlsform (z. B. "Logs der letzten Stunde anzeigen"). Formatiere diesen ' +
    'Block EXAKT so und schreibe nichts anderes hinein:\n' +
    '<<ACTIONS>>\n1. Erste Aktion\n2. Zweite Aktion\n3. Dritte Aktion\n<</ACTIONS>>\n' +
    'Lass den Block komplett weg, wenn es keine sinnvollen Folgeaktionen gibt.';

  // ── DOM ────────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const panel = $('chat-panel');
  const toggleBtn = $('chat-toggle');
  const messagesEl = $('chat-messages');
  const inputEl = $('chat-input');
  const sendBtn = $('chat-send');
  const statusEl = $('chat-status');
  const settingsEl = $('chat-settings');
  const apiKeyEl = $('chat-api-key');
  const modelEl = $('chat-model');
  const emptyHint = $('chat-empty');

  // ── Zustand ──────────────────────────────────────────────────────────
  let lastResponseId = null; // Responses-API-Verkettung (previous_response_id)
  let responseIds = []; // alle erzeugten Response-IDs (zum Löschen beim Leeren)
  let busy = false;
  let currentActions = []; // zuletzt vorgeschlagene Instant-Actions (für Zifferntasten)

  const tools = () => window.TERMINAL_TOOLS || {};

  // ── Panel auf/zu ───────────────────────────────────────────────────────
  function openPanel() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    setTimeout(() => inputEl.focus(), 50);
  }
  function closePanel() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  }
  function togglePanel() {
    panel.classList.contains('open') ? closePanel() : openPanel();
  }

  toggleBtn.addEventListener('click', togglePanel);
  $('chat-close').addEventListener('click', closePanel);

  // Klick ins Terminal-/Buffer-Fenster blendet den Chat aus
  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('open')) return;
    if (e.target.closest && e.target.closest('.terminal-container')) {
      closePanel();
    }
  });
  document.addEventListener('keydown', (e) => {
    // Ctrl+I nicht abfangen, während das Terminal fokussiert ist (dort = Tab-Control-Code)
    if (e.ctrlKey && (e.key === 'i' || e.key === 'I') &&
        !(e.target.closest && e.target.closest('#terminal'))) {
      e.preventDefault();
      togglePanel();
    }
    if (e.key === 'Escape' && panel.classList.contains('open') &&
        e.target.closest && e.target.closest('.chat-panel')) {
      closePanel();
    }
    // Instant-Action per Zifferntaste – nur wenn Panel offen, nicht beschäftigt
    // und das Eingabefeld leer ist (damit normales Tippen nicht gestört wird).
    if (panel.classList.contains('open') && !busy && /^[1-9]$/.test(e.key) &&
        inputEl.value === '' && currentActions.length >= Number(e.key)) {
      e.preventDefault();
      send(currentActions[Number(e.key) - 1]);
    }
  });

  // ── Settings (localStorage) ──────────────────────────────────────────
  function loadSettings() {
    apiKeyEl.value = localStorage.getItem(LS_KEY) || '';
    modelEl.value = localStorage.getItem(LS_MODEL) || 'gpt-5.5';
  }
  $('chat-settings-btn').addEventListener('click', () => settingsEl.classList.toggle('open'));
  $('chat-save-settings').addEventListener('click', () => {
    localStorage.setItem(LS_KEY, apiKeyEl.value.trim());
    localStorage.setItem(LS_MODEL, modelEl.value.trim() || 'gpt-5.5');
    settingsEl.classList.remove('open');
    setStatus('Einstellungen gespeichert.');
    setTimeout(() => setStatus(''), 1500);
  });
  $('chat-clear').addEventListener('click', () => {
    const toDelete = responseIds.slice();
    lastResponseId = null;
    responseIds = [];
    messagesEl.innerHTML = '';
    messagesEl.appendChild(emptyHint);
    emptyHint.style.display = '';
    setStatus('');
    // Gespeicherte Konversation bei OpenAI löschen (best-effort, blockiert nicht)
    deleteResponses(toDelete);
  });

  // Löscht die server-seitig gespeicherten Responses bei OpenAI (über den Proxy)
  function deleteResponses(ids) {
    if (!ids || !ids.length) return;
    const apiKey = localStorage.getItem(LS_KEY) || '';
    fetch('/api/chat/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, ids })
    }).catch(() => {});
  }
  $('chat-send-buffer').addEventListener('click', sendBuffer);

  // ── Tools ───────────────────────────────────────────────────────────
  async function callTool(name, args = {}) {
    const tool = tools()[name];
    if (!tool) return { error: `Unbekanntes Tool '${name}'.` };
    try {
      return await tool.execute(args || {});
    } catch (err) {
      return { error: String(err?.message || err) };
    }
  }

  // Tools für die Responses-API: hosted web_search + die Terminal-Tools (flaches Format)
  function buildTools() {
    const fns = Object.entries(tools()).map(([name, t]) => ({
      type: 'function',
      name,
      description: t.description,
      parameters: t.inputSchema || { type: 'object', properties: {} }
    }));
    return [{ type: 'web_search' }, ...fns];
  }

  // ── OpenAI Responses-API über Server-Proxy ──────────────────────────
  async function callResponses({ input, previous_response_id }) {
    const apiKey = localStorage.getItem(LS_KEY) || '';
    const model = localStorage.getItem(LS_MODEL) || 'gpt-5.5';
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        model,
        input,
        tools: buildTools(),
        instructions: SYSTEM_PROMPT,
        previous_response_id
      })
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data?.error?.message || `Fehler ${resp.status}`);
    }
    return data;
  }

  // Wertet die Responses-Output-Items aus
  function parseResponse(data) {
    const out = Array.isArray(data.output) ? data.output : [];
    let text = '';
    const functionCalls = [];
    let usedWebSearch = false;
    for (const item of out) {
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.type === 'output_text' && c.text) text += (text ? '\n' : '') + c.text;
        }
      } else if (item.type === 'function_call') {
        functionCalls.push(item);
      } else if (item.type === 'web_search_call') {
        usedWebSearch = true;
      }
    }
    if (!text && typeof data.output_text === 'string') text = data.output_text;
    return { text, functionCalls, usedWebSearch };
  }

  // Führt den Responses-Loop aus: ruft das Modell, führt Function-Calls aus und
  // speist deren Ergebnisse zurück, bis eine finale Antwort kommt.
  async function runResponseLoop(initialInput) {
    let pendingInput = initialInput;
    let prev = lastResponseId;
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      setStatus(round === 0 ? 'Denkt nach …' : 'Verarbeite Ergebnisse …', true);
      const data = await callResponses({ input: pendingInput, previous_response_id: prev });
      if (data.id) {
        lastResponseId = data.id;
        responseIds.push(data.id);
      }
      prev = data.id;

      const { text: assistantText, functionCalls, usedWebSearch } = parseResponse(data);
      if (usedWebSearch) addToolNote('🔎 web_search');
      if (assistantText) addMessage('assistant', assistantText);

      if (!functionCalls.length) break;

      const outputs = [];
      for (const fc of functionCalls) {
        let args = {};
        try {
          args = fc.arguments ? JSON.parse(fc.arguments) : {};
        } catch {
          args = {};
        }

        // run-command muss vom Nutzer bestätigt werden, bevor es ausgeführt wird
        if (fc.name === 'run-command') {
          setStatus('Warte auf Bestätigung …');
          const ok = await confirmCommand(args.command || '');
          if (!ok) {
            outputs.push({
              type: 'function_call_output',
              call_id: fc.call_id,
              output: JSON.stringify({
                declined: true,
                message: 'Der Nutzer hat die Ausführung abgelehnt. Der Befehl wurde NICHT ausgeführt.'
              })
            });
            continue;
          }
        }

        addToolNote(`${fc.name}(${shortArgs(args)})`);
        setStatus(`Tool: ${fc.name} …`, true);
        const result = await callTool(fc.name, args);
        outputs.push({ type: 'function_call_output', call_id: fc.call_id, output: JSON.stringify(result) });
      }
      // Nächste Runde: nur die Tool-Ergebnisse senden, Kontext via previous_response_id
      pendingInput = outputs;
    }
    setStatus('');
  }

  // ── Senden ─────────────────────────────────────────────────────────────
  async function send(forcedText) {
    if (busy) return;
    const text = (forcedText != null ? forcedText : inputEl.value).trim();
    if (!text) return;

    setBusy(true);
    currentActions = [];
    if (forcedText == null) {
      inputEl.value = '';
      autoGrow();
    }
    addMessage('user', text);

    try {
      // Aktuellen Terminal-Buffer als Kontext holen
      setStatus('Lese Terminal-Buffer …', true);
      const buf = await callTool('get-terminal-output', { lines: BUFFER_LINES });
      const bufferText = (buf && buf.lines)
        ? buf.lines.join('\n')
        : `(Buffer nicht verfügbar: ${buf?.error || 'unbekannt'})`;

      await runResponseLoop([
        { role: 'user', content: `Aktueller Terminal-Buffer (letzte ${BUFFER_LINES} Zeilen):\n\`\`\`\n${bufferText}\n\`\`\`` },
        { role: 'user', content: text }
      ]);
    } catch (err) {
      addMessage('error', String(err?.message || err));
      setStatus('');
    } finally {
      setBusy(false);
      inputEl.focus();
    }
  }

  // "Ausführen"-Button: Befehl ausführen UND das Ergebnis zurück ins Modell laden.
  // AUSNAHME zur Bestätigungspflicht: Der Klick auf "Ausführen" IST bereits die
  // Bestätigung des Nutzers – daher hier KEIN zusätzlicher confirmCommand-Dialog,
  // sondern direkter Tool-Aufruf. Der Dialog greift nur, wenn das Modell selbst
  // run-command im Tool-Loop (runResponseLoop) auslöst.
  async function runAndFeed(command, btn) {
    if (busy) return;
    const original = btn.textContent;
    btn.textContent = '⏳ Läuft…';
    setBusy(true);
    currentActions = [];
    addMessage('user', `▶ ${command}`);
    try {
      addToolNote(`run-command(${shortArgs({ command })})`);
      setStatus('Tool: run-command …', true);
      const result = await callTool('run-command', { command });
      btn.textContent = result && result.error ? `⚠ ${result.error}` : '✓ Ausgeführt';

      const outText = result && result.output ? result.output.join('\n') : JSON.stringify(result);
      const running = result && result.still_running ? '\n(Befehl läuft möglicherweise noch.)' : '';
      await runResponseLoop([
        {
          role: 'user',
          content:
            `Ich habe diesen Befehl im Terminal ausgeführt:\n\`\`\`\n${command}\n\`\`\`\n` +
            `Ergebnis:\n\`\`\`\n${outText}\n\`\`\`${running}`
        }
      ]);
    } catch (err) {
      addMessage('error', String(err?.message || err));
      setStatus('');
    } finally {
      setBusy(false);
      setTimeout(() => { btn.textContent = original; }, 1500);
      inputEl.focus();
    }
  }

  // Schickt den aktuellen Terminal-Buffer (letzte Zeilen) erneut ans Modell
  async function sendBuffer() {
    if (busy) return;
    setBusy(true);
    currentActions = [];
    addMessage('user', `📋 Aktuellen Terminal-Buffer (letzte ${BUFFER_LINES} Zeilen) gesendet`);
    try {
      setStatus('Lese Terminal-Buffer …', true);
      const buf = await callTool('get-terminal-output', { lines: BUFFER_LINES });
      const bufferText = (buf && buf.lines)
        ? buf.lines.join('\n')
        : `(Buffer nicht verfügbar: ${buf?.error || 'unbekannt'})`;
      await runResponseLoop([
        {
          role: 'user',
          content:
            `Hier ist der aktuelle Terminal-Buffer (letzte ${BUFFER_LINES} Zeilen). ` +
            `Bitte berücksichtige den neuesten Stand:\n\`\`\`\n${bufferText}\n\`\`\``
        }
      ]);
    } catch (err) {
      addMessage('error', String(err?.message || err));
      setStatus('');
    } finally {
      setBusy(false);
      inputEl.focus();
    }
  }

  function shortArgs(args) {
    const s = JSON.stringify(args);
    return s.length > 60 ? s.slice(0, 57) + '…' : s;
  }

  // ── UI-Helfer ───────────────────────────────────────────────────────
  function setBusy(b) {
    busy = b;
    sendBtn.disabled = b;
    inputEl.disabled = b;
  }

  function setStatus(text, spinner = false) {
    statusEl.innerHTML = '';
    if (spinner) {
      const s = document.createElement('span');
      s.className = 'chat-spinner';
      statusEl.appendChild(s);
    }
    statusEl.appendChild(document.createTextNode(text));
  }

  function addMessage(role, content) {
    emptyHint.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.className = `chat-msg ${role}`;
    const roleEl = document.createElement('div');
    roleEl.className = 'chat-role';
    roleEl.textContent =
      role === 'user' ? 'Du' : role === 'assistant' ? 'Assistent' : role === 'error' ? 'Fehler' : role;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    wrap.appendChild(roleEl);
    wrap.appendChild(bubble);

    if (role === 'assistant') {
      const { text, actions } = parseActions(content);
      renderMarkdown(bubble, text);
      if (actions.length) {
        renderActions(wrap, actions);
        currentActions = actions;
      }
    } else if (role === 'user') {
      bubble.textContent = content;
      bubble.title = 'Klicken zum Wiederholen';
      bubble.style.cursor = 'pointer';
      bubble.addEventListener('click', () => {
        const text = content.startsWith('▶ ') ? content.slice(2) : content;
        inputEl.value = text;
        autoGrow();
        inputEl.focus();
        inputEl.setSelectionRange(text.length, text.length);
      });
    } else {
      bubble.textContent = content;
    }

    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Extrahiert den <<ACTIONS>>-Block aus der Antwort und liefert {text, actions}
  function parseActions(content) {
    const m = content.match(/<<ACTIONS>>([\s\S]*?)<<\/ACTIONS>>/);
    if (!m) return { text: content, actions: [] };
    const actions = m[1]
      .split('\n')
      .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*])\s*/, '').trim())
      .filter((l) => l.length > 0)
      .slice(0, 9);
    const text = content.replace(m[0], '').trim();
    return { text, actions };
  }

  function renderActions(wrap, actions) {
    const box = document.createElement('div');
    box.className = 'chat-actions';
    actions.forEach((label, i) => {
      const btn = document.createElement('button');
      btn.className = 'chat-action';
      btn.title = 'Diese Aktion senden (Taste ' + (i + 1) + ')';
      const num = document.createElement('span');
      num.className = 'chat-action-num';
      num.textContent = String(i + 1);
      btn.appendChild(num);
      btn.appendChild(document.createTextNode(' ' + label));
      btn.addEventListener('click', () => send(label));
      box.appendChild(btn);
    });
    wrap.appendChild(box);
  }

  // Zeigt einen Bestätigungs-Dialog für einen Befehl und löst mit true/false auf
  function confirmCommand(command) {
    emptyHint.style.display = 'none';
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'chat-msg confirm';
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';

      const q = document.createElement('div');
      q.className = 'chat-confirm-q';
      q.textContent = 'Diesen Befehl im Terminal ausführen?';
      const pre = document.createElement('pre');
      pre.className = 'chat-confirm-cmd';
      pre.textContent = command;

      const actions = document.createElement('div');
      actions.className = 'chat-code-actions';
      const yes = document.createElement('button');
      yes.textContent = '✓ Ausführen';
      const no = document.createElement('button');
      no.textContent = '✗ Ablehnen';

      const finish = (ok) => {
        yes.disabled = true;
        no.disabled = true;
        (ok ? yes : no).textContent = ok ? '✓ Bestätigt' : '✗ Abgelehnt';
        resolve(ok);
      };
      yes.addEventListener('click', () => finish(true));
      no.addEventListener('click', () => finish(false));

      actions.appendChild(yes);
      actions.appendChild(no);
      bubble.appendChild(q);
      bubble.appendChild(pre);
      bubble.appendChild(actions);
      wrap.appendChild(bubble);
      messagesEl.appendChild(wrap);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function addToolNote(label) {
    emptyHint.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg tool';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = `🔧 ${label}`;
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── Minimaler, XSS-sicherer Markdown-Renderer ──────────────────────────
  function renderMarkdown(container, text) {
    const fence = /```(\w*)\n?([\s\S]*?)```/g;
    let last = 0;
    let m;
    while ((m = fence.exec(text))) {
      if (m.index > last) appendTextBlock(container, text.slice(last, m.index));
      appendCodeBlock(container, m[2].replace(/\n$/, ''));
      last = fence.lastIndex;
    }
    if (last < text.length) appendTextBlock(container, text.slice(last));
  }

  function appendTextBlock(container, text) {
    for (const para of text.split(/\n{2,}/)) {
      const trimmed = para.replace(/^\n+|\n+$/g, '');
      if (!trimmed) continue;
      const p = document.createElement('p');
      const lines = trimmed.split('\n');
      lines.forEach((line, i) => {
        appendInline(p, line);
        if (i < lines.length - 1) p.appendChild(document.createElement('br'));
      });
      container.appendChild(p);
    }
  }

  function appendInline(parent, text) {
    const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
    let last = 0;
    let m;
    while ((m = regex.exec(text))) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      const tok = m[0];
      if (tok.startsWith('`')) {
        const c = document.createElement('code');
        c.className = 'chat-code-inline';
        c.textContent = tok.slice(1, -1);
        parent.appendChild(c);
      } else {
        const b = document.createElement('strong');
        b.textContent = tok.slice(2, -2);
        parent.appendChild(b);
      }
      last = regex.lastIndex;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  function appendCodeBlock(container, code) {
    const block = document.createElement('div');
    block.className = 'chat-codeblock';
    const pre = document.createElement('pre');
    const codeEl = document.createElement('code');
    codeEl.textContent = code;
    pre.appendChild(codeEl);
    block.appendChild(pre);

    const actions = document.createElement('div');
    actions.className = 'chat-code-actions';

    const pasteBtn = document.createElement('button');
    pasteBtn.textContent = '↪ Einfügen';
    pasteBtn.title = 'In das Terminal tippen (ohne Enter)';
    pasteBtn.addEventListener('click', () => applyCode(pasteBtn, 'send-input', { text: code }, 'Eingefügt'));

    const runBtn = document.createElement('button');
    runBtn.textContent = '▶ Ausführen';
    runBtn.title = 'Im Terminal ausführen und Ergebnis ans Modell senden';
    runBtn.addEventListener('click', () => runAndFeed(code, runBtn));

    actions.appendChild(pasteBtn);
    actions.appendChild(runBtn);
    block.appendChild(actions);
    container.appendChild(block);
  }

  async function applyCode(btn, tool, args, okLabel) {
    const original = btn.textContent;
    btn.disabled = true;
    const res = await callTool(tool, args);
    const ok = !(res && res.error);
    btn.textContent = ok ? `✓ ${okLabel}` : `⚠ ${res.error}`;
    // Nach dem Einfügen Terminal fokussieren, damit der Nutzer direkt Enter drücken kann
    if (ok && tool === 'send-input' && window.focusTerminal) window.focusTerminal();
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, ok ? 1500 : 2500);
  }

  // ── Eingabe ────────────────────────────────────────────────────────────
  function autoGrow() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
  }
  inputEl.addEventListener('input', autoGrow);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  sendBtn.addEventListener('click', send);

  // ── Init ─────────────────────────────────────────────────────────────
  loadSettings();
})();
