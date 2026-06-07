let hatchPoints = [];
let lastHatchPoints = [];
let isDrawingHatch = false;
let isHatchDragging = false;
let previewHatchLines = [];
let hatchAngle = 45;
let hatchDensity = 0.03;
let hatchPhase = 0;

let hatchMode = 'lines';
let hatchThickness = 0.005;

let lastHatchAction = null;
let lastAddedHatchPointTime = 0;
let lastHatchRemovedIndex = -1;
let lastHatchRemovedPoint = null;

window.setHatchMode = function(mode) {
    hatchMode = mode;
    const btnLines = document.getElementById('hatchModeLinesBtn');
    const btnQuads = document.getElementById('hatchModeQuadsBtn');
    const thickCont = document.getElementById('hatchThicknessContainer');

    if (btnLines && btnQuads) {
        btnLines.style.background = 'transparent';
        btnLines.style.border = '1px solid var(--border-col)';
        btnQuads.style.background = 'transparent';
        btnQuads.style.border = '1px solid var(--border-col)';

        let activeBtn = mode === 'lines' ? btnLines : btnQuads;
        activeBtn.style.background = 'var(--input-bg)';
        activeBtn.style.borderColor = 'transparent';
    }

    if (thickCont) {
        thickCont.style.display = mode === 'quads' ? 'flex' : 'none';
    }
    
    if (typeof updateHatchPreview === 'function') updateHatchPreview();
};

function startHatchDrawing(pos) {
    hatchPoints = [{
        x: Math.round(pos.x * 1000000) / 1000000,
        y: Math.round(pos.y * 1000000) / 1000000
    }];

    lastHatchAction = 'start';
    lastAddedHatchPointTime = Date.now();

    isDrawingHatch = true;
    previewHatchLines = [];
    hatchPhase = el("hatchPhaseInput").value ? parseFloat(el("hatchPhaseInput").value) : 0;
    updateHatchPreview();
}

function addHatchPoint(pos, isDragging = false) {
    if (!isDrawingHatch) return;

    const roundedPos = {
        x: Math.round(pos.x * 1000000) / 1000000,
        y: Math.round(pos.y * 1000000) / 1000000
    };

    if (hatchPoints.length > 0) {
        const last = hatchPoints[hatchPoints.length - 1];
        if (Math.abs(roundedPos.x - last.x) < 0.000001 &&
            Math.abs(roundedPos.y - last.y) < 0.000001) return;
    }
    if (hatchPoints.length > 1) {
        const prevLast = hatchPoints[hatchPoints.length - 2];
        if (Math.abs(roundedPos.x - prevLast.x) < 0.000001 &&
            Math.abs(roundedPos.y - prevLast.y) < 0.000001) return;
    }

    let existingIndex = -1;
    let isTouch = ('ontouchstart' in window);
    let radius = (isTouch ? 20 : 10) / screenZoom / getBaseScale();

    for (let i = 0; i < hatchPoints.length; i++) {
        if (Math.abs(roundedPos.x - hatchPoints[i].x) < radius &&
            Math.abs(roundedPos.y - hatchPoints[i].y) < radius) {
            existingIndex = i;
            break;
        }
    }

    if (snapping || mobileSnappingActive) {
        const finalPos = (existingIndex !== -1) ? hatchPoints[existingIndex] : roundedPos;

        lastHatchAction = 'add';
        lastAddedHatchPointTime = Date.now();

        hatchPoints.push({ x: finalPos.x, y: finalPos.y });
        updateHatchPreview();
        return;
    }

    if (existingIndex !== -1) {
        if (!isDragging) {
            lastHatchAction = 'remove';
            lastHatchRemovedIndex = existingIndex;
            lastHatchRemovedPoint = hatchPoints[existingIndex];
            lastAddedHatchPointTime = Date.now();

            hatchPoints.splice(existingIndex, 1);
            if (hatchPoints.length === 0) cancelHatch();
            else updateHatchPreview();
        }
        return;
    }

    lastHatchAction = 'add';
    lastAddedHatchPointTime = Date.now();
    hatchPoints.push(roundedPos);
    updateHatchPreview();
}

function updateHatchPreview() {
    const countEl = document.getElementById('hatchPointsNum');
    if (countEl) countEl.innerText = hatchPoints.length;

    if (!isDrawingHatch || hatchPoints.length < 2) return;

    if (hatchPoints.length >= 3) {
        previewHatchLines = generateHatchData(hatchPoints, hatchAngle, hatchDensity, hatchPhase, hatchMode, hatchThickness);
    } else {
        previewHatchLines = [];
    }
}

