let brushPoints = [];
let isDrawingBrush = false;

function finishBrush() {
    if (brushPoints.length < 2) {
        brushPoints = [];
        return;
    }

    let simplifyVal = parseFloat(document.getElementById('brushSimplifyInput').value);
    let smoothVal = parseInt(document.getElementById('brushSmoothInput').value);
    let thicknessVal = parseInt(document.getElementById('brushThicknessInput').value);

    let epsilon = simplifyVal * 0.0001;
    let thickness = thicknessVal * 0.001;
    let halfThick = thickness / 2;

    let smoothed = smoothCurve(brushPoints, smoothVal);
    let simplified = simplifyRDP(smoothed, epsilon);

    if (simplified.length < 2) {
        brushPoints = [];
        return;
    }

    let newObjects = [];
    let leftPoints = [];
    let rightPoints = [];

    for (let i = 0; i < simplified.length; i++) {
        let d1 = { x: 0, y: 0 };
        let d2 = { x: 0, y: 0 };

        if (i > 0) {
            d1.x = simplified[i].x - simplified[i - 1].x;
            d1.y = simplified[i].y - simplified[i - 1].y;
        }
        if (i < simplified.length - 1) {
            d2.x = simplified[i + 1].x - simplified[i].x;
            d2.y = simplified[i + 1].y - simplified[i].y;
        }

        if (i === 0) d1 = { x: d2.x, y: d2.y };
        if (i === simplified.length - 1) d2 = { x: d1.x, y: d1.y };

        let len1 = Math.hypot(d1.x, d1.y);
        let len2 = Math.hypot(d2.x, d2.y);

        if (len1 > 0) { d1.x /= len1; d1.y /= len1; }
        if (len2 > 0) { d2.x /= len2; d2.y /= len2; }

        let tangent = { x: d1.x + d2.x, y: d1.y + d2.y };
        let tLen = Math.hypot(tangent.x, tangent.y);
        if (tLen > 0.001) {
            tangent.x /= tLen;
            tangent.y /= tLen;
        } else {
            tangent = d1;
        }

        let normal = { x: -tangent.y, y: tangent.x };
        let n1 = { x: -d1.y, y: d1.x };

        let miter = normal.x * n1.x + normal.y * n1.y;
        let miterLength = halfThick;

        if (Math.abs(miter) > 0.1) {
            miterLength = halfThick / miter;
            if (miterLength > halfThick * 4) miterLength = halfThick * 4;
            if (miterLength < -halfThick * 4) miterLength = -halfThick * 4;
        }

        leftPoints.push({
            x: simplified[i].x + normal.x * miterLength,
            y: simplified[i].y + normal.y * miterLength
        });
        rightPoints.push({
            x: simplified[i].x - normal.x * miterLength,
            y: simplified[i].y - normal.y * miterLength
        });
    }

    for (let i = 0; i < simplified.length - 1; i++) {
        const objIdStr = nextId().toString();

        const object = {
            name: (typeof lang !== 'undefined' && lang.quad ? lang.quad : "Quad") + " " + objIdStr,
            type: "quad",
            pos1: { x: Math.round(leftPoints[i].x * 1000000) / 1000000, y: Math.round(leftPoints[i].y * 1000000) / 1000000 },
            pos2: { x: Math.round(rightPoints[i].x * 1000000) / 1000000, y: Math.round(rightPoints[i].y * 1000000) / 1000000 },
            pos3: { x: Math.round(rightPoints[i + 1].x * 1000000) / 1000000, y: Math.round(rightPoints[i + 1].y * 1000000) / 1000000 },
            pos4: { x: Math.round(leftPoints[i + 1].x * 1000000) / 1000000, y: Math.round(leftPoints[i + 1].y * 1000000) / 1000000 },
            selected: false
        };

        objects.set(objIdStr, object);
        newObjects.push({ id: objIdStr, object: object });
    }

    if (newObjects.length > 0) {
        pushEvent("add_multiple", newObjects);
    }

    refreshObjectsList(true);
    brushPoints = [];
}