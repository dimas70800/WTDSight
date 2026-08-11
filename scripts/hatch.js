let hatchRegions = [[]];
let currentHatchRegionIndex = 0;
let isMultiRegionMode = false;
let hatchPoints = hatchRegions[0];

let lastHatchPoints = [];
let isDrawingHatch = false;
let isHatchDragging = false;
let previewHatchLines = [];

let hatchVertexDragIndex = -1;
let hatchVertexDragMoved = false;
let hatchVertexDragIsNew = false;
let hatchAngle = 45;
let hatchDensity = 0.03;
let hatchPhase = 0;

let hatchGridEnabled = false;
let hatchGridAngle = 90;

let hatchMode = 'lines';
let hatchThickness = 0.005;

let lastHatchAction = null;
let lastAddedHatchPointTime = 0;
let lastHatchRemovedIndex = -1;
let lastHatchRemovedPoint = null;

function setHatchRegionMode(mode) {
    isMultiRegionMode = (mode === 'multi');
    const btnSingle = document.getElementById('hatchRegionSingleBtn');
    const btnMulti = document.getElementById('hatchRegionMultiBtn');
    const controls = document.getElementById('hatchMultiControls');

    if (btnSingle && btnMulti) {
        btnSingle.style.background = mode === 'single' ? 'var(--input-bg)' : 'transparent';
        btnSingle.style.border = mode === 'single' ? 'transparent' : '1px solid var(--border-col)';
        btnMulti.style.background = mode === 'multi' ? 'var(--input-bg)' : 'transparent';
        btnMulti.style.border = mode === 'multi' ? 'transparent' : '1px solid var(--border-col)';
    }

    if (controls) {
        controls.style.display = mode === 'multi' ? 'flex' : 'none';
    }

    if (mode === 'single') {
        if (hatchRegions[currentHatchRegionIndex]) {
            hatchRegions = [hatchRegions[currentHatchRegionIndex]];
        } else {
            hatchRegions = [[]];
        }
        currentHatchRegionIndex = 0;
        hatchPoints = hatchRegions[0];
        updateHatchRegionUI();
        updateHatchPreview();
    }
};

setHatchRegionMode('single');

function changeHatchRegion(dir) {
    if (hatchRegions.length === 0) return;

    let newIdx = (currentHatchRegionIndex + dir + hatchRegions.length) % hatchRegions.length;

    currentHatchRegionIndex = newIdx;
    hatchPoints = hatchRegions[currentHatchRegionIndex];

    updateHatchRegionUI();
    updateHatchPreview();
};

function setHatchRegionFromInput() {
    const input = document.getElementById('hatchRegionInput');
    if (!input) return;
    let val = parseInt(input.value) - 1;
    if (isNaN(val) || val < 0) val = 0;
    if (val >= hatchRegions.length) val = hatchRegions.length - 1;
    currentHatchRegionIndex = val;
    hatchPoints = hatchRegions[currentHatchRegionIndex];
    updateHatchRegionUI();
    updateHatchPreview();
};

function addHatchRegion() {
    hatchRegions.push([]);
    currentHatchRegionIndex = hatchRegions.length - 1;
    hatchPoints = hatchRegions[currentHatchRegionIndex];
    updateHatchRegionUI();
    updateHatchPreview();
};

function deleteHatchRegion() {
    hatchRegions.splice(currentHatchRegionIndex, 1);
    if (hatchRegions.length === 0) {
        hatchRegions.push([]);
        isDrawingHatch = false;
    }
    if (currentHatchRegionIndex >= hatchRegions.length) {
        currentHatchRegionIndex = hatchRegions.length - 1;
    }
    hatchPoints = hatchRegions[currentHatchRegionIndex];
    updateHatchRegionUI();
    updateHatchPreview();
};

function updateHatchRegionUI() {
    const input = document.getElementById('hatchRegionInput');
    if (input) input.value = currentHatchRegionIndex + 1;

    const countEl = document.getElementById('hatchPointsNum');
    if (countEl) countEl.innerText = hatchPoints.length;
}

