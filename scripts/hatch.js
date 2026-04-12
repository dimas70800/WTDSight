let hatchPoints = [];
let isDrawingHatch = false;
let previewHatchLines = [];
let previewUIElement = null;
let hatchAngle = 45;
let hatchDensity = 0.03;
let hatchPhase = 0;


function removePreviewUI() {
    if (previewUIElement && previewUIElement.parentNode) {
        previewUIElement.parentNode.removeChild(previewUIElement);
        previewUIElement = null;
    }
}

function startHatchDrawing(pos) {
    hatchPoints = [{
        x: Math.round(pos.x * 100000) / 100000,
        y: Math.round(pos.y * 100000) / 100000
    }];
    isDrawingHatch = true;
    previewHatchLines = [];
    hatchPhase = 0;
    removePreviewUI();
}

function addHatchPoint(pos) {
    if (!isDrawingHatch) return;
    const roundedPos = {
        x: Math.round(pos.x * 100000) / 100000,
        y: Math.round(pos.y * 100000) / 100000
    };
    if (hatchPoints.length > 0) {
        const lastPoint = hatchPoints[hatchPoints.length - 1];
        if (Math.abs(roundedPos.x - lastPoint.x) < 0.00001 && 
            Math.abs(roundedPos.y - lastPoint.y) < 0.00001) {
            return;
        }
    }
    hatchPoints.push(pos);
    updateHatchPreview();
}

function updateHatchPreview() {
    if (!isDrawingHatch || hatchPoints.length < 2) return;

    if (hatchPoints.length >= 3) {
        previewHatchLines = generateHatchLines(hatchPoints, hatchAngle, hatchDensity, hatchPhase);
    } else {
        previewHatchLines = [];
    }

    updatePreviewPanel();
}


function generateHatchLines(points, angleDeg, spacing, phase) {
    const lines = [];
    if (points.length < 3) return lines;
    if (spacing <= 0) return lines;

    // Нормализация угла
    let normalizedAngle = angleDeg % 360;
    if (normalizedAngle < 0) normalizedAngle += 360;

    // Угол для расчёта направлений
    const adjustedAngle = normalizedAngle - 90;
    const angleRad = adjustedAngle * Math.PI / 180;

    // Направление линий (вдоль)
    const lineDirX = Math.cos(angleRad);
    const lineDirY = Math.sin(angleRad);

    // Перпендикулярное направление
    const perpX = -Math.sin(angleRad);
    const perpY = Math.cos(angleRad);

    // Проекции вершин полигона на перпендикуляр
    const projValues = points.map(p => p.x * perpX + p.y * perpY);
    let minProj = Math.min(...projValues);
    let maxProj = Math.max(...projValues);

    // Мировая база
    const base = 0;

    const kMin = Math.floor((minProj - base - phase) / spacing);
    const kMax = Math.ceil((maxProj - base - phase) / spacing);

    const maxLines = 5000;
    if (kMax - kMin + 1 > maxLines) {
        console.warn(`Слишком много линий (${kMax - kMin + 1}), ограничено до ${maxLines}`);
        return lines;
    }

    for (let k = kMin; k <= kMax; k++) {
        const proj = base + phase + k * spacing;

        const intersections = [];
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];

            const proj1 = p1.x * perpX + p1.y * perpY;
            const proj2 = p2.x * perpX + p2.y * perpY;

            if ((proj1 - proj) * (proj2 - proj) < 0) {
                const t = (proj - proj1) / (proj2 - proj1);
                const ix = p1.x + (p2.x - p1.x) * t;
                const iy = p1.y + (p2.y - p1.y) * t;
                const along = ix * lineDirX + iy * lineDirY;
                intersections.push({ x: ix, y: iy, along: along });
            }
        }

        if (intersections.length < 2) continue;

        intersections.sort((a, b) => a.along - b.along);

        for (let i = 0; i < intersections.length - 1; i += 2) {
            lines.push({
                start: { x: intersections[i].x, y: intersections[i].y },
                end: { x: intersections[i + 1].x, y: intersections[i + 1].y }
            });
        }
    }

    return lines;
}

