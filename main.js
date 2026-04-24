const { app, BrowserWindow, ipcMain, net } = require("electron");
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// --- SYSTÈME DE MISE À JOUR ORIGINEL ---
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let configWindow;
const sitesPath = path.join(app.getPath('userData'), 'sites-config.json');

const customCSS = `
    ::-webkit-scrollbar {
        width: 12px;
        }
    ::-webkit-scrollbar-track {
        background: #141d22;
        }
    ::-webkit-scrollbar-thumb {
        background: #20292f;
        border-radius: 6px;
        border: 3px solid #1e2227;
        }
    ::-webkit-scrollbar-thumb:hover {
        background: #217fc2;
        }
`;

function createConfigWindow() {
    configWindow = new BrowserWindow({
        width: 500,
        height: 680,
        resizable: false,
        fullscreenable: false,
        autoHideMenuBar: true,
        MenuBar: false,
        icon: path.join(__dirname, 'assets', 'sunsetz-logo.png'),

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    configWindow.removeMenu();
    configWindow.loadFile('index.html');
}

// --- IPC HANDLERS (Gestion des données & Ping) ---

ipcMain.handle('get-sites', () => {
    if (!fs.existsSync(sitesPath)) return [];
    try { return JSON.parse(fs.readFileSync(sitesPath, 'utf8')); } 
    catch (e) { return []; }
});

// Ton système de vérification "Ping" originel pour valider l'URL
ipcMain.handle('verify-and-save-site', async (event, site) => {
    return new Promise((resolve) => {
        const request = net.request({ method: 'GET', url: site.url, redirect: 'follow' });
        
        // Sécurité timeout de 5 secondes
        const timeout = setTimeout(() => {
            request.abort();
            resolve({ success: false });
        }, 5000);

        request.on('response', (response) => {
            clearTimeout(timeout);
            if (response.statusCode >= 200 && response.statusCode < 400) {
                let sites = [];
                if (fs.existsSync(sitesPath)) sites = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));
                sites.push(site);
                fs.writeFileSync(sitesPath, JSON.stringify(sites, null, 2));
                resolve({ success: true });
            } else {
                resolve({ success: false });
            }
        });

        request.on('error', () => {
            clearTimeout(timeout);
            resolve({ success: false });
        });
        request.end();
    });
});

ipcMain.handle('delete-site', (event, index) => {
    let sites = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));
    sites.splice(index, 1);
    fs.writeFileSync(sitesPath, JSON.stringify(sites, null, 2));
    return sites;
});

ipcMain.on('open-server', (event, url) => {
    const win = new BrowserWindow({
        width: 1100, height: 800,
        icon: path.join(__dirname, 'assets', 'sunsetz-logo.png'),
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    win.loadURL(url);
    win.webContents.on('did-finish-load', () => { win.webContents.insertCSS(customCSS); });
});

// --- CYCLE DE VIE (Support Mac/Linux/Win) ---
app.whenReady().then(() => {
    createConfigWindow();
    autoUpdater.checkForUpdatesAndNotify(); // Lancement des MAJ
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createConfigWindow();
});