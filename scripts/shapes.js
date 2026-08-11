let shapesToolState = {
    active: false,
    type: 'square',
    box: { cx: 0, cy: 0, w: 0.1, h: 0.1, angle: 0 },
    action: null,
    startBox: null,
    startAngle: 0,
    offsetX: 0,
    offsetY: 0
};

let freeShapeState = {
    active: false,
    points: []
};
let freeShapeStickyMode = false;

let previewFreeShapeLines = [];

const SHAPES = {
    square: [
        { x: -0.4, y: -0.4 }, { x: 0.4, y: -0.4 },
        { x: 0.4, y: 0.4 }, { x: -0.4, y: 0.4 }
    ],
    triangle: [
        { x: 0, y: -0.4 }, { x: 0.4, y: 0.4 }, { x: -0.4, y: 0.4 }
    ],
    circle: generateCircle(32),
    star: generateStar(5, 0.4, 0.16),
    animeStar: [
        { x: 0, y: -0.4 }, { x: 0.04, y: -0.16 }, { x: 0.08, y: -0.08 }, { x: 0.16, y: -0.04 },
        { x: 0.4, y: 0 }, { x: 0.16, y: 0.04 }, { x: 0.08, y: 0.08 }, { x: 0.04, y: 0.16 },
        { x: 0, y: 0.4 }, { x: -0.04, y: 0.16 }, { x: -0.08, y: 0.08 }, { x: -0.16, y: 0.04 },
        { x: -0.4, y: 0 }, { x: -0.16, y: -0.04 }, { x: -0.08, y: -0.08 }, { x: -0.04, y: -0.16 }
    ],
    heart: generateHeart(),
    cross: [
        { x: 0, y: -0.1 }, { x: 0.3, y: -0.4 }, { x: 0.4, y: -0.3 },
        { x: 0.1, y: 0 }, { x: 0.4, y: 0.3 }, { x: 0.3, y: 0.4 },
        { x: 0, y: 0.1 }, { x: -0.3, y: 0.4 }, { x: -0.4, y: 0.3 },
        { x: -0.1, y: 0 }, { x: -0.4, y: -0.3 }, { x: -0.3, y: -0.4 }
    ],
    checkmark: [
        { x: -0.4, y: -0.05 }, { x: -0.1, y: 0.2 }, { x: 0.4, y: -0.25 },
        { x: 0.32, y: -0.35 }, { x: -0.1, y: 0.05 }, { x: -0.32, y: -0.15 }
    ]
};

function generateCircle(segments = 32) {
    let points = [];
    for (let i = 0; i < segments; i++) {
        let theta = (i / segments) * Math.PI * 2;
        points.push({
            x: Math.cos(theta) * 0.4,
            y: Math.sin(theta) * 0.4
        });
    }
    return points;
}

function generateStar(points, outer, inner) {
    let pts = [];
    const step = Math.PI / points;
    for (let i = 0; i < 2 * points; i++) {
        const r = (i % 2 === 0) ? outer : inner;
        const angle = i * step - Math.PI / 2;
        pts.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
    }
    return pts;
}

function generateHeart() {
    let pts = [];
    const totalPoints = 50;
    for (let i = 0; i < totalPoints; i++) {
        let t = (i / totalPoints) * Math.PI * 2;
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        pts.push({
            x: (x / 17.5) * 0.4,
            y: ((y / 17.5) - 0.05) * 0.4
        });
    }
    return pts;
}

function freeShapeCentroid(points) {
    let cx = 0, cy = 0;
    for (const p of points) { cx += p.x; cy += p.y; }
    return { x: cx / points.length, y: cy / points.length };
}

