let isDrawingEraser = false;
let eraserPoints = [];
let eraserFilterMode = 'all';

function setEraserMode(mode) {
    eraserFilterMode = mode;

    const btnAll = document.getElementById('eraserModeAll');
    const btnLines = document.getElementById('eraserModeLines');
    const btnQuads = document.getElementById('eraserModeQuads');
    if (!btnAll || !btnLines || !btnQuads) return;

    [btnAll, btnLines, btnQuads].forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = 'inherit';
        btn.style.border = '1px solid var(--border-col)';

        btn.onmouseover = () => {
            if (eraserFilterMode !== btn.id.replace('eraserMode', '').toLowerCase()) {
                btn.style.background = 'rgba(128, 128, 128, 0.3)';
            }
        };
        btn.onmouseout = () => {
            if (eraserFilterMode !== btn.id.replace('eraserMode', '').toLowerCase()) {
                btn.style.background = 'transparent';
            }
        };
    });

    let activeBtn;
    if (mode === 'all') activeBtn = btnAll;
    else if (mode === 'lines') activeBtn = btnLines;
    else if (mode === 'quads') activeBtn = btnQuads;

    if (activeBtn) {
        activeBtn.style.background = 'var(--input-bg)';
        activeBtn.style.color = 'var(--text-white)';
        activeBtn.onmouseover = null;
        activeBtn.onmouseout = null;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setEraserMode('all'));
} else {
    setEraserMode('all');
}

function getEraserThickness() {
    const input = document.getElementById('eraserThicknessInput');
    const val = input ? parseFloat(input.value) : 10;
    return (isNaN(val) || val <= 0 ? 10 : val) * 0.001;
}

function cancelEraser() {
    isDrawingEraser = false;
    eraserPoints = [];
}

function isConvexQuadPts(q) {
    function cross(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }
    let pos = 0, neg = 0;
    for (let i = 0; i < 4; i++) {
        let cr = cross(q[i], q[(i + 1) % 4], q[(i + 2) % 4]);
        if (cr > 1e-9) pos++; else if (cr < -1e-9) neg++; else return false;
    }
    return pos === 4 || neg === 4;
}

function cleanPolygonPts(points, tol = 2e-5) {
    if (!points || points.length < 3) return [];
    let pts = [];
    for (let p of points) {
        if (!pts.length || Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y) > 1e-6) {
            pts.push({ x: p.x, y: p.y });
        }
    }
    if (pts.length > 1 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) <= 1e-6) {
        pts.pop();
    }
    if (pts.length < 3) return [];

    let changed = true;
    let iter = 0;
    while (changed && pts.length >= 3 && iter++ < 10) {
        changed = false;
        const n = pts.length;
        const nextPts = [];
        for (let i = 0; i < n; i++) {
            const prev = pts[(i - 1 + n) % n];
            const curr = pts[i];
            const next = pts[(i + 1) % n];

            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq < 1e-12) {
                changed = true;
                continue;
            }
            const t = ((curr.x - prev.x) * dx + (curr.y - prev.y) * dy) / lenSq;
            if (t > 0 && t < 1) {
                const projX = prev.x + t * dx;
                const projY = prev.y + t * dy;
                if (Math.hypot(curr.x - projX, curr.y - projY) < tol) {
                    changed = true;
                    continue;
                }
            }
            nextPts.push(curr);
        }
        pts = nextPts;
    }
    return pts.length >= 3 ? pts : [];
}

