const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onShortcut: (callback) => {
    ipcRenderer.on('app-shortcut', (_event, payload) => callback(payload));
  },
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  copyText: (text) => ipcRenderer.invoke('clipboard-write', text),
  readClipboard: () => ipcRenderer.invoke('clipboard-read'),
  clearSessionData: (providerUrl) => ipcRenderer.invoke('clear-provider-session', providerUrl)
});