function setHatchMode(mode) {
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
    hatchRegions = [[{
        x: Math.round(pos.x * 1000000) / 1000000,
        y: Math.round(pos.y * 1000000) / 1000000
    }]];
    currentHatchRegionIndex = 0;
    hatchPoints = hatchRegions[0];

    lastHatchAction = 'start';
    lastAddedHatchPointTime = Date.now();

    isDrawingHatch = true;
    previewHatchLines = [];
    hatchPhase = el("hatchPhaseInput").value ? parseFloat(el("hatchPhaseInput").value) : 0;
    updateHatchRegionUI();
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
        if (Math.abs(roundedPos.x - last.x) < 0.000001 && Math.abs(roundedPos.y - last.y) < 0.000001) return;
    }
    if (hatchPoints.length > 1) {
        const prevLast = hatchPoints[hatchPoints.length - 2];
        if (Math.abs(roundedPos.x - prevLast.x) < 0.000001 && Math.abs(roundedPos.y - prevLast.y) < 0.000001) return;
    }

    let existingIndex = -1;
    let isTouch = ('ontouchstart' in window);
    let radius = (isTouch ? 20 : 10) / screenZoom / getBaseScale();

    for (let i = 0; i < hatchPoints.length; i++) {
        if (Math.abs(roundedPos.x - hatchPoints[i].x) < radius && Math.abs(roundedPos.y - hatchPoints[i].y) < radius) {
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
            if (hatchPoints.length === 0 && hatchRegions.length === 1) cancelHatch();
            else updateHatchPreview();
        }
        return;
    }

    lastHatchAction = 'add';
    lastAddedHatchPointTime = Date.now();
    hatchPoints.push(roundedPos);
    updateHatchPreview();
}

function hitTestHatchVertex(pos) {
    if (!isDrawingHatch || !hatchPoints || hatchPoints.length === 0) return -1;

    const isTouch = ('ontouchstart' in window);
    const radius = (isTouch ? 20 : 10) / screenZoom / getBaseScale();

    for (let i = 0; i < hatchPoints.length; i++) {
        if (Math.abs(pos.x - hatchPoints[i].x) < radius && Math.abs(pos.y - hatchPoints[i].y) < radius) {
            return i;
        }
    }
    return -1;
}

function pointToSegmentSqrDist(p, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const apx = p.x - a.x, apy = p.y - a.y;
    const abLenSqr = abx * abx + aby * aby;

    let t = (abLenSqr > 0) ? (apx * abx + apy * aby) / abLenSqr : 0;
    t = Math.max(0, Math.min(1, t));

    const proj = { x: a.x + abx * t, y: a.y + aby * t };
    const dx = p.x - proj.x, dy = p.y - proj.y;

    return { sqrDist: dx * dx + dy * dy, proj: proj };
}

function hitTestHatchEdge(pos) {
    if (!isDrawingHatch || !hatchPoints || hatchPoints.length < 2) return null;

    const isTouch = ('ontouchstart' in window);
    const radiusSight = (isTouch ? 20 : 10) / screenZoom / getBaseScale();
    const maxSqrDist = radiusSight * radiusSight;

    let bestAfterIndex = -1;
    let bestPos = null;
    let bestSqrDist = maxSqrDist;

    const n = hatchPoints.length;
    const edgeCount = (n >= 3) ? n : (n - 1);

    for (let i = 0; i < edgeCount; i++) {
        const a = hatchPoints[i];
        const b = hatchPoints[(i + 1) % n];

        const { sqrDist, proj } = pointToSegmentSqrDist(pos, a, b);
        if (sqrDist < bestSqrDist) {
            bestSqrDist = sqrDist;
            bestAfterIndex = i;
            bestPos = proj;
        }
    }

    if (bestAfterIndex === -1) return null;
    return { afterIndex: bestAfterIndex, pos: bestPos };
}

