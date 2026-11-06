const { app, BrowserWindow, session, Menu, shell, ipcMain, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

// Strip Electron identifier so Google OAuth, Apple ID & Cloudflare Turnstile work seamlessly
app.userAgentFallback = CHROME_USER_AGENT;

let mainWindow = null;

async function ensureOllamaServerRunning() {
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags');
    if (res.ok) return { ok: true, status: 'already-running' };
  } catch (_err) {
    // Not running yet, start ollama serve in background if installed
  }

  const candidatePaths = [
    '/opt/homebrew/bin/ollama',
    '/usr/local/bin/ollama',
    '/usr/bin/ollama'
  ];

  const ollamaBin = candidatePaths.find((p) => fs.existsSync(p)) || 'ollama';

  try {
    const child = spawn(ollamaBin, ['serve'], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        OLLAMA_ORIGINS: '*'
      }
    });
    child.unref();
    return { ok: true, status: 'started' };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

const providerHosts = ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'aistudio.google.com', 'perplexity.ai', 'chat.deepseek.com', 'grok.com', 'venice.ai'];
const authHosts = [...providerHosts, 'accounts.google.com', 'appleid.apple.com', 'auth0.com', 'login.microsoftonline.com', 'github.com', 'openai.com', 'anthropic.com', 'deepseek.com', 'x.com', 'twitter.com'];
function parseWebUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch (_) { return null; }
}
function hostAllowed(url, hosts) {
  return Boolean(url && url.protocol === 'https:' && hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host)));
}
function trustedPermissionRequest(contents, origin) {
  const requested = parseWebUrl(origin);
  const top = parseWebUrl(contents?.getURL());
  const trustedHosts = [...providerHosts, 'www.perplexity.ai'];
  return Boolean(requested && top && requested.protocol === 'https:' && top.protocol === 'https:' &&
    trustedHosts.includes(requested.hostname) && trustedHosts.includes(top.hostname) && requested.origin === top.origin);
}
function configureAISession() {
  const aiSession = session.fromPartition('persist:ia-use');
  aiSession.setUserAgent(CHROME_USER_AGENT);

  // Allow local Ollama <webview> to talk to 127.0.0.1:11434 without CORS issues
  aiSession.webRequest.onBeforeSendHeaders(
    { urls: ['http://127.0.0.1:11434/*', 'http://localhost:11434/*'] },
    (details, callback) => {
      const requestHeaders = { ...details.requestHeaders };
      delete requestHeaders.Origin;
      delete requestHeaders.origin;
      callback({ requestHeaders });
    }
  );

  aiSession.webRequest.onHeadersReceived(
    { urls: ['http://127.0.0.1:11434/*', 'http://localhost:11434/*'] },
    (details, callback) => {
      const responseHeaders = {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Headers': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, OPTIONS, DELETE']
      };
      callback({ responseHeaders });
    }
  );
  aiSession.setPermissionCheckHandler((contents, permission, origin, details) => {
    if (!trustedPermissionRequest(contents, origin)) return false;
    if (permission === 'media' || permission === 'audioCapture') {
      return false; // A request must pass through the explicit consent dialog.
    }
    return ['clipboard-sanitized-write', 'fullscreen'].includes(permission);
  });
  aiSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    if (!trustedPermissionRequest(contents, details?.requestingUrl)) return callback(false);
    if (permission === 'media' || permission === 'audioCapture') {
      const types = details.mediaTypes || (permission === 'audioCapture' ? ['audio'] : []);
      if (!types.length || types.some(type => type !== 'audio')) return callback(false);
      try {
        if (!mainWindow || mainWindow.isDestroyed()) return callback(false);
        const result = await dialog.showMessageBox(mainWindow, {
          type: 'question', buttons: ['Nega', 'Consenti'], defaultId: 0, cancelId: 0,
          title: 'Accesso al microfono',
          message: `${new URL(details.requestingUrl).hostname} chiede di usare il microfono.`,
          detail: 'Consenti solo se vuoi utilizzare la modalità vocale.'
        });
        return callback(result.response === 1 && trustedPermissionRequest(contents, details?.requestingUrl));
      } catch (_) { return callback(false); }
    }
    callback(['clipboard-sanitized-write', 'fullscreen'].includes(permission));
  });
}

function createMainWindow() {
  configureAISession();

  mainWindow = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0B0C0E',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      spellcheck: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Apply the same popup policy to provider views and their OAuth child windows.
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() !== 'webview' && contents.session !== session.fromPartition('persist:ia-use')) return;
  contents.setUserAgent(CHROME_USER_AGENT);
  contents.setWindowOpenHandler(({ url }) => {
    const parsed = parseWebUrl(url);
    if (!parsed) return { action: 'deny' };
    if (hostAllowed(parsed, authHosts)) {
      return { action: 'allow', overrideBrowserWindowOptions: {
        width: 540, height: 700, center: true, title: 'Autenticazione AI — IA-Use',
        backgroundColor: '#121418', webPreferences: {
          partition: 'persist:ia-use', nodeIntegration: false, contextIsolation: true, sandbox: true
        }
      } };
    }
    shell.openExternal(parsed.href).catch(() => {});
    return { action: 'deny' };
  });
  if (contents.getType() !== 'webview') {
    contents.on('will-navigate', (event, url) => {
      const parsed = parseWebUrl(url);
      if (!hostAllowed(parsed, authHosts)) {
        event.preventDefault();
        if (parsed) shell.openExternal(parsed.href).catch(() => {});
      }
    });
  }
});

