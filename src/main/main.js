const { app, BrowserWindow, session, Menu, shell, ipcMain } = require('electron');
const path = require('path');

const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

// Strip Electron identifier so Google OAuth, Apple ID & Cloudflare Turnstile work seamlessly
app.userAgentFallback = CHROME_USER_AGENT;

let mainWindow = null;

function configureAISession() {
  const aiSession = session.fromPartition('persist:ia-use');
  aiSession.setUserAgent(CHROME_USER_AGENT);

  // Grant permissions needed by AI web apps (clipboard copy, mic for voice mode, notifications)
  aiSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowedPermissions = [
      'clipboard-read',
      'clipboard-sanitized-write',
      'media',
      'audioCapture',
      'notifications',
      'fullscreen'
    ];
    callback(allowedPermissions.includes(permission));
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

// Configure all <webview> instances for seamless OAuth popups (Google, Apple, Microsoft, GitHub)
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'webview') {
    contents.setUserAgent(CHROME_USER_AGENT);

    contents.setWindowOpenHandler(({ url }) => {
      // Allow login / OAuth popups in a shared-session child window so cookies persist in the webview
      const isAuthOrPopup =
        url.includes('accounts.google.com') ||
        url.includes('appleid.apple.com') ||
        url.includes('auth0.com') ||
        url.includes('login.microsoftonline.com') ||
        url.includes('github.com/login') ||
        url.includes('chatgpt.com') ||
        url.includes('openai.com') ||
        url.includes('claude.ai') ||
        url.includes('anthropic.com') ||
        url.includes('perplexity.ai') ||
        url.includes('deepseek.com') ||
        url.includes('grok.com') ||
        url.includes('venice.ai') ||
        url.includes('x.com') ||
        url.includes('twitter.com');

      if (isAuthOrPopup) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 540,
            height: 700,
            center: true,
            title: 'Autenticazione AI — IA-Use',
            backgroundColor: '#121418',
            webPreferences: {
              partition: 'persist:ia-use',
              nodeIntegration: false,
              contextIsolation: true
            }
          }
        };
      }

      // Open external reference links in the user's default system browser
      shell.openExternal(url);
      return { action: 'deny' };
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

ipcMain.handle('open-external', async (_event, url) => {
  if (url && /^https?:\/\//i.test(url)) {
    await shell.openExternal(url);
  }
});

ipcMain.handle('clear-provider-session', async (_event, originUrl) => {
  const aiSession = session.fromPartition('persist:ia-use');
  if (originUrl) {
    await aiSession.clearStorageData({ origin: new URL(originUrl).origin });
  }
  return true;
});

app.whenReady().then(() => {
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