function freeShapeBoundingBox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function freeShapeConvexHull(points) {
    const pts = points.slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
    const uniq = [];
    for (const p of pts) {
        if (uniq.length === 0 || uniq[uniq.length - 1].x !== p.x || uniq[uniq.length - 1].y !== p.y) uniq.push(p);
    }
    if (uniq.length < 3) return uniq;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of uniq) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
        lower.push(p);
    }
    const upper = [];
    for (let i = uniq.length - 1; i >= 0; i--) {
        const p = uniq[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
        upper.push(p);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
}

function freeShapeDistToSegment(p, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    if (lenSq < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function freeShapeSimplifyClosed(ring, tolerance) {
    if (ring.length <= 3) return ring;

    function dpOpen(chain) {
        if (chain.length < 3) return chain;
        let maxDist = -1, maxIdx = -1;
        const a = chain[0], b = chain[chain.length - 1];
        for (let i = 1; i < chain.length - 1; i++) {
            const d = freeShapeDistToSegment(chain[i], a, b);
            if (d > maxDist) { maxDist = d; maxIdx = i; }
        }
        if (maxDist > tolerance) {
            return dpOpen(chain.slice(0, maxIdx + 1)).slice(0, -1).concat(dpOpen(chain.slice(maxIdx)));
        }
        return [a, b];
    }
    function mergeNearCollinear(poly) {
        let result = poly.slice(), changed = true;
        while (changed && result.length > 3) {
            changed = false;
            for (let i = 0; i < result.length; i++) {
                const n = result.length;
                const prev = result[(i - 1 + n) % n], cur = result[i], next = result[(i + 1) % n];
                const v1 = { x: prev.x - cur.x, y: prev.y - cur.y }, v2 = { x: next.x - cur.x, y: next.y - cur.y };
                const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
                if (mag < 1e-12) continue;
                const angle = Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / mag))) * 180 / Math.PI;
                if (angle > 160) { result.splice(i, 1); changed = true; break; }
            }
        }
        return result;
    }

    const centroid = freeShapeCentroid(ring);
    const anchors = ring.map((p, i) => ({ i, d: (p.x - centroid.x) ** 2 + (p.y - centroid.y) ** 2 }))
        .sort((a, b) => b.d - a.d).slice(0, Math.min(3, ring.length)).map(o => o.i);

    let best = null;
    for (const anchor of anchors) {
        const rotated = ring.slice(anchor).concat(ring.slice(0, anchor));
        const result = mergeNearCollinear(dpOpen(rotated.concat([rotated[0]])).slice(0, -1));
        if (best === null || result.length < best.length) best = result;
    }
    return best;
}

function freeShapeGenerateRegularPolygon(sides, rotationOffset) {
    const pts = [];
    for (let i = 0; i < sides; i++) {
        const a = rotationOffset + i * (2 * Math.PI / sides);
        pts.push({ x: 0.4 * Math.cos(a), y: 0.4 * Math.sin(a) });
    }
    return pts;
}
function freeShapeGenerateStarPoints(points, innerOuterRatio, rotationOffset) {
    const pts = [];
    const step = Math.PI / points;
    for (let i = 0; i < 2 * points; i++) {
        const r = (i % 2 === 0) ? 0.4 : 0.4 * innerOuterRatio;
        const a = rotationOffset + i * step;
        pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    }
    return pts;
}

function freeShapeApplyBox(normalizedPoints, box) {
    const cos = Math.cos(box.angle), sin = Math.sin(box.angle);
    return normalizedPoints.map(p => {
        const lx = p.x * box.w, ly = p.y * box.h;
        return { x: box.cx + lx * cos - ly * sin, y: box.cy + lx * sin + ly * cos };
    });
}

function freeShapeScoreCandidate(rawPoints, worldPolygonPoints, diag) {
    let sum = 0;
    for (const p of rawPoints) {
        let best = Infinity;
        for (let i = 0; i < worldPolygonPoints.length; i++) {
            const d = freeShapeDistToSegment(p, worldPolygonPoints[i], worldPolygonPoints[(i + 1) % worldPolygonPoints.length]);
            if (d < best) best = d;
        }
        sum += best;
    }
    return (sum / rawPoints.length) / diag;
}

function freeShapeFitCircle(bbox) {
    const cx = (bbox.minX + bbox.maxX) / 2, cy = (bbox.minY + bbox.maxY) / 2;
    return { points: SHAPES.circle, box: { cx, cy, w: bbox.w / 0.8, h: bbox.h / 0.8, angle: 0 } };
}

