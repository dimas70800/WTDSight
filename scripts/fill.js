let fillRegions = [[]];
let currentFillRegionIndex = 0;
let isFillMultiRegionMode = false;
let fillPoints = fillRegions[0];

let lastFillPoints = [];

let isDrawingFill = false;
let isFillDragging = false;
let previewFillQuads = [];

let fillVertexDragIndex = -1;
let fillVertexDragMoved = false;
let fillVertexDragIsNew = false;

let lastFillAction = null;
let lastAddedFillPointTime = 0;
let lastFillRemovedIndex = -1;
let lastFillRemovedPoint = null;

function setFillRegionMode(mode) {
    isFillMultiRegionMode = (mode === 'multi');
    const btnSingle = document.getElementById('fillRegionSingleBtn');
    const btnMulti = document.getElementById('fillRegionMultiBtn');
    const controls = document.getElementById('fillMultiControls');

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
        if (fillRegions[currentFillRegionIndex]) {
            fillRegions = [fillRegions[currentFillRegionIndex]];
        } else {
            fillRegions = [[]];
        }
        currentFillRegionIndex = 0;
        fillPoints = fillRegions[0];
        updateFillRegionUI();
        updateFillPreview();
    }
}

setFillRegionMode('single');

function changeFillRegion(dir) {
    if (fillRegions.length === 0) return;
    let newIdx = (currentFillRegionIndex + dir + fillRegions.length) % fillRegions.length;
    currentFillRegionIndex = newIdx;
    fillPoints = fillRegions[currentFillRegionIndex];
    updateFillRegionUI();
    updateFillPreview();
}

function setFillRegionFromInput() {
    const input = document.getElementById('fillRegionInput');
    if (!input) return;
    let val = parseInt(input.value) - 1;
    if (isNaN(val) || val < 0) val = 0;
    if (val >= fillRegions.length) val = fillRegions.length - 1;
    currentFillRegionIndex = val;
    fillPoints = fillRegions[currentFillRegionIndex];
    updateFillRegionUI();
    updateFillPreview();
}

function addFillRegion() {
    fillRegions.push([]);
    currentFillRegionIndex = fillRegions.length - 1;
    fillPoints = fillRegions[currentFillRegionIndex];
    updateFillRegionUI();
    updateFillPreview();
}

function deleteFillRegion() {
    fillRegions.splice(currentFillRegionIndex, 1);
    if (fillRegions.length === 0) {
        fillRegions.push([]);
        isDrawingFill = false;
    }
    if (currentFillRegionIndex >= fillRegions.length) {
        currentFillRegionIndex = fillRegions.length - 1;
    }
    fillPoints = fillRegions[currentFillRegionIndex];
    updateFillRegionUI();
    updateFillPreview();
}

function updateFillRegionUI() {
    const input = document.getElementById('fillRegionInput');
    if (input) input.value = currentFillRegionIndex + 1;

    const countEl = document.getElementById('fillPointsNum');
    if (countEl) countEl.innerText = fillPoints.length;
}

function startFillDrawing(pos) {
    fillRegions = [[{
        x: Math.round(pos.x * 1000000) / 1000000,
        y: Math.round(pos.y * 1000000) / 1000000
    }]];
    currentFillRegionIndex = 0;
    fillPoints = fillRegions[0];

    lastFillAction = 'start';
    lastAddedFillPointTime = Date.now();

    isDrawingFill = true;
    previewFillQuads = [];
    updateFillRegionUI();
    updateFillPreview();
}