function generateHatchData(points, angleDeg, spacing, phase, mode, thickness) {
    const results = [];
    if (points.length < 3) return results;
    if (spacing <= 0) return results;

    let normalizedAngle = angleDeg % 360;
    if (normalizedAngle < 0) normalizedAngle += 360;

    const adjustedAngle = normalizedAngle - 90;
    const angleRad = adjustedAngle * Math.PI / 180;

    const lineDirX = Math.cos(angleRad);
    const lineDirY = Math.sin(angleRad);
    const perpX = -Math.sin(angleRad);
    const perpY = Math.cos(angleRad);

    const projValues = points.map(p => p.x * perpX + p.y * perpY);
    let minProj = Math.min(...projValues);
    let maxProj = Math.max(...projValues);

    const base = 0;
    const kMin = Math.floor((minProj - base - phase) / spacing) - 1;
    const kMax = Math.ceil((maxProj - base - phase) / spacing) + 1;

    const maxLines = 5000;
    if (kMax - kMin + 1 > maxLines) {
        console.warn(`Слишком много элементов (${kMax - kMin + 1}), ограничено до ${maxLines}`);
        return results;
    }

    for (let k = kMin; k <= kMax; k++) {
        const baseProj = base + phase + k * spacing;

        if (mode === 'lines' || !mode) {
            const intersections = [];
            for (let i = 0; i < points.length; i++) {
                const p1 = points[i];
                const p2 = points[(i + 1) % points.length];
                const proj1 = p1.x * perpX + p1.y * perpY;
                const proj2 = p2.x * perpX + p2.y * perpY;

                if ((proj1 - baseProj) * (proj2 - baseProj) < 0) {
                    const t = (baseProj - proj1) / (proj2 - proj1);
                    const ix = p1.x + (p2.x - p1.x) * t;
                    const iy = p1.y + (p2.y - p1.y) * t;
                    const along = ix * lineDirX + iy * lineDirY;
                    intersections.push({ x: ix, y: iy, along: along });
                }
            }

            if (intersections.length < 2) continue;
            intersections.sort((a, b) => a.along - b.along);

            for (let i = 0; i < intersections.length - 1; i += 2) {
                results.push({
                    type: 'line',
                    start: { x: intersections[i].x, y: intersections[i].y },
                    end: { x: intersections[i + 1].x, y: intersections[i + 1].y }
                });
            }
        } else if (mode === 'quads') {
            const pStart = baseProj - thickness / 2;
            const pEnd = baseProj + thickness / 2;

            const uniqueProjs = [pStart, pEnd];

            for (let i = 0; i < points.length; i++) {
                const vProj = projValues[i];
                if (vProj > pStart + 1e-9 && vProj < pEnd - 1e-9) {
                    uniqueProjs.push(vProj);
                }
            }

            uniqueProjs.sort((a, b) => a - b);
            const intervals = [];
            for (let i = 0; i < uniqueProjs.length; i++) {
                if (i === 0 || uniqueProjs[i] - uniqueProjs[i - 1] > 1e-9) {
                    intervals.push(uniqueProjs[i]);
                }
            }

            for (let j = 0; j < intervals.length - 1; j++) {
                const p_j = intervals[j];
                const p_next = intervals[j + 1];
                const p_mid = (p_j + p_next) / 2;

                const crossingEdges = [];

                for (let i = 0; i < points.length; i++) {
                    const p1 = points[i];
                    const p2 = points[(i + 1) % points.length];
                    const proj1 = projValues[i];
                    const proj2 = projValues[(i + 1) % points.length];

                    if ((proj1 - p_mid) * (proj2 - p_mid) < 0) {
                        const t_j = (p_j - proj1) / (proj2 - proj1);
                        const ix_j = p1.x + (p2.x - p1.x) * t_j;
                        const iy_j = p1.y + (p2.y - p1.y) * t_j;
                        const along_j = ix_j * lineDirX + iy_j * lineDirY;

                        const t_next = (p_next - proj1) / (proj2 - proj1);
                        const ix_next = p1.x + (p2.x - p1.x) * t_next;
                        const iy_next = p1.y + (p2.y - p1.y) * t_next;
                        const along_next = ix_next * lineDirX + iy_next * lineDirY;

                        crossingEdges.push({
                            pt_j: { x: ix_j, y: iy_j },
                            pt_next: { x: ix_next, y: iy_next },
                            along_mid: (along_j + along_next) / 2
                        });
                    }
                }
                crossingEdges.sort((a, b) => a.along_mid - b.along_mid);

                for (let i = 0; i < crossingEdges.length - 1; i += 2) {
                    const edgeA = crossingEdges[i];
                    const edgeB = crossingEdges[i + 1];

                    
                    results.push({
                        type: 'quad',
                        pos1: edgeA.pt_j,
                        pos2: edgeB.pt_j,
                        pos3: edgeB.pt_next,
                        pos4: edgeA.pt_next
                    });
                }
            }
        }
    }
    return results;
}