function freeShapeFitRectangle(hull) {
    let bestAngle = 0, bestArea = Infinity, bestW = 0, bestH = 0, bestCx = 0, bestCy = 0;
    for (let s = 0; s < 90; s++) {
        const angle = (s / 90) * (Math.PI / 2);
        const cos = Math.cos(-angle), sin = Math.sin(-angle);
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of hull) {
            const lx = p.x * cos - p.y * sin, ly = p.x * sin + p.y * cos;
            if (lx < minX) minX = lx; if (lx > maxX) maxX = lx;
            if (ly < minY) minY = ly; if (ly > maxY) maxY = ly;
        }
        const w = maxX - minX, h = maxY - minY, area = w * h;
        if (area < bestArea) {
            bestArea = area; bestAngle = angle; bestW = w; bestH = h;
            const lcx = (minX + maxX) / 2, lcy = (minY + maxY) / 2;
            const cb = Math.cos(angle), sb = Math.sin(angle);
            bestCx = lcx * cb - lcy * sb; bestCy = lcx * sb + lcy * cb;
        }
    }
    return {
        points: [{ x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }],
        box: { cx: bestCx, cy: bestCy, w: bestW, h: bestH, angle: bestAngle }
    };
}

function freeShapeFitNGon(points, sides) {
    const centroid = freeShapeCentroid(points);
    const withAngles = points.map(p => ({
        r: Math.hypot(p.x - centroid.x, p.y - centroid.y),
        theta: Math.atan2(p.y - centroid.y, p.x - centroid.x)
    }));

    let bestAngle = 0, bestErr = Infinity;
    for (let s = 0; s < 72; s++) {
        const testAngle = (s / 72) * (2 * Math.PI / sides);
        let err = 0;
        for (const w of withAngles) {
            const slot = Math.round((w.theta - testAngle) / (2 * Math.PI / sides));
            let diff = w.theta - (testAngle + slot * (2 * Math.PI / sides));
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            err += diff * diff;
        }
        if (err < bestErr) { bestErr = err; bestAngle = testAngle; }
    }

    const slotMax = new Array(sides).fill(0), slotHas = new Array(sides).fill(false);
    for (const w of withAngles) {
        let slot = ((Math.round((w.theta - bestAngle) / (2 * Math.PI / sides)) % sides) + sides) % sides;
        if (w.r > slotMax[slot]) slotMax[slot] = w.r;
        slotHas[slot] = true;
    }
    const maxima = slotMax.filter((_, i) => slotHas[i]);
    const avgR = maxima.length ? maxima.reduce((a, b) => a + b, 0) / maxima.length
        : withAngles.reduce((a, b) => a + b.r, 0) / withAngles.length;

    return {
        points: freeShapeGenerateRegularPolygon(sides, 0),
        box: { cx: centroid.x, cy: centroid.y, w: avgR / 0.4, h: avgR / 0.4, angle: bestAngle }
    };
}

function freeShapeFitStar(rawPoints, points, diag) {
    const centroid = freeShapeCentroid(rawPoints);
    const withR = rawPoints.map(p => ({
        r: Math.hypot(p.x - centroid.x, p.y - centroid.y),
        theta: Math.atan2(p.y - centroid.y, p.x - centroid.x)
    }));

    let best = null;
    for (let rs = 0; rs < 72; rs++) {
        const rotation = (rs / 72) * (Math.PI / points);
        const slotMax = new Array(points).fill(0), slotHas = new Array(points).fill(false);
        for (const w of withR) {
            const slot = ((Math.round((w.theta - rotation) / (2 * Math.PI / points)) % points) + points) % points;
            if (w.r > slotMax[slot]) slotMax[slot] = w.r;
            slotHas[slot] = true;
        }
        const maxima = slotMax.filter((_, i) => slotHas[i]);
        if (maxima.length === 0) continue;
        const outerR = maxima.reduce((a, b) => a + b, 0) / maxima.length;

        for (let rt = 0; rt <= 40; rt++) {
            const ratio = 0.1 + (rt / 40) * 0.8;
            const worldPts = freeShapeGenerateStarPoints(points, ratio, rotation)
                .map(p => ({ x: centroid.x + (p.x / 0.4) * outerR, y: centroid.y + (p.y / 0.4) * outerR }));
            const score = freeShapeScoreCandidate(rawPoints, worldPts, diag);
            if (!best || score < best.score) best = { score, rotation, outerR, ratio };
        }
    }

    return {
        points: freeShapeGenerateStarPoints(points, best.ratio, 0),
        box: { cx: centroid.x, cy: centroid.y, w: best.outerR / 0.4, h: best.outerR / 0.4, angle: best.rotation },
        score: best.score
    };
}