function addFillPoint(pos, isDragging = false) {
    if (!isDrawingFill) return;

    const roundedPos = {
        x: Math.round(pos.x * 1000000) / 1000000,
        y: Math.round(pos.y * 1000000) / 1000000
    };

    if (fillPoints.length > 0) {
        const last = fillPoints[fillPoints.length - 1];
        if (Math.abs(roundedPos.x - last.x) < 0.000001 && Math.abs(roundedPos.y - last.y) < 0.000001) return;
    }
    if (fillPoints.length > 1) {
        const prevLast = fillPoints[fillPoints.length - 2];
        if (Math.abs(roundedPos.x - prevLast.x) < 0.000001 && Math.abs(roundedPos.y - prevLast.y) < 0.000001) return;
    }

    let existingIndex = -1;
    let isTouch = ('ontouchstart' in window);
    let radius = (isTouch ? 20 : 10) / screenZoom / getBaseScale();

    for (let i = 0; i < fillPoints.length; i++) {
        if (Math.abs(roundedPos.x - fillPoints[i].x) < radius && Math.abs(roundedPos.y - fillPoints[i].y) < radius) {
            existingIndex = i;
            break;
        }
    }

    if (snapping || mobileSnappingActive) {
        const finalPos = (existingIndex !== -1) ? fillPoints[existingIndex] : roundedPos;

        lastFillAction = 'add';
        lastAddedFillPointTime = Date.now();

        fillPoints.push({ x: finalPos.x, y: finalPos.y });
        updateFillPreview();
        return;
    }

    if (existingIndex !== -1) {
        if (!isDragging) {
            lastFillAction = 'remove';
            lastFillRemovedIndex = existingIndex;
            lastFillRemovedPoint = fillPoints[existingIndex];
            lastAddedFillPointTime = Date.now();

            fillPoints.splice(existingIndex, 1);
            if (fillPoints.length === 0 && fillRegions.length === 1) cancelFill();
            else updateFillPreview();
        }
        return;
    }

    lastFillAction = 'add';
    lastAddedFillPointTime = Date.now();
    fillPoints.push(roundedPos);
    updateFillPreview();
}

function hitTestFillVertex(pos) {
    if (!isDrawingFill || !fillPoints || fillPoints.length === 0) return -1;

    const isTouch = ('ontouchstart' in window);
    const radius = (isTouch ? 20 : 10) / screenZoom / getBaseScale();

    for (let i = 0; i < fillPoints.length; i++) {
        if (Math.abs(pos.x - fillPoints[i].x) < radius && Math.abs(pos.y - fillPoints[i].y) < radius) {
            return i;
        }
    }
    return -1;
}