function mergeTrianglesIntoQuads(triangles) {
    if (!triangles || !triangles.length) return [];

    function samePt(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
    }

    function tryMerge(t1, t2) {
        for (let i = 0; i < 3; i++) {
            const u = t1[i];
            const v = t1[(i + 1) % 3];
            const w1 = t1[(i + 2) % 3];
            if (t2.some(p => samePt(p, u)) && t2.some(p => samePt(p, v))) {
                const w2 = t2.find(p => !samePt(p, u) && !samePt(p, v));
                if (!w2) continue;
                const quad = [u, w1, v, w2];
                if (isConvexQuadPts(quad)) return quad;
            }
        }
        return null;
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

    const quads = [];
    const used = new Uint8Array(m);
    for (let i = 0; i < m; i++) {
        if (used[i]) continue;
        const j = match[i];
        if (j > i) {
            quads.push(quadPairs.get(i + ':' + j));
            used[i] = 1;
            used[j] = 1;
        } else if (j < 0) {
            const t = triangles[i];
            const crossVal = (t[1].x - t[0].x) * (t[2].y - t[0].y) - (t[1].y - t[0].y) * (t[2].x - t[0].x);
            if (Math.abs(crossVal) > 1e-10) {
                quads.push([t[0], t[1], t[2], t[2]]);
            }
            used[i] = 1;
        }
    }

    return quads;
}

function tryMergeQuads(q1, q2, SCALE, cleanDist) {
    const p1 = [q1[0], q1[1], q1[2]];
    if (Math.hypot(q1[2].x - q1[3].x, q1[2].y - q1[3].y) > 1e-6) p1.push(q1[3]);

    const p2 = [q2[0], q2[1], q2[2]];
    if (Math.hypot(q2[2].x - q2[3].x, q2[2].y - q2[3].y) > 1e-6) p2.push(q2[3]);

    const clpr = new ClipperLib.Clipper();
    clpr.AddPath(p1.map(p => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) })), ClipperLib.PolyType.ptSubject, true);
    clpr.AddPath(p2.map(p => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) })), ClipperLib.PolyType.ptClip, true);

    const sol = new ClipperLib.Paths();
    clpr.Execute(ClipperLib.ClipType.ctUnion, sol, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

    if (sol.length !== 1) return null;

    const cleaned = ClipperLib.Clipper.CleanPolygon(sol[0], cleanDist);
    let pts = cleaned.map(p => ({ x: p.X / SCALE, y: p.Y / SCALE }));
    pts = cleanPolygonPts(pts, cleanDist / SCALE);

    if (pts.length === 3) {
        return [pts[0], pts[1], pts[2], pts[2]];
    }
    if (pts.length === 4 && isConvexQuadPts(pts)) {
        return pts;
    }
    return null;
}

function optimizeQuadsList(quadsList, SCALE, cleanDist) {
    let list = [...quadsList];
    let merged = true;
    let passes = 0;
    while (merged && list.length > 1 && passes++ < 50) {
        merged = false;
        outer: for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const mq = tryMergeQuads(list[i], list[j], SCALE, cleanDist);
                if (mq) {
                    list[i] = mq;
                    list.splice(j, 1);
                    merged = true;
                    break outer;
                }
            }
        }
    }
    return list;
}

function decomposePolyTreeToQuads(polyTree, SCALE, cleanDist) {
    const quads = [];
    const earcutFn = (typeof earcut !== 'undefined' ? (earcut.default || earcut) : null);
    const tol = Math.max(1e-5, cleanDist / SCALE);

    function processNode(node) {
        if (!node.IsHole()) {
            const rawOuter = node.Contour();
            const cleanedOuterInt = cleanDist > 0 ? ClipperLib.Clipper.CleanPolygon(rawOuter, cleanDist) : rawOuter;
            const outer = cleanedOuterInt.map(p => ({ x: p.X / SCALE, y: p.Y / SCALE }));

            const holes = [];
            for (let i = 0; i < node.ChildCount(); i++) {
                const child = node.Childs()[i];
                if (child.IsHole()) {
                    const rawHole = child.Contour();
                    const cleanedHoleInt = cleanDist > 0 ? ClipperLib.Clipper.CleanPolygon(rawHole, cleanDist) : rawHole;
                    holes.push(cleanedHoleInt.map(p => ({ x: p.X / SCALE, y: p.Y / SCALE })));
                    for (let j = 0; j < child.ChildCount(); j++) {
                        processNode(child.Childs()[j]);
                    }
                }
            }

            const cleanOuter = cleanPolygonPts(outer, tol);
            if (cleanOuter.length < 3) return;

            if (holes.length === 0) {
                if (cleanOuter.length === 3) {
                    quads.push([cleanOuter[0], cleanOuter[1], cleanOuter[2], cleanOuter[2]]);
                    return;
                }
                if (cleanOuter.length === 4 && isConvexQuadPts(cleanOuter)) {
                    quads.push(cleanOuter);
                    return;
                }
            }

            if (earcutFn) {
                const vertices = [];
                const points = [];
                const holeIndices = [];

                for (const p of cleanOuter) {
                    points.push(p);
                    vertices.push(p.x, p.y);
                }

                let offset = cleanOuter.length;
                for (const h of holes) {
                    const cleanH = cleanPolygonPts(h, tol);
                    if (cleanH.length < 3) continue;
                    holeIndices.push(offset);
                    for (const p of cleanH) {
                        points.push(p);
                        vertices.push(p.x, p.y);
                    }
                    offset += cleanH.length;
                }

                try {
                    const indices = earcutFn(vertices, holeIndices.length > 0 ? holeIndices : null, 2);
                    const triangles = [];
                    for (let i = 0; i < indices.length; i += 3) {
                        triangles.push([points[indices[i]], points[indices[i + 1]], points[indices[i + 2]]]);
                    }
                    const nodeQuads = mergeTrianglesIntoQuads(triangles);
                    quads.push(...nodeQuads);
                    return;
                } catch (e) {
                    console.error('Eraser earcut error:', e);
                }
            }

            if (typeof generateFillQuads === 'function') {
                quads.push(...generateFillQuads(cleanOuter));
            }
        } else {
            for (let i = 0; i < node.ChildCount(); i++) {
                processNode(node.Childs()[i]);
            }
        }
    }

    for (let i = 0; i < polyTree.ChildCount(); i++) {
        processNode(polyTree.Childs()[i]);
    }

    return quads;
}