function finalizeHatch() {
    if (hatchPoints.length < 3) {
        alert(lang === ru ? "Для штриховки необходимо минимум 3 точки!" : "At least 3 points are required for hatching!");
        cancelHatch();
        return;
    }

    const finalLines = generateHatchLines(hatchPoints, hatchAngle, hatchDensity, hatchPhase);

    if (finalLines.length === 0) {
        alert(lang === ru ? "Не удалось сгенерировать линии штриховки!" : "Failed to generate hatch lines!");
        cancelHatch();
        return;
    }

    for (const line of finalLines) {
        const objIdStr = nextId().toString();
        const object = {
            name: lang.line + objIdStr,
            type: "line",
            start: { x: line.start.x, y: line.start.y },
            end: { x: line.end.x, y: line.end.y },
            selected: false
        };
        objects.set(objIdStr, object);
        pushEvent("add", { id: objIdStr, object: object });
    }

    refreshObjectsList(true);
    cancelHatch();
    // tool = "lines";
    markAllTools();
}

function cancelHatch() {
    hatchPoints = [];
    isDrawingHatch = false;
    previewHatchLines = [];
    hatchPhase = 0;
    removePreviewUI();
}

function updatePreviewPanel() {
    if (hatchPoints.length < 3) {
        removePreviewUI();
        return;
    }

    const toolsMenu = el("toolsMenu");
    if (!toolsMenu) {
        createPanelAtCorner();
        return;
    }

    const toolsRect = toolsMenu.getBoundingClientRect();

    let left = toolsRect.right + 10;
    let top = toolsRect.top;

    const panelWidth = 240;
    const panelHeight = 210;

    const objectsMenu = el("objectsMenu");
    const infoMenu = el("infoMenu");

    if (objectsMenu) {
        const objectsRect = objectsMenu.getBoundingClientRect();
        if (left < objectsRect.right && left + panelWidth > objectsRect.left) {
            if (top + panelHeight > objectsRect.top && top < objectsRect.bottom) {
                top = objectsRect.bottom + 10;
            }
        }
    }

    if (infoMenu) {
        const infoRect = infoMenu.getBoundingClientRect();
        if (left < infoRect.right && left + panelWidth > infoRect.left) {
            if (top + panelHeight > infoRect.top && top < infoRect.bottom) {
                top = infoRect.top - panelHeight - 10;
            }
        }
    }

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (left + panelWidth > windowWidth) {
        left = toolsRect.left - panelWidth - 10;
    }
    if (top < 0) {
        top = 10;
    }
    if (top + panelHeight > windowHeight) {
        top = windowHeight - panelHeight - 10;
    }

    removePreviewUI();

    const panel = document.createElement('div');
    panel.className = 'menuIsland';
    panel.style.position = 'fixed';
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.zIndex = '100';
    panel.style.minWidth = '220px';
    panel.style.padding = '10px';
    panel.style.border = '2px solid rgb(27, 27, 27)';
    panel.style.borderRadius = '1em';
    panel.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    panel.style.userSelect = 'none';
    panel.style.pointerEvents = 'auto';

    panel.innerHTML = `
        <div style="margin-bottom: 10px;">
            <label  id="hatchAngle" style="display: block; margin-bottom: 4px; font-weight: bold;">${lang.hatchAngle}:</label>
            <input type="number" id="hatchAngleInput" step="1" value="${hatchAngle}" style="width: 100%; padding: 4px; box-sizing: border-box; border-radius: 4px; border: 1px solid #888; background: rgba(255,255,255,0.8);">
        </div>
        <div style="margin-bottom: 12px;">
            <label id="hatchDensity" style="display: block; margin-bottom: 4px; font-weight: bold;">${lang.hatchDensity}:</label>
            <input type="number" id="hatchDensityInput" min="0.001" max="0.05" step="0.001" value="${hatchDensity}" style="width: 100%; padding: 4px; box-sizing: border-box; border-radius: 4px; border: 1px solid #888; background: rgba(255,255,255,0.8);">
        </div>
        <div style="margin-bottom: 12px;">
            <label id="hatchPhase" style="display: block; margin-bottom: 4px; font-weight: bold;">${lang.hatchPhase}:</label>
            <input type="number" id="hatchPhaseInput" step="0.01" value="${hatchPhase}" style="width: 100%; padding: 4px; box-sizing: border-box; border-radius: 4px; border: 1px solid #888; background: rgba(255,255,255,0.8);">
        </div>
        <div style="display: flex; gap: 8px; justify-content: center; margin-top: 5px;">
            <button id="hatchCreateBtn" style="background: #228025ff; color: white; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">${lang.hatchCreateBtn || 'Создать'}</button>
            <button id="hatchCancelBtn" style="background: #8d2720ff; color: white; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">${lang.hatchCancelBtn || 'Отмена'}</button>
        </div>
        <div style="font-size: 10px; color: #888; text-align: center; margin-top: 8px; padding-top: 5px; border-top: 1px solid #ccc;">
            <span id="hatchPointsCount">${lang.hatchPointsCount}</span>: ${hatchPoints.length}
        </div>
    `;

    document.body.appendChild(panel);
    previewUIElement = panel;

    const angleInput = panel.querySelector('#hatchAngleInput');
    const densityInput = panel.querySelector('#hatchDensityInput');
    const phaseInput = panel.querySelector('#hatchPhaseInput');
    const createBtn = panel.querySelector('#hatchCreateBtn');
    const cancelBtn = panel.querySelector('#hatchCancelBtn');

    angleInput.oninput = (e) => {
        e.stopPropagation();
        let newAngle = parseFloat(angleInput.value);
        if (isNaN(newAngle)) newAngle = 0;
        hatchAngle = newAngle;
        if (hatchPoints.length >= 3) {
            previewHatchLines = generateHatchLines(hatchPoints, hatchAngle, hatchDensity, hatchPhase);
        }
    };

    densityInput.oninput = (e) => {
        e.stopPropagation();
        let newDensity = parseFloat(densityInput.value);
        if (isNaN(newDensity)) newDensity = 0.05;
        if (newDensity < 0.001) newDensity = 0.001;
        if (newDensity > 0.5) newDensity = 0.5;
        hatchDensity = newDensity;
        densityInput.value = hatchDensity;
        if (hatchPoints.length >= 3) {
            previewHatchLines = generateHatchLines(hatchPoints, hatchAngle, hatchDensity, hatchPhase);
        }
    };

    phaseInput.oninput = (e) => {
        e.stopPropagation();
        let newPhase = parseFloat(phaseInput.value);
        if (isNaN(newPhase)) newPhase = 0;
        hatchPhase = newPhase;
        if (hatchPoints.length >= 3) {
            previewHatchLines = generateHatchLines(hatchPoints, hatchAngle, hatchDensity, hatchPhase);
        }
    };

    createBtn.onclick = (e) => {
        e.stopPropagation();
        finalizeHatch();
    };

    cancelBtn.onclick = (e) => {
        e.stopPropagation();
        cancelHatch();
        // tool = "lines";
        markAllTools();
    };

    panel.onpointerdown = (e) => e.stopPropagation();
    panel.onpointermove = (e) => e.stopPropagation();
    panel.onpointerup = (e) => e.stopPropagation();
    panel.onmousedown = (e) => e.stopPropagation();
    panel.onmouseup = (e) => e.stopPropagation();
    panel.onclick = (e) => e.stopPropagation();
}

