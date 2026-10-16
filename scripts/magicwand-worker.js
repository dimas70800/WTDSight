self.importScripts('clipper.js');
self.importScripts('earcut.min.js');

const SCALE = 1000000;
const rndCoord = (v) => Math.round(v * 1000000) / 1000000;

function computeMagicWandRegions(lines, quads, clickPos) {
    if (typeof ClipperLib === 'undefined') throw new Error('clipper-not-found');
    const scale = 100000;
    const tolerance = 0.0005;
    const intTolerance = Math.round(tolerance * scale);

    let co = new ClipperLib.ClipperOffset();
    let coClosed = new ClipperLib.ClipperOffset();
    let hasObjects = false;

    for (const line of lines) {
        hasObjects = true;
        co.AddPath([
            { X: Math.round(line.start.x * scale), Y: Math.round(line.start.y * scale) },
            { X: Math.round(line.end.x * scale), Y: Math.round(line.end.y * scale) }
        ], ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etOpenSquare);
    }
    for (const quad of quads) {
        hasObjects = true;
        coClosed.AddPath([
            { X: Math.round(quad.pos1.x * scale), Y: Math.round(quad.pos1.y * scale) },
            { X: Math.round(quad.pos2.x * scale), Y: Math.round(quad.pos2.y * scale) },
            { X: Math.round(quad.pos3.x * scale), Y: Math.round(quad.pos3.y * scale) },
            { X: Math.round(quad.pos4.x * scale), Y: Math.round(quad.pos4.y * scale) }
        ], ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    }

    let allThickWalls = new ClipperLib.Paths();
    if (hasObjects) {
        let thickWalls = new ClipperLib.Paths(), thickWallsClosed = new ClipperLib.Paths();
        co.Execute(thickWalls, intTolerance);
        coClosed.Execute(thickWallsClosed, intTolerance);
        let clprCombine = new ClipperLib.Clipper();
        clprCombine.AddPaths(thickWalls, ClipperLib.PolyType.ptSubject, true);
        clprCombine.AddPaths(thickWallsClosed, ClipperLib.PolyType.ptSubject, true);
        clprCombine.Execute(ClipperLib.ClipType.ctUnion, allThickWalls, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    }

    const boxX = 9 * 0.1 * scale, boxY = 5 * 0.1 * scale;
    let clpr = new ClipperLib.Clipper();
    clpr.AddPaths([[{ X: -boxX, Y: -boxY }, { X: boxX, Y: -boxY }, { X: boxX, Y: boxY }, { X: -boxX, Y: boxY }]], ClipperLib.PolyType.ptSubject, true);
    if (allThickWalls.length > 0) clpr.AddPaths(allThickWalls, ClipperLib.PolyType.ptClip, true);

    let polyTree = new ClipperLib.PolyTree();
    clpr.Execute(ClipperLib.ClipType.ctDifference, polyTree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

    let clickPt = { X: Math.round(clickPos.x * scale), Y: Math.round(clickPos.y * scale) };
    const getChilds = (node) => typeof node.Childs === 'function' ? node.Childs() : (node.Childs || []);
    const getContour = (node) => typeof node.Contour === 'function' ? node.Contour() : (node.Contour || []);

    function findDeepestSpaceNode(node, pt, isSpace) {
        const childs = getChilds(node);
        for (let i = 0; i < childs.length; i++) {
            const contour = getContour(childs[i]);
            if (contour && contour.length > 0 && ClipperLib.Clipper.PointInPolygon(pt, contour) !== 0) {
                const found = findDeepestSpaceNode(childs[i], pt, !isSpace);
                if (found) return found;
            }
        }
        return (isSpace && getContour(node)?.length > 0) ? node : null;
    }

    let targetNode = null;
    for (const child of getChilds(polyTree)) {
        const contour = getContour(child);
        if (contour && contour.length > 0 && ClipperLib.Clipper.PointInPolygon(clickPt, contour) !== 0) {
            targetNode = findDeepestSpaceNode(child, clickPt, true);
            if (targetNode) break;
        }
    }
    if (!targetNode) return [];

    let roomPaths = new ClipperLib.Paths();
    roomPaths.push(getContour(targetNode));
    for (const ch of getChilds(targetNode)) {
        const c = getContour(ch);
        if (c && c.length > 0) roomPaths.push(c);
    }

    let coExpand = new ClipperLib.ClipperOffset();
    coExpand.AddPaths(roomPaths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    let expandedTree = new ClipperLib.PolyTree();
    coExpand.Execute(expandedTree, intTolerance);
    const expChilds = getChilds(expandedTree);
    if (!expChilds.length) return [];

    let finalNode = expChilds[0];
    let finalContour = getContour(finalNode);
    if (finalContour && finalContour.length > 2) {
        let cleaned = ClipperLib.Clipper.CleanPolygon(finalContour, 1.415);
        if (cleaned && cleaned.length >= 3) finalContour = cleaned;
    }

    function toSightPoints(clipperPath) {
        const pts = [];
        for (let i = 0; i < clipperPath.length; i++) {
            const pt = { x: clipperPath[i].X / scale, y: clipperPath[i].Y / scale };
            if (!pts.length || Math.hypot(pt.x - pts[pts.length - 1].x, pt.y - pts[pts.length - 1].y) >= 0.00001) pts.push(pt);
        }
        if (pts.length > 1 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.00001) pts.pop();
        return pts;
    }

    const newRegions = [toSightPoints(finalContour)];
    for (const ch of getChilds(finalNode)) {
        let hc = getContour(ch);
        if (hc && hc.length >= 3) {
            const cln = ClipperLib.Clipper.CleanPolygon(hc, 1.415);
            newRegions.push(toSightPoints(cln && cln.length >= 3 ? cln : hc));
        }
    }
    return newRegions;
}

function tryMergeCollinearLines(s1, s2, distTol = 0.00002, angleTol = 0.001, gapTol = 0.0001) {
    const v1x = s1.p2.x - s1.p1.x, v1y = s1.p2.y - s1.p1.y, L1 = Math.hypot(v1x, v1y);
    if (L1 < 1e-5) return null;
    const u1x = v1x / L1, u1y = v1y / L1, n1x = -u1y, n1y = u1x;
    const c1 = s1.p1.x * n1x + s1.p1.y * n1y;

    const v2x = s2.p2.x - s2.p1.x, v2y = s2.p2.y - s2.p1.y, L2 = Math.hypot(v2x, v2y);
    if (L2 < 1e-5) return null;
    const u2x = v2x / L2, u2y = v2y / L2;
    if (Math.abs(Math.abs(u1x * u2x + u1y * u2y) - 1) > angleTol) return null;

    if (Math.abs(s2.p1.x * n1x + s2.p1.y * n1y - c1) > distTol ||
        Math.abs(s2.p2.x * n1x + s2.p2.y * n1y - c1) > distTol) return null;

    const tA2 = (s2.p1.x - s1.p1.x) * u1x + (s2.p1.y - s1.p1.y) * u1y;
    const tB2 = (s2.p2.x - s1.p1.x) * u1x + (s2.p2.y - s1.p1.y) * u1y;
    const t2min = Math.min(tA2, tB2), t2max = Math.max(tA2, tB2);
    if (Math.max(0, t2min) > Math.min(L1, t2max) + gapTol) return null;

    const tMin = Math.min(0, t2min), tMax = Math.max(L1, t2max);
    return {
        p1: { x: rndCoord(s1.p1.x + tMin * u1x), y: rndCoord(s1.p1.y + tMin * u1y) },
        p2: { x: rndCoord(s1.p1.x + tMax * u1x), y: rndCoord(s1.p1.y + tMax * u1y) },
        origOrder: Math.min(s1.origOrder ?? Infinity, s2.origOrder ?? Infinity)
    };
}

function mergeCollinearSegments(list) {
    if (list.length <= 1) return list;
    let mergedAny = true;
    let current = list.slice();

    while (mergedAny) {
        mergedAny = false;
        current.sort((a, b) => Math.min(a.p1.x, a.p2.x) - Math.min(b.p1.x, b.p2.x));
        const next = [];
        const used = new Uint8Array(current.length);

        for (let i = 0; i < current.length; i++) {
            if (used[i]) continue;
            let cur = current[i];
            const m = 0.001;
            let x0 = Math.min(cur.p1.x, cur.p2.x) - m, x1 = Math.max(cur.p1.x, cur.p2.x) + m;
            let y0 = Math.min(cur.p1.y, cur.p2.y) - m, y1 = Math.max(cur.p1.y, cur.p2.y) + m;

            for (let j = i + 1; j < current.length; j++) {
                if (used[j]) continue;
                const minX2 = Math.min(current[j].p1.x, current[j].p2.x);
                if (minX2 > x1) break;
                const maxX2 = Math.max(current[j].p1.x, current[j].p2.x);
                const minY2 = Math.min(current[j].p1.y, current[j].p2.y);
                const maxY2 = Math.max(current[j].p1.y, current[j].p2.y);
                if (x0 > maxX2 || y0 > maxY2 || y1 < minY2) continue;

                const res = tryMergeCollinearLines(cur, current[j]);
                if (res) {
                    cur = res;
                    used[j] = 1;
                    mergedAny = true;
                    x0 = Math.min(cur.p1.x, cur.p2.x) - m;
                    x1 = Math.max(cur.p1.x, cur.p2.x) + m;
                    y0 = Math.min(cur.p1.y, cur.p2.y) - m;
                    y1 = Math.max(cur.p1.y, cur.p2.y) + m;
                }
            }
            next.push(cur);
        }
        current = next;
    }
    return current;
}

function distPointToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    if (l2 < 1e-10) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function rdp(pts, eps) {
    if (pts.length <= 2) return pts;
    let dmax = 0, idx = 0;
    const ax = pts[0].x, ay = pts[0].y, bx = pts[pts.length - 1].x, by = pts[pts.length - 1].y;
    const len = Math.hypot(bx - ax, by - ay);
    for (let i = 1; i < pts.length - 1; i++) {
        const d = len < 1e-9 ? Math.hypot(pts[i].x - ax, pts[i].y - ay) :
            Math.abs((pts[i].x - ax) * (by - ay) - (pts[i].y - ay) * (bx - ax)) / len;
        if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax > eps) {
        const r1 = rdp(pts.slice(0, idx + 1), eps);
        const r2 = rdp(pts.slice(idx), eps);
        return r1.slice(0, -1).concat(r2);
    }
    return [pts[0], pts[pts.length - 1]];
}

function simplifyCurvesSafely(segments) {
    if (segments.length <= 1) return segments;
    const EPS = 0.00002, cs = 0.01;
    const grid = new Map(), nodes = [];

    function getNode(pt) {
        const gx = Math.floor(pt.x / cs), gy = Math.floor(pt.y / cs);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const c = grid.get(`${gx + dx},${gy + dy}`);
                if (c) {
                    for (const id of c) {
                        if (Math.hypot(nodes[id].x - pt.x, nodes[id].y - pt.y) <= EPS) return id;
                    }
                }
            }
        }
        const id = nodes.length;
        nodes.push({ x: pt.x, y: pt.y, edges: [] });
        const k = `${gx},${gy}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(id);
        return id;
    }

    for (let i = 0; i < segments.length; i++) {
        const s = segments[i], u = getNode(s.p1), v = getNode(s.p2);
        if (u === v) continue;
        nodes[u].edges.push({ segIdx: i, other: v });
        nodes[v].edges.push({ segIdx: i, other: u });
    }

    const segAbutting = new Uint8Array(segments.length);
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i], conn = new Set(n.edges.map(e => e.segIdx));
        for (let sIdx = 0; sIdx < segments.length; sIdx++) {
            if (conn.has(sIdx)) continue;
            const s = segments[sIdx];
            if (distPointToSegment(n.x, n.y, s.p1.x, s.p1.y, s.p2.x, s.p2.y) <= 0.0001) segAbutting[sIdx] = 1;
        }
    }

    const isAnchor = new Uint8Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.edges.length !== 2 || segAbutting[n.edges[0].segIdx] || segAbutting[n.edges[1].segIdx]) {
            isAnchor[i] = 1;
            continue;
        }
        const p1 = nodes[n.edges[0].other], p2 = nodes[n.edges[1].other];
        const v1x = n.x - p1.x, v1y = n.y - p1.y, v2x = p2.x - n.x, v2y = p2.y - n.y;
        const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
        if (l1 < 1e-6 || l2 < 1e-6 || Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2)))) >= 45 * Math.PI / 180) {
            isAnchor[i] = 1;
        }
    }

    const visited = new Uint8Array(segments.length), out = [];
    for (let i = 0; i < nodes.length; i++) {
        if (!isAnchor[i]) continue;
        for (const e of nodes[i].edges) {
            if (visited[e.segIdx]) continue;
            const path = [{ x: nodes[i].x, y: nodes[i].y }];
            let cur = e, minOrd = Infinity;
            while (cur) {
                visited[cur.segIdx] = 1;
                if (segments[cur.segIdx].origOrder !== undefined) minOrd = Math.min(minOrd, segments[cur.segIdx].origOrder);
                const nxt = nodes[cur.other];
                path.push({ x: nxt.x, y: nxt.y });
                if (isAnchor[cur.other]) break;
                cur = nxt.edges.find(ed => ed.segIdx !== cur.segIdx && !visited[ed.segIdx]);
            }
            const simp = rdp(path, 0.0006);
            for (let k = 0; k < simp.length - 1; k++) {
                if (Math.hypot(simp[k + 1].x - simp[k].x, simp[k + 1].y - simp[k].y) > 1e-5) out.push({ p1: simp[k], p2: simp[k + 1], origOrder: minOrd !== Infinity ? minOrd : undefined });
            }
        }
    }

    for (let i = 0; i < segments.length; i++) {
        if (visited[i]) continue;
        const startId = getNode(segments[i].p1);
        const path = [{ x: nodes[startId].x, y: nodes[startId].y }];
        let curId = startId, cur = nodes[startId].edges.find(e => e.segIdx === i), minOrdLoop = Infinity;
        while (cur) {
            visited[cur.segIdx] = 1;
            if (segments[cur.segIdx].origOrder !== undefined) minOrdLoop = Math.min(minOrdLoop, segments[cur.segIdx].origOrder);
            curId = cur.other;
            path.push({ x: nodes[curId].x, y: nodes[curId].y });
            if (curId === startId) break;
            cur = nodes[curId].edges.find(e => e.segIdx !== cur.segIdx && !visited[e.segIdx]);
        }
        const mid = Math.floor(path.length / 2);
        const simp = rdp(path.slice(0, mid + 1), 0.0006).slice(0, -1).concat(rdp(path.slice(mid), 0.0006));
        for (let k = 0; k < simp.length - 1; k++) {
            if (Math.hypot(simp[k + 1].x - simp[k].x, simp[k + 1].y - simp[k].y) > 1e-5) out.push({ p1: simp[k], p2: simp[k + 1], origOrder: minOrdLoop !== Infinity ? minOrdLoop : undefined });
        }
    }
    return out;
}

function optimizeLinesLayer(lineList) {
    if (!lineList?.length) return [];
    let segments = [];
    for (const l of lineList) {
        if (l.start && l.end && Math.hypot(l.end.x - l.start.x, l.end.y - l.start.y) >= 1e-5) {
            segments.push({ p1: { x: l.start.x, y: l.start.y }, p2: { x: l.end.x, y: l.end.y }, origOrder: l.origOrder });
        }
    }
    if (!segments.length) return [];
    segments = mergeCollinearSegments(simplifyCurvesSafely(mergeCollinearSegments(segments)));
    segments.sort((a, b) => (a.origOrder ?? 0) - (b.origOrder ?? 0));
    return segments;
}

const quadCross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

function isConvexQuad(p) {
    if (p.length !== 4) return false;
    let s = 0;
    for (let i = 0; i < 4; i++) {
        const cr = quadCross(p[i], p[(i + 1) % 4], p[(i + 2) % 4]);
        if (Math.abs(cr) < 1e-9) continue;
        if (!s) s = cr > 0 ? 1 : -1;
        else if ((cr > 0 ? 1 : -1) !== s) return false;
    }
    return s !== 0;
}

function calcPolygonArea(p) {
    let a = 0;
    for (let i = 0, n = p.length; i < n; i++) a += p[i].x * p[(i + 1) % n].y - p[(i + 1) % n].x * p[i].y;
    return Math.abs(a) / 2;
}

function computeAABB(pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
}

class SpatialGrid {
    constructor(cs = 0.01) {
        this.cs = cs;
        this.grid = new Map();
        this.boxes = new Map();
    }
    insert(id, b) {
        this.boxes.set(id, b);
        const x0 = Math.floor(b.minX / this.cs), x1 = Math.floor(b.maxX / this.cs);
        const y0 = Math.floor(b.minY / this.cs), y1 = Math.floor(b.maxY / this.cs);
        for (let x = x0; x <= x1; x++) {
            for (let y = y0; y <= y1; y++) {
                const k = `${x},${y}`;
                let c = this.grid.get(k);
                if (!c) { c = new Set(); this.grid.set(k, c); }
                c.add(id);
            }
        }
    }
    remove(id, b) {
        b = b || this.boxes.get(id);
        if (!b) return;
        this.boxes.delete(id);
        const x0 = Math.floor(b.minX / this.cs), x1 = Math.floor(b.maxX / this.cs);
        const y0 = Math.floor(b.minY / this.cs), y1 = Math.floor(b.maxY / this.cs);
        for (let x = x0; x <= x1; x++) {
            for (let y = y0; y <= y1; y++) {
                const k = `${x},${y}`, c = this.grid.get(k);
                if (c) { c.delete(id); if (!c.size) this.grid.delete(k); }
            }
        }
    }
    query(b) {
        const x0 = Math.floor(b.minX / this.cs), x1 = Math.floor(b.maxX / this.cs);
        const y0 = Math.floor(b.minY / this.cs), y1 = Math.floor(b.maxY / this.cs);
        const res = new Set();
        for (let x = x0; x <= x1; x++) {
            for (let y = y0; y <= y1; y++) {
                const c = this.grid.get(`${x},${y}`);
                if (c) for (const id of c) res.add(id);
            }
        }
        return res;
    }
}

function normalizeQuad(pts) {
    if (!pts || pts.length < 3) return null;
    let p = pts.slice(0, 4);
    if (p.length === 3) p.push({ x: p[2].x, y: p[2].y });
    let sa = 0;
    for (let i = 0; i < 4; i++) sa += p[i].x * p[(i + 1) % 4].y - p[(i + 1) % 4].x * p[i].y;
    if (sa < 0) p.reverse();
    let tl = 0, minV = p[0].y * 1e6 + p[0].x;
    for (let i = 1; i < 4; i++) {
        const v = p[i].y * 1e6 + p[i].x;
        if (v < minV) { minV = v; tl = i; }
    }
    return {
        pos1: { x: rndCoord(p[tl].x), y: rndCoord(p[tl].y) },
        pos2: { x: rndCoord(p[(tl + 1) % 4].x), y: rndCoord(p[(tl + 1) % 4].y) },
        pos3: { x: rndCoord(p[(tl + 2) % 4].x), y: rndCoord(p[(tl + 2) % 4].y) },
        pos4: { x: rndCoord(p[(tl + 3) % 4].x), y: rndCoord(p[(tl + 3) % 4].y) }
    };
}

function cleanContour(pts) {
    if (!pts || pts.length < 3) return pts;
    let clean = [];
    for (const p of pts) {
        if (!clean.length || Math.hypot(p.x - clean[clean.length - 1].x, p.y - clean[clean.length - 1].y) > 1e-6) {
            clean.push({ x: p.x, y: p.y });
        }
    }
    if (clean.length > 1 && Math.hypot(clean[0].x - clean[clean.length - 1].x, clean[0].y - clean[clean.length - 1].y) <= 1e-6) clean.pop();
    if (clean.length < 3) return clean;

    let changed = true, iter = 0;
    while (changed && clean.length > 3 && iter++ < 10) {
        changed = false;
        const n = clean.length, res = [];
        for (let i = 0; i < n; i++) {
            const prev = clean[(i - 1 + n) % n], curr = clean[i], next = clean[(i + 1) % n];
            const v1x = curr.x - prev.x, v1y = curr.y - prev.y, v2x = next.x - curr.x, v2y = next.y - curr.y;
            const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
            if (l1 < 1e-6 || l2 < 1e-6) { changed = true; continue; }
            if ((v1x * v2x + v1y * v2y) > 0 && Math.abs(v1x * v2y - v1y * v2x) / (l1 * l2) < 1e-4) {
                changed = true;
                continue;
            }
            res.push(curr);
        }
        clean = res;
    }
    return clean;
}

function tryMergeAdjacentQuads(q1, q2, a1, a2) {
    if (typeof ClipperLib === 'undefined') return null;
    if (!a1) a1 = computeAABB(q1);
    if (!a2) a2 = computeAABB(q2);
    const eps = 0.0001;
    if (a1.minX > a2.maxX + eps || a1.maxX < a2.minX - eps || a1.minY > a2.maxY + eps || a1.maxY < a2.minY - eps) return null;

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

    const unionArea = Math.abs(ClipperLib.Clipper.Area(sol[0])) / (SCALE * SCALE);
    const cleaned = ClipperLib.Clipper.CleanPolygon(sol[0], 1.415);
    const pts = cleanContour(cleaned.map(p => ({ x: p.X / SCALE, y: p.Y / SCALE })));

    let cand = null;
    if (pts.length === 3) cand = [pts[0], pts[1], pts[2], pts[2]];
    else if (pts.length === 4 && isConvexQuad(pts)) cand = pts;

    return (cand && Math.abs(calcPolygonArea(cand) - unionArea) <= 1e-7) ? cand : null;
}

function isPolygonConvex(p) {
    if (p.length < 3) return false;
    let s = 0;
    for (let i = 0, n = p.length; i < n; i++) {
        const cr = quadCross(p[i], p[(i + 1) % n], p[(i + 2) % n]);
        if (Math.abs(cr) < 1e-9) continue;
        if (!s) s = cr > 0 ? 1 : -1;
        else if ((cr > 0 ? 1 : -1) !== s) return false;
    }
    return true;
}

function quadrangulateConvex(p) {
    const n = p.length;
    if (n < 3) return [];
    if (n === 3) return [[p[0], p[1], p[2], p[2]]];
    if (n === 4 && isConvexQuad(p)) return [p];

    let w = [...p], a = 0;
    for (let i = 0; i < n; i++) a += w[i].x * w[(i + 1) % n].y - w[(i + 1) % n].x * w[i].y;
    if (a < 0) w.reverse();

    const quads = [];
    let i = 0, last = n - 1;
    while (last - i >= 3) {
        quads.push([w[i], w[i + 1], w[i + 2], w[last]]);
        if (last - i === 3) break;
        i += 2;
    }
    if (last - i === 2) quads.push([w[i], w[i + 1], w[last], w[last]]);
    return quads;
}

function decomposePolygonToQuads(outerPts, holesPts = []) {
    outerPts = cleanContour(outerPts);
    if (!outerPts || outerPts.length < 3) return [];

    const cleanedHoles = [];
    if (holesPts) {
        for (const h of holesPts) {
            const ch = cleanContour(h);
            if (ch.length >= 3) cleanedHoles.push(ch);
        }
    }
    if (!cleanedHoles.length && isPolygonConvex(outerPts)) return quadrangulateConvex(outerPts);

    const earcutFn = typeof self.earcut === 'function' ? self.earcut : (self.earcut?.default || null);
    if (!earcutFn) return [];

    const flat = [], holeIndices = [];
    for (const p of outerPts) flat.push(p.x, p.y);
    for (const h of cleanedHoles) {
        holeIndices.push(flat.length / 2);
        for (const p of h) flat.push(p.x, p.y);
    }
    const allPts = [];
    for (let i = 0; i < flat.length; i += 2) allPts.push({ x: flat[i], y: flat[i + 1] });
    const indices = earcutFn(flat, holeIndices.length ? holeIndices : null, 2);
    if (!indices?.length) return [];

    const refineFn = self.earcut?.refine || earcutFn.refine;
    if (refineFn) refineFn(indices, flat, 2);

    const triangles = [];
    for (let i = 0; i < indices.length; i += 3) {
        triangles.push([allPts[indices[i]], allPts[indices[i + 1]], allPts[indices[i + 2]]]);
    }

    const m = triangles.length, edgeMap = new Map(), adj = Array.from({ length: m }, () => []), quadPairs = new Map();
    const samePt = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;

    for (let i = 0; i < m; i++) {
        const t = triangles[i];
        for (let e = 0; e < 3; e++) {
            const p1 = t[e], p2 = t[(e + 1) % 3], pO = t[(e + 2) % 3];
            const k1 = Math.round(p1.x * 1e6) + ',' + Math.round(p1.y * 1e6);
            const k2 = Math.round(p2.x * 1e6) + ',' + Math.round(p2.y * 1e6);
            const key = k1 < k2 ? (k1 + ':' + k2) : (k2 + ':' + k1);

            if (edgeMap.has(key)) {
                const j = edgeMap.get(key), ot = triangles[j];
                const pOther = ot.find(p => !samePt(p, p1) && !samePt(p, p2));
                if (pOther) {
                    const q = [pO, p2, pOther, p1];
                    if (isConvexQuad(q) && Math.abs(calcPolygonArea(q) - (calcPolygonArea(t) + calcPolygonArea(ot))) < 1e-8) {
                        adj[i].push(j);
                        adj[j].push(i);
                        quadPairs.set(Math.min(i, j) + ':' + Math.max(i, j), q);
                    }
                }
            } else edgeMap.set(key, i);
        }
    }

    const match = new Int32Array(m).fill(-1), vis = new Uint8Array(m);
    function dfs(u) {
        for (const v of adj[u]) {
            if (vis[v]) continue;
            vis[v] = 1;
            if (match[v] < 0 || dfs(match[v])) { match[v] = u; match[u] = v; return true; }
        }
        return false;
    }
    for (let u = 0; u < m; u++) { if (match[u] < 0) { for (const v of adj[u]) { if (match[v] < 0) { match[u] = v; match[v] = u; break; } } } }
    for (let u = 0; u < m; u++) { if (match[u] < 0) { vis.fill(0); dfs(u); } }

    const quads = [], used = new Uint8Array(m);
    for (let i = 0; i < m; i++) {
        if (used[i]) continue;
        const j = match[i];
        if (j >= 0) {
            quads.push(quadPairs.get(Math.min(i, j) + ':' + Math.max(i, j)));
            used[i] = used[j] = 1;
        } else {
            const t = triangles[i];
            if (calcPolygonArea(t) > 1e-9) quads.push([t[0], t[1], t[2], t[2]]);
            used[i] = 1;
        }
    }
    return quads;
}

function processPolyNode(node, outQuads) {
    const rawOuter = ClipperLib.Clipper.CleanPolygon(node.Contour(), 1.415).map(p => ({ x: p.X / SCALE, y: p.Y / SCALE }));
    const holes = [], islands = [];
    for (const ch of node.Childs()) {
        const rawHole = ClipperLib.Clipper.CleanPolygon(ch.Contour(), 1.415).map(p => ({ x: p.X / SCALE, y: p.Y / SCALE }));
        if (rawHole.length >= 3) holes.push(rawHole);
        for (const isl of ch.Childs()) islands.push(isl);
    }
    for (const q of decomposePolygonToQuads(rawOuter, holes)) outQuads.push(q);
    for (const isl of islands) processPolyNode(isl, outQuads);
}

class DSU {
    constructor(n) { this.p = Array.from({ length: n }, (_, i) => i); }
    find(i) { return this.p[i] === i ? i : (this.p[i] = this.find(this.p[i])); }
    union(i, j) { const a = this.find(i), b = this.find(j); if (a !== b) this.p[a] = b; }
}

function quadToClipper(q) {
    const raw = [q.pos1, q.pos2, q.pos3];
    if (Math.hypot(q.pos3.x - q.pos4.x, q.pos3.y - q.pos4.y) > 1e-6 &&
        Math.hypot(q.pos1.x - q.pos4.x, q.pos1.y - q.pos4.y) > 1e-6) raw.push(q.pos4);
    const path = raw.map(p => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) }));
    const clean = [];
    for (const p of path) {
        if (!clean.length || clean[clean.length - 1].X !== p.X || clean[clean.length - 1].Y !== p.Y) clean.push(p);
    }
    if (clean.length > 1 && clean[0].X === clean[clean.length - 1].X && clean[0].Y === clean[clean.length - 1].Y) clean.pop();
    if (clean.length >= 3 && !ClipperLib.Clipper.Orientation(clean)) clean.reverse();
    return clean;
}

function optimizeQuadsLayer(quadList) {
    if (!quadList?.length) return [];
    const valid = [];
    for (let i = 0; i < quadList.length; i++) {
        const q = quadList[i];
        if (q.pos1 && q.pos2 && q.pos3 && q.pos4 && calcPolygonArea([q.pos1, q.pos2, q.pos3, q.pos4]) > 1e-9) {
            valid.push({ ...q, origOrder: q.origOrder !== undefined ? q.origOrder : i });
        }
    }
    if (!valid.length) return [];

    const unique = [], signatures = new Map();
    for (const q of valid) {
        const key = [q.pos1, q.pos2, q.pos3, q.pos4].map(p => `${rndCoord(p.x)},${rndCoord(p.y)}`).sort().join('|');
        if (!signatures.has(key)) {
            signatures.set(key, q);
            unique.push(q);
        } else {
            const exist = signatures.get(key);
            if (q.origOrder !== undefined && (exist.origOrder === undefined || q.origOrder < exist.origOrder)) {
                exist.origOrder = q.origOrder;
            }
        }
    }
    if (unique.length <= 1 || typeof ClipperLib === 'undefined') {
        const single = unique.map(q => {
            const nq = normalizeQuad([q.pos1, q.pos2, q.pos3, q.pos4]);
            if (nq) nq.origOrder = q.origOrder;
            return nq;
        }).filter(Boolean);
        single.sort((a, b) => (a.origOrder ?? 0) - (b.origOrder ?? 0));
        return single;
    }

    const items = unique.map((q, idx) => ({ id: idx, q, origOrder: q.origOrder, path: quadToClipper(q), aabb: computeAABB([q.pos1, q.pos2, q.pos3, q.pos4]) }));
    let avgW = 0, avgH = 0;
    for (const item of items) { avgW += item.aabb.maxX - item.aabb.minX; avgH += item.aabb.maxY - item.aabb.minY; }
    const cellSize = Math.max((avgW + avgH) / (items.length || 1) * 2, 0.001);

    const grid = new SpatialGrid(cellSize);
    for (let i = 0; i < items.length; i++) grid.insert(i, items[i].aabb);

    const dsu = new DSU(items.length), epsTouch = 0.0001;
    for (let i = 0; i < items.length; i++) {
        const box = items[i].aabb;
        const cand = grid.query({ minX: box.minX - epsTouch, maxX: box.maxX + epsTouch, minY: box.minY - epsTouch, maxY: box.maxY + epsTouch });
        for (const j of cand) {
            if (j > i) {
                const b2 = items[j].aabb;
                if (box.minX <= b2.maxX + epsTouch && box.maxX >= b2.minX - epsTouch &&
                    box.minY <= b2.maxY + epsTouch && box.maxY >= b2.minY - epsTouch) dsu.union(i, j);
            }
        }
    }

    const clusterMap = new Map();
    for (let i = 0; i < items.length; i++) {
        const root = dsu.find(i);
        if (!clusterMap.has(root)) clusterMap.set(root, []);
        clusterMap.get(root).push(items[i]);
    }

    let quadsAfterClusters = [];
    for (const [, cluster] of clusterMap) {
        const clusterMinOrder = Math.min(...cluster.map(it => it.origOrder ?? 0));
        if (cluster.length <= 1) {
            const q = cluster[0].q;
            quadsAfterClusters.push({ pts: [{ x: q.pos1.x, y: q.pos1.y }, { x: q.pos2.x, y: q.pos2.y }, { x: q.pos3.x, y: q.pos3.y }, { x: q.pos4.x, y: q.pos4.y }], origOrder: cluster[0].origOrder ?? clusterMinOrder });
            continue;
        }

        const clprUnion = new ClipperLib.Clipper();
        for (const item of cluster) clprUnion.AddPath(item.path, ClipperLib.PolyType.ptSubject, true);
        const solTree = new ClipperLib.PolyTree();
        clprUnion.Execute(ClipperLib.ClipType.ctUnion, solTree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

        const rebuilt = [];
        for (const child of solTree.Childs()) processPolyNode(child, rebuilt);

        if (rebuilt.length < cluster.length && rebuilt.length > 0) {
            const clprDiff = new ClipperLib.Clipper();
            for (const item of cluster) clprDiff.AddPath(item.path, ClipperLib.PolyType.ptSubject, true);
            for (const q of rebuilt) clprDiff.AddPath(q.map(p => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) })), ClipperLib.PolyType.ptClip, true);
            const solDiff = new ClipperLib.Paths();
            clprDiff.Execute(ClipperLib.ClipType.ctDifference, solDiff, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
            let holesArea = 0;
            for (const p of solDiff) holesArea += Math.abs(ClipperLib.Clipper.Area(p)) / (SCALE * SCALE);

            if (holesArea <= 1e-7) {
                const clprDiff2 = new ClipperLib.Clipper();
                for (const q of rebuilt) clprDiff2.AddPath(q.map(p => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) })), ClipperLib.PolyType.ptSubject, true);
                for (const item of cluster) clprDiff2.AddPath(item.path, ClipperLib.PolyType.ptClip, true);
                const solDiff2 = new ClipperLib.Paths();
                clprDiff2.Execute(ClipperLib.ClipType.ctDifference, solDiff2, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
                let overflowArea = 0;
                for (const p of solDiff2) overflowArea += Math.abs(ClipperLib.Clipper.Area(p)) / (SCALE * SCALE);

                if (overflowArea <= 1e-7) {
                    for (let qi = 0; qi < rebuilt.length; qi++) {
                        quadsAfterClusters.push({ pts: rebuilt[qi], origOrder: clusterMinOrder + qi * 0.0001 });
                    }
                    continue;
                }
            }
        }

        for (const item of cluster) {
            const q = item.q;
            quadsAfterClusters.push({ pts: [{ x: q.pos1.x, y: q.pos1.y }, { x: q.pos2.x, y: q.pos2.y }, { x: q.pos3.x, y: q.pos3.y }, { x: q.pos4.x, y: q.pos4.y }], origOrder: item.origOrder ?? clusterMinOrder });
        }
    }

    const gridMerge = new SpatialGrid(cellSize);
    const activeQuads = new Map();
    const queue = [];

    for (let i = 0; i < quadsAfterClusters.length; i++) {
        const item = quadsAfterClusters[i], pts = item.pts, aabb = computeAABB(pts);
        activeQuads.set(i, { pts, aabb, origOrder: item.origOrder });
        gridMerge.insert(i, aabb);
        queue.push(i);
    }

    while (queue.length > 0) {
        const id = queue.shift();
        const cur = activeQuads.get(id);
        if (!cur) continue;

        for (const otherId of gridMerge.query(cur.aabb)) {
            if (otherId === id) continue;
            const other = activeQuads.get(otherId);
            if (!other) continue;

            const mq = tryMergeAdjacentQuads(cur.pts, other.pts, cur.aabb, other.aabb);
            if (mq) {
                gridMerge.remove(otherId, other.aabb);
                activeQuads.delete(otherId);
                gridMerge.remove(id, cur.aabb);
                cur.pts = mq;
                cur.origOrder = Math.min(cur.origOrder ?? 0, other.origOrder ?? 0);
                cur.aabb = computeAABB(mq);
                gridMerge.insert(id, cur.aabb);
                queue.push(id);
                break;
            }
        }
    }

    const finalQuads = [];
    for (const [, item] of activeQuads) {
        const nq = normalizeQuad(item.pts);
        if (nq) {
            nq.origOrder = item.origOrder;
            finalQuads.push(nq);
        }
    }
    finalQuads.sort((a, b) => (a.origOrder ?? 0) - (b.origOrder ?? 0));
    return finalQuads;
}

self.onmessage = function (e) {
    const data = e.data || {};

    if (data.type === 'optimize') {
        const layers = data.layers || [];
        const results = [];

        try {
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                const optimizedQuads = optimizeQuadsLayer(layer.quads);
                const optimizedLines = optimizeLinesLayer(layer.lines);

                results.push({
                    layerId: layer.layerId,
                    originalIds: layer.originalIds,
                    optimizedQuads: optimizedQuads,
                    optimizedLines: optimizedLines
                });

                self.postMessage({
                    type: 'progress',
                    current: i + 1,
                    total: layers.length
                });
            }

            self.postMessage({
                type: 'done',
                results: results
            });
        } catch (err) {
            self.postMessage({
                type: 'error',
                message: err && err.message ? err.message : String(err)
            });
        }
        return;
    }

    const requestId = data.requestId;
    try {
        const regions = computeMagicWandRegions(data.lines || [], data.quads || [], data.clickPos);
        self.postMessage({ requestId: requestId, regions: regions });
    } catch (err) {
        self.postMessage({ requestId: requestId, error: (err && err.message) || String(err) });
    }
};
