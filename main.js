const { app, BrowserWindow, WebContentsView, ipcMain, net, Menu, MenuItem, clipboard, nativeImage } = require("electron");
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
const TITLEBAR_HEIGHT = 25;

// --- FENÊTRE DE CONFIGURATION ---

function createConfigWindow() {
    configWindow = new BrowserWindow({
        width: 500,
        height: 650,
        resizable: false,
        frame: false,
        devTools: true,
        backgroundColor: '#1b262c',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
    });
    configWindow.removeMenu();
    configWindow.loadFile('index.html');
    configWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

// --- IPC HANDLERS ---

ipcMain.handle('get-sites', () => {
    if (!fs.existsSync(sitesPath)) return [];
    try { return JSON.parse(fs.readFileSync(sitesPath, 'utf8')); }
    catch (e) { return []; }
});

// Vérification de l'URL et sauvegarde du site
ipcMain.handle('verify-and-save-site', async (event, site) => {
    return new Promise((resolve) => {
        try {
            const request = net.request({ method: 'GET', url: site.url, redirect: 'follow' });
            const timeout = setTimeout(() => { request.abort(); resolve({ success: false }); }, 5000);

            request.on('response', (response) => {
                clearTimeout(timeout);
                response.on('data', () => {});
                response.on('end', () => {
                    if (response.statusCode >= 200 && response.statusCode < 400) {
                        try {
                            let sites = [];
                            if (fs.existsSync(sitesPath)) {
                                const fileContent = fs.readFileSync(sitesPath, 'utf8');
                                if (fileContent.trim() !== '') sites = JSON.parse(fileContent);
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
            request.on('error', () => { clearTimeout(timeout); resolve({ success: false }); });
            request.end();
        } catch (err) {
            console.error("Erreur critique net.request :", err);
            resolve({ success: false });
        }
    });
});

// Suppression d'un site par index
ipcMain.handle('delete-site', (event, index) => {
    try {
        let sites = JSON.parse(fs.readFileSync(sitesPath, 'utf8'));
        sites.splice(index, 1);
        fs.writeFileSync(sitesPath, JSON.stringify(sites, null, 2));
        return sites;
    } catch (err) {
        console.error("Erreur suppression site :", err);
        return [];
    }
});

// --- OUVERTURE D'UNE FENÊTRE DE NAVIGATION ---

ipcMain.on('open-server', (event, url) => {
    const win = new BrowserWindow({
        width: 1200,
        height: 900,
        frame: false,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        backgroundColor: '#1b262c',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    win.loadFile('viewer.html');

    const view = new WebContentsView({
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    win.contentView.addChildView(view);

    const updateBounds = () => {
        const [w, h] = win.getSize();
        view.setBounds({ x: 0, y: TITLEBAR_HEIGHT, width: w, height: h - TITLEBAR_HEIGHT });
    };
    updateBounds();
    win.on('resize', updateBounds);

    view.webContents.loadURL(url);

    view.webContents.on('page-title-updated', (e, title) => {
        win.webContents.send('update-title', title);
    });

    // Injection de JavaScript pour activer la navigation avec les boutons souris (back/forward)
    const injectMouseButtons = () => {
        view.webContents.executeJavaScript(`
            if (!window.__mouseNavInjected) {
                window.__mouseNavInjected = true;
                document.addEventListener('mouseup', (e) => {
                    if (e.button === 3) { e.preventDefault(); history.back(); }
                    else if (e.button === 4) { e.preventDefault(); history.forward(); }
                }, true);
            }
        `).catch(() => {});
    };

    // Injection du CSS pour personnaliser les scrollbars
    const injectScrollbar = () => {
        view.webContents.insertCSS(`
            html::-webkit-scrollbar, body::-webkit-scrollbar, ::-webkit-scrollbar {
                width: 12px !important; height: 12px !important; display: block !important;
            }
            html::-webkit-scrollbar-track, body::-webkit-scrollbar-track, ::-webkit-scrollbar-track {
                background: #1c1e20 !important;
            }
            html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb {
                background: #272727 !important; border-radius: 6px !important;
                border: 3px solid #1a1c1fa4 !important;
            }
            html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover, ::-webkit-scrollbar-thumb:hover {
                background: #363636 !important;
            }
            ::-webkit-scrollbar-button { display: none !important; }
        `).catch(() => {});
    };

    view.webContents.on('did-finish-load', () => {
        injectMouseButtons();
        injectScrollbar();
    });

    // Gestion des liens ouverts dans de nouvelles fenêtres
    view.webContents.setWindowOpenHandler(({ url: openUrl }) => {
        const req = net.request({ method: 'HEAD', url: openUrl, redirect: 'follow' });

        req.on('response', (res) => {
            const cd = (res.headers['content-disposition'] || '').toLowerCase();
            const ct = (res.headers['content-type'] || '').toLowerCase();

            const isDownload =
                cd.includes('attachment') ||
                (ct !== '' &&
                    !ct.includes('text/html') &&
                    !ct.includes('text/plain') &&
                    !ct.includes('application/json'));

            if (isDownload) {
                view.webContents.downloadURL(openUrl);
            } else {
                setImmediate(() => view.webContents.loadURL(openUrl));
            }
        });

        req.on('error', () => setImmediate(() => view.webContents.loadURL(openUrl)));
        req.end();
        return { action: 'deny' };
    });

    // --- MENU CONTEXTUEL ---

    view.webContents.on('context-menu', (e, params) => {
        const menu = new Menu();
        const wc = view.webContents;

        // Champ éditable
        if (params.isEditable) {
            if (params.selectionText) {
                menu.append(new MenuItem({ label: 'Couper',        click: () => wc.cut() }));
                menu.append(new MenuItem({ label: 'Copier',        click: () => wc.copy() }));
            }
            menu.append(new MenuItem({ label: 'Coller',            click: () => wc.paste() }));
            menu.append(new MenuItem({ label: 'Sélectionner tout', click: () => wc.selectAll() }));

        } else if (params.selectionText) {
            // Texte sélectionné hors champ
            menu.append(new MenuItem({ label: 'Copier', click: () => wc.copy() }));
        }

        // Lien
        if (params.linkURL) {
            if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }));
            menu.append(new MenuItem({
                label: 'Enregistrer le lien sous...',
                click: () => wc.downloadURL(params.linkURL)
            }));
            menu.append(new MenuItem({
                label: "Copier l'adresse du lien",
                click: () => clipboard.writeText(params.linkURL)
            }));
        }

        // Image
        if (params.mediaType === 'image' && params.srcURL) {
            if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }));
            menu.append(new MenuItem({
                label: "Enregistrer l'image sous...",
                click: () => wc.downloadURL(params.srcURL)
            }));
            menu.append(new MenuItem({
                label: "Copier l'image",
                click: () => {
                    const srcUrl = params.srcURL;

                    if (srcUrl.startsWith('data:')) {
                        // Image encodée en base64 directement dans l'URL
                        try {
                            const base64Data = srcUrl.split(',')[1];
                            const buffer = Buffer.from(base64Data, 'base64');
                            const img = nativeImage.createFromBuffer(buffer);
                            if (!img.isEmpty()) clipboard.writeImage(img);
                        } catch (err) {
                            console.error("Erreur copie image data: :", err);
                        }

                    } else if (srcUrl.startsWith('blob:')) {
                        // Blob URL : on passe par le contexte de la page pour le lire
                        wc.executeJavaScript(`
                            (async () => {
                                const res = await fetch('${srcUrl}');
                                const blob = await res.blob();
                                return new Promise((resolve) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => resolve(reader.result);
                                    reader.readAsDataURL(blob);
                                });
                            })()
                        `).then((dataUrl) => {
                            try {
                                const base64Data = dataUrl.split(',')[1];
                                const buffer = Buffer.from(base64Data, 'base64');
                                const img = nativeImage.createFromBuffer(buffer);
                                if (!img.isEmpty()) clipboard.writeImage(img);
                            } catch (err) {
                                console.error("Erreur copie image blob: :", err);
                            }
                        }).catch(err => console.error("Erreur fetch blob: :", err));

                    } else {
                        // URL http/https classique
                        const req = net.request({ url: srcUrl, redirect: 'follow' });
                        const chunks = [];
                        req.on('response', (res) => {
                            res.on('data', (chunk) => chunks.push(chunk));
                            res.on('end', () => {
                                try {
                                    const buffer = Buffer.concat(chunks);
                                    const img = nativeImage.createFromBuffer(buffer);
                                    if (!img.isEmpty()) clipboard.writeImage(img);
                                } catch (err) {
                                    console.error("Erreur copie image :", err);
                                }
                            });
                        });
                        req.on('error', (err) => console.error("Erreur fetch image :", err));
                        req.end();
                    }
                }
            }));
            menu.append(new MenuItem({
                label: "Copier l'adresse de l'image",
                click: () => clipboard.writeText(params.srcURL)
            }));
        }

        // Navigation
        if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({ label: 'Retour',    enabled: wc.canGoBack(),    click: () => wc.goBack() }));
        menu.append(new MenuItem({ label: 'Suivant',   enabled: wc.canGoForward(), click: () => wc.goForward() }));
        menu.append(new MenuItem({ label: 'Actualiser',                             click: () => wc.reload() }));

        menu.popup({ window: win });
    });
});

// --- GESTION DES FENÊTRES (MIN/MAX/CLOSE) ---

ipcMain.on("action", (event, data) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    switch (data.type) {
        case "window::close":
            if (win === configWindow) app.quit();
            else win.close();
            break;
        case "window::minimize":
            win.minimize();
            break;
        case "window::maximize":
            if (win.isMaximized()) win.unmaximize();
            else win.maximize();
            break;
    }
});

// --- CYCLE DE VIE ---

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