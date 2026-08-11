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
    if (points.length < 3) return [];
    
    let pts = [];
    for (let p of points) {
        if (pts.length === 0 || Math.hypot(p.x - pts[pts.length-1].x, p.y - pts[pts.length-1].y) > 1e-8) {
            pts.push({ x: p.x, y: p.y });
        }
    }
    if (pts.length > 1 && Math.hypot(pts[0].x - pts[pts.length-1].x, pts[0].y - pts[pts.length-1].y) < 1e-8) {
        pts.pop();
    }
    if (pts.length < 3) return [];

    let area = 0;
    for (let i = 0; i < pts.length; i++) {
        let j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    if (area < 0) pts.reverse();

    function cross(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    function samePoint(p1, p2) {
        return Math.abs(p1.x - p2.x) < 1e-8 && Math.abs(p1.y - p2.y) < 1e-8;
    }

    function isPointInTriangle(p, a, b, c) {
        if (samePoint(p, a) || samePoint(p, b) || samePoint(p, c)) return false;
        
        let denominator = ((b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y));
        if (Math.abs(denominator) < 1e-12) return false;
        
        let w1 = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / denominator;
        let w2 = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / denominator;
        let w3 = 1 - w1 - w2;
        
        return w1 >= -1e-8 && w2 >= -1e-8 && w3 >= -1e-8;
    }

    let triangles = [];
    let bailout = 0;
    
    while (pts.length >= 3 && bailout < 2000) {
        bailout++;
        let n = pts.length;
        let earFound = false;
        
        for (let i = 0; i < n; i++) {
            let prev = (i - 1 + n) % n;
            let next = (i + 1) % n;
            let a = pts[prev], b = pts[i], c = pts[next];

            if (cross(a, b, c) <= 1e-10) continue;

            let isEar = true;
            for (let j = 0; j < n; j++) {
                if (j === prev || j === i || j === next) continue;
                if (isPointInTriangle(pts[j], a, b, c)) {
                    isEar = false;
                    break;
                }
            }

            if (isEar) {
                triangles.push([a, b, c]);
                pts.splice(i, 1);
                earFound = true;
                break;
            }
        }
        
        if (!earFound) {
            let bestIdx = -1;
            let maxCross = -Infinity;
            for (let i = 0; i < pts.length; i++) {
                let prev = (i - 1 + pts.length) % pts.length;
                let next = (i + 1) % pts.length;
                let cr = cross(pts[prev], pts[i], pts[next]);
                if (cr > maxCross) {
                    maxCross = cr;
                    bestIdx = i;
                }
            }
            
            if (bestIdx !== -1) {
                let prev = (bestIdx - 1 + pts.length) % pts.length;
                let next = (bestIdx + 1) % pts.length;
                
                if (maxCross > 1e-10) { 
                    triangles.push([pts[prev], pts[bestIdx], pts[next]]);
                }
                pts.splice(bestIdx, 1);
            } else {
                pts.splice(0, 1);
            }
        }
    }

    let quads = [];
    let usedTriangles = new Array(triangles.length).fill(false);
    
    function rebuildQuad(t1, t2) {
        let ptsList = [];
        for (let p of t1) ptsList.push(p);
        for (let p of t2) {
            if (!ptsList.some(pt => samePoint(pt, p))) ptsList.push(p);
        }
        if (ptsList.length !== 4) return null;

        let cx = (ptsList[0].x + ptsList[1].x + ptsList[2].x + ptsList[3].x) / 4;
        let cy = (ptsList[0].y + ptsList[1].y + ptsList[2].y + ptsList[3].y) / 4;
        ptsList.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
        return ptsList;
    }

    function isConvexQuad(q) {
        let signs = [];
        for(let i = 0; i < 4; i++) {
            let cr = cross(q[i], q[(i+1)%4], q[(i+2)%4]);
            if (cr <= 1e-10) return false;
            signs.push(cr > 0);
        }
        return signs.every(s => s === true) || signs.every(s => s === false);
    }

    for (let i = 0; i < triangles.length; i++) {
        if (usedTriangles[i]) continue;
        let merged = false;
        
        for (let j = i + 1; j < triangles.length; j++) {
            if (usedTriangles[j]) continue;
            
            let sharedCount = 0;
            for(let p1 of triangles[i]) {
                if(triangles[j].some(p2 => samePoint(p1, p2))) sharedCount++;
            }

            if (sharedCount === 2) {
                let quadPoints = rebuildQuad(triangles[i], triangles[j]);
                if (quadPoints && isConvexQuad(quadPoints)) {
                    quads.push(quadPoints);
                    usedTriangles[i] = true;
                    usedTriangles[j] = true;
                    merged = true;
                    break;
                }
            }
        }
        if (!merged) {
             let t = triangles[i];
             if (Math.abs(cross(t[0], t[1], t[2])) > 1e-10) {
                 quads.push([t[0], t[1], t[2], t[2]]);
             }
             usedTriangles[i] = true;
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