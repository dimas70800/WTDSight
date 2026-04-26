let currentActiveTabId = 'lines';
const shell = document.getElementById('shell');
const arrow = document.getElementById('arrow');

function loadSettings() {
    try {
        const saved = localStorage.getItem('wtdsight-settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed;
        }
    } catch (e) { }

    return {
        language: 'ru',
        theme: 'dark',
        hints: true,
        outline: true,
        canvasBgColor: '#c7c7c7'
    };
}

let saveTimeout = null;

function saveAllSettings() {
    if (saveTimeout) clearTimeout(saveTimeout);

    saveTimeout = setTimeout(() => {
        const hintsEl = document.getElementById('hintsCheckBox');
        const outlineEl = document.getElementById('outlineCheckBox');

        if (!hintsEl || !outlineEl) {
            return;
        }

        const settings = {
            language: (typeof lang !== 'undefined' && lang === en) ? 'en' : 'ru',
            theme: document.body.getAttribute('data-theme') || 'dark',
            hints: hintsEl.checked,
            outline: outlineEl.checked,
            canvasBgColor: localStorage.getItem('canvasBgColor') || '#c7c7c7'
        };
        localStorage.setItem('wtdsight-settings', JSON.stringify(settings));
    }, 100);
}
window.saveAllSettings = saveAllSettings;

function applyAllSettings(settings) {

    changeLang(settings.language);

    if (settings.theme === 'light') {
        document.body.setAttribute('data-theme', 'light');
    } else {
        document.body.removeAttribute('data-theme');
    }

    const hintsEl = document.getElementById('hints');
    const hintsCheckBox = document.getElementById('hintsCheckBox');
    if (hintsEl) {
        hintsEl.style.display = settings.hints ? 'block' : 'none';
    }
    if (hintsCheckBox) {
        hintsCheckBox.checked = settings.hints;
    }

    const outlineCheckBox = document.getElementById('outlineCheckBox');
    if (outlineCheckBox && typeof settings.outline !== 'undefined') {
        outlineCheckBox.checked = settings.outline;
        localStorage.setItem('outlineCheckBox', settings.outline.toString());
    }

    if (settings.canvasBgColor && typeof setBgColorCanvas === 'function') {
        setBgColorCanvas(settings.canvasBgColor);
        const colorPicker = document.getElementById('canvasBgColor');
        if (colorPicker) colorPicker.value = settings.canvasBgColor;
    }
}

function togglePanel(forceState) {
    const isCollapsed = (forceState !== undefined)
        ? (shell.classList[forceState ? 'add' : 'remove']('collapsed'), forceState)
        : shell.classList.toggle('collapsed');
    if (arrow) arrow.textContent = isCollapsed ? '▶' : '◀';
}

document.querySelectorAll('.nav-static .tab-button').forEach(btn => {
    btn.addEventListener('click', function (e) {
        const targetId = this.getAttribute('data-target');
        if (!targetId) return;

        const isPanelCollapsed = shell.classList.contains('collapsed');

        if (targetId === currentActiveTabId) {
            togglePanel();
            return;
        }

        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentActiveTabId = targetId;

        if (isPanelCollapsed) togglePanel(false);

        document.querySelectorAll('.panel-content').forEach(p => p.style.display = 'none');
        const panel = document.getElementById('panel-' + targetId);
        if (panel) panel.style.display = 'flex';

        const sharedTools = document.getElementById('shared-drawing-tools');
        if (sharedTools) {
            sharedTools.style.display = (targetId === 'file' || targetId === 'reference') ? 'flex' : 'none';
            el("panel-with-refOpacityShared").style.display = (targetId === 'reference') ? 'none' : 'flex';
        }
    });
});

function toggleTheme() {
    const body = document.body;
    if (body.getAttribute('data-theme') === 'light') {
        body.removeAttribute('data-theme');
    } else {
        body.setAttribute('data-theme', 'light');
    }
    saveAllSettings();
}

function toggleHints(show) {
    const hintsEl = document.getElementById('hints');
    if (hintsEl) {
        hintsEl.style.display = show ? 'block' : 'none';
    }
    saveAllSettings();
}

function toggleObjectsMenu() {
    const menu = document.getElementById('objectsMenu');
    const btn = document.getElementById('objectsToggleBtn');

    menu.classList.toggle('collapsed');
    btn.innerHTML = menu.classList.contains('collapsed') ? '◀' : '▶';
}

function showNotification(msg, isError = false) {
    const toast = document.getElementById(isError ? 'errorNotification' : 'toastNotification');
    toast.innerHTML = msg;
    toast.style.top = '20px';
    setTimeout(() => { toast.style.top = '-60px'; }, 4000);
}

window.addEventListener('error', function (e) { showNotification(`Ошибка: ${e.message}`, true); });
window.onerror = function () { return true; };
const originalAlert = window.alert;
window.alert = function (msg) { showNotification(msg); };

window.addEventListener('load', () => {
    const settings = loadSettings();
    applyAllSettings(settings);
});