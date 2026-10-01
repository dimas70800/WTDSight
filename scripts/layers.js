let layers = [
    { id: 1, name: "Слой 1", visible: true, locked: false }
];
let activeLayerId = 1;
let globalSightOpacity = 1;

function getLayers() {
    return layers;
}

function getLayerById(id) {
    return layers.find(l => l.id === id);
}

function getActiveLayerId() {
    return activeLayerId || (layers[0] ? layers[0].id : 1);
}

function setActiveLayerId(id) {
    if (layers.some(l => l.id === id)) {
        activeLayerId = id;
    }
}

function getActiveLayer() {
    return getLayerById(getActiveLayerId());
}

function isLayerVisible(layerId) {
    const l = getLayerById(layerId || 1);
    return l ? l.visible : true;
}

function isLayerLocked(layerId) {
    const l = getLayerById(layerId || 1);
    return l ? l.locked : false;
}

function getGlobalOpacity() {
    return globalSightOpacity;
}

function getLayerOpacity(layerId) {
    return globalSightOpacity;
}

function onGlobalOpacityInput(value) {
    globalSightOpacity = parseFloat(value);
    try {
        localStorage.setItem("wtdmsight-global-opacity", globalSightOpacity.toString());
    } catch (_) { }
}

function updateOpacitySliderUI() {
    const opacityInputEl = document.getElementById("opacityInput");
    if (opacityInputEl) {
        opacityInputEl.value = globalSightOpacity;
    }
}

function notifyLayerLocked() {
    const msg = (typeof lang !== 'undefined' && lang === ru) ? "Слой заблокирован" : "Layer is locked";
    if (typeof showNotification === 'function') {
        showNotification(msg, true);
    }
}

function hookObjectsSet() {
    const objs = (typeof objects !== 'undefined' ? objects : window.objects);
    if (!objs || objs.__layersHooked) return;
    const origSet = objs.set.bind(objs);
    objs.set = function (key, val) {
        if (val && typeof val === 'object' && val.layer === undefined && typeof val.type === 'string') {
            val.layer = getActiveLayerId();
        }
        return origSet(key, val);
    };
    objs.__layersHooked = true;
}

function selectSingleLayer(id) {
    const layer = getLayerById(id);
    if (!layer) return;
    activeLayerId = id;
    renderLayersUI();
    saveLayersToStorage();
}

function addNewLayer(e) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();

    const existingIds = new Set(layers.map(l => l.id));
    let newId = 1;
    while (existingIds.has(newId)) {
        newId++;
    }

    const defaultPrefix = (typeof lang !== 'undefined' && lang === ru) ? "Слой " : "Layer ";
    const existingNames = new Set(layers.map(l => l.name));
    let nameNum = newId;
    while (existingNames.has(defaultPrefix + nameNum)) {
        nameNum++;
    }
    const name = defaultPrefix + nameNum;

    const newLayer = {
        id: newId,
        name: name,
        visible: true,
        locked: false
    };

    layers.unshift(newLayer);
    activeLayerId = newId;

    renderLayersUI();
    saveLayersToStorage();

    const panel = document.getElementById("layersPanel");
    if (panel && panel.classList.contains("collapsed")) {
        toggleLayersCollapse();
    }

    const listEl = document.getElementById("layersList");
    if (listEl) {
        setTimeout(() => {
            const row = listEl.querySelector(`[data-id="${newId}"]`);
            if (row) row.scrollIntoView({ block: 'nearest' });
        }, 10);
    }
}

function deleteLayer(id) {
    const layer = getLayerById(id);
    if (!layer) return;

    if (layer.locked) {
        notifyLayerLocked();
        return;
    }

    if (layers.length <= 1) {
        const msg = (typeof lang !== 'undefined' && lang === ru) ? "Нельзя удалить единственный слой!" : "Cannot delete the only layer!";
        alert(msg);
        return;
    }

    const layerIndex = layers.findIndex(l => l.id === id);
    if (layerIndex === -1) return;

    const confirmMsg = (typeof lang !== 'undefined' && lang === ru)
        ? `Удалить слой "${layer.name}" и все его объекты?`
        : `Delete layer "${layer.name}" and all its objects?`;

    if (!confirm(confirmMsg)) return;

    const deleted = [];
    const objs = (typeof objects !== 'undefined' ? objects : window.objects);
    if (objs) {
        for (const [objId, obj] of objs) {
            const objLayerId = obj.layer || 1;
            if (objLayerId === id) {
                deleted.push({ id: objId, object: obj });
                objs.delete(objId);
            }
        }
    }

    if (typeof pushEvent === 'function') {
        pushEvent("delete_layer", {
            layer: { ...layer },
            index: layerIndex,
            deletedObjects: deleted
        });
    }

    if (deleted.length > 0) {
        if (typeof refreshObjectsList === 'function') refreshObjectsList();
        if (typeof unselectAnyObjects === 'function') unselectAnyObjects();
    }

    layers.splice(layerIndex, 1);
    if (activeLayerId === id) {
        activeLayerId = layers[0].id;
    }

    renderLayersUI();
    saveLayersToStorage();
}

