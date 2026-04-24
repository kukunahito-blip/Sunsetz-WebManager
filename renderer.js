const sitesList = document.getElementById('sitesList');
const nameInput = document.getElementById('nameInput');
const urlInput = document.getElementById('urlInput');
const addBtn = document.getElementById('addBtn');
const modal = document.getElementById('customModal');

// --- MODALE DE CONFIRMATION ---
function askConfirmation() {
    return new Promise((resolve) => {
        modal.style.display = 'flex';
        const confirmBtn = document.getElementById('modalConfirm');
        const cancelBtn = document.getElementById('modalCancel');

        const onConfirm = () => { close(true); };
        const onCancel = () => { close(false); };
        const close = (val) => {
            modal.style.display = 'none';
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            resolve(val);
        };
        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
    });
}

// --- RENDU DE LA LISTE ---
async function refreshList() {
    const sites = await window.electronAPI.getSites();
    sitesList.innerHTML = '';
    sites.forEach((site, index) => {
        const item = document.createElement('div');
        item.className = 'site-item';
        item.innerHTML = `
            <div class="site-info">
                <b>${site.name}</b>
                <span>${site.url}</span>
            </div>
            <button class="delete-btn">Supprimer</button>
        `;
        item.querySelector('.site-info').onclick = () => window.electronAPI.openServer(site.url);
        item.querySelector('.delete-btn').onclick = async (e) => {
            e.stopPropagation();
            if (await askConfirmation()) {
                await window.electronAPI.deleteSite(index);
                refreshList();
            }
        };
        sitesList.appendChild(item);
    });
}

// --- FONCTION POUR AFFICHER L'ERREUR AVEC ANIMATION ---
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
        setTimeout(() => err.remove(), 200);
    }, 2800);
}

// --- AJOUT DE SITE ---
addBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();

    // 1. Vérification des champs vides
    if (!name || !url) {
        showError('Veuillez remplir les deux champs.');
        return;
    }

    if (!url.startsWith('http')) url = 'https://' + url + (url.endsWith('/') ? '' : '/');
    else if (!url.endsWith('/')) url += '/';

    // UI : Lock le bouton
    addBtn.disabled = true;
    addBtn.textContent = "Vérification...";

    const result = await window.electronAPI.saveSite({ name, url });

    if (result.success) {
        nameInput.value = ''; 
        urlInput.value = '';
        refreshList();
    } else {
        // 2. Utilisation de la MÊME animation pour l'URL invalide
        showError('URL invalide ou serveur injoignable.');
    }

    // UI : Unlock le bouton
    addBtn.disabled = false;
    addBtn.textContent = "Ajouter le site";
});

document.addEventListener('DOMContentLoaded', refreshList);