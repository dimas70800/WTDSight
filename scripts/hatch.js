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

let hatchBrushEnabled = false;
let isDrawingHatchBrush = false;
let hatchBrushPoints = [];
let previewHatchBrushLines = [];

function getHatchBrushThickness() {
    const input = document.getElementById('hatchBrushThicknessInput');
    const val = input ? parseFloat(input.value) : 10;
    return (isNaN(val) || val <= 0 ? 10 : val) * 0.001;
}

function setHatchBrushMode(enabled) {
    hatchBrushEnabled = enabled;
    const checkbox = document.getElementById('hatchBrushCheckbox');
    if (checkbox) checkbox.checked = enabled;

    const thickCont = document.getElementById('hatchBrushThicknessContainer');
    if (thickCont) thickCont.style.display = enabled ? 'flex' : 'none';

    const contourControls = document.getElementById('hatchContourControls');
    const restoreBtn = document.getElementById('hatchRestoreBtn');
    const areaSelect = document.getElementById('hatchAreaSelectContainer');
    const areaMode = document.getElementById('hatchAreaModeContainer');

    if (contourControls) contourControls.style.display = enabled ? 'none' : 'block';
    if (restoreBtn) restoreBtn.style.display = enabled ? 'none' : 'block';
    if (areaSelect) areaSelect.style.display = enabled ? 'none' : 'block';
    if (areaMode) areaMode.style.display = enabled ? 'none' : 'block';

    if (enabled) {
        cancelHatch();
        if (typeof updateHatchBrushPreview === 'function') {
            updateHatchBrushPreview();
        }
    } else {
        isDrawingHatchBrush = false;
        hatchBrushPoints = [];
        previewHatchBrushLines = [];
        if (typeof updateHatchPreview === 'function') {
            updateHatchPreview();
        }
    }
}

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

    if (hatchBrushEnabled) {
        updateHatchBrushPreview();
        return;
    }

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

function getCirclePolygon(center, radius, numPoints = 32) {
    const poly = [];
    for (let i = 0; i < numPoints; i++) {
        const a = (i / numPoints) * 2 * Math.PI;
        poly.push({
            x: center.x + radius * Math.cos(a),
            y: center.y + radius * Math.sin(a)
        });
    }
    return poly;
}

