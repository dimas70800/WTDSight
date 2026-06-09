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
        outline: false,
        canvasBgColor: '#c7c7c7',
        drawGrid: true,
        oldSelection: false
    };
}

let saveTimeout = null;

function saveAllSettings() {
    if (saveTimeout) clearTimeout(saveTimeout);

    saveTimeout = setTimeout(() => {
        const hintsEl = document.getElementById('hintsCheckBox');
        const outlineEl = document.getElementById('outlineCheckBox');
        const drawGridEl = document.getElementById('drawGridCheckBox');
        const canvasBgColorEl = document.getElementById('canvasBgColor');
        const oldSelectionEl = document.getElementById('oldSelectionCheckBox');

        if (!hintsEl || !outlineEl || !drawGridEl || !canvasBgColorEl) return;

        const settings = {
            language: (typeof lang !== 'undefined' && lang === en) ? 'en' : 'ru',
            theme: document.body.getAttribute('data-theme') || 'dark',
            hints: hintsEl.checked,
            outline: outlineEl.checked,
            canvasBgColor: canvasBgColorEl.value,
            drawGrid: drawGridEl.checked,
            oldSelection: oldSelectionEl.checked
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

    if (typeof toggleHints === 'function') {
        toggleHints(settings.hints !== undefined ? settings.hints : true);
    }

    // Обводка
    if (typeof setOutlineCheckBox === 'function') {
        setOutlineCheckBox(settings.outline !== undefined ? settings.outline : true);
    }

    // Цвет фона
    if (typeof setBgColorCanvas === 'function') {
        setBgColorCanvas(settings.canvasBgColor || '#c7c7c7');
    }

    // Сетка
    if (typeof toggleDrawGrid === 'function') {
        toggleDrawGrid(settings.drawGrid !== undefined ? settings.drawGrid : true);
    }

    const oldSelectionEl = document.getElementById('oldSelectionCheckBox');
    if (oldSelectionEl) {
        oldSelectionEl.checked = settings.oldSelection || false;
        oldSelectionEl.addEventListener('change', saveAllSettings);
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
    const hintsCheckBox = document.getElementById('hintsCheckBox');

    if (hintsEl) {
        hintsEl.style.display = show ? 'block' : 'none';
    }
    if (hintsCheckBox) {
        hintsCheckBox.checked = show;
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
    setTimeout(() => { toast.style.top = '-100px'; }, 4000);
}

window.addEventListener('error', function (e) { showNotification(`Ошибка: ${e.message}`, true); });
window.onerror = function () { return true; };
const originalAlert = window.alert;
window.alert = function (msg) { showNotification(msg); };

window.addEventListener('load', () => {
    const settings = loadSettings();
    applyAllSettings(settings);
});

function toggleSightPreview() {
    const overlay = document.getElementById('sightPreviewOverlay');
    if (overlay.style.display === 'none') {
        overlay.style.display = 'flex';
        drawPreview();
    } else {
        overlay.style.display = 'none';
    }
}

function toggleFullScreen() {
    const doc = window.document;
    const docEl = doc.documentElement;

    const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    } else {
        cancelFullScreen.call(doc);
    }
}

function drawPreview() {
    const pCanvas = document.getElementById('previewCanvas');
    if (!pCanvas) return;
    const pCtx = pCanvas.getContext('2d');

    pCanvas.width = 3840;
    pCanvas.height = 2160;

    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

    const maxDist = parseInt(document.getElementById('previewMaxDist')?.value) || 6000;

    const drawVert = document.getElementById('previewDrawCentralLineVert').checked;
    const drawHorz = document.getElementById('previewDrawCentralLineHorz').checked;

    const drawTicks = document.getElementById('previewDrawTicks')?.checked;
    const tickSpacingRaw = parseFloat(document.getElementById('previewTickSpacing')?.value) || 4;

    const previewScreenshotZoom = 1.08;

    const baseScale = pCanvas.height * (2000 / 2160) * previewScreenshotZoom;
    const cx = pCanvas.width / 2;
    const cy = pCanvas.height / 2;

    function sightToPreview(pos) {
        return {
            x: cx + pos.x * baseScale,
            y: cy + pos.y * baseScale
        };
    }

    pCtx.lineWidth = (pCanvas.height / 2160) * 1.5;
    pCtx.strokeStyle = "rgba(0, 0, 0, 0.8)";

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

    if (drawTicks) {
        pCtx.lineWidth = (pCanvas.height / 2160) * 1.5;
        pCtx.fillStyle = "rgba(0, 0, 0, 0.8)";

        pCtx.textAlign = "center";
        pCtx.textBaseline = "middle";
        const fontSize = Math.round(22 * (pCanvas.height / 2160));
        pCtx.font = `bold ${fontSize}px Arial`;

        const val_cdhsa1 = parseFloat(document.getElementById('exp_cdhsa1')?.value) || 0.005;
        const val_cdhsa2 = parseFloat(document.getElementById('exp_cdhsa2')?.value) || 0.003;

        const val_cdhsm1 = parseFloat(document.getElementById('exp_cdhsm1')?.value) || 0;
        const val_cdhsm2 = parseFloat(document.getElementById('exp_cdhsm2')?.value) || 0;

        const textPosX = parseFloat(document.getElementById('previewTextPosX')?.value) || 0;

        const baseSpacing = tickSpacingRaw * baseScale * 0.01;
        const stretching = 1;

        let currentY = cy;
        let lastTextY = -Infinity;

        const minTextGap = fontSize * 0.9;

        const textCanvasX = cx + (textPosX - 0.16 - (val_cdhsm1 / 6)) * baseScale;

        for (let d = 200; d <= maxDist; d += 200) {
            const multiplier = 1 + (d / 2000) * stretching;
            currentY += baseSpacing * multiplier;

            if (currentY > pCanvas.height) break;

            const hasText = (d % 400 === 0);
            const textValue = d / 100;

            const lenCentral = hasText ? val_cdhsa1 : val_cdhsa2;
            const lenCentralPx = lenCentral * baseScale;

            pCtx.beginPath();
            pCtx.moveTo(cx - lenCentralPx, currentY);
            pCtx.lineTo(cx + lenCentralPx, currentY);
            pCtx.stroke();

            const lenLeft = hasText ? val_cdhsm1 : val_cdhsm2;
            const lenLeftPx = lenLeft * baseScale;

            const leftScaleX = cx - (0.1425 * baseScale);

            pCtx.beginPath();
            pCtx.moveTo(leftScaleX - lenLeftPx / 2, currentY);
            pCtx.lineTo(leftScaleX + lenLeftPx / 2, currentY);
            pCtx.stroke();

            if (hasText) {
                if (currentY >= lastTextY + minTextGap) {
                    pCtx.fillText(textValue.toString(), textCanvasX, currentY);
                    lastTextY = currentY;
                }
            }
        }
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

function changePreviewBackground() {
    const select = document.getElementById('previewBgSelect');
    const bgImg = document.getElementById('previewBackground');
    const thermalToggle = document.getElementById('previewThermalToggle');
    const thermalRow = document.getElementById('previewThermalRow');

    if (!select || !bgImg || !thermalToggle) return;

    const selectedValue = select.value;
    
    const backgrounds = {
        standard: 'images/preview.png',
        sinai: 'images/sinaiPreview.png',
        poland: 'images/fieldsOfPolandPreview.png',
        breslau: 'images/breslauPreview.png',
        ardennes: 'images/ardennesPreview.png',
        testdrive: 'images/testDrivePreview.png'
    };

    if (selectedValue === 'standard') {
        if (thermalRow) thermalRow.style.display = 'flex';
        thermalToggle.disabled = false;
        
        if (thermalToggle.checked) {
            bgImg.src = 'images/previewThermal.png';
        } else {
            bgImg.src = backgrounds['standard'];
        }
    } else {
        thermalToggle.checked = false;
        thermalToggle.disabled = true;
        
        if (thermalRow) thermalRow.style.display = 'none';
        
        if (backgrounds[selectedValue]) {
            bgImg.src = backgrounds[selectedValue];
        }
    }
}

function toggleThermalMode() {
    const select = document.getElementById('previewBgSelect');
    const isThermal = document.getElementById('previewThermalToggle').checked;
    const bgImg = document.getElementById('previewBackground');

    if (select && select.value !== 'standard') {
        return;
    }

    if (isThermal) {
        bgImg.src = 'images/previewThermal.png';
    } else {
        bgImg.src = 'images/preview.png';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const expMaxDist = document.getElementById('exp_maxDist');
    const prevMaxDist = document.getElementById('previewMaxDist');
    const prevTextPos = document.getElementById('previewTextPosX');
    const expTextPos = document.getElementById('exp_textPosX');

    if (expMaxDist && prevMaxDist) {
        expMaxDist.addEventListener('input', (e) => {
            prevMaxDist.value = e.target.value;
        });

        prevMaxDist.addEventListener('input', (e) => {
            expMaxDist.value = e.target.value;
            drawPreview();
            saveExportSettings();
        });
    }

    if (expTextPos && prevTextPos) {
        expTextPos.addEventListener('input', (e) => {
            prevTextPos.value = e.target.value;
        });

        prevTextPos.addEventListener('input', (e) => {
            expTextPos.value = e.target.value;
            drawPreview();
            saveExportSettings();
        });
    }
});