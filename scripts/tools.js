
let tool = "lines";
const toolNames = ["lines", "quads", "hatch", "vectorize", "select", "curve"];


function switchTool(targetId) {
    if (!toolNames.includes(targetId)) return;

    if (targetId === currentActiveTabId) {
        togglePanel();
        return;
    }

    // Смена инструмента
    tool = targetId;

    // Очистка состояний
    if (typeof clearIntermediateDrawing === 'function') clearIntermediateDrawing();
    if (targetId === "hatch" && typeof cancelHatch === 'function') cancelHatch();
    if (targetId === "vectorize") {
        if (typeof toggleVectorizePanel === 'function') toggleVectorizePanel(true);
    } else {
        if (typeof hideVectorizePreview === 'function') hideVectorizePreview();
        const vPanel = document.getElementById('vectorizePanel');
        if (vPanel) vPanel.style.display = 'none';
    }
    if (targetId === "select") {
        if (typeof selectionRect !== 'undefined') selectionRect = null;
        if (typeof isSelecting !== 'undefined') isSelecting = false;
    } else {
        if (typeof selectedObjectsSet !== 'undefined') selectedObjectsSet.clear();
    }

    // Подсветка кнопок
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.tab-button[data-target="${targetId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Переключение панелей
    document.querySelectorAll('.panel-content').forEach(p => p.style.display = 'none');
    let panelId = 'panel-' + targetId;
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = 'flex';

    // Общие настройки
    const sharedTools = document.getElementById('shared-drawing-tools');
    if (sharedTools) {
        sharedTools.style.display = ['lines', 'quads', 'select', 'hatch', 'file', 'vectorize', 'reference', "curve"].includes(targetId) ? 'flex' : 'none';
        el("panel-with-refOpacityShared").style.display = (targetId === 'reference') ? 'none' : 'flex';
    }

    if (shell.classList.contains('collapsed')) {
        togglePanel(false);
    }

    if (typeof updateSelectionInfo === 'function') updateSelectionInfo();
    currentActiveTabId = targetId;
}

// Привязка кнопок
toolNames.forEach(name => {
    const btnId = "tools" + name.charAt(0).toUpperCase() + name.slice(1) + "Button";
    const btn = document.getElementById(btnId);
    if (btn) {
        btn.addEventListener('click', function (e) {
            const targetId = this.getAttribute('data-target');
            if (targetId) switchTool(targetId);
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const firstBtn = document.querySelector('.tab-button[data-target="lines"]');
    if (firstBtn) firstBtn.classList.add('active');
    const linesPanel = document.getElementById('panel-lines');
    if (linesPanel) linesPanel.style.display = 'flex';
    const sharedTools = document.getElementById('shared-drawing-tools');
    if (sharedTools) sharedTools.style.display = 'flex';
    markAllTools();
    currentActiveTabId = 'lines';
});

function markAllTools() {
    for (const name of toolNames) {
        const btnId = "tools" + name.charAt(0).toUpperCase() + name.slice(1) + "Button";
        const btn = document.getElementById(btnId);
        if (btn) {
            if (name === tool) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    }
}