function hitTestFillEdge(pos) {
    if (!isDrawingFill || !fillPoints || fillPoints.length < 2) return null;

    const isTouch = ('ontouchstart' in window);
    const radiusSight = (isTouch ? 20 : 10) / screenZoom / getBaseScale();
    const maxSqrDist = radiusSight * radiusSight;

    let bestAfterIndex = -1;
    let bestPos = null;
    let bestSqrDist = maxSqrDist;

    const n = fillPoints.length;
    const edgeCount = (n >= 3) ? n : (n - 1);

    for (let i = 0; i < edgeCount; i++) {
        const a = fillPoints[i];
        const b = fillPoints[(i + 1) % n];

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

function insertFillPointAfter(afterIndex, pos) {
    const roundedPos = {
        x: Math.round(pos.x * 1000000) / 1000000,
        y: Math.round(pos.y * 1000000) / 1000000
    };

    const insertIndex = afterIndex + 1;
    fillPoints.splice(insertIndex, 0, roundedPos);

    lastFillAction = 'add';
    lastAddedFillPointTime = Date.now();

    updateFillPreview();
    return insertIndex;
}

function startFillVertexDrag(index, isNew = false) {
    if (!isDrawingFill || index < 0 || index >= fillPoints.length) return;
    fillVertexDragIndex = index;
    fillVertexDragMoved = false;
    fillVertexDragIsNew = isNew;
}

function dragFillVertex(pos) {
    if (fillVertexDragIndex < 0 || fillVertexDragIndex >= fillPoints.length) return;

    fillVertexDragMoved = true;

    let finalPos = pos;

    if (snapping || mobileSnappingActive) {
        let snapRad = (mobileSnappingActive && !snapping) ? 40 : Infinity;
        const snapPos = snappingPos(pos, snapRad);
        if (snapPos != null) finalPos = snapPos;
    }

    fillPoints[fillVertexDragIndex] = {
        x: Math.round(finalPos.x * 1000000) / 1000000,
        y: Math.round(finalPos.y * 1000000) / 1000000
    };

    updateFillPreview();
}

function endFillVertexDrag() {
    const result = { wasMoved: fillVertexDragMoved, isNew: fillVertexDragIsNew };
    fillVertexDragIndex = -1;
    fillVertexDragMoved = false;
    fillVertexDragIsNew = false;
    return result;
}

function getEvenOddPaths(regions) {
    const validRegions = regions.filter(r => r.length >= 3).map(r => r.map(p => ({ x: p.x, y: p.y })));
    if (validRegions.length === 0) return [];

    function isPointInPolygon(p, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > p.y) !== (yj > p.y))
                && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    function getPolygonArea(pts) {
        let area = 0;
        for (let i = 0; i < pts.length; i++) {
            let j = (i + 1) % pts.length;
            area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
        }
        return area;
    }

    function ensureOrientation(pts, ccw = true) {
        const area = getPolygonArea(pts);
        if ((area > 0 && !ccw) || (area < 0 && ccw)) {
            pts.reverse();
        }
    }

    function segmentsIntersect(a1, a2, b1, b2) {
        if ((Math.abs(a1.x - b1.x) < 1e-6 && Math.abs(a1.y - b1.y) < 1e-6) ||
            (Math.abs(a1.x - b2.x) < 1e-6 && Math.abs(a1.y - b2.y) < 1e-6) ||
            (Math.abs(a2.x - b1.x) < 1e-6 && Math.abs(a2.y - b1.y) < 1e-6) ||
            (Math.abs(a2.x - b2.x) < 1e-6 && Math.abs(a2.y - b2.y) < 1e-6)) {
            return false;
        }
        const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
        if (Math.abs(d) < 1e-10) return false;
        const u = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
        const v = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
        return (u > 1e-6 && u < 1 - 1e-6 && v > 1e-6 && v < 1 - 1e-6);
    }

    const depths = new Array(validRegions.length).fill(0);
    const containers = [];
    for (let i = 0; i < validRegions.length; i++) {
        containers[i] = [];
        for (let j = 0; j < validRegions.length; j++) {
            if (i === j) continue;
            if (isPointInPolygon(validRegions[i][0], validRegions[j])) {
                depths[i]++;
                containers[i].push(j);
            }
        }
    }

    const outers = [];
    const holes = [];

    for (let i = 0; i < validRegions.length; i++) {
        if (depths[i] % 2 === 0) {
            outers.push({ index: i, pts: validRegions[i], holes: [] });
        } else {
            let parentIdx = -1;
            let maxParentDepth = -1;
            for (const cIdx of containers[i]) {
                if (depths[cIdx] % 2 === 0 && depths[cIdx] > maxParentDepth) {
                    maxParentDepth = depths[cIdx];
                    parentIdx = cIdx;
                }
            }
            holes.push({ index: i, pts: validRegions[i], parentOuterIdx: parentIdx });
        }
    }

    for (const h of holes) {
        const parentOuter = outers.find(o => o.index === h.parentOuterIdx);
        if (parentOuter) {
            parentOuter.holes.push(h.pts);
        } else {
            outers.push({ index: h.index, pts: h.pts, holes: [] });
        }
    }

    const mergedPaths = [];

    for (const outerGroup of outers) {
        const outerPts = outerGroup.pts;
        ensureOrientation(outerPts, true);

        let combinedPts = [...outerPts];

        for (const holePts of outerGroup.holes) {
            ensureOrientation(holePts, false);

            let bestCombinedIdx = 0;
            let bestHoleIdx = 0;
            let minKey = Infinity;
            let foundValidBridge = false;

            for (let i = 0; i < combinedPts.length; i++) {
                for (let j = 0; j < holePts.length; j++) {
                    const pC = combinedPts[i];
                    const pH = holePts[j];
                    const distSq = (pC.x - pH.x)**2 + (pC.y - pH.y)**2;

                    if (distSq < minKey) {
                        let intersects = false;
                        for (let k = 0; k < combinedPts.length; k++) {
                            if (segmentsIntersect(pC, pH, combinedPts[k], combinedPts[(k + 1) % combinedPts.length])) {
                                intersects = true;
                                break;
                            }
                        }
                        if (!intersects) {
                            for (let k = 0; k < holePts.length; k++) {
                                if (segmentsIntersect(pC, pH, holePts[k], holePts[(k + 1) % holePts.length])) {
                                    intersects = true;
                                    break;
                                }
                            }
                        }
                        if (!intersects) {
                            minKey = distSq;
                            bestCombinedIdx = i;
                            bestHoleIdx = j;
                            foundValidBridge = true;
                        }
                    }
                }
            }

            if (!foundValidBridge) {
                let absoluteMinDistSq = Infinity;
                for (let i = 0; i < combinedPts.length; i++) {
                    for (let j = 0; j < holePts.length; j++) {
                        const distSq = (combinedPts[i].x - holePts[j].x)**2 + (combinedPts[i].y - holePts[j].y)**2;
                        if (distSq < absoluteMinDistSq) {
                            absoluteMinDistSq = distSq;
                            bestCombinedIdx = i;
                            bestHoleIdx = j;
                        }
                    }
                }
            }

            const newCombined = [];
            for (let i = 0; i <= bestCombinedIdx; i++) {
                newCombined.push(combinedPts[i]);
            }
            for (let j = 0; j < holePts.length; j++) {
                const idx = (bestHoleIdx + j) % holePts.length;
                newCombined.push(holePts[idx]);
            }
            newCombined.push(holePts[bestHoleIdx]);
            newCombined.push(combinedPts[bestCombinedIdx]);
            for (let i = bestCombinedIdx + 1; i < combinedPts.length; i++) {
                newCombined.push(combinedPts[i]);
            }
            combinedPts = newCombined;
        }

        mergedPaths.push(combinedPts);
    }

    return mergedPaths;
}

function updateFillPreview() {
    updateFillRegionUI();

    const quadsCountEl = document.getElementById('fillQuadsNum');

    if (!isDrawingFill) {
        previewFillQuads = [];
        if (quadsCountEl) quadsCountEl.innerText = "0";
        return;
    }

    const regionsToRender = isFillMultiRegionMode ? fillRegions : [fillPoints];
    const pathsToRender = getEvenOddPaths(regionsToRender);

    previewFillQuads = [];
    for (const path of pathsToRender) {
        const quads = generateFillQuads(path);
        previewFillQuads = previewFillQuads.concat(quads);
    }
    
    if (quadsCountEl) {
        quadsCountEl.innerText = previewFillQuads.length;
    }
}

function generateFillQuads(points) {
    if (!points || points.length < 3) return [];

    // 1. Очистка дубликатов и лишних коллинеарных точек на прямых ребрах
    let clean = [];
    for (let p of points) {
        if (!clean.length || Math.hypot(p.x - clean[clean.length - 1].x, p.y - clean[clean.length - 1].y) > 1e-6) {
            clean.push({ x: p.x, y: p.y });
        }
    }
    if (clean.length > 1 && Math.hypot(clean[0].x - clean[clean.length - 1].x, clean[0].y - clean[clean.length - 1].y) <= 1e-6) {
        clean.pop();
    }
    let pts = [];
    const n = clean.length;
    for (let i = 0; i < n; i++) {
        const prev = clean[(i - 1 + n) % n], curr = clean[i], next = clean[(i + 1) % n];
        const cr = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
        const dot = (curr.x - prev.x) * (next.x - curr.x) + (curr.y - prev.y) * (next.y - curr.y);
        if (Math.abs(cr) < 1e-8 && dot > 0) continue;
        pts.push(curr);
    }
    if (pts.length < 3) return [];

    function cross(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }
    function samePt(a, b) {
        return Math.abs(a.x - b.x) < 1e-7 && Math.abs(a.y - b.y) < 1e-7;
    }
    function isConvex4(q) {
        let pos = 0, neg = 0;
        for (let i = 0; i < 4; i++) {
            let cr = cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4]);
            if (cr > 1e-9) pos++; else if (cr < -1e-9) neg++; else return false;
        }
        return pos === 4 || neg === 4;
    }

    if (pts.length === 3) return [[pts[0], pts[1], pts[2], pts[2]]];
    if (pts.length === 4 && isConvex4(pts)) return [pts];

    // 2. Качественная триангуляция через earcut (с надежным fallback ear-clipping)
    let triangles = [];
    const earcutFn = (typeof earcut !== 'undefined' ? (earcut.default || earcut) : null);
    if (earcutFn) {
        try {
            const flat = [];
            for (let p of pts) flat.push(p.x, p.y);
            const indices = earcutFn(flat, null, 2);
            for (let i = 0; i < indices.length; i += 3) {
                triangles.push([pts[indices[i]], pts[indices[i + 1]], pts[indices[i + 2]]]);
            }
        } catch (e) {
            triangles = [];
        }
    }
    if (triangles.length === 0) {
        let temp = [...pts];
        while (temp.length >= 3) {
            let earFound = false;
            for (let i = 0; i < temp.length; i++) {
                let p = temp[(i - 1 + temp.length) % temp.length], c = temp[i], nx = temp[(i + 1) % temp.length];
                if (cross(p, c, nx) <= 1e-9) continue;
                let inside = false;
                for (let j = 0; j < temp.length; j++) {
                    if (j === (i - 1 + temp.length) % temp.length || j === i || j === (i + 1) % temp.length) continue;
                    let pt = temp[j];
                    if (cross(p, c, pt) >= -1e-9 && cross(c, nx, pt) >= -1e-9 && cross(nx, p, pt) >= -1e-9) { inside = true; break; }
                }
                if (!inside) {
                    triangles.push([p, c, nx]);
                    temp.splice(i, 1);
                    earFound = true;
                    break;
                }
            }
            if (!earFound) break;
        }
    }

    // 3. Поиск пар треугольников, образующих строго выпуклые квады
    function tryMerge(t1, t2) {
        let shared = 0;
        for (let p of t1) if (t2.some(q => samePt(p, q))) shared++;
        if (shared !== 2) return null;

        let qPts = [...t1];
        for (let p of t2) if (!qPts.some(q => samePt(p, q))) qPts.push(p);
        if (qPts.length !== 4) return null;

        let cx = (qPts[0].x + qPts[1].x + qPts[2].x + qPts[3].x) / 4;
        let cy = (qPts[0].y + qPts[1].y + qPts[2].y + qPts[3].y) / 4;
        qPts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
        return isConvex4(qPts) ? qPts : null;
    }

    const m = triangles.length;
    const quadPairs = new Map();
    const adj = Array.from({ length: m }, () => []);

    for (let i = 0; i < m; i++) {
        for (let j = i + 1; j < m; j++) {
            const q = tryMerge(triangles[i], triangles[j]);
            if (q) {
                adj[i].push(j);
                adj[j].push(i);
                quadPairs.set(i + ':' + j, q);
            }
        }
    }

    // 4. Точное максимальное паросочетание на графе (Augmenting Paths)
    const match = new Int32Array(m).fill(-1);
    const vis = new Uint8Array(m);

    function dfs(u) {
        for (const v of adj[u]) {
            if (vis[v]) continue;
            vis[v] = 1;
            if (match[v] < 0 || dfs(match[v])) {
                match[v] = u;
                match[u] = v;
                return true;
            }
        }
        return false;
    }

    for (let u = 0; u < m; u++) {
        if (match[u] < 0) {
            for (const v of adj[u]) {
                if (match[v] < 0) { match[u] = v; match[v] = u; break; }
            }
        }
    }
    for (let u = 0; u < m; u++) {
        if (match[u] < 0) {
            vis.fill(0);
            dfs(u);
        }
    }

    // 5. Сборка итоговых квадов и минимального числа непарных треугольников
    const quads = [];
    const used = new Uint8Array(m);
    for (let i = 0; i < m; i++) {
        if (used[i]) continue;
        const j = match[i];
        if (j > i) {
            quads.push(quadPairs.get(i + ':' + j));
            used[i] = used[j] = 1;
        } else if (j < 0) {
            const t = triangles[i];
            if (Math.abs(cross(t[0], t[1], t[2])) > 1e-10) {
                quads.push([t[0], t[1], t[2], t[2]]);
            }
            used[i] = 1;
        }
    }

    return quads;
}

