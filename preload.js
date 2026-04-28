const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    web: {
        getSites: () => ipcRenderer.invoke('get-sites'),
        saveSite: (site) => ipcRenderer.invoke('verify-and-save-site', site),
        deleteSite: (index) => ipcRenderer.invoke('delete-site', index),
        openServer: (url) => ipcRenderer.send('open-server', url)
    },
    onLoadUrl: (callback) => ipcRenderer.on('load-url', (event, url) => callback(url)),
    onUpdateTitle: (callback) => ipcRenderer.on('update-title', (event, title) => callback(title)),
    window: {
        close: () => ipcRenderer.send("action", { type: "window::close" }),
        minimize: () => ipcRenderer.send("action", { type: "window::minimize" }),
        maximize: () => ipcRenderer.send("action", { type: "window::maximize" })
    },
});