function freeShapeClassify(rawPoints) {
    if (!rawPoints || rawPoints.length < 3) return null;

    const bbox = freeShapeBoundingBox(rawPoints);
    const diag = Math.hypot(bbox.w, bbox.h);
    if (diag < 1e-6) return null;

    const hull = freeShapeConvexHull(rawPoints);
    if (hull.length < 3) return null;

    const candidates = [];
    const score = (fit) => ({ ...fit, score: freeShapeScoreCandidate(rawPoints, freeShapeApplyBox(fit.points, fit.box), diag) });

    candidates.push(score(freeShapeFitCircle(bbox)));
    candidates.push(score(freeShapeFitRectangle(hull)));

    const corners = freeShapeSimplifyClosed(hull, diag * 0.045);
    for (const sides of new Set([corners.length - 1, corners.length, corners.length + 1])) {
        if (sides >= 3 && sides <= 8 && sides !== 4) {
            candidates.push(score(freeShapeFitNGon(corners.length >= 3 ? corners : hull, sides)));
        }
    }

    const rawCorners = freeShapeSimplifyClosed(rawPoints, diag * 0.02);
    const impliedStarPoints = Math.round(rawCorners.length / 2);
    for (const k of new Set([impliedStarPoints - 1, impliedStarPoints, impliedStarPoints + 1])) {
        if (k >= 4 && k <= 8) candidates.push(freeShapeFitStar(rawPoints, k, diag));
    }

    candidates.sort((a, b) => a.score - b.score);
    return candidates[0];
}

function getShapesTransformHandles(box) {
    if (!box) return [];
    const { cx, cy, w, h, angle } = box;
    const cos = Math.cos(angle), sin = Math.sin(angle);

    const localPts = {
        scale_tl: { x: -w / 2, y: -h / 2 },
        scale_t: { x: 0, y: -h / 2 },
        scale_tr: { x: w / 2, y: -h / 2 },
        scale_r: { x: w / 2, y: 0 },
        scale_br: { x: w / 2, y: h / 2 },
        scale_b: { x: 0, y: h / 2 },
        scale_bl: { x: -w / 2, y: h / 2 },
        scale_l: { x: -w / 2, y: 0 },
        rotate: { x: 0, y: -h / 2 - 30 / (screenZoom * getBaseScale()) }
    };

    return Object.entries(localPts).map(([id, pt]) => ({
        id: id,
        p: { x: cx + pt.x * cos - pt.y * sin, y: cy + pt.x * sin + pt.y * cos }
    }));
}

function updateShapesPreview() {
    if (!shapesToolState.active) {
        previewShapeLines = [];
        return;
    }

    const points = SHAPES[shapesToolState.type];
    const box = shapesToolState.box;
    const cos = Math.cos(box.angle);
    const sin = Math.sin(box.angle);

    previewShapeLines = [];

    for (let i = 0; i < points.length; i++) {
        let p1 = points[i];
        let p2 = points[(i + 1) % points.length];

        let lx1 = p1.x * box.w, ly1 = p1.y * box.h;
        let lx2 = p2.x * box.w, ly2 = p2.y * box.h;

        let finalP1 = {
            x: box.cx + lx1 * cos - ly1 * sin,
            y: box.cy + lx1 * sin + ly1 * cos
        };
        let finalP2 = {
            x: box.cx + lx2 * cos - ly2 * sin,
            y: box.cy + lx2 * sin + ly2 * cos
        };

        previewShapeLines.push({ start: finalP1, end: finalP2 });
    }
}

function syncActiveShapeButton(type) {
    const btn = document.querySelector('.shape-btn[data-shape="' + type + '"]');
    document.querySelectorAll('.shape-btn[data-shape]').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
}

function clearShapesState() {
    if (shapesToolState.type && shapesToolState.type.indexOf('custom_') === 0) {
        delete SHAPES[shapesToolState.type];
        shapesToolState.type = 'square';
        syncActiveShapeButton(shapesToolState.type);
    }
    shapesToolState.active = false;
    previewShapeLines = [];
    freeShapeState.active = false;
    freeShapeState.points = [];
}