function finalizeFill() {
    const regionsToRender = isFillMultiRegionMode ? fillRegions : [fillPoints];
    const pathsToRender = getEvenOddPaths(regionsToRender);

    if (pathsToRender.length === 0) {
        alert(typeof lang !== 'undefined' && lang === ru ? "Для заполнения необходимо минимум 3 точки!" : "At least 3 points are required for filling!");
        cancelFill();
        return;
    }

    let finalQuads = [];
    for (const path of pathsToRender) {
        finalQuads = finalQuads.concat(generateFillQuads(path));
    }

    if (finalQuads.length === 0) {
        alert(typeof lang !== 'undefined' && lang === ru ? "Не удалось сгенерировать заливку!" : "Failed to generate fill!");
        cancelFill();
        return;
    }

    lastFillPoints = regionsToRender.map(r => [...r]);

    let newObjects = [];
    for (const q of finalQuads) {
        const objIdStr = nextId().toString();
        const object = {
            name: (typeof lang !== 'undefined' ? lang.quad : "Quad") + " " + objIdStr,
            type: "quad",
            pos1: { x: q[0].x, y: q[0].y },
            pos2: { x: q[1].x, y: q[1].y },
            pos3: { x: q[2].x, y: q[2].y },
            pos4: { x: q[3].x, y: q[3].y },
            selected: false
        };
        objects.set(objIdStr, object);
        newObjects.push({ id: objIdStr, object: object });
    }

    if (newObjects.length > 0) pushEvent("add_multiple", newObjects);

    refreshObjectsList(true);
    cancelFill();
    if (typeof markAllTools === 'function') markAllTools();
}

