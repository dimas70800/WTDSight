let curvePoints = [];
let isDrawingCurve = false;

function smoothCurve(points, windowSize) {
    if (points.length <= 2 || windowSize < 2) return points;
    let result = [];
    
    result.push(points[0]);

    for (let i = 1; i < points.length - 1; i++) {
        let sumX = 0, sumY = 0, count = 0;
        let start = Math.max(0, i - Math.floor(windowSize / 2));
        let end = Math.min(points.length - 1, i + Math.floor(windowSize / 2));
        
        for (let j = start; j <= end; j++) {
            sumX += points[j].x;
            sumY += points[j].y;
            count++;
        }
        result.push({ x: sumX / count, y: sumY / count });
    }
    
    result.push(points[points.length - 1]);
    
    return result;
}

function perpendicularDistance(p, p1, p2) {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 0) { dx /= mag; dy /= mag; }
    let pvx = p.x - p1.x;
    let pvy = p.y - p1.y;
    let pvdot = pvx * dx + pvy * dy;
    let ax = pvx - (pvdot * dx);
    let ay = pvy - (pvdot * dy);
    return Math.sqrt(ax * ax + ay * ay);
}

function simplifyRDP(points, epsilon) {
    if (points.length < 3) return points;
    let dmax = 0;
    let index = 0;
    let end = points.length - 1;
    for (let i = 1; i < end; i++) {
        let d = perpendicularDistance(points[i], points[0], points[end]);
        if (d > dmax) { index = i; dmax = d; }
    }
    if (dmax > epsilon) {
        let rec1 = simplifyRDP(points.slice(0, index + 1), epsilon);
        let rec2 = simplifyRDP(points.slice(index), epsilon);
        return rec1.slice(0, rec1.length - 1).concat(rec2);
    } else {
        return [points[0], points[end]];
    }
}

function finishCurve() {
    if (curvePoints.length < 2) {
        curvePoints = [];
        return;
    }
    
    let simplifyVal = parseFloat(document.getElementById('curveSimplifyInput').value);
    let smoothVal = parseInt(document.getElementById('curveSmoothInput').value);
    
    let epsilon = simplifyVal * 0.0001; 

    let smoothed = smoothCurve(curvePoints, smoothVal);
    let simplified = simplifyRDP(smoothed, epsilon);

    for (let i = 0; i < simplified.length - 1; i++) {
        const objIdStr = nextId().toString();
        const object = {
            name: lang.line + " " + objIdStr,
            type: "line",
            start: { x: Math.round(simplified[i].x * 1000000) / 1000000, y: Math.round(simplified[i].y * 1000000) / 1000000 },
            end: { x: Math.round(simplified[i+1].x * 1000000) / 1000000, y: Math.round(simplified[i+1].y * 1000000) / 1000000 },
            selected: false
        };
        objects.set(objIdStr, object);
        pushEvent("add", { id: objIdStr, object: object });
    }
    
    refreshObjectsList(true);
    curvePoints = [];
}