function sendShortcut(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-shortcut', payload);
  }
}

function buildAppMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Modifica',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Ambienti AI',
      submenu: [
        {
          label: 'ChatGPT',
          accelerator: 'CmdOrCtrl+1',
          click: () => sendShortcut({ type: 'provider', id: 'chatgpt' })
        },
        {
          label: 'Claude',
          accelerator: 'CmdOrCtrl+2',
          click: () => sendShortcut({ type: 'provider', id: 'claude' })
        },
        {
          label: 'Gemini',
          accelerator: 'CmdOrCtrl+3',
          click: () => sendShortcut({ type: 'provider', id: 'gemini' })
        },
        {
          label: 'Perplexity',
          accelerator: 'CmdOrCtrl+4',
          click: () => sendShortcut({ type: 'provider', id: 'perplexity' })
        },
        {
          label: 'DeepSeek',
          accelerator: 'CmdOrCtrl+5',
          click: () => sendShortcut({ type: 'provider', id: 'deepseek' })
        },
        {
          label: 'Grok',
          accelerator: 'CmdOrCtrl+6',
          click: () => sendShortcut({ type: 'provider', id: 'grok' })
        },
        {
          label: 'Google AI Studio',
          accelerator: 'CmdOrCtrl+7',
          click: () => sendShortcut({ type: 'provider', id: 'aistudio' })
        },
        {
          label: 'Venice AI',
          accelerator: 'CmdOrCtrl+8',
          click: () => sendShortcut({ type: 'provider', id: 'venice' })
        },
        {
          label: 'Ollama Locale',
          accelerator: 'CmdOrCtrl+9',
          click: () => sendShortcut({ type: 'provider', id: 'ollama' })
        },
        { type: 'separator' },
        {
          label: 'Focus Barra Multi-Prompt',
          accelerator: 'CmdOrCtrl+K',
          click: () => sendShortcut({ type: 'focus-omnibar' })
        },
        {
          label: 'Cattura Risposta per Relay',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => sendShortcut({ type: 'capture-active' })
        }
      ]
    },
    {
      label: 'Layout & Vista',
      submenu: [
        {
          label: 'Vista Singola (Focus 1x)',
          accelerator: 'CmdOrCtrl+Shift+1',
          click: () => sendShortcut({ type: 'layout', mode: '1x' })
        },
        {
          label: 'Split 2 Colonne (2x)',
          accelerator: 'CmdOrCtrl+Shift+2',
          click: () => sendShortcut({ type: 'layout', mode: '2x' })
        },
        {
          label: 'Split 3 Colonne (3x)',
          accelerator: 'CmdOrCtrl+Shift+3',
          click: () => sendShortcut({ type: 'layout', mode: '3x' })
        },
        {
          label: 'Griglia 4 AI (2x2)',
          accelerator: 'CmdOrCtrl+Shift+4',
          click: () => sendShortcut({ type: 'layout', mode: '2x2' })
        },
        { type: 'separator' },
        {
          label: 'Ricarica Pannello AI Attivo',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendShortcut({ type: 'reload-active' })
        },
        {
          label: 'Mostra/Nascondi Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendShortcut({ type: 'toggle-sidebar' })
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Finestra',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function requireHost(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error('Operazione non autorizzata');
  }
}
ipcMain.handle('open-external', async (event, url) => {
  requireHost(event);
  const parsed = typeof url === 'string' && parseWebUrl(url);
  if (!parsed) throw new Error('Indirizzo non valido');
  await shell.openExternal(parsed.href);
});
ipcMain.handle('clipboard-write', (event, text) => {
  requireHost(event);
  if (typeof text !== 'string' || text.length > 10_000_000) throw new Error('Testo non valido');
  clipboard.writeText(text);
});
ipcMain.handle('clipboard-read', (event) => {
  requireHost(event);
  return clipboard.readText();
});
ipcMain.handle('clear-provider-session', async (event, originUrl) => {
  requireHost(event);
  const parsed = typeof originUrl === 'string' && parseWebUrl(originUrl);
  if (!hostAllowed(parsed, providerHosts)) throw new Error('Origine non valida');
  await session.fromPartition('persist:ia-use').clearStorageData({ origin: parsed.origin });
  return true;
});

app.whenReady().then(() => {
  ensureOllamaServerRunning();
  buildAppMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