function finishEraser() {
    if (eraserPoints.length === 0) {
        cancelEraser();
        return;
    }

    if (typeof ClipperLib === 'undefined') {
        console.error('ClipperLib is not loaded');
        cancelEraser();
        return;
    }

    const thickness = getEraserThickness();
    const radius = thickness / 2;
    const SCALE = 1000000;
    const intRadius = Math.round(radius * SCALE);
    const cleanDist = Math.max(10, Math.min(40, Math.round(intRadius * 0.04)));

    let pts = eraserPoints;
    if (pts.length === 1) {
        pts = [pts[0], { x: pts[0].x + 1e-6, y: pts[0].y + 1e-6 }];
    } else if (pts.length > 2 && typeof simplifyRDP === 'function') {
        pts = simplifyRDP(pts, Math.max(1e-5, radius * 0.05));
        if (pts.length < 2) pts = eraserPoints;
    }

    const clipperStroke = pts.map(p => ({
        X: Math.round(p.x * SCALE),
        Y: Math.round(p.y * SCALE)
    }));

    const co = new ClipperLib.ClipperOffset();
    co.ArcTolerance = Math.max(1, Math.round(intRadius * 0.02));
    co.AddPath(clipperStroke, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);

    const rawEraserPolys = new ClipperLib.Paths();
    co.Execute(rawEraserPolys, intRadius);

    if (!rawEraserPolys || rawEraserPolys.length === 0) {
        cancelEraser();
        return;
    }

    const clprUnion = new ClipperLib.Clipper();
    clprUnion.AddPaths(rawEraserPolys, ClipperLib.PolyType.ptSubject, true);
    const eraserPolygons = new ClipperLib.Paths();
    clprUnion.Execute(ClipperLib.ClipType.ctUnion, eraserPolygons, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

    if (eraserPolygons.length === 0) {
        cancelEraser();
        return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let path of eraserPolygons) {
        for (let pt of path) {
            const x = pt.X / SCALE;
            const y = pt.Y / SCALE;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    const margin = 1e-5;
    minX -= margin; minY -= margin;
    maxX += margin; maxY += margin;

    const deletedObjects = [];
    const addedObjects = [];
    const allNewQuads = [];

    const objectsList = Array.from(objects.entries());

    for (const [id, obj] of objectsList) {
        if (!obj || !obj.type) continue;

        if (obj.type === 'line' && (eraserFilterMode === 'all' || eraserFilterMode === 'lines')) {
            const lMinX = Math.min(obj.start.x, obj.end.x);
            const lMaxX = Math.max(obj.start.x, obj.end.x);
            const lMinY = Math.min(obj.start.y, obj.end.y);
            const lMaxY = Math.max(obj.start.y, obj.end.y);

            if (lMaxX < minX || lMinX > maxX || lMaxY < minY || lMinY > maxY) {
                continue;
            }

            const cLine = new ClipperLib.Clipper();
            const clipperLine = [
                { X: Math.round(obj.start.x * SCALE), Y: Math.round(obj.start.y * SCALE) },
                { X: Math.round(obj.end.x * SCALE), Y: Math.round(obj.end.y * SCALE) }
            ];

            cLine.AddPath(clipperLine, ClipperLib.PolyType.ptSubject, false);
            cLine.AddPaths(eraserPolygons, ClipperLib.PolyType.ptClip, true);

            const polyTree = new ClipperLib.PolyTree();
            cLine.Execute(ClipperLib.ClipType.ctDifference, polyTree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
            const openPaths = ClipperLib.Clipper.OpenPathsFromPolyTree(polyTree);

            if (openPaths.length === 1 && openPaths[0].length >= 2) {
                const p0 = openPaths[0][0];
                const pEnd = openPaths[0][openPaths[0].length - 1];
                const x0 = p0.X / SCALE, y0 = p0.Y / SCALE;
                const x1 = pEnd.X / SCALE, y1 = pEnd.Y / SCALE;

                const directMatch = Math.hypot(x0 - obj.start.x, y0 - obj.start.y) < 1e-5 &&
                                    Math.hypot(x1 - obj.end.x, y1 - obj.end.y) < 1e-5;
                const reverseMatch = Math.hypot(x1 - obj.start.x, y1 - obj.start.y) < 1e-5 &&
                                      Math.hypot(x0 - obj.end.x, y0 - obj.end.y) < 1e-5;

                if (directMatch || reverseMatch) {
                    continue;
                }
            }

            deletedObjects.push({ id: id, object: obj });
            objects.delete(id);

            for (const path of openPaths) {
                if (path.length < 2) continue;
                const pStart = path[0];
                const pEnd = path[path.length - 1];
                const len = Math.hypot((pEnd.X - pStart.X) / SCALE, (pEnd.Y - pStart.Y) / SCALE);
                if (len < 0.0001) continue;

                const newId = nextId().toString();
                const newObj = {
                    name: (typeof lang !== 'undefined' && lang.line ? lang.line : "Line") + " " + newId,
                    type: "line",
                    start: { x: rnd(pStart.X / SCALE), y: rnd(pStart.Y / SCALE) },
                    end: { x: rnd(pEnd.X / SCALE), y: rnd(pEnd.Y / SCALE) },
                    selected: false
                };
                objects.set(newId, newObj);
                addedObjects.push({ id: newId, object: newObj });
            }
        } else if (obj.type === 'quad' && (eraserFilterMode === 'all' || eraserFilterMode === 'quads')) {
            const qMinX = Math.min(obj.pos1.x, obj.pos2.x, obj.pos3.x, obj.pos4.x);
            const qMaxX = Math.max(obj.pos1.x, obj.pos2.x, obj.pos3.x, obj.pos4.x);
            const qMinY = Math.min(obj.pos1.y, obj.pos2.y, obj.pos3.y, obj.pos4.y);
            const qMaxY = Math.max(obj.pos1.y, obj.pos2.y, obj.pos3.y, obj.pos4.y);

            if (qMaxX < minX || qMinX > maxX || qMaxY < minY || qMinY > maxY) {
                continue;
            }

            let quadPts = [obj.pos1, obj.pos2, obj.pos3, obj.pos4];
            if (Math.hypot(obj.pos3.x - obj.pos4.x, obj.pos3.y - obj.pos4.y) < 1e-6) {
                quadPts = [obj.pos1, obj.pos2, obj.pos3];
            }

            const clipperQuad = quadPts.map(p => ({
                X: Math.round(p.x * SCALE),
                Y: Math.round(p.y * SCALE)
            }));

            const cQuad = new ClipperLib.Clipper();
            cQuad.AddPath(clipperQuad, ClipperLib.PolyType.ptSubject, true);
            cQuad.AddPaths(eraserPolygons, ClipperLib.PolyType.ptClip, true);

            const polyTree = new ClipperLib.PolyTree();
            cQuad.Execute(ClipperLib.ClipType.ctDifference, polyTree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

            if (polyTree.ChildCount() === 1 && !polyTree.Childs()[0].IsHole() && polyTree.Childs()[0].ChildCount() === 0) {
                const contour = polyTree.Childs()[0].Contour();
                if (contour.length === quadPts.length) {
                    let allMatched = true;
                    for (let i = 0; i < contour.length; i++) {
                        const cx = contour[i].X / SCALE;
                        const cy = contour[i].Y / SCALE;
                        const matched = quadPts.some(qp => Math.hypot(qp.x - cx, qp.y - cy) < 1e-5);
                        if (!matched) {
                            allMatched = false;
                            break;
                        }
                    }
                    if (allMatched) {
                        continue;
                    }
                }
            }

            deletedObjects.push({ id: id, object: obj });
            objects.delete(id);

            const newQuads = decomposePolyTreeToQuads(polyTree, SCALE, cleanDist);
            allNewQuads.push(...newQuads);
        }
    }

    if (allNewQuads.length > 0) {
        const finalQuads = optimizeQuadsList(allNewQuads, SCALE, cleanDist);
        for (const q of finalQuads) {
            const newId = nextId().toString();
            const newObj = {
                name: (typeof lang !== 'undefined' && lang.quad ? lang.quad : "Quad") + " " + newId,
                type: "quad",
                pos1: { x: rnd(q[0].x), y: rnd(q[0].y) },
                pos2: { x: rnd(q[1].x), y: rnd(q[1].y) },
                pos3: { x: rnd(q[2].x), y: rnd(q[2].y) },
                pos4: { x: rnd(q[3].x), y: rnd(q[3].y) },
                selected: false
            };
            objects.set(newId, newObj);
            addedObjects.push({ id: newId, object: newObj });
        }
    }

    if (deletedObjects.length > 0 || addedObjects.length > 0) {
        pushEvent("replace_multiple", { added: addedObjects, deleted: deletedObjects });
        refreshObjectsList(true);
    }

    cancelEraser();
}