function exitFreeShapeStickyMode() {
    freeShapeStickyMode = false;
    clearShapesState();
    const freeBtnEl = document.getElementById('freeShapeToolBtn');
    if (freeBtnEl) freeBtnEl.classList.remove('active');
    syncActiveShapeButton(shapesToolState.type);
    resetShapesDescription();
}

let freeShapeDynamicCounter = 0;

function finishFreeShape() {
    const rawPoints = freeShapeState.points;
    freeShapeState.active = false;
    freeShapeState.points = [];

    if (!rawPoints || rawPoints.length < 2) {
        updateShapesPreview();
        if (freeShapeStickyMode) {
            freeShapeState.active = true;
            freeShapeState.points = [];
        }
        return;
    }

    const classified = freeShapeClassify(rawPoints);

    if (!classified) {
        shapesToolState.active = false;
        previewShapeLines = [];
        if (freeShapeStickyMode) {
            freeShapeState.active = true;
            freeShapeState.points = [];
        }
        return;
    }

    const dynamicKey = 'custom_' + (freeShapeDynamicCounter++);
    SHAPES[dynamicKey] = classified.points;

    shapesToolState.type = dynamicKey;
    shapesToolState.box = classified.box;
    shapesToolState.active = true;
    shapesToolState.action = null;

    updateShapesPreview();
}

function resetShapesDescription() {
    const descEl = document.getElementById('shapesDescription');
    if (descEl) descEl.textContent = lang === ru
        ? "Выберите фигуру и кликните по холсту для ее создания"
        : "Select a shape and click on the canvas to create it";
}

function setFreeShapeDrawingDescription() {
    const descEl = document.getElementById('shapesDescription');
    if (descEl) descEl.textContent = lang === ru
        ? "Нарисуйте фигуру на холсте, удерживая кнопку мыши"
        : "Draw a shape on the canvas while holding the mouse button";
}

function convertShapeToLines() {
    if (previewShapeLines.length === 0) return;

    let newObjects = [];
    previewShapeLines.forEach(line => {
        const objIdStr = nextId().toString();
        const object = {
            name: (typeof lang !== 'undefined' && lang.line ? lang.line : "Line") + " " + objIdStr,
            type: "line",
            start: { x: Math.round(line.start.x * 1000000) / 1000000, y: Math.round(line.start.y * 1000000) / 1000000 },
            end: { x: Math.round(line.end.x * 1000000) / 1000000, y: Math.round(line.end.y * 1000000) / 1000000 },
            selected: false
        };
        objects.set(objIdStr, object);
        newObjects.push({ id: objIdStr, object: object });
    });

    if (newObjects.length > 0) {
        pushEvent("add_multiple", newObjects);
    }

    refreshObjectsList(true);
    clearShapesState();
}

document.addEventListener('DOMContentLoaded', () => {
    const freeBtn = document.getElementById('freeShapeToolBtn');
    const btns = Array.from(document.querySelectorAll('.shape-btn')).filter(b => b !== freeBtn);

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (freeShapeStickyMode) exitFreeShapeStickyMode();

            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            shapesToolState.type = btn.getAttribute('data-shape');
            if (shapesToolState.active) updateShapesPreview();
        });
    });

    if (freeBtn) {
        freeBtn.addEventListener('click', () => {
            if (freeShapeStickyMode) {
                exitFreeShapeStickyMode();
                return;
            }

            if (shapesToolState.active) clearShapesState();

            freeShapeStickyMode = true;
            freeShapeState.active = true;
            freeShapeState.points = [];

            btns.forEach(b => b.classList.remove('active'));
            freeBtn.classList.add('active');

            setFreeShapeDrawingDescription();
        });
    }

    const createBtn = document.getElementById('shapesCreateBtn');
    const cancelBtn = document.getElementById('shapesCancelBtn');

    function resumeFreeShapeStickyDrawing() {
        freeShapeState.active = true;
        freeShapeState.points = [];
        if (freeBtn) {
            btns.forEach(b => b.classList.remove('active'));
            freeBtn.classList.add('active');
        }
        setFreeShapeDrawingDescription();
    }

    if (createBtn) {
        createBtn.addEventListener('click', () => {
            convertShapeToLines();
            if (freeShapeStickyMode) resumeFreeShapeStickyDrawing();
        });
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            clearShapesState();
            if (freeShapeStickyMode) resumeFreeShapeStickyDrawing();
        });
    }
});