function createPanelAtCorner() {
    removePreviewUI();

    const panel = document.createElement('div');
    panel.className = 'menuIsland';
    panel.style.position = 'fixed';
    panel.style.right = '1em';
    panel.style.bottom = '1em';
    panel.style.zIndex = '10000';
    panel.style.minWidth = '220px';
    panel.style.padding = '10px';
    panel.style.backdropFilter = 'blur(10px)';
    panel.style.border = '2px solid rgb(27, 27, 27)';
    panel.style.borderRadius = '1em';
    panel.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    panel.style.userSelect = 'none';
    panel.style.pointerEvents = 'auto';

    panel.innerHTML = `
        <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 4px; font-weight: bold;">${lang.hatchAngle || 'Угол'}:</label>
            <input type="number" id="hatchAngleInput" min="0" max="360" step="1" value="${hatchAngle}" style="width: 100%; padding: 4px; box-sizing: border-box; border-radius: 4px; border: 1px solid #888; background: rgba(255,255,255,0.8);">
        </div>
        <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-weight: bold;">${lang.hatchDensity || 'Плотность'}:</label>
            <input type="number" id="hatchDensityInput" min="0.001" max="0.5" step="0.001" value="${hatchDensity}" style="width: 100%; padding: 4px; box-sizing: border-box; border-radius: 4px; border: 1px solid #888; background: rgba(255,255,255,0.8);">
        </div>
        <div style="margin-bottom: 12px;">
            <label style="display: block; margin-bottom: 4px; font-weight: bold;">${lang.hatchPhase || 'Сдвиг'}:</label>
            <input type="number" id="hatchPhaseInput" step="0.01" value="${hatchPhase}" style="width: 100%; padding: 4px; box-sizing: border-box; border-radius: 4px; border: 1px solid #888; background: rgba(255,255,255,0.8);">
            
        </div>
        <div style="display: flex; gap: 8px; justify-content: center; margin-top: 5px;">
            <button id="hatchCreateBtn" style="background: #368339ff; color: white; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">${lang.hatchCreate || 'Создать'}</button>
            <button id="hatchCancelBtn" style="background: #a5362eff; color: white; border: none; padding: 5px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">${lang.hatchCancel || 'Отмена'}</button>
        </div>
        <div style="font-size: 10px; color: #888; text-align: center; margin-top: 8px; padding-top: 5px; border-top: 1px solid #ccc;">
            Точки: ${hatchPoints.length}
        </div>
    `;

    document.body.appendChild(panel);
    previewUIElement = panel;

    const angleInput = panel.querySelector('#hatchAngleInput');
    const densityInput = panel.querySelector('#hatchDensityInput');
    const phaseInput = panel.querySelector('#hatchPhaseInput');
    const createBtn = panel.querySelector('#hatchCreateBtn');
    const cancelBtn = panel.querySelector('#hatchCancelBtn');

    angleInput.oninput = (e) => {
        e.stopPropagation();
        let newAngle = parseFloat(angleInput.value);
        if (isNaN(newAngle)) newAngle = 0;
        hatchAngle = newAngle;
        if (hatchPoints.length >= 3) {
            previewHatchLines = generateHatchLines(hatchPoints, hatchAngle, hatchDensity, hatchPhase);
        }
    };

    densityInput.oninput = (e) => {
        e.stopPropagation();
        let newDensity = parseFloat(densityInput.value);
        if (isNaN(newDensity)) newDensity = 0.05;
        if (newDensity < 0.001) newDensity = 0.001;
        if (newDensity > 0.5) newDensity = 0.5;
        hatchDensity = newDensity;
        densityInput.value = hatchDensity;
        if (hatchPoints.length >= 3) {
            previewHatchLines = generateHatchLines(hatchPoints, hatchAngle, hatchDensity, hatchPhase);
        }
    };

    phaseInput.oninput = (e) => {
        e.stopPropagation();
        let newPhase = parseFloat(phaseInput.value);
        if (isNaN(newPhase)) newPhase = 0;
        hatchPhase = newPhase;
        if (hatchPoints.length >= 3) {
            previewHatchLines = generateHatchLines(hatchPoints, hatchAngle, hatchDensity, hatchPhase);
        }
    };

    createBtn.onclick = (e) => {
        e.stopPropagation();
        finalizeHatch();
    };

    cancelBtn.onclick = (e) => {
        e.stopPropagation();
        cancelHatch();
        // tool = "lines";
        markAllTools();
    };

    panel.onpointerdown = (e) => e.stopPropagation();
    panel.onpointermove = (e) => e.stopPropagation();
    panel.onpointerup = (e) => e.stopPropagation();
    panel.onmousedown = (e) => e.stopPropagation();
    panel.onmouseup = (e) => e.stopPropagation();
    panel.onclick = (e) => e.stopPropagation();
}

function clearHatchState() {
    cancelHatch();
}
