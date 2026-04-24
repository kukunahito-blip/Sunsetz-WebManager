const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getSites: () => ipcRenderer.invoke('get-sites'),
    saveSite: (site) => ipcRenderer.invoke('verify-and-save-site', site),
    deleteSite: (index) => ipcRenderer.invoke('delete-site', index),
    openServer: (url) => ipcRenderer.send('open-server', url)
});