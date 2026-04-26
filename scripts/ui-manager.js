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

// Открытие/закрытие окна предпросмотра
function toggleSightPreview() {
    const overlay = document.getElementById('sightPreviewOverlay');
    if (overlay.style.display === 'none') {
        overlay.style.display = 'flex';
        drawPreview(); // Рисуем актуальный вид при открытии
    } else {
        overlay.style.display = 'none';
    }
}

function drawPreview() {
    const pCanvas = document.getElementById('previewCanvas');
    if (!pCanvas) return;
    const pCtx = pCanvas.getContext('2d');
    
    pCanvas.width = 3840;
    pCanvas.height = 2160;
    
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    
    const drawVert = document.getElementById('previewDrawCentralLineVert').checked;
    const drawHorz = document.getElementById('previewDrawCentralLineHorz').checked;
    
    const previewScreenshotZoom = 1.08 ;

    const baseScale = pCanvas.height * (2000 / 2160) * previewScreenshotZoom;
    const cx = pCanvas.width / 2;
    const cy = pCanvas.height / 2;
    
    function sightToPreview(pos) {
        return {
            x: cx + pos.x * baseScale,
            y: cy + pos.y * baseScale
        };
    }
    
    pCtx.lineWidth = (pCanvas.height / 2160) * 2;
    pCtx.strokeStyle = "rgba(0, 0, 0, 1)";
    
    if (drawVert || drawHorz) {
        pCtx.beginPath();
        if (drawVert) {
            pCtx.moveTo(cx, 0);
            pCtx.lineTo(cx, pCanvas.height);
        }
        if (drawHorz) {
            pCtx.moveTo(0, cy);
            pCtx.lineTo(pCanvas.width, cy);
        }
        pCtx.stroke();
    }
    
    pCtx.fillStyle = "rgba(0, 0, 0, 1)";
    pCtx.strokeStyle = "rgba(0, 0, 0, 1)";
    pCtx.lineJoin = "round";
    
    for (const [id, object] of objects) {
        if (object.type === "line") {
            const from = sightToPreview(object.start);
            const to = sightToPreview(object.end);
            
            pCtx.beginPath();
            pCtx.moveTo(from.x, from.y);
            pCtx.lineTo(to.x, to.y);
            pCtx.stroke();
        } else if (object.type === "quad") {
            const p1 = sightToPreview(object.pos1);
            const p2 = sightToPreview(object.pos2);
            const p3 = sightToPreview(object.pos3);
            const p4 = sightToPreview(object.pos4);
            
            pCtx.beginPath();
            pCtx.moveTo(p1.x, p1.y);
            pCtx.lineTo(p2.x, p2.y);
            pCtx.lineTo(p3.x, p3.y);
            pCtx.lineTo(p4.x, p4.y);
            pCtx.closePath();
            pCtx.fill();
        }
    }
}

window.addEventListener('resize', () => {
    const overlay = document.getElementById('sightPreviewOverlay');
    if (overlay && overlay.style.display === 'flex') {
        drawPreview();
    }
});

function takePreviewScreenshot() {
    const bgImg = document.getElementById('previewBackground');
    const pCanvas = document.getElementById('previewCanvas');
    
    if (!bgImg || !pCanvas) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = pCanvas.width;   // 3840
    tempCanvas.height = pCanvas.height; // 2160
    
    const tCtx = tempCanvas.getContext('2d');

    tCtx.drawImage(bgImg, 0, 0, tempCanvas.width, tempCanvas.height);
    
    tCtx.drawImage(pCanvas, 0, 0, tempCanvas.width, tempCanvas.height);

    tCtx.font = "20px Arial";
    tCtx.fillStyle = "rgba(60, 60, 60, 0.2)";
    tCtx.textAlign = "right";
    tCtx.textBaseline = "bottom";
    
    const textPadding = 30;
    const watermarkText = "Made with WTDSight by dimas7080";
    
    tCtx.fillText(watermarkText, tempCanvas.width - textPadding, tempCanvas.height - textPadding);

    try {
        const dataURL = tempCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `WTDSight_Preview_${new Date().toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_')}.png`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("Ошибка при сохранении скриншота:", e);
        alert("Не удалось сохранить скриншот.");
    }
}