function toggleLayerVisibility(id) {
    const layer = getLayerById(id);
    if (!layer) return;
    layer.visible = !layer.visible;

    if (!layer.visible) {
        unselectObjectsOnLayer(id);
    }

    renderLayersUI();
    saveLayersToStorage();
}

function toggleLayerLock(id) {
    const layer = getLayerById(id);
    if (!layer) return;
    layer.locked = !layer.locked;

    if (layer.locked) {
        unselectObjectsOnLayer(id);
    }

    renderLayersUI();
    saveLayersToStorage();
}

function renameLayer(id, newName) {
    const layer = getLayerById(id);
    if (layer && newName.trim().length > 0) {
        layer.name = newName.trim();
        saveLayersToStorage();
    }
}

function unselectObjectsOnLayer(layerId) {
    const objs = (typeof objects !== 'undefined' ? objects : window.objects);
    if (!objs) return;
    let changed = false;
    for (const [objId, obj] of objs) {
        const lId = obj.layer || 1;
        if (lId === layerId && obj.selected) {
            obj.selected = false;
            changed = true;
            if (typeof selectedObjectsSet !== 'undefined') {
                selectedObjectsSet.delete(objId);
            }
        }
    }
    if (typeof selectedId !== 'undefined' && selectedId !== null) {
        const selObj = objs.get(selectedId);
        if (selObj && (selObj.layer || 1) === layerId) {
            window.selectedId = null;
        }
    }
    if (changed) {
        if (typeof updateSelectionInfo === 'function') updateSelectionInfo();
        if (typeof refreshObjectsList === 'function') refreshObjectsList();
    }
}

function syncLayersFromObjects(isReplace = false) {
    const objs = (typeof objects !== 'undefined' ? objects : window.objects);
    if (!objs) return;

    let anyHasLayer = false;
    for (const [_, obj] of objs) {
        if (obj && obj.layer !== undefined && obj.layer !== null) {
            anyHasLayer = true;
            break;
        }
    }

    const layerIdsInObjects = new Set();
    for (const [_, obj] of objs) {
        if (!obj) continue;
        if (obj.layer === undefined || obj.layer === null) {
            obj.layer = 1;
        } else {
            const parsed = parseInt(obj.layer, 10);
            obj.layer = isNaN(parsed) ? 1 : parsed;
        }
        layerIdsInObjects.add(obj.layer);
    }

    const defaultPrefix = (typeof lang !== 'undefined' && lang === ru) ? "Слой " : "Layer ";

    if (isReplace) {
        if (!anyHasLayer || layerIdsInObjects.size === 0) {
            layers = [{
                id: 1,
                name: defaultPrefix + "1",
                visible: true,
                locked: false
            }];
            activeLayerId = 1;
        } else {
            const oldLayersMap = new Map(layers.map(l => [l.id, l]));
            const newLayers = [];
            const sortedIds = Array.from(layerIdsInObjects).sort((a, b) => a - b);

            for (const id of sortedIds) {
                if (oldLayersMap.has(id)) {
                    const oldL = oldLayersMap.get(id);
                    newLayers.push({
                        id: id,
                        name: oldL.name || (defaultPrefix + id),
                        visible: oldL.visible !== undefined ? oldL.visible : true,
                        locked: oldL.locked !== undefined ? oldL.locked : false
                    });
                } else {
                    newLayers.push({
                        id: id,
                        name: defaultPrefix + id,
                        visible: true,
                        locked: false
                    });
                }
            }

            layers = newLayers;
            if (layers.length === 0) {
                layers.push({
                    id: 1,
                    name: defaultPrefix + "1",
                    visible: true,
                    locked: false
                });
            }
        }
    } else {
        if (layers.length === 0) {
            layers = [{
                id: 1,
                name: defaultPrefix + "1",
                visible: true,
                locked: false
            }];
            activeLayerId = 1;
        }

        const existingIds = new Set(layers.map(l => l.id));
        for (const id of layerIdsInObjects) {
            if (!existingIds.has(id)) {
                layers.push({
                    id: id,
                    name: defaultPrefix + id,
                    visible: true,
                    locked: false
                });
                existingIds.add(id);
            }
        }
    }

    if (!layers.some(l => l.id === activeLayerId)) {
        activeLayerId = layers[0].id;
    }

    hookObjectsSet();
    updateOpacitySliderUI();
    renderLayersUI();
    saveLayersToStorage();
}