function insertHatchPointAfter(afterIndex, pos) {
    const roundedPos = {
        x: Math.round(pos.x * 1000000) / 1000000,
        y: Math.round(pos.y * 1000000) / 1000000
    };

    const insertIndex = afterIndex + 1;
    hatchPoints.splice(insertIndex, 0, roundedPos);

    lastHatchAction = 'add';
    lastAddedHatchPointTime = Date.now();

    updateHatchPreview();
    return insertIndex;
}

function startHatchVertexDrag(index, isNew = false) {
    if (!isDrawingHatch || index < 0 || index >= hatchPoints.length) return;
    hatchVertexDragIndex = index;
    hatchVertexDragMoved = false;
    hatchVertexDragIsNew = isNew;
}

function dragHatchVertex(pos) {
    if (hatchVertexDragIndex < 0 || hatchVertexDragIndex >= hatchPoints.length) return;

    hatchVertexDragMoved = true;

    let finalPos = pos;

    if (snapping || mobileSnappingActive) {
        let snapRad = (mobileSnappingActive && !snapping) ? 40 : Infinity;
        const snapPos = snappingPos(pos, snapRad);
        if (snapPos != null) finalPos = snapPos;
    }

    hatchPoints[hatchVertexDragIndex] = {
        x: Math.round(finalPos.x * 1000000) / 1000000,
        y: Math.round(finalPos.y * 1000000) / 1000000
    };

    updateHatchPreview();
}

function endHatchVertexDrag() {
    const result = { wasMoved: hatchVertexDragMoved, isNew: hatchVertexDragIsNew };
    hatchVertexDragIndex = -1;
    hatchVertexDragMoved = false;
    hatchVertexDragIsNew = false;
    return result;
}

function updateHatchPreview() {
    updateHatchRegionUI();

    if (!isDrawingHatch) {
        previewHatchLines = [];
        return;
    }

    const regionsToRender = isMultiRegionMode ? hatchRegions : [hatchPoints];
    const validRegions = regionsToRender.filter(r => r.length >= 3);

    if (validRegions.length > 0) {
        previewHatchLines = generateHatchData(regionsToRender, hatchAngle, hatchDensity, hatchPhase, hatchMode, hatchThickness);

        if (hatchGridEnabled) {
            const gridLines = generateHatchData(regionsToRender, hatchAngle + hatchGridAngle, hatchDensity, hatchPhase, hatchMode, hatchThickness);
            previewHatchLines = previewHatchLines.concat(gridLines);
        }
    } else {
        previewHatchLines = [];
    }
}

