let fillPoints = [];
let isDrawingFill = false;
let isFillDragging = false;
let previewFillQuads = [];

let lastFillAction = null;
let lastAddedFillPointTime = 0;
let lastFillRemovedIndex = -1;
let lastFillRemovedPoint = null;

function startFillDrawing(pos) {
    fillPoints = [{
        x: Math.round(pos.x * 1000000) / 1000000,
        y: Math.round(pos.y * 1000000) / 1000000
    }];

    lastFillAction = 'start';
    lastAddedFillPointTime = Date.now();

    isDrawingFill = true;
    previewFillQuads = [];
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
            if (fillPoints.length === 0) cancelFill();
            else updateFillPreview();
        }
        return;
    }

    lastFillAction = 'add';
    lastAddedFillPointTime = Date.now();
    fillPoints.push(roundedPos);
    updateFillPreview();
}

function updateFillPreview() {
    const countEl = document.getElementById('fillPointsNum');
    if (countEl) countEl.innerText = fillPoints.length;

    const quadsCountEl = document.getElementById('fillQuadsNum');

    if (!isDrawingFill || fillPoints.length < 3) {
        previewFillQuads = [];
        if (quadsCountEl) quadsCountEl.innerText = "0";
        return;
    }

    previewFillQuads = generateFillQuads(fillPoints);
    
    if (quadsCountEl) {
        quadsCountEl.innerText = previewFillQuads.length;
    }
}

function generateFillQuads(points) {
    if (points.length < 3) return [];
    
    let pts = points.map(p => ({ x: p.x, y: p.y }));
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
        let j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    if (area < 0) pts.reverse();

    function cross(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    function isPointInTriangle(p, a, b, c) {
        let as_x = p.x - a.x, as_y = p.y - a.y;
        let s_ab = (b.x - a.x) * as_y - (b.y - a.y) * as_x > 0;
        if (((c.x - a.x) * as_y - (c.y - a.y) * as_x > 0) === s_ab) return false;
        if (((c.x - b.x) * (p.y - b.y) - (c.y - b.y) * (p.x - b.x) > 0) !== s_ab) return false;
        return true;
    }

    let triangles = [];
    let bailout = 0;
    while (pts.length >= 3 && bailout < 1000) {
        bailout++;
        let n = pts.length;
        let earFound = false;
        
        for (let i = 0; i < n; i++) {
            let prev = (i - 1 + n) % n;
            let next = (i + 1) % n;
            let a = pts[prev], b = pts[i], c = pts[next];

            if (cross(a, b, c) <= 1e-7) continue;

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
            triangles.push([pts[0], pts[1], pts[2]]);
            pts.splice(1, 1);
        }
    }

    let quads = [];
    let usedTriangles = new Array(triangles.length).fill(false);

    function samePoint(p1, p2) { return Math.abs(p1.x - p2.x) < 1e-6 && Math.abs(p1.y - p2.y) < 1e-6; }
    function edgesOpposite(e1, e2) { return samePoint(e1.start, e2.end) && samePoint(e1.end, e2.start); }
    function getEdges(t) { return [{start: t[0], end: t[1]}, {start: t[1], end: t[2]}, {start: t[2], end: t[0]}]; }
    
    function rebuildQuad(t1, t2) {
        let edges1 = getEdges(t1), edges2 = getEdges(t2), allEdges = [];
        for(let e1 of edges1) {
            if(!edges2.some(e2 => edgesOpposite(e1, e2))) allEdges.push(e1);
        }
        for(let e2 of edges2) {
            if(!edges1.some(e1 => edgesOpposite(e2, e1))) allEdges.push(e2);
        }
        if(allEdges.length !== 4) return null;

        let quad = [], curEdge = allEdges[0];
        quad.push(curEdge.start);
        for(let step=0; step<3; step++) {
            let nextEdge = allEdges.find(e => samePoint(e.start, curEdge.end) && e !== curEdge);
            if(!nextEdge) return null;
            quad.push(nextEdge.start);
            curEdge = nextEdge;
        }
        return quad;
    }

    function isConvexQuad(q) {
        let signs = [];
        for(let i=0; i<4; i++) signs.push(cross(q[i], q[(i+1)%4], q[(i+2)%4]) > 0);
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
             quads.push([t[0], t[1], t[2], t[2]]);
             usedTriangles[i] = true;
        }
    }

    return quads;
}

function finalizeFill() {
    if (fillPoints.length < 3) {
        alert(lang === ru ? "Для заполнения необходимо минимум 3 точки!" : "At least 3 points are required for filling!");
        cancelFill();
        return;
    }

    const finalQuads = generateFillQuads(fillPoints);
    if (finalQuads.length === 0) {
        alert(lang === ru ? "Не удалось сгенерировать заливку!" : "Failed to generate fill!");
        cancelFill();
        return;
    }

    let newObjects = [];
    for (const q of finalQuads) {
        const objIdStr = nextId().toString();
        const object = {
            name: lang.quad + " " + objIdStr,
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
    markAllTools();
}

function cancelFill() {
    fillPoints = [];
    isDrawingFill = false;
    isFillDragging = false;
    previewFillQuads = [];
    
    const countEl = document.getElementById('fillPointsNum');
    if (countEl) countEl.innerText = "0";
    
    const quadsCountEl = document.getElementById('fillQuadsNum');
    if (quadsCountEl) quadsCountEl.innerText = "0";
}

document.addEventListener('DOMContentLoaded', () => {
    const createBtn = document.getElementById('fillCreateBtn');
    const cancelBtn = document.getElementById('fillCancelBtn');
    if (createBtn) createBtn.onclick = () => finalizeFill();
    if (cancelBtn) cancelBtn.onclick = () => cancelFill();
});