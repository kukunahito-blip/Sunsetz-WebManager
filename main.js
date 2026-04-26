const { app, BrowserWindow, ipcMain, net } = require("electron");
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// --- SYSTÈME DE MISE À JOUR ---
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
        height: 650,
        resizable: false,
        frame: false,
        devTools: true,
        icon: path.join(__dirname, 'assets', 'icon.png'),

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
    });
    configWindow.removeMenu();
    configWindow.loadFile('index.html');
    // La norme actuelle
    configWindow.webContents.setWindowOpenHandler((details) => {
        return { action: 'deny' }; 
    });
}

// --- IPC HANDLERS (Gestion des données & Ping) ---

ipcMain.handle('get-sites', () => {
    if (!fs.existsSync(sitesPath)) return [];
    try { return JSON.parse(fs.readFileSync(sitesPath, 'utf8')); } 
    catch (e) { return []; }
});

// --- SYSTÈME DE VÉRIFICATION & SAUVEGARDE (Ping avant d'ajouter) ---
ipcMain.handle('verify-and-save-site', async (event, site) => {
    return new Promise((resolve) => {
        try {
            const request = net.request({ method: 'GET', url: site.url, redirect: 'follow' });
            
            const timeout = setTimeout(() => {
                request.abort();
                resolve({ success: false });
            }, 5000);

            request.on('response', (response) => {
                clearTimeout(timeout);
                
                response.on('data', () => {}); 
                
                response.on('end', () => {
                    if (response.statusCode >= 200 && response.statusCode < 400) {
                        try {
                            let sites = [];
                            if (fs.existsSync(sitesPath)) {
                                const fileContent = fs.readFileSync(sitesPath, 'utf8');
                                if (fileContent.trim() !== '') {
                                    sites = JSON.parse(fileContent);
                                }
                            }
                            sites.push(site);
                            fs.writeFileSync(sitesPath, JSON.stringify(sites, null, 2));
                            resolve({ success: true });
                        } catch (err) {
                            console.error("Erreur d'écriture JSON :", err);
                            resolve({ success: false });
                        }
                    } else {
                        resolve({ success: false });
                    }
                });
            });

            request.on('error', (err) => {
                clearTimeout(timeout);
                resolve({ success: false });
            });
            
            request.end();

        } catch (err) {
            console.error("Erreur critique net.request :", err);
            resolve({ success: false });
        }
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
        icon: path.join(__dirname, 'assets', 'icon.png'),
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false }
    });
    win.loadURL(url);
    win.removeMenu();
    win.webContents.on('did-finish-load', () => { win.webContents.insertCSS(customCSS); });
});

ipcMain.on("action", async (event, data) => {
    const win = BrowserWindow.getFocusedWindow();
    switch (data.type) {
        case "window::close":
            app.exit(0)
            break
        case "window::minimize":
            win.minimize()
            break
    }
});
// --- CYCLE DE VIE (Support Mac/Linux/Win) ---
app.whenReady().then(() => {
    createConfigWindow();
    autoUpdater.checkForUpdatesAndNotify();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createConfigWindow();
});