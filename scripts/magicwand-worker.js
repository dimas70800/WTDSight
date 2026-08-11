
importScripts('clipper.js');

function computeMagicWandRegions(lines, quads, clickPos) {
    if (typeof ClipperLib === 'undefined') {
        throw new Error('clipper-not-found');
    }

    const scale = 100000;
    const tolerance = 0.0005;
    const intTolerance = Math.round(tolerance * scale);

    let co = new ClipperLib.ClipperOffset();
    let coClosed = new ClipperLib.ClipperOffset();

    let hasObjects = false;

    for (const line of lines) {
        hasObjects = true;
        let path = [
            { X: Math.round(line.start.x * scale), Y: Math.round(line.start.y * scale) },
            { X: Math.round(line.end.x * scale), Y: Math.round(line.end.y * scale) }
        ];
        co.AddPath(path, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etOpenSquare);
    }

    for (const quad of quads) {
        hasObjects = true;
        let path = [
            { X: Math.round(quad.pos1.x * scale), Y: Math.round(quad.pos1.y * scale) },
            { X: Math.round(quad.pos2.x * scale), Y: Math.round(quad.pos2.y * scale) },
            { X: Math.round(quad.pos3.x * scale), Y: Math.round(quad.pos3.y * scale) },
            { X: Math.round(quad.pos4.x * scale), Y: Math.round(quad.pos4.y * scale) }
        ];
        coClosed.AddPath(path, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    }

    let allThickWalls = new ClipperLib.Paths();
    if (hasObjects) {
        let thickWalls = new ClipperLib.Paths();
        co.Execute(thickWalls, intTolerance);
        let thickWallsClosed = new ClipperLib.Paths();
        coClosed.Execute(thickWallsClosed, intTolerance);

        let clprCombine = new ClipperLib.Clipper();
        clprCombine.AddPaths(thickWalls, ClipperLib.PolyType.ptSubject, true);
        clprCombine.AddPaths(thickWallsClosed, ClipperLib.PolyType.ptSubject, true);
        clprCombine.Execute(ClipperLib.ClipType.ctUnion, allThickWalls, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
    }

    const boxX = 9 * 0.1 * scale;
    const boxY = 5 * 0.1 * scale;
    let bbox = [[
        { X: -boxX, Y: -boxY }, { X: boxX, Y: -boxY },
        { X: boxX, Y: boxY }, { X: -boxX, Y: boxY }
    ]];

    let clpr = new ClipperLib.Clipper();
    clpr.AddPaths(bbox, ClipperLib.PolyType.ptSubject, true);
    if (allThickWalls.length > 0) {
        clpr.AddPaths(allThickWalls, ClipperLib.PolyType.ptClip, true);
    }

    let polyTree = new ClipperLib.PolyTree();
    clpr.Execute(ClipperLib.ClipType.ctDifference, polyTree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

    let clickPt = { X: Math.round(clickPos.x * scale), Y: Math.round(clickPos.y * scale) };

    function getChilds(node) {
        return typeof node.Childs === 'function' ? node.Childs() : (node.Childs || []);
    }
    function getContour(node) {
        return typeof node.Contour === 'function' ? node.Contour() : (node.Contour || []);
    }

    function findDeepestSpaceNode(node, pt, isSpace) {
        let foundChild = null;
        let childs = getChilds(node);
        for (let i = 0; i < childs.length; i++) {
            let child = childs[i];
            let contour = getContour(child);
            if (contour && contour.length > 0 && ClipperLib.Clipper.PointInPolygon(pt, contour) !== 0) {
                foundChild = findDeepestSpaceNode(child, pt, !isSpace);
                if (foundChild) return foundChild;
            }
        }
        let nodeContour = getContour(node);
        if (isSpace && nodeContour && nodeContour.length > 0) return node;
        return null;
    }

    let targetNode = null;
    let rootChilds = getChilds(polyTree);
    for (let i = 0; i < rootChilds.length; i++) {
        let child = rootChilds[i];
        let contour = getContour(child);
        if (contour && contour.length > 0 && ClipperLib.Clipper.PointInPolygon(clickPt, contour) !== 0) {
            targetNode = findDeepestSpaceNode(child, clickPt, true);
            if (targetNode) break;
        }
    }

    if (!targetNode) return [];

    let targetContour = getContour(targetNode);
    if (!targetContour || targetContour.length === 0) return [];

    let roomPaths = new ClipperLib.Paths();
    roomPaths.push(targetContour);
    let targetChilds = getChilds(targetNode);
    for (let i = 0; i < targetChilds.length; i++) {
        let cContour = getContour(targetChilds[i]);
        if (cContour && cContour.length > 0) {
            roomPaths.push(cContour);
        }
    }

    let coExpand = new ClipperLib.ClipperOffset();
    coExpand.AddPaths(roomPaths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    let expandedTree = new ClipperLib.PolyTree();
    coExpand.Execute(expandedTree, intTolerance);

    let expandedChilds = getChilds(expandedTree);
    if (expandedChilds.length === 0) return [];

    let finalNode = expandedChilds[0];
    let finalContour = getContour(finalNode);

    function toSightPoints(clipperPath) {
        let pts = [];
        for (let i = 0; i < clipperPath.length; i++) {
            let pt = { x: clipperPath[i].X / scale, y: clipperPath[i].Y / scale };
            if (pts.length > 0) {
                let lastPt = pts[pts.length - 1];
                if (Math.abs(pt.x - lastPt.x) < 0.00001 && Math.abs(pt.y - lastPt.y) < 0.00001) continue;
            }
            pts.push(pt);
        }
        if (pts.length > 1) {
            let first = pts[0];
            let last = pts[pts.length - 1];
            if (Math.abs(first.x - last.x) < 0.00001 && Math.abs(first.y - last.y) < 0.00001) {
                pts.pop();
            }
        }
        return pts;
    }

    let newRegions = [];
    newRegions.push(toSightPoints(finalContour));

    let finalNodeChilds = getChilds(finalNode);
    for (let i = 0; i < finalNodeChilds.length; i++) {
        let holeContour = getContour(finalNodeChilds[i]);
        if (holeContour && holeContour.length > 0) {
            newRegions.push(toSightPoints(holeContour));
        }
    }

    return newRegions;
}

self.onmessage = function (e) {
    const data = e.data || {};
    const requestId = data.requestId;

    try {
        const regions = computeMagicWandRegions(data.lines || [], data.quads || [], data.clickPos);
        self.postMessage({ requestId: requestId, regions: regions });
    } catch (err) {
        self.postMessage({ requestId: requestId, error: (err && err.message) || String(err) });
    }
};
