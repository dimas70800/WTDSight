let brushPoints = [];
let brushStartSnapInfo = null;
let brushEndSnapInfo = null;
let isDrawingBrush = false;
let brushMode = 'flat';

function setBrushMode(mode) {
    brushMode = mode;
    const btnFlat = document.getElementById('brushModeFlatBtn');
    const btnRound = document.getElementById('brushModeRoundBtn');
    
    if (btnFlat && btnRound) {
        if (mode === 'flat') {
            btnFlat.style.background = 'var(--input-bg)';
            btnFlat.style.borderColor = 'transparent';
            btnRound.style.background = 'transparent';
            btnRound.style.border = '1px solid var(--border-col)';
        } else {
            btnRound.style.background = 'var(--input-bg)';
            btnRound.style.borderColor = 'transparent';
            btnFlat.style.background = 'transparent';
            btnFlat.style.border = '1px solid var(--border-col)';
        }
    }
}

function finishBrush() {
    if (brushPoints.length < 2) {
        brushPoints = [];
        return;
    }

    let simplifyVal = parseFloat(document.getElementById('brushSimplifyInput').value);
    let smoothVal = parseInt(document.getElementById('brushSmoothInput').value);
    let thicknessVal = parseFloat(document.getElementById('brushThicknessInput').value);

    let epsilon = simplifyVal * 0.0001;
    let thickness = thicknessVal * 0.001;
    let halfThick = thickness / 2;

    let smoothed = smoothCurve(brushPoints, smoothVal);
    let simplified = simplifyRDP(smoothed, epsilon);

    if (typeof brushStartSnapInfo !== 'undefined' && brushStartSnapInfo && brushStartSnapInfo.isEdge && simplified.length >= 2) {
        let p1 = brushStartSnapInfo.p1;
        let p2 = brushStartSnapInfo.p2;
        
        let edgeDir = { x: p2.x - p1.x, y: p2.y - p1.y };
        
        let normal = { x: -edgeDir.y, y: edgeDir.x };
        let nLen = Math.hypot(normal.x, normal.y);
        if (nLen > 0) {
            normal.x /= nLen;
            normal.y /= nLen;
        }

        let strokeDir = { x: simplified[1].x - simplified[0].x, y: simplified[1].y - simplified[0].y };
        if (strokeDir.x * normal.x + strokeDir.y * normal.y < 0) {
            normal.x = -normal.x;
            normal.y = -normal.y;
        }

        let fixPoint = {
            x: simplified[0].x + normal.x * 0.0001,
            y: simplified[0].y + normal.y * 0.0001
        };
        
        simplified.splice(1, 0, fixPoint);
    }
    
    if (typeof brushEndSnapInfo !== 'undefined' && brushEndSnapInfo && brushEndSnapInfo.isEdge && simplified.length >= 2) {
        let p1 = brushEndSnapInfo.p1;
        let p2 = brushEndSnapInfo.p2;
        
        let edgeDir = { x: p2.x - p1.x, y: p2.y - p1.y };
        
        let normal = { x: -edgeDir.y, y: edgeDir.x };
        let nLen = Math.hypot(normal.x, normal.y);
        if (nLen > 0) {
            normal.x /= nLen;
            normal.y /= nLen;
        }

        let lastIdx = simplified.length - 1;

        let strokeDir = { x: simplified[lastIdx].x - simplified[lastIdx - 1].x, y: simplified[lastIdx].y - simplified[lastIdx - 1].y };
        
        if (strokeDir.x * normal.x + strokeDir.y * normal.y < 0) {
            normal.x = -normal.x;
            normal.y = -normal.y;
        }

        let fixPoint = {
            x: simplified[lastIdx].x - normal.x * 0.0001,
            y: simplified[lastIdx].y - normal.y * 0.0001
        };
        
        simplified.splice(lastIdx, 0, fixPoint);
    }
    
    if (typeof brushStartSnapInfo !== 'undefined') brushStartSnapInfo = null;
    if (typeof brushEndSnapInfo !== 'undefined') brushEndSnapInfo = null;

    if (simplified.length < 2) {
        brushPoints = [];
        return;
    }

    let newObjects = [];
    let leftPoints = [];
    let rightPoints = [];
    let normals = []; 
    let directions = [];

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

        directions.push({d1: d1, d2: d2});

        let tangent = { x: d1.x + d2.x, y: d1.y + d2.y };
        let tLen = Math.hypot(tangent.x, tangent.y);
        if (tLen > 0.001) {
            tangent.x /= tLen;
            tangent.y /= tLen;
        } else {
            tangent = d1;
        }

        let normal = { x: -tangent.y, y: tangent.x };
        normals.push(normal);
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

    const rnd = (v) => Math.round(v * 1000000) / 1000000;
    const addQuad = (p1, p2, p3, p4) => {
        const objIdStr = nextId().toString();
        const object = {
            name: (typeof lang !== 'undefined' && lang.quad ? lang.quad : "Quad") + " " + objIdStr,
            type: "quad",
            pos1: { x: rnd(p1.x), y: rnd(p1.y) },
            pos2: { x: rnd(p2.x), y: rnd(p2.y) },
            pos3: { x: rnd(p3.x), y: rnd(p3.y) },
            pos4: { x: rnd(p4.x), y: rnd(p4.y) },
            selected: false
        };
        objects.set(objIdStr, object);
        newObjects.push({ id: objIdStr, object: object });
    };

    const numCapQuads = 3; 

    if (brushMode === 'round') {
        let C = simplified[0];
        let n = normals[0];
        let out = { x: -directions[0].d1.x, y: -directions[0].d1.y }; 
        
        for (let k = 0; k < numCapQuads; k++) {
            let alpha0 = (k / numCapQuads) * Math.PI;
            let alpha1 = ((k + 0.5) / numCapQuads) * Math.PI;
            let alpha2 = ((k + 1) / numCapQuads) * Math.PI;
            
            let p0 = {
                x: C.x + (Math.cos(alpha0) * n.x + Math.sin(alpha0) * out.x) * halfThick,
                y: C.y + (Math.cos(alpha0) * n.y + Math.sin(alpha0) * out.y) * halfThick
            };
            let p1 = {
                x: C.x + (Math.cos(alpha1) * n.x + Math.sin(alpha1) * out.x) * halfThick,
                y: C.y + (Math.cos(alpha1) * n.y + Math.sin(alpha1) * out.y) * halfThick
            };
            let p2 = {
                x: C.x + (Math.cos(alpha2) * n.x + Math.sin(alpha2) * out.x) * halfThick,
                y: C.y + (Math.cos(alpha2) * n.y + Math.sin(alpha2) * out.y) * halfThick
            };
            
            addQuad(C, p0, p1, p2);
        }
    }

    for (let i = 0; i < simplified.length - 1; i++) {
        addQuad(leftPoints[i], rightPoints[i], rightPoints[i + 1], leftPoints[i + 1]);
    }

    if (brushMode === 'round') {
        let lastIdx = simplified.length - 1;
        let C = simplified[lastIdx];
        let n = normals[lastIdx];
        let out = { x: directions[lastIdx].d2.x, y: directions[lastIdx].d2.y }; 
        
        for (let k = 0; k < numCapQuads; k++) {
            let alpha0 = (k / numCapQuads) * Math.PI;
            let alpha1 = ((k + 0.5) / numCapQuads) * Math.PI;
            let alpha2 = ((k + 1) / numCapQuads) * Math.PI;
            
            let p0 = {
                x: C.x + (-Math.cos(alpha0) * n.x + Math.sin(alpha0) * out.x) * halfThick,
                y: C.y + (-Math.cos(alpha0) * n.y + Math.sin(alpha0) * out.y) * halfThick
            };
            let p1 = {
                x: C.x + (-Math.cos(alpha1) * n.x + Math.sin(alpha1) * out.x) * halfThick,
                y: C.y + (-Math.cos(alpha1) * n.y + Math.sin(alpha1) * out.y) * halfThick
            };
            let p2 = {
                x: C.x + (-Math.cos(alpha2) * n.x + Math.sin(alpha2) * out.x) * halfThick,
                y: C.y + (-Math.cos(alpha2) * n.y + Math.sin(alpha2) * out.y) * halfThick
            };
            
            addQuad(C, p0, p1, p2);
        }
    }

    if (newObjects.length > 0) {
        pushEvent("add_multiple", newObjects);
    }

    refreshObjectsList(true);
    brushPoints = [];
}