// Background Script für Web Terminal Chrome Extension

// Default-Einstellungen
const DEFAULT_SETTINGS = {
  terminalUrl: 'http://localhost:3000',
  shortcut: 'Command+Period',
  autoGroup: true,
  groupName: '🖥️ Terminals',
  groupColor: 'blue'
};

// Extension-Installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Web Terminal Extension installiert');
  
  // Standard-Einstellungen setzen
  chrome.storage.sync.set(DEFAULT_SETTINGS);
  
  // // Context Menu erstellen
  // chrome.contextMenus.create({
  //   id: 'open-terminal',
  //   title: '🖥️ Neues Terminal öffnen',
  //   contexts: ['page', 'selection']
  // });
});

// Keyboard Command Handler
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-terminal') {
    await openNewTerminal();
  }
});

// chrome.contextMenus.onClicked.addListener((info, tab) => {
//   if (info.menuItemId === 'open-terminal') {
//     openNewTerminal();
//   }
// });

// Neues Terminal öffnen
async function openNewTerminal(sessionName = null) {
  try {
    const settings = await getSettings();
    
    // URL mit optionalem Session-Parameter
    let url = settings.terminalUrl;
    if (sessionName) {
      const urlObj = new URL(url);
      urlObj.searchParams.set('session', sessionName);
      url = urlObj.toString();
    }
    
    // Neuen Tab erstellen
    const newTab = await chrome.tabs.create({
      url: url,
      active: true
    });
    
    console.log('Neues Terminal geöffnet:', newTab.id, sessionName ? `(Session: ${sessionName})` : '');
    
    // Auto-Gruppierung wenn aktiviert
    if (settings.autoGroup) {
      await groupTerminalTabs(newTab.id, settings);
    }
    
  } catch (error) {
    console.error('Fehler beim Öffnen des Terminals:', error);
  }
}

// Terminal-Tabs gruppieren
async function groupTerminalTabs(newTabId, settings) {
  try {
    // Alle Tabs durchsuchen
    const allTabs = await chrome.tabs.query({});
    
    // Terminal-Tabs finden (basierend auf URL)
    const terminalTabs = allTabs.filter(tab => {
      if (!tab.url) return false;
      
      try {
        const tabUrl = new URL(tab.url);
        const terminalUrl = new URL(settings.terminalUrl);
        return tabUrl.host === terminalUrl.host && tabUrl.pathname === terminalUrl.pathname;
      } catch (error) {
        return false;
      }
    });
    
    if (terminalTabs.length <= 1) {
      return; // Keine Gruppierung nötig bei nur einem Tab
    }
    
    // Bestehende Terminal-Gruppe suchen
    const existingGroups = await chrome.tabGroups.query({});
    let terminalGroup = existingGroups.find(group => 
      group.title === settings.groupName
    );
    
    if (terminalGroup) {
      // Neuen Tab zur bestehenden Gruppe hinzufügen
      await chrome.tabs.group({
        tabIds: [newTabId],
        groupId: terminalGroup.id
      });
      
      console.log('Tab zur bestehenden Gruppe hinzugefügt:', terminalGroup.id);
    } else {
      // Neue Gruppe erstellen
      const tabIds = terminalTabs.map(tab => tab.id);
      
      const groupId = await chrome.tabs.group({
        tabIds: tabIds
      });
      
      // Gruppe konfigurieren
      await chrome.tabGroups.update(groupId, {
        title: settings.groupName,
        color: settings.groupColor,
        collapsed: false
      });
      
      console.log('Neue Terminal-Gruppe erstellt:', groupId);
    }
    
  } catch (error) {
    console.error('Fehler bei Tab-Gruppierung:', error);
  }
}

// Einstellungen laden
async function getSettings() {
  const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...result };
}

// Message Handler für Popup und Options
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'openTerminal':
      openNewTerminal();
      sendResponse({ success: true });
      break;
      
    case 'getSettings':
      getSettings().then(settings => {
        sendResponse({ settings });
      });
      return true; // Async response
      
    case 'saveSettings':
      chrome.storage.sync.set(request.settings).then(() => {
        sendResponse({ success: true });
      });
      return true; // Async response
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

// Tab-Events überwachen für automatische Gruppierung
chrome.tabs.onCreated.addListener(async (tab) => {
  // Kurz warten, damit URL geladen wird
  setTimeout(async () => {
    const updatedTab = await chrome.tabs.get(tab.id);
    const settings = await getSettings();
    
    if (updatedTab.url && 
        updatedTab.url.includes(new URL(settings.terminalUrl).host) &&
        settings.autoGroup) {
      await groupTerminalTabs(tab.id, settings);
    }
  }, 1000);
});

// Wenn Tab-Gruppe gelöscht wird, neue erstellen falls noch Terminal-Tabs vorhanden
chrome.tabGroups.onRemoved.addListener(async (group) => {
  const settings = await getSettings();
  
  if (group.title === settings.groupName && settings.autoGroup) {
    // Nach kurzer Verzögerung prüfen ob noch Terminal-Tabs da sind
    setTimeout(async () => {
      const allTabs = await chrome.tabs.query({});
      const terminalTabs = allTabs.filter(tab => 
        tab.url && tab.url.includes(new URL(settings.terminalUrl).host)
      );
      
      if (terminalTabs.length > 1) {
        // Neue Gruppe erstellen
        const tabIds = terminalTabs.map(tab => tab.id);
        const groupId = await chrome.tabs.group({ tabIds });
        
        await chrome.tabGroups.update(groupId, {
          title: settings.groupName,
          color: settings.groupColor,
          collapsed: false
        });
      }
    }, 500);
  }
});