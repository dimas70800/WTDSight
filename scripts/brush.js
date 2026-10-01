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

function getBrushThickness() {
    const num = document.getElementById('brushThicknessNumber');
    const range = document.getElementById('brushThicknessInput');
    let val = 10;
    if (num && !isNaN(parseFloat(num.value))) {
        val = parseFloat(num.value);
    } else if (range && !isNaN(parseFloat(range.value))) {
        val = parseFloat(range.value);
    }
    if (isNaN(val)) val = 10;
    if (val < 0.5) val = 0.5;
    return val;
}

function isBrushStraightLinesEnabled() {
    const cb = document.getElementById('brushStraightLinesCheckbox');
    return cb ? cb.checked : false;
}

function cancelBrush() {
    isDrawingBrush = false;
    brushPoints = [];
    if (typeof brushStartSnapInfo !== 'undefined') brushStartSnapInfo = null;
    if (typeof brushEndSnapInfo !== 'undefined') brushEndSnapInfo = null;
}

function finishBrush() {
    if (brushPoints.length < 2) {
        brushPoints = [];
        return;
    }
    if (typeof isLayerLocked === 'function' && isLayerLocked(getActiveLayerId())) {
        if (typeof notifyLayerLocked === 'function') notifyLayerLocked();
        brushPoints = [];
        return;
    }

    if (isBrushStraightLinesEnabled()) {
        const p1 = brushPoints[0];
        const p2 = brushPoints[brushPoints.length - 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len > 0.000001) {
            const thicknessVal = getBrushThickness();
            const halfThick = (thicknessVal * 0.001) / 2;
            const nx = -dy / len;
            const ny = dx / len;
            const dirX = dx / len;
            const dirY = dy / len;
            const rnd = (v) => Math.round(v * 1000000) / 1000000;
            const curLayer = (typeof getActiveLayerId === 'function') ? getActiveLayerId() : 1;
            const newObjects = [];

            const addStraightQuad = (pt1, pt2, pt3, pt4) => {
                const objIdStr = nextId().toString();
                const object = {
                    name: (typeof lang !== 'undefined' && lang.quad ? lang.quad : "Quad") + " " + objIdStr,
                    type: "quad",
                    pos1: { x: rnd(pt1.x), y: rnd(pt1.y) },
                    pos2: { x: rnd(pt2.x), y: rnd(pt2.y) },
                    pos3: { x: rnd(pt3.x), y: rnd(pt3.y) },
                    pos4: { x: rnd(pt4.x), y: rnd(pt4.y) },
                    selected: false,
                    layer: curLayer
                };
                objects.set(objIdStr, object);
                newObjects.push({ id: objIdStr, object: object });
            };

            const numCapQuads = 3;

            if (brushMode === 'round') {
                const C = p1;
                const out = { x: -dirX, y: -dirY };
                for (let k = 0; k < numCapQuads; k++) {
                    let a0 = (k / numCapQuads) * Math.PI;
                    let a1 = ((k + 0.5) / numCapQuads) * Math.PI;
                    let a2 = ((k + 1) / numCapQuads) * Math.PI;
                    let pt0 = {
                        x: C.x + (Math.cos(a0) * nx + Math.sin(a0) * out.x) * halfThick,
                        y: C.y + (Math.cos(a0) * ny + Math.sin(a0) * out.y) * halfThick
                    };
                    let pt1 = {
                        x: C.x + (Math.cos(a1) * nx + Math.sin(a1) * out.x) * halfThick,
                        y: C.y + (Math.cos(a1) * ny + Math.sin(a1) * out.y) * halfThick
                    };
                    let pt2 = {
                        x: C.x + (Math.cos(a2) * nx + Math.sin(a2) * out.x) * halfThick,
                        y: C.y + (Math.cos(a2) * ny + Math.sin(a2) * out.y) * halfThick
                    };
                    addStraightQuad(C, pt0, pt1, pt2);
                }
            }

            addStraightQuad(
                { x: p1.x + nx * halfThick, y: p1.y + ny * halfThick },
                { x: p2.x + nx * halfThick, y: p2.y + ny * halfThick },
                { x: p2.x - nx * halfThick, y: p2.y - ny * halfThick },
                { x: p1.x - nx * halfThick, y: p1.y - ny * halfThick }
            );

            if (brushMode === 'round') {
                const C = p2;
                const out = { x: dirX, y: dirY };
                for (let k = 0; k < numCapQuads; k++) {
                    let a0 = (k / numCapQuads) * Math.PI;
                    let a1 = ((k + 0.5) / numCapQuads) * Math.PI;
                    let a2 = ((k + 1) / numCapQuads) * Math.PI;
                    let pt0 = {
                        x: C.x + (-Math.cos(a0) * nx + Math.sin(a0) * out.x) * halfThick,
                        y: C.y + (-Math.cos(a0) * ny + Math.sin(a0) * out.y) * halfThick
                    };
                    let pt1 = {
                        x: C.x + (-Math.cos(a1) * nx + Math.sin(a1) * out.x) * halfThick,
                        y: C.y + (-Math.cos(a1) * ny + Math.sin(a1) * out.y) * halfThick
                    };
                    let pt2 = {
                        x: C.x + (-Math.cos(a2) * nx + Math.sin(a2) * out.x) * halfThick,
                        y: C.y + (-Math.cos(a2) * ny + Math.sin(a2) * out.y) * halfThick
                    };
                    addStraightQuad(C, pt0, pt1, pt2);
                }
            }

            if (newObjects.length === 1) {
                pushEvent("add", { id: newObjects[0].id, object: newObjects[0].object });
            } else if (newObjects.length > 1) {
                pushEvent("add_multiple", newObjects);
            }
            refreshObjectsList(true);
        }
        brushPoints = [];
        if (typeof brushStartSnapInfo !== 'undefined') brushStartSnapInfo = null;
        if (typeof brushEndSnapInfo !== 'undefined') brushEndSnapInfo = null;
        return;
    }

    let simplifyVal = parseFloat(document.getElementById('brushSimplifyInput').value);
    let smoothVal = parseInt(document.getElementById('brushSmoothInput').value);
    let thicknessVal = getBrushThickness();

    let epsilon = simplifyVal * 0.0001;
    let thickness = thicknessVal * 0.001;
    let halfThick = thickness / 2;

    let smoothed = smoothCurve(brushPoints, smoothVal);
    let simplified = simplifyRDP(smoothed, epsilon);

function getQuadDir(q) {
    if (!q || !q.pos1 || !q.pos2 || !q.pos3 || !q.pos4) return null;
    let d12 = Math.hypot(q.pos2.x - q.pos1.x, q.pos2.y - q.pos1.y);
    let d23 = Math.hypot(q.pos3.x - q.pos2.x, q.pos3.y - q.pos2.y);
    let d34 = Math.hypot(q.pos4.x - q.pos3.x, q.pos4.y - q.pos3.y);
    let d41 = Math.hypot(q.pos1.x - q.pos4.x, q.pos1.y - q.pos4.y);
    let qx = (d23 + d41 >= d12 + d34) ? (q.pos3.x - q.pos2.x + q.pos4.x - q.pos1.x) : (q.pos2.x - q.pos1.x + q.pos3.x - q.pos4.x);
    let qy = (d23 + d41 >= d12 + d34) ? (q.pos3.y - q.pos2.y + q.pos4.y - q.pos1.y) : (q.pos2.y - q.pos1.y + q.pos3.y - q.pos4.y);
    let len = Math.hypot(qx, qy);
    return len > 0.000001 ? { x: qx / len, y: qy / len } : null;
}

    let startFlushNormal = null;
    if (typeof brushStartSnapInfo !== 'undefined' && brushStartSnapInfo && brushStartSnapInfo.isEdge && simplified.length >= 2) {
        let p1 = brushStartSnapInfo.p1;
        let p2 = brushStartSnapInfo.p2;
        
        let edgeDir = { x: p2.x - p1.x, y: p2.y - p1.y };
        let eLen = Math.hypot(edgeDir.x, edgeDir.y);
        if (eLen > 0) {
            let normal = { x: -edgeDir.y / eLen, y: edgeDir.x / eLen };
            let strokeDir = { x: simplified[1].x - simplified[0].x, y: simplified[1].y - simplified[0].y };
            let sLen = Math.hypot(strokeDir.x, strokeDir.y);

            if (sLen > 0.0001) {
                let sDir = { x: strokeDir.x / sLen, y: strokeDir.y / sLen };
                if (sDir.x * normal.x + sDir.y * normal.y < 0) {
                    normal.x = -normal.x;
                    normal.y = -normal.y;
                }

                let qDir = brushStartSnapInfo.quad ? getQuadDir(brushStartSnapInfo.quad) : null;
                let isEndCap = qDir ? Math.abs(normal.x * qDir.x + normal.y * qDir.y) > 0.7 : true;
                let dot = sDir.x * normal.x + sDir.y * normal.y;
                if (isEndCap && dot >= 0.99) {
                    let perp = { x: -normal.y, y: normal.x };
                    let strokeNormal = { x: -sDir.y, y: sDir.x };
                    if (perp.x * strokeNormal.x + perp.y * strokeNormal.y < 0) {
                        perp.x = -perp.x;
                        perp.y = -perp.y;
                    }
                    startFlushNormal = perp;
                } else {
                    let fixPoint = {
                        x: simplified[0].x + normal.x * 0.0001,
                        y: simplified[0].y + normal.y * 0.0001
                    };
                    simplified.splice(1, 0, fixPoint);
                }
            }
        }
    }
    
    let endFlushNormal = null;
    if (typeof brushEndSnapInfo !== 'undefined' && brushEndSnapInfo && brushEndSnapInfo.isEdge && simplified.length >= 2) {
        let p1 = brushEndSnapInfo.p1;
        let p2 = brushEndSnapInfo.p2;
        
        let edgeDir = { x: p2.x - p1.x, y: p2.y - p1.y };
        let eLen = Math.hypot(edgeDir.x, edgeDir.y);
        if (eLen > 0) {
            let normal = { x: -edgeDir.y / eLen, y: edgeDir.x / eLen };
            let lastIdx = simplified.length - 1;
            let strokeDir = { x: simplified[lastIdx].x - simplified[lastIdx - 1].x, y: simplified[lastIdx].y - simplified[lastIdx - 1].y };
            let sLen = Math.hypot(strokeDir.x, strokeDir.y);

            if (sLen > 0.0001) {
                let sDir = { x: strokeDir.x / sLen, y: strokeDir.y / sLen };
                if (sDir.x * normal.x + sDir.y * normal.y < 0) {
                    normal.x = -normal.x;
                    normal.y = -normal.y;
                }

                let qDir = brushEndSnapInfo.quad ? getQuadDir(brushEndSnapInfo.quad) : null;
                let isEndCap = qDir ? Math.abs(normal.x * qDir.x + normal.y * qDir.y) > 0.7 : true;
                let dot = sDir.x * normal.x + sDir.y * normal.y;
                if (isEndCap && dot >= 0.99) {
                    let perp = { x: -normal.y, y: normal.x };
                    let strokeNormal = { x: -sDir.y, y: sDir.x };
                    if (perp.x * strokeNormal.x + perp.y * strokeNormal.y < 0) {
                        perp.x = -perp.x;
                        perp.y = -perp.y;
                    }
                    endFlushNormal = perp;
                } else {
                    let fixPoint = {
                        x: simplified[lastIdx].x - normal.x * 0.0001,
                        y: simplified[lastIdx].y - normal.y * 0.0001
                    };
                    simplified.splice(lastIdx, 0, fixPoint);
                }
            }
        }
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
        let n1 = { x: -d1.y, y: d1.x };

        let miter = normal.x * n1.x + normal.y * n1.y;
        let miterLength = halfThick;

        if (Math.abs(miter) > 0.1) {
            miterLength = halfThick / miter;
            if (miterLength > halfThick * 4) miterLength = halfThick * 4;
            if (miterLength < -halfThick * 4) miterLength = -halfThick * 4;
        }

        if (i === 0 && startFlushNormal) {
            normal = startFlushNormal;
            miterLength = halfThick;
        } else if (i === simplified.length - 1 && endFlushNormal) {
            normal = endFlushNormal;
            miterLength = halfThick;
        }

        normals.push(normal);

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
    const curLayer = (typeof getActiveLayerId === 'function') ? getActiveLayerId() : 1;
    const addQuad = (p1, p2, p3, p4) => {
        const objIdStr = nextId().toString();
        const object = {
            name: (typeof lang !== 'undefined' && lang.quad ? lang.quad : "Quad") + " " + objIdStr,
            type: "quad",
            pos1: { x: rnd(p1.x), y: rnd(p1.y) },
            pos2: { x: rnd(p2.x), y: rnd(p2.y) },
            pos3: { x: rnd(p3.x), y: rnd(p3.y) },
            pos4: { x: rnd(p4.x), y: rnd(p4.y) },
            selected: false,
            layer: curLayer
        };
        objects.set(objIdStr, object);
        newObjects.push({ id: objIdStr, object: object });
    };

    const numCapQuads = 3; 

    if (brushMode === 'round' && !startFlushNormal) {
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

    if (brushMode === 'round' && !endFlushNormal) {
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