function cancelFill() {
    fillRegions = [[]];
    currentFillRegionIndex = 0;
    fillPoints = fillRegions[0];
    isDrawingFill = false;
    isFillDragging = false;
    previewFillQuads = [];
    updateFillRegionUI();
    
    const quadsCountEl = document.getElementById('fillQuadsNum');
    if (quadsCountEl) quadsCountEl.innerText = "0";
}

function restoreLastFill() {
    if (!lastFillPoints || lastFillPoints.length === 0) {
        alert(typeof lang !== 'undefined' && lang === ru ? "Предыдущая зона отсутствует!" : "No previous zone found!");
        return;
    }

    if (Array.isArray(lastFillPoints[0])) {
        fillRegions = lastFillPoints.map(r => [...r]);
    } else {
        fillRegions = [[...lastFillPoints]];
    }

    currentFillRegionIndex = 0;
    fillPoints = fillRegions[currentFillRegionIndex];

    if (fillRegions.length > 1) {
        setFillRegionMode('multi');
    } else {
        updateFillRegionUI();
    }

    isDrawingFill = true;
    updateFillPreview();
}

let fillInputMode = 'manual';

function setFillInputMode(mode) {
    fillInputMode = mode;
    const btnManual = document.getElementById('fillInputManualBtn');
    const btnWand = document.getElementById('fillInputWandBtn');

    if (btnManual && btnWand) {
        btnManual.style.background = mode === 'manual' ? 'var(--input-bg)' : 'transparent';
        btnManual.style.border = mode === 'manual' ? 'transparent' : '1px solid var(--border-col)';
        btnWand.style.background = mode === 'wand' ? 'var(--input-bg)' : 'transparent';
        btnWand.style.border = mode === 'wand' ? 'transparent' : '1px solid var(--border-col)';
    }
}

