const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onShortcut: (callback) => {
    ipcRenderer.on('app-shortcut', (_event, payload) => callback(payload));
  },
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  copyText: (text) => clipboard.writeText(text),
  readClipboard: () => clipboard.readText(),
  clearSessionData: (providerUrl) => ipcRenderer.invoke('clear-provider-session', providerUrl)
});