function getHatchBrushStrokeRegions(pts, radius) {
    if (!pts || pts.length === 0) return [];
    if (pts.length === 1) {
        return [getCirclePolygon(pts[0], radius, 32)];
    }

    const SCALE = 1000000;
    const intRadius = Math.round(radius * SCALE);

    let cleanPts = pts;
    if (cleanPts.length > 2 && typeof simplifyRDP === 'function') {
        cleanPts = simplifyRDP(cleanPts, Math.max(1e-5, radius * 0.05));
        if (cleanPts.length < 2) cleanPts = pts;
    }

    const clipperStroke = cleanPts.map(p => ({
        X: Math.round(p.x * SCALE),
        Y: Math.round(p.y * SCALE)
    }));

    if (typeof ClipperLib === 'undefined' || !ClipperLib.ClipperOffset) {
        return [getCirclePolygon(pts[pts.length - 1], radius, 32)];
    }

    const co = new ClipperLib.ClipperOffset();
    co.ArcTolerance = Math.max(1, Math.round(intRadius * 0.02));
    co.AddPath(clipperStroke, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);

    const rawPolys = new ClipperLib.Paths();
    co.Execute(rawPolys, intRadius);

    if (!rawPolys || rawPolys.length === 0) {
        return [getCirclePolygon(pts[pts.length - 1], radius, 32)];
    }

    const clprUnion = new ClipperLib.Clipper();
    clprUnion.AddPaths(rawPolys, ClipperLib.PolyType.ptSubject, true);
    const unionPolys = new ClipperLib.Paths();
    clprUnion.Execute(ClipperLib.ClipType.ctUnion, unionPolys, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

    const targetPolys = (unionPolys && unionPolys.length > 0) ? unionPolys : rawPolys;
    const regions = [];
    for (let poly of targetPolys) {
        if (poly.length >= 3) {
            regions.push(poly.map(pt => ({
                x: pt.X / SCALE,
                y: pt.Y / SCALE
            })));
        }
    }
    return regions;
}

function updateHatchBrushPreview() {
    if (!hatchBrushEnabled || (typeof tool !== 'undefined' && tool !== 'hatch')) {
        previewHatchBrushLines = [];
        return;
    }

    if (typeof canvasHover !== 'undefined' && !canvasHover && !isDrawingHatchBrush) {
        previewHatchBrushLines = [];
        return;
    }

    const radius = getHatchBrushThickness() / 2;
    let regions = [];

    if (isDrawingHatchBrush && hatchBrushPoints.length > 0) {
        let pts = [...hatchBrushPoints];
        if (typeof mousePos !== 'undefined' && mousePos && (pts.length === 0 || v2sqrmag(mousePos, pts[pts.length - 1]) > 1e-10)) {
            pts.push(mousePos);
        }
        regions = getHatchBrushStrokeRegions(pts, radius);
    } else if (typeof mousePos !== 'undefined' && mousePos) {
        regions = [getCirclePolygon(mousePos, radius, 32)];
    }

    if (!regions || regions.length === 0) {
        previewHatchBrushLines = [];
        return;
    }

    previewHatchBrushLines = generateHatchData(regions, hatchAngle, hatchDensity, hatchPhase, hatchMode, hatchThickness);
    if (hatchGridEnabled) {
        const gridLines = generateHatchData(regions, hatchAngle + hatchGridAngle, hatchDensity, hatchPhase, hatchMode, hatchThickness);
        previewHatchBrushLines = previewHatchBrushLines.concat(gridLines);
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

function tryMergeTwoSegments(A, B, C, D) {
    const dx1 = B.x - A.x;
    const dy1 = B.y - A.y;
    const len1 = Math.hypot(dx1, dy1);
    if (len1 < 1e-7) return null;

    const dx2 = D.x - C.x;
    const dy2 = D.y - C.y;
    const len2 = Math.hypot(dx2, dy2);
    if (len2 < 1e-7) return null;

    let R1, R2, P1, P2, Lref, Lother;
    if (len1 >= len2) {
        R1 = A; R2 = B; Lref = len1;
        P1 = C; P2 = D; Lother = len2;
    } else {
        R1 = C; R2 = D; Lref = len2;
        P1 = A; P2 = B; Lother = len1;
    }

    const ux = (R2.x - R1.x) / Lref;
    const uy = (R2.y - R1.y) / Lref;
    const nx = -uy;
    const ny = ux;

    const distTol = Math.min(0.0004, (typeof hatchDensity !== 'undefined' && hatchDensity > 0 ? hatchDensity * 0.1 : 0.0004));

    const dist1 = Math.abs((P1.x - R1.x) * nx + (P1.y - R1.y) * ny);
    const dist2 = Math.abs((P2.x - R1.x) * nx + (P2.y - R1.y) * ny);
    if (dist1 > distTol || dist2 > distTol) return null;

    const vx = (P2.x - P1.x) / Lother;
    const vy = (P2.y - P1.y) / Lother;
    const dot = Math.abs(ux * vx + uy * vy);
    if (Lother > distTol && dot < 0.95) return null;

    const tR1 = R1.x * ux + R1.y * uy;
    const tR2 = R2.x * ux + R2.y * uy;
    const tRMin = Math.min(tR1, tR2);
    const tRMax = Math.max(tR1, tR2);

    const tP1 = P1.x * ux + P1.y * uy;
    const tP2 = P2.x * ux + P2.y * uy;
    const tPMin = Math.min(tP1, tP2);
    const tPMax = Math.max(tP1, tP2);

    const gapTol = 0.0005;
    if (tPMin > tRMax + gapTol || tRMin > tPMax + gapTol) {
        return null;
    }

    const tMergedMin = Math.min(tRMin, tPMin);
    const tMergedMax = Math.max(tRMax, tPMax);
    const cDist = R1.x * nx + R1.y * ny;

    const start = {
        x: nx * cDist + ux * tMergedMin,
        y: ny * cDist + uy * tMergedMin
    };
    const end = {
        x: nx * cDist + ux * tMergedMax,
        y: ny * cDist + uy * tMergedMax
    };

    return { start, end };
}

function mergeAndApplyHatchLines(finalItems) {
    if (typeof isLayerLocked === 'function' && isLayerLocked(getActiveLayerId())) {
        if (typeof notifyLayerLocked === 'function') notifyLayerLocked();
        return;
    }
    const newObjects = [];
    const deletedObjects = [];

    const inputLines = [];
    const inputQuads = [];

    for (const item of finalItems) {
        if (item.type === 'quad') {
            inputQuads.push(item);
        } else {
            inputLines.push({
                start: { x: item.start.x, y: item.start.y },
                end: { x: item.end.x, y: item.end.y }
            });
        }
    }

    if (inputLines.length > 0) {
        const existingLineEntries = [];
        for (const [id, obj] of objects) {
            if (obj && obj.type === 'line') {
                existingLineEntries.push({
                    id: id,
                    start: { x: obj.start.x, y: obj.start.y },
                    end: { x: obj.end.x, y: obj.end.y },
                    object: obj
                });
            }
        }

        const mergedLinesToAdd = [];

        for (const seg of inputLines) {
            let curSeg = { start: { ...seg.start }, end: { ...seg.end }, mergedIds: [] };
            let mergedWithExisting = true;

            while (mergedWithExisting) {
                mergedWithExisting = false;
                for (let i = 0; i < existingLineEntries.length; i++) {
                    const existing = existingLineEntries[i];
                    const merged = tryMergeTwoSegments(curSeg.start, curSeg.end, existing.start, existing.end);
                    if (merged) {
                        curSeg.start = merged.start;
                        curSeg.end = merged.end;
                        curSeg.mergedIds.push(existing.id);
                        deletedObjects.push({ id: existing.id, object: existing.object });
                        objects.delete(existing.id);
                        existingLineEntries.splice(i, 1);
                        mergedWithExisting = true;
                        break;
                    }
                }
            }

            let mergedWithPrev = true;
            while (mergedWithPrev) {
                mergedWithPrev = false;
                for (let j = 0; j < mergedLinesToAdd.length; j++) {
                    const prev = mergedLinesToAdd[j];
                    const merged = tryMergeTwoSegments(curSeg.start, curSeg.end, prev.start, prev.end);
                    if (merged) {
                        curSeg.start = merged.start;
                        curSeg.end = merged.end;
                        if (prev.mergedIds && prev.mergedIds.length > 0) {
                            curSeg.mergedIds.push(...prev.mergedIds);
                        }
                        mergedLinesToAdd.splice(j, 1);
                        mergedWithPrev = true;
                        break;
                    }
                }
            }

            mergedLinesToAdd.push(curSeg);
        }

        for (const line of mergedLinesToAdd) {
            const len = Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
            if (len < 1e-6) continue;

            const objIdStr = nextId().toString();
            const mergedIds = line.mergedIds || [];

            let retainedName = null;

            if (typeof selectedId !== 'undefined' && selectedId !== null && mergedIds.includes(selectedId)) {
                const selObj = deletedObjects.find(d => d.id === selectedId);
                if (selObj && selObj.object && selObj.object.name) {
                    retainedName = selObj.object.name;
                }
            }

            const curLayer = (typeof getActiveLayerId === 'function') ? getActiveLayerId() : 1;
            const object = {
                name: retainedName || ((typeof lang !== 'undefined' && lang.line ? lang.line : "Line") + " " + objIdStr),
                type: "line",
                start: {
                    x: rnd(line.start.x),
                    y: rnd(line.start.y)
                },
                end: {
                    x: rnd(line.end.x),
                    y: rnd(line.end.y)
                },
                selected: false,
                layer: curLayer
            };
            objects.set(objIdStr, object);
            newObjects.push({ id: objIdStr, object: object });
        }
    }

    if (inputQuads.length > 0) {
        const curLayer = (typeof getActiveLayerId === 'function') ? getActiveLayerId() : 1;
        for (const item of inputQuads) {
            const objIdStr = nextId().toString();
            const object = {
                name: (typeof lang !== 'undefined' && lang.quad ? lang.quad : "Quad") + " " + objIdStr,
                type: "quad",
                pos1: { x: rnd(item.pos1.x), y: rnd(item.pos1.y) },
                pos2: { x: rnd(item.pos2.x), y: rnd(item.pos2.y) },
                pos3: { x: rnd(item.pos3.x), y: rnd(item.pos3.y) },
                pos4: { x: rnd(item.pos4.x), y: rnd(item.pos4.y) },
                selected: false,
                layer: curLayer
            };
            objects.set(objIdStr, object);
            newObjects.push({ id: objIdStr, object: object });
        }
    }

    if (deletedObjects.length > 0 && newObjects.length > 0 && typeof isGeometryIdentical === 'function' && isGeometryIdentical(newObjects, deletedObjects)) {
        for (const item of newObjects) {
            objects.delete(item.id);
        }
        for (const item of deletedObjects) {
            objects.set(item.id, item.object);
        }
        refreshObjectsList(true);
        return;
    }

    const deletedIds = new Set(deletedObjects.map(d => d.id));
    const wasSelectedDeleted = (typeof selectedId !== 'undefined' && selectedId !== null && deletedIds.has(selectedId)) ||
                               (typeof selectedObjectsSet !== 'undefined' && [...selectedObjectsSet].some(id => deletedIds.has(id)));
    if (wasSelectedDeleted) {
        if (typeof unselectAnyObjects === 'function') unselectAnyObjects();
        if (typeof showInfo === 'function') showInfo(null);
    }

    if (deletedObjects.length > 0 && newObjects.length > 0) {
        pushEvent("replace_multiple", { added: newObjects, deleted: deletedObjects });
    } else if (newObjects.length > 0) {
        pushEvent("add_multiple", newObjects);
    } else if (deletedObjects.length > 0) {
        pushEvent("delete_multiple", deletedObjects);
    }

    refreshObjectsList(true);
}

function finishHatchBrush() {
    if (!hatchBrushPoints || hatchBrushPoints.length === 0) {
        isDrawingHatchBrush = false;
        previewHatchBrushLines = [];
        return;
    }

    const radius = getHatchBrushThickness() / 2;
    const strokeRegions = getHatchBrushStrokeRegions(hatchBrushPoints, radius);
    isDrawingHatchBrush = false;
    hatchBrushPoints = [];

    if (!strokeRegions || strokeRegions.length === 0) {
        updateHatchBrushPreview();
        return;
    }

    let finalItems = generateHatchData(strokeRegions, hatchAngle, hatchDensity, hatchPhase, hatchMode, hatchThickness);
    if (hatchGridEnabled) {
        const gridItems = generateHatchData(strokeRegions, hatchAngle + hatchGridAngle, hatchDensity, hatchPhase, hatchMode, hatchThickness);
        finalItems = finalItems.concat(gridItems);
    }

    if (finalItems.length === 0) {
        updateHatchBrushPreview();
        return;
    }

    mergeAndApplyHatchLines(finalItems);
    updateHatchBrushPreview();
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

    mergeAndApplyHatchLines(finalItems);

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
    isDrawingHatchBrush = false;
    hatchBrushPoints = [];
    if (hatchBrushEnabled && typeof updateHatchBrushPreview === 'function') {
        updateHatchBrushPreview();
    }
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

function autoHatchFromReference() {
    if (typeof isLayerLocked === 'function' && isLayerLocked(getActiveLayerId())) {
        if (typeof notifyLayerLocked === 'function') notifyLayerLocked();
        return;
    }

    const ref = (typeof referenceArray !== 'undefined' && typeof currentReference !== 'undefined') ? referenceArray[currentReference] : null;
    if (!ref || !ref.obj) {
        const msg = (typeof lang !== 'undefined' && lang === ru) ? "Сначала загрузите изображение в референс!" : "Please load a reference image first!";
        if (typeof showNotification === 'function') showNotification(msg, true);
        else alert(msg);
        return;
    }

    const img = ref.obj;
    if (!img.width || !img.height) {
        const msg = (typeof lang !== 'undefined' && lang === ru) ? "Изображение референса еще не загружено!" : "Reference image is not loaded yet!";
        if (typeof showNotification === 'function') showNotification(msg, true);
        return;
    }

    const maxDim = 500;
    let drawW = img.width;
    let drawH = img.height;
    if (drawW > maxDim || drawH > maxDim) {
        if (drawW > drawH) {
            drawH = Math.max(1, Math.round((drawH * maxDim) / drawW));
            drawW = maxDim;
        } else {
            drawW = Math.max(1, Math.round((drawW * maxDim) / drawH));
            drawH = maxDim;
        }
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = drawW;
    tempCanvas.height = drawH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0, drawW, drawH);

    let imgData;
    try {
        imgData = tempCtx.getImageData(0, 0, drawW, drawH);
    } catch (err) {
        const errMsg = (typeof lang !== 'undefined' && lang === ru)
            ? "Не удалось получить пиксели изображения из-за защиты браузера (CORS). Загрузите картинку локальным файлом!"
            : "Cannot access image pixels due to CORS. Please load image as a local file!";
        if (typeof showNotification === 'function') showNotification(errMsg, true);
        else alert(errMsg);
        return;
    }

    const refAspectRatio = img.width / img.height;
    const refHeight = (typeof ref.size === 'number' && ref.size > 0) ? ref.size : 1.0;
    const refWidth = refHeight * refAspectRatio;
    const cx = ref.x || 0;
    const cy = ref.y || 0;
    const rotRad = (ref.rotation || 0) * Math.PI / 180;
    const cosRot = Math.cos(rotRad);
    const sinRot = Math.sin(rotRad);

    const imgW = imgData.width;
    const imgH = imgData.height;
    const data = imgData.data;

    const halfW = refWidth / 2;
    const halfH = refHeight / 2;
    const corners = [
        { u: -halfW, v: -halfH },
        { u:  halfW, v: -halfH },
        { u:  halfW, v:  halfH },
        { u: -halfW, v:  halfH }
    ];

    const scale = Math.max(0.001, refHeight);

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h *= 60;
        }
        return { h, s, l };
    }

    function extractDominantClusters(data, w, h, k = 8) {
        const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 4000)));
        const sampleR = [], sampleG = [], sampleB = [];
        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                const idx = (y * w + x) * 4;
                if (data[idx + 3] < 50) continue;
                sampleR.push(data[idx]);
                sampleG.push(data[idx + 1]);
                sampleB.push(data[idx + 2]);
            }
        }
        const n = sampleR.length;
        if (n < k) return null;

        let seed = 42;
        const detRandom = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 4294967296;
        };

        const centers = [{ r: sampleR[0], g: sampleG[0], b: sampleB[0] }];
        const dists = new Float32Array(n);
        for (let c = 1; c < k; c++) {
            let sumDist = 0;
            for (let i = 0; i < n; i++) {
                let minDist = Infinity;
                for (let j = 0; j < c; j++) {
                    const dr = sampleR[i] - centers[j].r;
                    const dg = sampleG[i] - centers[j].g;
                    const db = sampleB[i] - centers[j].b;
                    const d = dr * dr + dg * dg + db * db;
                    if (d < minDist) minDist = d;
                }
                dists[i] = minDist;
                sumDist += minDist;
            }
            let randVal = detRandom() * sumDist;
            let chosenIdx = n - 1;
            for (let i = 0; i < n; i++) {
                randVal -= dists[i];
                if (randVal <= 0) { chosenIdx = i; break; }
            }
            centers.push({ r: sampleR[chosenIdx], g: sampleG[chosenIdx], b: sampleB[chosenIdx] });
        }

        const clusterSumR = new Float64Array(k);
        const clusterSumG = new Float64Array(k);
        const clusterSumB = new Float64Array(k);
        const clusterCount = new Int32Array(k);

        for (let iter = 0; iter < 8; iter++) {
            clusterSumR.fill(0); clusterSumG.fill(0); clusterSumB.fill(0); clusterCount.fill(0);
            for (let i = 0; i < n; i++) {
                const sr = sampleR[i], sg = sampleG[i], sb = sampleB[i];
                let bestC = 0, bestDist = Infinity;
                for (let c = 0; c < k; c++) {
                    const dr = sr - centers[c].r, dg = sg - centers[c].g, db = sb - centers[c].b;
                    const d = dr * dr + dg * dg + db * db;
                    if (d < bestDist) { bestDist = d; bestC = c; }
                }
                clusterSumR[bestC] += sr; clusterSumG[bestC] += sg; clusterSumB[bestC] += sb;
                clusterCount[bestC]++;
            }
            for (let c = 0; c < k; c++) {
                if (clusterCount[c] > 0) {
                    centers[c].r = clusterSumR[c] / clusterCount[c];
                    centers[c].g = clusterSumG[c] / clusterCount[c];
                    centers[c].b = clusterSumB[c] / clusterCount[c];
                }
            }
        }

        return centers.map(c => {
            const r = Math.round(c.r), g = Math.round(c.g), b = Math.round(c.b);
            const { h, s, l } = rgbToHsl(r, g, b);
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

            let act = 1;
            if (lum < 0.07 || (r < 22 && g < 22 && b < 22) || (r <= 30 && g <= 18 && b <= 18 && lum < 0.088)) act = 0;
            else if (lum > 0.95 || (l >= 0.84 && s < 0.10) || (l >= 0.88 && (s < 0.20 || (r - g < 35 && r - b < 35)))) act = 0;
            else if ((h >= 8 && h <= 38 && l >= 0.74 && s >= 0.24 && (g - b >= 5) && (h >= 13 || r - g < 40)) ||
                     (h >= 5 && h <= 40 && l >= 0.85 && s >= 0.24 && (s <= 0.55 || r - g <= 45))) act = 0;
            else if (l <= 0.145 || lum <= 0.14 || ((l <= 0.215 || lum <= 0.205) && (b >= r - 3 || (s <= 0.15 && r - b <= 5))) ||
                     ((h >= 345 || h <= 25) && s >= 0.20 && l <= 0.29 && lum <= 0.28 && (r - g >= 27 || (lum >= 0.22 && r - g >= 18 && r - b >= 25))) ||
                     ((lum <= 0.27 || l <= 0.28) && b >= r + 7 && b >= g + 4 && g > r)) act = 5;
            else if ((h >= 345 || h <= 25) && s >= 0.35 && (r > g * 1.3 && r > b * 1.3) && l <= 0.72) act = 4;
            else if (lum <= 0.40 || l <= 0.42) act = 6;
            else if (h >= 10 && h <= 45 && s >= 0.15 && s <= 0.70 && l >= 0.20 && l <= 0.65) act = 2;
            else if (((h >= 0 && h <= 40) || h >= 350) && l >= 0.40 && l < 0.74) act = 1;
            else act = 1;

            return { r, g, b, act };
        });
    }

    const clusters = extractDominantClusters(data, imgW, imgH, 8);

    function classifyPixel(r, g, b, a) {
        if (a < 40) return 0;
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (lum < 0.06 || (r <= 25 && g <= 25 && b <= 25) || (lum < 0.088 && Math.abs(r - g) <= 5 && Math.abs(r - b) <= 5) || (lum < 0.088 && (b <= 15 || (g <= 15 && b <= 17)))) return 0;
        const { h, s, l } = rgbToHsl(r, g, b);
        if (lum > 0.95 || (l >= 0.84 && s < 0.10) || (l >= 0.88 && (s < 0.20 || (r - g < 35 && r - b < 35)))) return 0;
        if (l <= 0.145 || lum <= 0.14 || ((l <= 0.215 || lum <= 0.205) && (b >= r - 3 || (s <= 0.15 && r - b <= 5))) ||
            ((h >= 345 || h <= 25) && s >= 0.20 && l <= 0.29 && lum <= 0.28 && (r - g >= 27 || (lum >= 0.22 && r - g >= 18 && r - b >= 25))) ||
            ((lum <= 0.27 || l <= 0.28) && b >= r + 7 && b >= g + 4 && g > r)) return 5;
        if ((h >= 8 && h <= 38 && l >= 0.74 && s >= 0.24 && (g - b >= 5) && (h >= 13 || r - g < 40)) ||
            (h >= 5 && h <= 40 && l >= 0.85 && s >= 0.24 && (s <= 0.55 || r - g <= 45))) return 0;
        if (s <= 0.22 && l >= 0.70 && l <= 0.83 && lum <= 0.83) return 1;
        if ((h >= 330 || h <= 12) && s >= 0.60 && l >= 0.70 && l <= 0.90 && (r - g >= 52 || r - b >= 55)) return 1;

        if (clusters && clusters.length > 0) {
            let bestDist = Infinity, bestAct = 0;
            for (let c = 0; c < clusters.length; c++) {
                const dr = r - clusters[c].r;
                const dg = g - clusters[c].g;
                const db = b - clusters[c].b;
                const d = dr * dr + dg * dg + db * db;
                if (d < bestDist) {
                    bestDist = d;
                    bestAct = clusters[c].act;
                }
            }
            return bestAct;
        }

        return 0;
    }

    const classGrid = new Uint8Array(imgW * imgH);
    for (let i = 0; i < imgW * imgH; i++) {
        const idx = i * 4;
        classGrid[i] = classifyPixel(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
    }

    function smoothGrid(src, w, h) {
        const dst = new Uint8Array(w * h);
        const counts = new Uint16Array(8);
        for (let y = 0; y < h; y++) {
            const rowOffset = y * w;
            for (let x = 0; x < w; x++) {
                counts.fill(0);
                for (let dy = -1; dy <= 1; dy++) {
                    const ny = y + dy;
                    if (ny < 0 || ny >= h) continue;
                    const nRow = ny * w;
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx;
                        if (nx < 0 || nx >= w) continue;
                        counts[src[nRow + nx]]++;
                    }
                }
                const current = src[rowOffset + x];
                let best = current;
                let max = counts[current];
                for (let c = 0; c < 8; c++) {
                    if (counts[c] > max) {
                        max = counts[c];
                        best = c;
                    }
                }
                dst[rowOffset + x] = best;
            }
        }
        return dst;
    }

    const cleanGrid = smoothGrid(smoothGrid(classGrid, imgW, imgH), imgW, imgH);

    const layers = [
        {
            name: 'light_60deg',
            angleDeg: 60,
            spacing: 0.006 * scale,
            test: (cls) => cls === 1
        },
        {
            name: 'dark_and_brown_45deg',
            angleDeg: 45,
            spacing: 0.0042 * scale,
            test: (cls) => cls === 2 || cls === 3 || cls === 5 || cls === 6
        },
        {
            name: 'red_135deg',
            angleDeg: 135,
            spacing: 0.0058 * scale,
            test: (cls) => cls === 4
        },
        {
            name: 'grid_135deg',
            angleDeg: 135,
            spacing: 0.0042 * scale,
            test: (cls) => cls === 5
        }
    ];

    let allLines = [];

    for (const layer of layers) {
        const angleRad = (layer.angleDeg - 90) * Math.PI / 180;
        const lineDirX = Math.cos(angleRad);
        const lineDirY = Math.sin(angleRad);
        const perpX = -Math.sin(angleRad);
        const perpY = Math.cos(angleRad);

        let minProj = Infinity, maxProj = -Infinity;
        let minAlong = Infinity, maxAlong = -Infinity;

        for (const c of corners) {
            const x = cx + c.u * cosRot - c.v * sinRot;
            const y = cy + c.u * sinRot + c.v * cosRot;
            const p = x * perpX + y * perpY;
            const a = x * lineDirX + y * lineDirY;
            if (p < minProj) minProj = p;
            if (p > maxProj) maxProj = p;
            if (a < minAlong) minAlong = a;
            if (a > maxAlong) maxAlong = a;
        }

        const spacing = layer.spacing;
        const stepT = Math.min(refHeight / imgH * 0.7, spacing * 0.35);
        const minSegLen = spacing * 0.65;

        const du_dt = (lineDirX * cosRot + lineDirY * sinRot) * stepT;
        const dv_dt = (-lineDirX * sinRot + lineDirY * cosRot) * stepT;

        for (let P = minProj + spacing * 0.5; P <= maxProj; P += spacing) {
            const startX = P * perpX + minAlong * lineDirX;
            const startY = P * perpY + minAlong * lineDirY;

            let curU = (startX - cx) * cosRot + (startY - cy) * sinRot;
            let curV = -(startX - cx) * sinRot + (startY - cy) * cosRot;

            let inSeg = false;
            let segStartT = minAlong;
            let gapSteps = 0;

            const steps = Math.ceil((maxAlong - minAlong) / stepT);
            let t = minAlong;

            for (let s = 0; s <= steps; s++) {
                let insideQualifying = false;

                if (curU >= -halfW && curU <= halfW && curV >= -halfH && curV <= halfH) {
                    const px = Math.floor((curU / refWidth + 0.5) * imgW);
                    const py = Math.floor((curV / refHeight + 0.5) * imgH);

                    if (px >= 0 && px < imgW && py >= 0 && py < imgH) {
                        const cls = cleanGrid[py * imgW + px];
                        if (cls && layer.test(cls)) {
                            insideQualifying = true;
                        }
                    }
                }

                if (insideQualifying) {
                    if (!inSeg) {
                        inSeg = true;
                        segStartT = t;
                    }
                    gapSteps = 0;
                } else {
                    if (inSeg) {
                        gapSteps++;
                        if (gapSteps > 2) {
                            const endT = t - gapSteps * stepT;
                            if (endT - segStartT >= minSegLen) {
                                allLines.push({
                                    start: {
                                        x: P * perpX + segStartT * lineDirX,
                                        y: P * perpY + segStartT * lineDirY
                                    },
                                    end: {
                                        x: P * perpX + endT * lineDirX,
                                        y: P * perpY + endT * lineDirY
                                    }
                                });
                            }
                            inSeg = false;
                            gapSteps = 0;
                        }
                    }
                }

                curU += du_dt;
                curV += dv_dt;
                t += stepT;
            }

            if (inSeg) {
                const endT = maxAlong - gapSteps * stepT;
                if (endT - segStartT >= minSegLen) {
                    allLines.push({
                        start: {
                            x: P * perpX + segStartT * lineDirX,
                            y: P * perpY + segStartT * lineDirY
                        },
                        end: {
                            x: P * perpX + endT * lineDirX,
                            y: P * perpY + endT * lineDirY
                        }
                    });
                }
            }
        }
    }

    const MAX_LINES = 3500;
    if (allLines.length > MAX_LINES) {
        allLines = allLines.slice(0, MAX_LINES);
    }

    if (allLines.length === 0) {
        const msg = (typeof lang !== 'undefined' && lang === ru)
            ? "Не найдено подходящих областей для штриховки на референсе"
            : "No suitable areas found for hatching on the reference";
        if (typeof showNotification === 'function') showNotification(msg, true);
        else alert(msg);
        return;
    }

    const addedItems = [];
    const curLayer = (typeof getActiveLayerId === 'function') ? getActiveLayerId() : 1;
    let currentId = (typeof nextId === 'function') ? nextId() : 0;

    for (const line of allLines) {
        while (objects.has(currentId.toString())) {
            currentId++;
        }
        const objIdStr = (currentId++).toString();
        const object = {
            name: (typeof lang !== 'undefined' && lang.line ? lang.line : "Line") + " " + objIdStr,
            type: "line",
            start: {
                x: rnd(line.start.x),
                y: rnd(line.start.y)
            },
            end: {
                x: rnd(line.end.x),
                y: rnd(line.end.y)
            },
            selected: false,
            layer: curLayer
        };
        objects.set(objIdStr, object);
        addedItems.push({ id: objIdStr, object: object });
    }

    if (typeof pushEvent === 'function') {
        pushEvent("add_multiple", addedItems);
    }
    if (typeof refreshObjectsList === 'function') {
        refreshObjectsList(true);
    }
    cancelHatch();
    if (typeof markAllTools === 'function') {
        markAllTools();
    }

    const successMsg = (typeof lang !== 'undefined' && lang === ru)
        ? `Автоштриховка выполнена: создано ${addedItems.length} линий`
        : `Auto-hatching complete: ${addedItems.length} lines created`;
    if (typeof showNotification === 'function') {
        showNotification(successMsg);
    } else {
        alert(successMsg);
    }
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
    const autoBtn = document.getElementById('hatchAutoBtn');
    if (autoBtn) autoBtn.onclick = () => autoHatchFromReference();

    const brushCheckbox = document.getElementById('hatchBrushCheckbox');
    const brushThickInput = document.getElementById('hatchBrushThicknessInput');
    const brushThickNumber = document.getElementById('hatchBrushThicknessNumber');

    if (brushCheckbox) {
        brushCheckbox.onchange = (e) => {
            setHatchBrushMode(e.target.checked);
        };
    }
    if (brushThickInput) {
        brushThickInput.oninput = (e) => {
            if (brushThickNumber) brushThickNumber.value = e.target.value;
            if (hatchBrushEnabled && typeof updateHatchBrushPreview === 'function') {
                updateHatchBrushPreview();
            }
        };
    }
    if (brushThickNumber) {
        brushThickNumber.oninput = (e) => {
            if (brushThickInput) brushThickInput.value = e.target.value;
            if (hatchBrushEnabled && typeof updateHatchBrushPreview === 'function') {
                updateHatchBrushPreview();
            }
        };
    }
});