function generateHatchData(regions, angleDeg, spacing, phase, mode, thickness) {
    const results = [];
    const validRegions = regions.filter(r => r.length >= 3);
    if (validRegions.length === 0) return results;
    if (spacing <= 0) return results;

    let normalizedAngle = angleDeg % 360;
    if (normalizedAngle < 0) normalizedAngle += 360;

    const adjustedAngle = normalizedAngle - 90;
    const angleRad = adjustedAngle * Math.PI / 180;

    const lineDirX = Math.cos(angleRad);
    const lineDirY = Math.sin(angleRad);
    const perpX = -Math.sin(angleRad);
    const perpY = Math.cos(angleRad);

    let allProjValues = [];
    for (let r of validRegions) {
        for (let p of r) {
            allProjValues.push(p.x * perpX + p.y * perpY);
        }
    }
    let minProj = Math.min(...allProjValues);
    let maxProj = Math.max(...allProjValues);

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
            for (let r of validRegions) {
                for (let i = 0; i < r.length; i++) {
                    const p1 = r[i];
                    const p2 = r[(i + 1) % r.length];
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
            }

            if (intersections.length < 2) continue;
            intersections.sort((a, b) => a.along - b.along);

            for (let i = 0; i < intersections.length - 1; i += 2) {
                const start = intersections[i];
                const end = intersections[i + 1];
                const distSq = (start.x - end.x) ** 2 + (start.y - end.y) ** 2;
                if (distSq < 1e-10) continue;
                results.push({
                    type: 'line',
                    start: { x: start.x, y: start.y },
                    end: { x: end.x, y: end.y }
                });
            }
        } else if (mode === 'quads') {
            const pStart = baseProj - thickness / 2;
            const pEnd = baseProj + thickness / 2;

            const uniqueProjs = [pStart, pEnd];
            for (let r of validRegions) {
                for (let i = 0; i < r.length; i++) {
                    const vProj = r[i].x * perpX + r[i].y * perpY;
                    if (vProj > pStart + 1e-9 && vProj < pEnd - 1e-9) {
                        uniqueProjs.push(vProj);
                    }
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
                for (let r of validRegions) {
                    for (let i = 0; i < r.length; i++) {
                        const p1 = r[i];
                        const p2 = r[(i + 1) % r.length];
                        const proj1 = p1.x * perpX + p1.y * perpY;
                        const proj2 = p2.x * perpX + p2.y * perpY;

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
    const regionsToRender = isMultiRegionMode ? hatchRegions : [hatchPoints];
    const validRegions = regionsToRender.filter(r => r.length >= 3);

    if (validRegions.length === 0) {
        alert(lang === ru ? "Для штриховки необходимо минимум 3 точки!" : "At least 3 points are required for hatching!");
        cancelHatch();
        return;
    }

    let finalItems = generateHatchData(regionsToRender, hatchAngle, hatchDensity, hatchPhase, hatchMode, hatchThickness);

    if (hatchGridEnabled) {
        const gridItems = generateHatchData(regionsToRender, hatchAngle + hatchGridAngle, hatchDensity, hatchPhase, hatchMode, hatchThickness);
        finalItems = finalItems.concat(gridItems);
    }

    if (finalItems.length === 0) {
        alert(lang === ru ? "Не удалось сгенерировать штриховку!" : "Failed to generate hatch lines!");
        cancelHatch();
        return;
    }

    lastHatchPoints = regionsToRender.map(r => [...r]);

    let newObjects = [];
    let processedLines = [];

    function clipLine(start, end) {
        let segments = [{ start: start, end: end }];

        function processAgainstLine(A, B) {
            const vObj = { x: B.x - A.x, y: B.y - A.y };
            const lenObj = Math.sqrt(vObj.x ** 2 + vObj.y ** 2);
            if (lenObj < 1e-6) return;
            const dObj = { x: vObj.x / lenObj, y: vObj.y / lenObj };

            for (let i = segments.length - 1; i >= 0; i--) {
                const seg = segments[i];
                const C = seg.start;
                const D = seg.end;

                const vSeg = { x: D.x - C.x, y: D.y - C.y };
                const lenSeg = Math.sqrt(vSeg.x ** 2 + vSeg.y ** 2);
                if (lenSeg < 1e-6) continue;
                const dSeg = { x: vSeg.x / lenSeg, y: vSeg.y / lenSeg };

                const cross1 = dObj.x * dSeg.y - dObj.y * dSeg.x;
                if (Math.abs(cross1) > 1e-4) continue;

                const vAC = { x: C.x - A.x, y: C.y - A.y };
                const cross2 = dObj.x * vAC.y - dObj.y * vAC.x;
                if (Math.abs(cross2) > 1e-4) continue;

                const pA = (A.x - C.x) * dSeg.x + (A.y - C.y) * dSeg.y;
                const pB = (B.x - C.x) * dSeg.x + (B.y - C.y) * dSeg.y;

                const pObjMin = Math.min(pA, pB);
                const pObjMax = Math.max(pA, pB);

                const pSegMin = 0;
                const pSegMax = lenSeg;

                if (pObjMax <= pSegMin + 1e-5 || pObjMin >= pSegMax - 1e-5) continue;

                segments.splice(i, 1);

                if (pObjMin > pSegMin + 1e-5) {
                    const t = pObjMin / lenSeg;
                    segments.push({
                        start: { x: C.x, y: C.y },
                        end: { x: C.x + vSeg.x * t, y: C.y + vSeg.y * t }
                    });
                }
                if (pObjMax < pSegMax - 1e-5) {
                    const t = pObjMax / lenSeg;
                    segments.push({
                        start: { x: C.x + vSeg.x * t, y: C.y + vSeg.y * t },
                        end: { x: D.x, y: D.y }
                    });
                }
            }
        }

        for (const [id, obj] of objects) {
            if (obj.type === "line") processAgainstLine(obj.start, obj.end);
        }
        for (const obj of processedLines) {
            if (obj.type === "line") processAgainstLine(obj.start, obj.end);
        }

        return segments;
    }

    for (const item of finalItems) {
        if (item.type === 'line') {
            const clippedSegments = clipLine(item.start, item.end);

            for (const seg of clippedSegments) {
                const objIdStr = nextId().toString();
                const object = {
                    name: lang.line + " " + objIdStr,
                    type: "line",
                    start: {
                        x: Math.round(seg.start.x * 1000000) / 1000000,
                        y: Math.round(seg.start.y * 1000000) / 1000000
                    },
                    end: {
                        x: Math.round(seg.end.x * 1000000) / 1000000,
                        y: Math.round(seg.end.y * 1000000) / 1000000
                    },
                    selected: false
                };
                objects.set(objIdStr, object);
                newObjects.push({ id: objIdStr, object: object });
                processedLines.push(object);
            }
        } else if (item.type === 'quad') {
            const objIdStr = nextId().toString();
            const object = {
                name: lang.quad + " " + objIdStr,
                type: "quad",
                pos1: { x: Math.round(item.pos1.x * 1000000) / 1000000, y: Math.round(item.pos1.y * 1000000) / 1000000 },
                pos2: { x: Math.round(item.pos2.x * 1000000) / 1000000, y: Math.round(item.pos2.y * 1000000) / 1000000 },
                pos3: { x: Math.round(item.pos3.x * 1000000) / 1000000, y: Math.round(item.pos3.y * 1000000) / 1000000 },
                pos4: { x: Math.round(item.pos4.x * 1000000) / 1000000, y: Math.round(item.pos4.y * 1000000) / 1000000 },
                selected: false
            };
            objects.set(objIdStr, object);
            newObjects.push({ id: objIdStr, object: object });
        }
    }

    if (newObjects.length > 0) {
        pushEvent("add_multiple", newObjects);
    }

    refreshObjectsList(true);
    cancelHatch();
    markAllTools();
}

function cancelHatch() {
    hatchRegions = [[]];
    currentHatchRegionIndex = 0;
    hatchPoints = hatchRegions[0];
    isDrawingHatch = false;
    isHatchDragging = false;
    previewHatchLines = [];
    hatchPhase = 0;
    updateHatchRegionUI();
}

function restoreLastHatch() {
    if (!lastHatchPoints || lastHatchPoints.length === 0) {
        alert(lang === ru ? "Предыдущая зона отсутствует!" : "No previous zone found!");
        return;
    }

    if (Array.isArray(lastHatchPoints[0])) {
        hatchRegions = lastHatchPoints.map(r => [...r]);
    } else {
        hatchRegions = [[...lastHatchPoints]];
    }

    currentHatchRegionIndex = 0;
    hatchPoints = hatchRegions[currentHatchRegionIndex];

    if (hatchRegions.length > 1) {
        setHatchRegionMode('multi');
    } else {
        updateHatchRegionUI();
    }

    isDrawingHatch = true;
    updateHatchPreview();
}

let hatchInputMode = 'manual';

function setHatchInputMode(mode) {
    hatchInputMode = mode;
    const btnManual = document.getElementById('hatchInputManualBtn');
    const btnWand = document.getElementById('hatchInputWandBtn');

    if (btnManual && btnWand) {
        btnManual.style.background = mode === 'manual' ? 'var(--input-bg)' : 'transparent';
        btnManual.style.border = mode === 'manual' ? 'transparent' : '1px solid var(--border-col)';
        btnWand.style.background = mode === 'wand' ? 'var(--input-bg)' : 'transparent';
        btnWand.style.border = mode === 'wand' ? 'transparent' : '1px solid var(--border-col)';
    }
}

const magicWandWorker = new Worker('scripts/magicwand-worker.js');
let magicWandRequestSeq = 0;
let magicWandCallback = null;

magicWandWorker.onmessage = (e) => {
    const data = e.data || {};
    if (data.requestId !== magicWandRequestSeq) return;
    const cb = magicWandCallback;
    magicWandCallback = null;
    if (cb) cb(data.error || null, data.regions || []);
};

function collectMagicWandWalls() {
    const lines = [];
    const quads = [];

    for (const [, obj] of objects) {
        if (obj.type === "line") {
            lines.push({ start: obj.start, end: obj.end });
        } else if (obj.type === "quad") {
            quads.push({ pos1: obj.pos1, pos2: obj.pos2, pos3: obj.pos3, pos4: obj.pos4 });
        }
    }

    return { lines, quads };
}


function requestMagicWandRegions(clickPos, callback) {
    const requestId = ++magicWandRequestSeq;
    magicWandCallback = callback;

    const { lines, quads } = collectMagicWandWalls();
    magicWandWorker.postMessage({ requestId, lines, quads, clickPos });
}


function executeMagicWand(clickPos) {
    requestMagicWandRegions(clickPos, (err, newRegions) => {
        if (err) {
            console.error('Magic wand failed:', err);
            showNotification(lang === ru ? "Не удалось построить область (волшебная палочка)" : "Failed to build the region (magic wand)", true);
            return;
        }

        if (!newRegions || newRegions.length === 0) return;

        if (newRegions.length > 1 && !isMultiRegionMode) {
            setHatchRegionMode('multi');
        }

        if (hatchRegions[currentHatchRegionIndex].length === 0) {
            hatchRegions.splice(currentHatchRegionIndex, 1, ...newRegions);
        } else {
            hatchRegions.push(...newRegions);
            currentHatchRegionIndex = hatchRegions.length - newRegions.length;
        }

        hatchPoints = hatchRegions[currentHatchRegionIndex];
        isDrawingHatch = true;
        if (typeof updateHatchPreview === 'function') updateHatchPreview();
    });
}

function pointToSegmentDistSqrDP(p, v, w) {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
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

    const gridCheckbox = document.getElementById('hatchGridCheckbox');
    const gridAngleCont = document.getElementById('hatchGridAngleContainer');
    const gridAngleInput = document.getElementById('hatchGridAngleInput');

    const eyedropperBtn = document.getElementById('hatchEyedropperBtn');

    if (eyedropperBtn) {
        let isEyedropperActive = false;
        
        eyedropperBtn.onclick = () => {
            if (isEyedropperActive) return;
            
            isEyedropperActive = true;
            const canvas = document.getElementById('mainCanvas');
            const ctx = canvas.getContext('2d');

            const magSize = 150;
            const zoom = 8;
            const srcSize = Math.floor(magSize / zoom);

            const magDiv = document.createElement('div');
            magDiv.style.position = 'fixed';
            magDiv.style.width = magSize + 'px';
            magDiv.style.height = magSize + 'px';
            magDiv.style.borderRadius = '50%';
            magDiv.style.border = '2px solid #444';
            magDiv.style.boxShadow = '0 0 15px rgba(0,0,0,0.6), inset 0 0 10px rgba(0,0,0,0.5)';
            magDiv.style.pointerEvents = 'none';
            magDiv.style.zIndex = '99999';
            magDiv.style.overflow = 'hidden';
            magDiv.style.display = 'none';
            magDiv.style.cursor = 'none';

            const magCanvas = document.createElement('canvas');
            magCanvas.width = magSize;
            magCanvas.height = magSize;
            magDiv.appendChild(magCanvas);

            const centerRing = document.createElement('div');
            centerRing.style.position = 'absolute';
            centerRing.style.top = '50%';
            centerRing.style.left = '50%';
            centerRing.style.width = zoom + 'px';
            centerRing.style.height = zoom + 'px';
            centerRing.style.border = '1px solid #000';
            centerRing.style.outline = '1px solid #fff';
            centerRing.style.transform = 'translate(-50%, -50%)';
            magDiv.appendChild(centerRing);

            document.body.appendChild(magDiv);

            const mCtx = magCanvas.getContext('2d');
            mCtx.imageSmoothingEnabled = false;

            const originalCursor = canvas.style.cursor;
            canvas.style.cursor = 'none';

            let isActive = true;

            function cleanup() {
                isActive = false;
                isEyedropperActive = false;
                canvas.style.cursor = originalCursor;
                if (document.body.contains(magDiv)) {
                    document.body.removeChild(magDiv);
                }
                window.removeEventListener('pointermove', onMove, { capture: true });
                window.removeEventListener('pointerdown', onClick, { capture: true });
                window.removeEventListener('keydown', onKey);
            }

            function onMove(e) {
                if (!isActive) return;
                
                if (e.target !== canvas) {
                    magDiv.style.display = 'none';
                    return;
                }
                magDiv.style.display = 'block';
                
                magDiv.style.left = (e.clientX - magSize / 2) + 'px';
                magDiv.style.top = (e.clientY - magSize / 2) + 'px';

                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;

                const cx = (e.clientX - rect.left) * scaleX;
                const cy = (e.clientY - rect.top) * scaleY;

                mCtx.clearRect(0, 0, magSize, magSize);
                mCtx.drawImage(
                    canvas,
                    cx - srcSize / 2, cy - srcSize / 2, srcSize, srcSize,
                    0, 0, magSize, magSize
                );
            }

            function onClick(e) {
                if (!isActive || e.target !== canvas) return;
                
                if (e.button === 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const cx = (e.clientX - rect.left) * scaleX;
                    const cy = (e.clientY - rect.top) * scaleY;

                    try {
                        const pixelData = ctx.getImageData(cx, cy, 1, 1).data;
                        const r = pixelData[0], g = pixelData[1], b = pixelData[2];

                        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                        const minDensity = 0.001; 
                        const maxDensity = 0.008; 
                        
                        let newDensity = minDensity + luminance * (maxDensity - minDensity);
                        newDensity = Math.round(newDensity * 2000) / 2000;

                        hatchDensity = newDensity;
                        if (densityInput) densityInput.value = hatchDensity;

                        const midLine = document.getElementById('middleLineForHatch');
                        const value = Number((hatchDensity * 2.5).toFixed(6));
                        if (midLine) midLine.innerHTML = `50% = ${value} ↑`;

                        if (typeof updateHatchPreview === 'function') updateHatchPreview();
                    } catch (err) {
                        showNotification(lang === ru ? "Ошибка пипетки" : "Error with eyedropper", true);
                    }
                }
                cleanup();
            }

            function onKey(e) {
                if (e.key === 'Escape') {
                    cleanup();
                }
            }

            window.addEventListener('pointermove', onMove, { capture: true });
            window.addEventListener('pointerdown', onClick, { capture: true });
            window.addEventListener('keydown', onKey);
        };
    }

    if (gridCheckbox) {
        gridCheckbox.onchange = (e) => {
            hatchGridEnabled = e.target.checked;
            if (gridAngleCont) gridAngleCont.style.display = hatchGridEnabled ? 'flex' : 'none';
            updateHatchPreview();
        };
    }

    if (gridAngleInput) {
        gridAngleInput.oninput = (e) => {
            let newGridAngle = parseFloat(gridAngleInput.value);
            if (isNaN(newGridAngle)) newGridAngle = 90;
            hatchGridAngle = newGridAngle;
            updateHatchPreview();
        };
    }

    const value = Number((hatchDensity * 2.5).toFixed(6));
    const midLine = document.getElementById('middleLineForHatch');
    if (midLine) midLine.innerHTML = `50% = ${value} ↑`;

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
            if (midLine) midLine.innerHTML = `50% = ${value} ↑`;
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
            if (newThickness < 0.0001) newThickness = 0.0001;
            if (newThickness > 0.5) newThickness = 0.5;
            hatchThickness = newThickness;
            updateHatchPreview();
        };
    }

    if (createBtn) createBtn.onclick = () => finalizeHatch();
    if (cancelBtn) cancelBtn.onclick = () => cancelHatch();
    if (restoreBtn) restoreBtn.onclick = () => restoreLastHatch();
});