function clearUnlockedLayers() {
    layers = layers.filter(l => l.locked);
    if (layers.length === 0) {
        const defaultPrefix = (typeof lang !== 'undefined' && lang === ru) ? "Слой " : "Layer ";
        layers = [{
            id: 1,
            name: defaultPrefix + "1",
            visible: true,
            locked: false
        }];
        activeLayerId = 1;
    } else if (!layers.some(l => l.id === activeLayerId)) {
        activeLayerId = layers[0].id;
    }
    saveLayersToStorage();
    renderLayersUI();
}

function saveLayersToStorage() {
    try {
        localStorage.setItem("wtdmsight-layers", JSON.stringify(layers));
        localStorage.setItem("wtdmsight-active-layer", activeLayerId.toString());
        localStorage.setItem("wtdmsight-global-opacity", globalSightOpacity.toString());
    } catch (e) { }
}

function restoreLayersFromStorage() {
    try {
        const saved = localStorage.getItem("wtdmsight-layers");
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                layers = parsed.map(l => ({
                    id: l.id,
                    name: l.name,
                    visible: l.visible !== undefined ? l.visible : true,
                    locked: l.locked !== undefined ? l.locked : false
                }));
            }
        }
        const savedActive = localStorage.getItem("wtdmsight-active-layer");
        if (savedActive) {
            const activeId = parseInt(savedActive, 10);
            if (layers.some(l => l.id === activeId)) {
                activeLayerId = activeId;
            }
        }
        const savedOpacity = localStorage.getItem("wtdmsight-global-opacity");
        if (savedOpacity !== null) {
            const parsedOp = parseFloat(savedOpacity);
            if (!isNaN(parsedOp)) globalSightOpacity = parsedOp;
        }
        const savedCollapsed = localStorage.getItem("wtdmsight-layers-collapsed");
        const isCollapsed = savedCollapsed !== null ? (savedCollapsed === "true") : true;
        const panel = document.getElementById("layersPanel");
        if (panel) {
            panel.classList.toggle("collapsed", isCollapsed);
        }
    } catch (e) { }
    hookObjectsSet();
    updateOpacitySliderUI();
    renderLayersUI();
}

function toggleLayersCollapse(e) {
    if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
    }
    const panel = document.getElementById("layersPanel");
    if (!panel) return;
    const isCollapsed = panel.classList.toggle("collapsed");
    try {
        localStorage.setItem("wtdmsight-layers-collapsed", isCollapsed ? "true" : "false");
    } catch (_) { }
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const iconDragHandle = `<img src="images/dragIcon.svg" style="width: 14px; height: 18px; pointer-events: none;">`;
const iconEyeVisible = `<img src="images/eyeVisible.svg" style="width: 18px; height: 18px; pointer-events: none;">`;
const iconEyeHidden = `<img src="images/eyeHidden.svg" style="width: 18px; height: 18px; pointer-events: none;">`;
const iconLockLocked = `<img src="images/lockClosed.svg" style="width: 18px; height: 18px; pointer-events: none;">`;
const iconLockUnlocked = `<img src="images/lockOpen.svg" style="width: 18px; height: 18px; pointer-events: none;">`;
const iconTrash = `<img src="images/trashIcon.svg" style="width: 18px; height: 18px; pointer-events: none; opacity: 0.85;">`;