function finalizeHatch() {
    if (hatchPoints.length < 3) {
        alert(lang === ru ? "Для штриховки необходимо минимум 3 точки!" : "At least 3 points are required for hatching!");
        cancelHatch();
        return;
    }

    const finalItems = generateHatchData(hatchPoints, hatchAngle, hatchDensity, hatchPhase, hatchMode, hatchThickness);

    if (finalItems.length === 0) {
        alert(lang === ru ? "Не удалось сгенерировать штриховку!" : "Failed to generate hatch lines!");
        cancelHatch();
        return;
    }

    lastHatchPoints = [...hatchPoints];

    let newObjects = [];

    for (const item of finalItems) {
        const objIdStr = nextId().toString();
        let object;
        
        if (item.type === 'line') {
            object = {
                name: lang.line + " " + objIdStr,
                type: "line",
                start: {
                    x: Math.round(item.start.x * 1000000) / 1000000,
                    y: Math.round(item.start.y * 1000000) / 1000000
                },
                end: {
                    x: Math.round(item.end.x * 1000000) / 1000000,
                    y: Math.round(item.end.y * 1000000) / 1000000
                },
                selected: false
            };
        } else if (item.type === 'quad') {
            object = {
                name: lang.quad + " " + objIdStr,
                type: "quad",
                pos1: { x: Math.round(item.pos1.x * 1000000) / 1000000, y: Math.round(item.pos1.y * 1000000) / 1000000 },
                pos2: { x: Math.round(item.pos2.x * 1000000) / 1000000, y: Math.round(item.pos2.y * 1000000) / 1000000 },
                pos3: { x: Math.round(item.pos3.x * 1000000) / 1000000, y: Math.round(item.pos3.y * 1000000) / 1000000 },
                pos4: { x: Math.round(item.pos4.x * 1000000) / 1000000, y: Math.round(item.pos4.y * 1000000) / 1000000 },
                selected: false
            };
        }

        objects.set(objIdStr, object);
        newObjects.push({ id: objIdStr, object: object });
    }

    if (newObjects.length > 0) {
        pushEvent("add_multiple", newObjects);
    }

    refreshObjectsList(true);
    cancelHatch();
    markAllTools();
}

function cancelHatch() {
    hatchPoints = [];
    isDrawingHatch = false;
    isHatchDragging = false;
    previewHatchLines = [];
    hatchPhase = 0;
    const countEl = document.getElementById('hatchPointsNum');
    if (countEl) countEl.innerText = "0";
}

function restoreLastHatch() {
    if (!lastHatchPoints || lastHatchPoints.length === 0) {
        alert(lang === ru ? "Предыдущая зона отсутствует!" : "No previous zone found!");
        return;
    }
    hatchPoints = [...lastHatchPoints];
    isDrawingHatch = true;
    updateHatchPreview();
}

function clearHatchState() {
    cancelHatch();
}

document.addEventListener('DOMContentLoaded', () => {
    const angleInput = document.getElementById('hatchAngleInput');
    const densityInput = document.getElementById('hatchDensityInput');
    const phaseInput = document.getElementById('hatchPhaseInput');
    const createBtn = document.getElementById('hatchCreateBtn');
    const cancelBtn = document.getElementById('hatchCancelBtn');
    const restoreBtn = document.getElementById('hatchRestoreBtn');
    const thicknessInput = document.getElementById('hatchThicknessInput');

    const value = Number((hatchDensity * 2.5).toFixed(6));
    document.getElementById('middleLineForHatch').innerHTML = `50% = ${value} ↑`;

    if (angleInput) {
        angleInput.oninput = (e) => {
            let newAngle = parseFloat(angleInput.value);
            if (isNaN(newAngle)) newAngle = 0;
            hatchAngle = newAngle;
            updateHatchPreview();
        };
    }

    if (densityInput) {
        densityInput.oninput = (e) => {
            let newDensity = parseFloat(densityInput.value);
            if (isNaN(newDensity)) newDensity = 0.05;
            if (newDensity < 0.001) newDensity = 0.001;
            if (newDensity > 0.5) newDensity = 0.5;
            hatchDensity = newDensity;
            densityInput.value = hatchDensity;
            const value = Number((hatchDensity * 2.5).toFixed(6));
            document.getElementById('middleLineForHatch').innerHTML = `50% = ${value} ↑`;
            updateHatchPreview();
        };
    }

    if (phaseInput) {
        phaseInput.oninput = (e) => {
            let newPhase = parseFloat(phaseInput.value);
            if (isNaN(newPhase)) newPhase = 0;
            hatchPhase = newPhase;
            updateHatchPreview();
        };
    }

    if (thicknessInput) {
        thicknessInput.oninput = (e) => {
            let newThickness = parseFloat(thicknessInput.value);
            if (isNaN(newThickness)) newThickness = 0.005;
            if (newThickness < 0.001) newThickness = 0.001;
            if (newThickness > 0.5) newThickness = 0.5;
            hatchThickness = newThickness;
            updateHatchPreview();
        };
    }

    if (createBtn) createBtn.onclick = () => finalizeHatch();
    if (cancelBtn) cancelBtn.onclick = () => cancelHatch();
    if (restoreBtn) restoreBtn.onclick = () => restoreLastHatch();
});