function executeFillMagicWand(clickPos) {
    requestMagicWandRegions(clickPos, (err, newRegions) => {
        if (err) {
            console.error('Magic wand failed:', err);
            showNotification(typeof lang !== 'undefined' && lang === ru ? "Не удалось построить область (волшебная палочка)" : "Failed to build the region (magic wand)", true);
            return;
        }

        if (!newRegions || newRegions.length === 0) return;

        if (newRegions.length > 1 && !isFillMultiRegionMode) {
            setFillRegionMode('multi');
        }

        if (fillRegions[currentFillRegionIndex].length === 0) {
            fillRegions.splice(currentFillRegionIndex, 1, ...newRegions);
        } else {
            fillRegions.push(...newRegions);
            currentFillRegionIndex = fillRegions.length - newRegions.length;
        }

        fillPoints = fillRegions[currentFillRegionIndex];
        isDrawingFill = true;
        if (typeof updateFillPreview === 'function') updateFillPreview();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const createBtn = document.getElementById('fillCreateBtn');
    const cancelBtn = document.getElementById('fillCancelBtn');
    const restoreBtn = document.getElementById('fillRestoreBtn');

    if (createBtn) createBtn.onclick = () => finalizeFill();
    if (cancelBtn) cancelBtn.onclick = () => cancelFill();
    if (restoreBtn) restoreBtn.onclick = () => restoreLastFill();
});