function renderLayersUI() {
    const listEl = document.getElementById("layersList");
    if (!listEl) return;

    listEl.innerHTML = "";

    layers.forEach(layer => {
        const row = document.createElement("div");
        row.className = "layer-row" + (layer.id === activeLayerId ? " active" : "");
        row.dataset.id = layer.id;

        row.onclick = (e) => {
            if (e.target.closest("button") || e.target.closest("input")) return;
            selectSingleLayer(layer.id);
        };

        const dragHandle = document.createElement("span");
        dragHandle.className = "layer-drag-handle";
        dragHandle.innerHTML = iconDragHandle;

        dragHandle.onpointerdown = (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();

            const startY = e.clientY;
            const startX = e.clientX;
            let isDragging = false;
            let currentTargetId = null;
            let currentIsAbove = false;

            const onPointerMove = (moveEvt) => {
                const dist = Math.hypot(moveEvt.clientX - startX, moveEvt.clientY - startY);
                if (!isDragging) {
                    if (dist > 3) {
                        isDragging = true;
                        row.classList.add("dragging");
                        document.body.style.userSelect = "none";
                    } else {
                        return;
                    }
                }

                const allRows = Array.from(listEl.querySelectorAll(".layer-row"));
                let foundRow = null;
                let isAbove = false;

                for (const r of allRows) {
                    const rect = r.getBoundingClientRect();
                    if (moveEvt.clientY >= rect.top && moveEvt.clientY <= rect.bottom) {
                        foundRow = r;
                        isAbove = moveEvt.clientY < rect.top + rect.height / 2;
                        break;
                    }
                }

                if (!foundRow && allRows.length > 0) {
                    const firstRect = allRows[0].getBoundingClientRect();
                    const lastRect = allRows[allRows.length - 1].getBoundingClientRect();
                    if (moveEvt.clientY < firstRect.top) {
                        foundRow = allRows[0];
                        isAbove = true;
                    } else if (moveEvt.clientY > lastRect.bottom) {
                        foundRow = allRows[allRows.length - 1];
                        isAbove = false;
                    }
                }

                allRows.forEach(r => r.classList.remove("drag-indicator-above", "drag-indicator-below"));

                if (foundRow) {
                    const targetId = parseInt(foundRow.dataset.id, 10);
                    if (targetId !== layer.id) {
                        currentTargetId = targetId;
                        currentIsAbove = isAbove;
                        foundRow.classList.toggle("drag-indicator-above", isAbove);
                        foundRow.classList.toggle("drag-indicator-below", !isAbove);
                    } else {
                        currentTargetId = null;
                    }
                } else {
                    currentTargetId = null;
                }
            };

            const onPointerUp = () => {
                window.removeEventListener("pointermove", onPointerMove);
                window.removeEventListener("pointerup", onPointerUp);
                window.removeEventListener("pointercancel", onPointerUp);
                document.body.style.userSelect = "";

                document.querySelectorAll(".layer-row").forEach(r => {
                    r.classList.remove("dragging", "drag-indicator-above", "drag-indicator-below");
                });

                if (!isDragging) {
                    selectSingleLayer(layer.id);
                    return;
                }

                if (currentTargetId !== null && currentTargetId !== layer.id) {
                    const fromIndex = layers.findIndex(l => l.id === layer.id);
                    let toIndex = layers.findIndex(l => l.id === currentTargetId);
                    if (fromIndex !== -1 && toIndex !== -1) {
                        const [moved] = layers.splice(fromIndex, 1);
                        toIndex = layers.findIndex(l => l.id === currentTargetId);
                        const insertIndex = currentIsAbove ? toIndex : toIndex + 1;
                        layers.splice(insertIndex, 0, moved);
                        activeLayerId = layer.id;
                        renderLayersUI();
                        saveLayersToStorage();
                    }
                }
            };

            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", onPointerUp);
            window.addEventListener("pointercancel", onPointerUp);
        };

        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.className = "layer-name-input";
        nameInput.value = layer.name;
        nameInput.onclick = (e) => e.stopPropagation();
        nameInput.onchange = (e) => {
            renameLayer(layer.id, e.target.value);
        };

        const actionsDiv = document.createElement("div");
        actionsDiv.style.display = "flex";
        actionsDiv.style.alignItems = "center";
        actionsDiv.style.gap = "2px";

        const eyeBtn = document.createElement("button");
        eyeBtn.type = "button";
        eyeBtn.className = "layer-action-btn" + (layer.visible ? "" : " hidden-state");
        eyeBtn.innerHTML = layer.visible ? iconEyeVisible : iconEyeHidden;
        eyeBtn.onclick = (e) => {
            e.stopPropagation();
            toggleLayerVisibility(layer.id);
        };

        const lockBtn = document.createElement("button");
        lockBtn.type = "button";
        lockBtn.className = "layer-action-btn" + (layer.locked ? " locked-state" : "");
        lockBtn.innerHTML = layer.locked ? iconLockLocked : iconLockUnlocked;
        lockBtn.onclick = (e) => {
            e.stopPropagation();
            toggleLayerLock(layer.id);
        };

        const trashBtn = document.createElement("button");
        trashBtn.type = "button";
        trashBtn.className = "layer-action-btn trash-btn";
        trashBtn.innerHTML = iconTrash;
        trashBtn.onclick = (e) => {
            e.stopPropagation();
            deleteLayer(layer.id);
        };

        actionsDiv.appendChild(eyeBtn);
        actionsDiv.appendChild(lockBtn);
        actionsDiv.appendChild(trashBtn);

        row.appendChild(dragHandle);
        row.appendChild(nameInput);
        row.appendChild(actionsDiv);

        listEl.appendChild(row);
    });
}

function initLayers() {
    restoreLayersFromStorage();
    hookObjectsSet();

    const opacityInputEl = document.getElementById("opacityInput");
    if (opacityInputEl) {
        opacityInputEl.addEventListener("input", (e) => {
            onGlobalOpacityInput(e.target.value);
        });
    }
}

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initLayers);
} else {
    initLayers();
}
