let sitesList, nameInput, urlInput, addBtn, modal;

// --- INITIALISATION DE L'INTERFACE (CORRIGÉE) ---
async function initApp() {
    loadingScreen();

    showAppContainer();

    // Récupère les éléments (maintenant qu'ils sont dans le DOM via showAppContainer)
    sitesList = document.getElementById('sitesList');
    nameInput = document.getElementById('nameInput');
    urlInput = document.getElementById('urlInput');
    addBtn = document.getElementById('addBtn');
    modal = document.getElementById('customModal');

    addBtn.addEventListener('click', handleAddSite);

    await refreshList();

    hideLoadingScreen();
}

// --- FONCTION POUR MASQUER LE LOADER ---
function hideLoadingScreen() {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.classList.add('fade-out');
        
        setTimeout(() => {
            loader.remove();
        }, 500);
    }
}

function loadingScreen() {
    let loader = document.getElementById('loading-screen');
    if (!loader) {

        loader = document.createElement('div');
        loader.id = 'loading-screen';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="spinner">
                    <img class="logo-big" src="assets/sunsetz/sunsetz-logo.png" alt="Logo">
                </div>
                <span>Sunsetz WebManager</span>
            </div>
        `;
        document.body.appendChild(loader);
    }
}

// --- GESTIONNAIRE D'AJOUT ---
async function handleAddSite() {
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();

    if (!name || !url) {
        showError('Veuillez remplir les deux champs.');
        return;
    }

    if (!url.startsWith('http')) url = 'https://' + url;
    if (!url.endsWith('/')) url += '/';

    addBtn.disabled = true;
    addBtn.textContent = "Vérification...";

    try {
        // Ajout d'un bloc try/catch pour que l'interface ne reste jamais bloquée
        const result = await window.electronAPI.web.saveSite({ name, url });

        if (result.success) {
            nameInput.value = ''; 
            urlInput.value = '';
            refreshList();
        } else {
            showError('URL invalide ou serveur injoignable.');
        }
    } catch (error) {
        console.error("Erreur de l'API IPC :", error);
        showError('Une erreur système est survenue.');
    } finally {
        // Le bloc "finally" s'exécute TOUJOURS, succès ou échec. 
        // Ton bouton sera toujours réactivé !
        addBtn.disabled = false;
        addBtn.textContent = "Ajouter le site";
    }
}

// --- SYSTÈME D'ERREUR + Animation ---
function showError(message) {
    const existingError = document.getElementById('error-msg-active');
    if (existingError) return;

    const err = document.createElement('div');
    err.id = 'error-msg-active';
    err.textContent = message;
    err.className = 'error-text';
    addBtn.insertAdjacentElement('afterend', err);

    setTimeout(() => err.classList.add('visible'), 10);

    setTimeout(() => {
        err.classList.remove('visible');
        err.classList.add('slide-out');
        setTimeout(() => err.remove(), 400);
    }, 2800);
}

// --- MODALE & LISTE ---
function askConfirmation() {
    return new Promise((resolve) => {
        modal.style.display = 'flex';
        const confirmBtn = document.getElementById('modalConfirm');
        const cancelBtn = document.getElementById('modalCancel');

        const close = (val) => {
            modal.style.display = 'none';
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(val);
        };
        confirmBtn.onclick = () => close(true);
        cancelBtn.onclick = () => close(false);
    });
}

async function refreshList() {
    const sites = await window.electronAPI.web.getSites();
    sitesList.innerHTML = '';
    sites.forEach((site, index) => {
        const item = document.createElement('div');
        item.className = 'site-item';
        item.innerHTML = `
            <div class="site-info"><b>${site.name}</b><span>${site.url}</span></div>
            <button class="btn delete-btn">Supprimer</button>
        `;
        item.querySelector('.site-info').onclick = () => window.electronAPI.web.openServer(site.url);
        item.querySelector('.delete-btn').onclick = async (e) => {
            e.stopPropagation();
            if (await askConfirmation()) {
                await window.electronAPI.web.deleteSite(index);
                refreshList();
            }
        };
        sitesList.appendChild(item);
    });
}

// --- GÉNÉRATION DU HTML ---
function showAppContainer() {
    let appContainer = document.getElementById('app-container');
    if (!appContainer) {
        appContainer = document.createElement('section');
        appContainer.id = 'app-container';
    }
    appContainer.innerHTML = `
        <div class="container">
            <div class="no-selection header">
                <div class="logo-circle"><img class = "no-selection" src="assets/icon.png" alt="Logo"></div>
                <h1>Sunsetz WebManager</h1>
            </div>
            <div class="add-form">
                <input type="text" id="nameInput" placeholder="Nom du site (ex: Ineterface NAS)">
                <input type="text" id="urlInput" placeholder="URL (ex: https://mon-site.com)">
                <button class="btn" id="addBtn">Ajouter le site</button>
            </div>
            <div id="sitesList" class="sites-list"></div>
        </div>
        <div id="customModal" class="modal-overlay" style="display:none;">
            <div class="modal-box">
                <h3>Confirmation</h3>
                <p>Voulez-vous vraiment supprimer ce site ?</p>
                <div class="modal-buttons">
                    <button id="modalCancel" class="btn btn-secondary">Annuler</button>
                    <button id="modalConfirm" class="btn btn-danger">Supprimer</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(appContainer);
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});