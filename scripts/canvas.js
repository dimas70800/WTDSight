const canvas = el("mainCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    // Коэффициент масштабирования пикселей
    const dpr = window.devicePixelRatio || 1;

    // Физический размер холста
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    // CSS-размер холста
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener("resize", resizeCanvas);

resizeCanvas();

// Positioning
let screenPos = { x: 0, y: 0 }; // In sight coordinates
let screenZoom = 1 / 1.21; // Sight scale * zoom * 2000 = pixels
// Zoom = 1 => 0.5 sight = 1000 pixels, zoom = 2 => 0.5 sight = 2000 pixels
function getBaseScale() {
    return canvas.height * (2000 / 2160);
}

// Эта функция будет возвращать коэффициент толщины
// Если экран меньше 4K, она будет уменьшать lineWidth
function getLineWidth(baseWidth) {
    return baseWidth * (canvas.height / 2160) * 1.5;
}

// Selection tool variables
let selectionRect = null;      // { startX, startY, endX, endY } в мировых координатах
let isSelecting = false;
let selectedObjectsSet = new Set();

let isDraggingSelected = false;
let dragStartPos = null;
let dragObjectsData = null;

let gridSize = 0.1; // Size of grid cell in sight scale

let mousePos = { x: 0, y: 0 };
let mousePosWindow = { x: 0, y: 0 }
let lastMousePosCanvas = { x: 0, y: 0 };

let ctxBgColor = "#ffffff";
let drawGridEnabled = true;

function setOutlineCheckBox(val) {
    el("outlineCheckBox").checked = val;
    if (typeof saveAllSettings === 'function') saveAllSettings();
}


const colorPicker = el("canvasBgColor");
if (colorPicker) {
    colorPicker.value = ctxBgColor;
}

function setBgColorCanvas(clr) {
    ctxBgColor = clr;
    if (typeof saveAllSettings === 'function') saveAllSettings();
}

function toggleDrawGrid(show) {
    drawGridEnabled = show;
    el("drawGridCheckBox").checked = show;
    if (typeof saveAllSettings === 'function') saveAllSettings();
}

let globalVisualRotation = 0;

function updateVisualRotation() {
    const input = document.getElementById("visualRotationInput");
    if (input) {
        globalVisualRotation = parseFloat(input.value) || 0;
    }
}

function changeVisualRotation(delta) {
    const input = document.getElementById("visualRotationInput");
    if (input) {
        let current = parseFloat(input.value) || 0;
        current += delta;
        input.value = current;
        updateVisualRotation();
    }
}

function render() {
    ctx.fillStyle = ctxBgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (globalVisualRotation !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(globalVisualRotation * Math.PI / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }

    for (let i = 0; i < 3; i++) drawReference(i);
    if (drawGridEnabled) {
        drawGrid();
    }
    drawCrosshair();
    drawStuff();
    drawArrows();
    drawGhost();

    ctx.restore();
    requestAnimationFrame(render);
}

render();

function v2disposSight2v2sight(disposSight) {
    return { x: disposSight.x - screenPos.x, y: disposSight.y - screenPos.y };
}

function sight2pixel(sight) {
    return sight * screenZoom * getBaseScale();
}

function v2sight2v2pixel(sight) {
    return { x: sight.x * screenZoom * getBaseScale(), y: sight.y * screenZoom * getBaseScale() };
}

function v2pixel2v2canvas(pixel) {
    return { x: pixel.x + canvas.width / 2, y: pixel.y + canvas.height / 2 };
}

function v2pixel2v2sight(pixel) {
    return { x: pixel.x / screenZoom / getBaseScale(), y: pixel.y / screenZoom / getBaseScale() };
}

function v2disposSight2v2canvas(disposSight) {
    return v2pixel2v2canvas(v2sight2v2pixel(v2disposSight2v2sight(disposSight)));
}

function v2canvas2v2pixel(canv) {
    return { x: canv.x - canvas.width / 2, y: canv.y - canvas.height / 2 };
}

function v2sight2v2disposSight(sight) {
    return { x: sight.x + screenPos.x, y: sight.y + screenPos.y };
}

function v2canvas2v2disposSight(canv) {
    return v2sight2v2disposSight(v2pixel2v2sight(v2canvas2v2pixel(canv)));
}

function drawCrosshair() {
    const crossSightPos = { x: 0, y: 0 };
    const crossPixelPos = v2sight2v2pixel(v2disposSight2v2sight(crossSightPos));
    const crossCanvasPos = v2pixel2v2canvas(crossPixelPos);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();

    const infinity = 10000;

    ctx.moveTo(crossCanvasPos.x - infinity, crossCanvasPos.y);
    ctx.lineTo(crossCanvasPos.x + infinity, crossCanvasPos.y);

    ctx.moveTo(crossCanvasPos.x, crossCanvasPos.y - infinity);
    ctx.lineTo(crossCanvasPos.x, crossCanvasPos.y + infinity);

    ctx.stroke();
}

function drawGrid() {
    ctx.lineWidth = getLineWidth(1);

    const gridHalfWidth = 9 * gridSize;
    const gridHalfHeight = 5 * gridSize;

    for (let z = 1; (0.5 * Math.pow(10, z - 1) < screenZoom) || (z === 1); z++) {
        const alpha = 0.25 * Math.pow(0.7, z - 1);
        const gridStep = gridSize * Math.pow(0.1, z - 1);

        ctx.strokeStyle = "rgba(0, 0, 0, " + alpha.toString() + ")";
        ctx.beginPath();

        const stepsX = Math.round((gridHalfWidth * 2) / gridStep);
        const stepsY = Math.round((gridHalfHeight * 2) / gridStep);

        for (let i = 0; i <= stepsY; i++) {
            const y = -gridHalfHeight + i * gridStep;
            const from = v2disposSight2v2canvas({ x: -gridHalfWidth, y: y });
            const to = v2disposSight2v2canvas({ x: gridHalfWidth, y: y });

            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
        }

        for (let j = 0; j <= stepsX; j++) {
            const x = -gridHalfWidth + j * gridStep;
            const from = v2disposSight2v2canvas({ x: x, y: -gridHalfHeight });
            const to = v2disposSight2v2canvas({ x: x, y: gridHalfHeight });

            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
        }

        ctx.closePath();
        ctx.stroke();
    }
}

function massTransformPoint(point, x, y, r, sx, sy) {
    let newX = point.x;
    let newY = point.y;

    const tempX = newX * Math.cos(r) - newY * Math.sin(r);
    const tempY = newX * Math.sin(r) + newY * Math.cos(r);

    newX = tempX * sx + x;
    newY = tempY * sy + y;

    return { x: newX, y: newY };
}

function drawStuff() {
    const timeSin = ((Math.sin(Date.now() * 0.01)) * 0.25) + 0.75;

    const mass = getMassTransform();

    let drawMassGhost = false;

    if (mass.x !== 0 || mass.y !== 0 || mass.r !== 0 || mass.sx !== 1 || mass.sy !== 1) {
        drawMassGhost = true;
        el("massB").disabled = false;
    }
    else {
        el("massB").disabled = true;
    }

    const opacity = el("opacityInput").value;

    function drawStuffObject(object, c, w, transformationFunc) {
        const opacity = el("opacityInput").value;
        const outlineColor = `rgba(255, 255, 255, ${opacity})`;
        const outlineCheckBoxVal = el("outlineCheckBox").checked;

        switch (object.type) {
            case "line":
                const from = v2disposSight2v2canvas(transformationFunc(object.start, mass.x, mass.y, mass.r, mass.sx, mass.sy));
                const to = v2disposSight2v2canvas(transformationFunc(object.end, mass.x, mass.y, mass.r, mass.sx, mass.sy));

                if (outlineCheckBoxVal) {
                    ctx.beginPath();
                    ctx.moveTo(from.x, from.y);
                    ctx.lineTo(to.x, to.y);
                    ctx.strokeStyle = outlineColor;
                    ctx.lineWidth = getLineWidth(w + 1);
                    ctx.stroke();
                }

                ctx.beginPath();
                ctx.moveTo(from.x, from.y);
                ctx.lineTo(to.x, to.y);
                ctx.strokeStyle = c;
                ctx.lineWidth = getLineWidth(w);
                ctx.stroke();
                break;

            case "quad":
                const pos1 = v2disposSight2v2canvas(transformationFunc(object.pos1, mass.x, mass.y, mass.r, mass.sx, mass.sy));
                const pos2 = v2disposSight2v2canvas(transformationFunc(object.pos2, mass.x, mass.y, mass.r, mass.sx, mass.sy));
                const pos3 = v2disposSight2v2canvas(transformationFunc(object.pos3, mass.x, mass.y, mass.r, mass.sx, mass.sy));
                const pos4 = v2disposSight2v2canvas(transformationFunc(object.pos4, mass.x, mass.y, mass.r, mass.sx, mass.sy));

                if (outlineCheckBoxVal) {
                    ctx.beginPath();
                    ctx.moveTo(pos1.x, pos1.y);
                    ctx.lineTo(pos2.x, pos2.y);
                    ctx.lineTo(pos3.x, pos3.y);
                    ctx.lineTo(pos4.x, pos4.y);
                    ctx.closePath();
                    ctx.strokeStyle = outlineColor;
                    ctx.lineWidth = getLineWidth(w + 1);
                    ctx.stroke();
                }

                ctx.beginPath();
                ctx.moveTo(pos1.x, pos1.y);
                ctx.lineTo(pos2.x, pos2.y);
                ctx.lineTo(pos3.x, pos3.y);
                ctx.lineTo(pos4.x, pos4.y);
                ctx.closePath();
                ctx.fillStyle = c;
                ctx.fill();
                break;
        }
    }

    for (const [id, object] of objects) {
        const color = !object.selected ? "rgba(0, 0, 0, " + opacity + ")" : "rgba(0, 0, 255, " + timeSin.toString() + ")";
        const width = !object.selected ? 1 : 3;

        drawStuffObject(object, color, width, (point, x, y, r, sx, sy) => { return point; });
    }

    if (drawMassGhost) {
        for (const [id, object] of objects) {
            drawStuffObject(object, "rgba(0, 128, 0, 0.5)", 1, massTransformPoint);
        }
    }

    ctx.lineWidth = getLineWidth(1);
}

function getMousePos(offsetX, offsetY) {
    let rawX = offsetX * (canvas.width / canvas.clientWidth);
    let rawY = offsetY * (canvas.height / canvas.clientHeight);

    if (globalVisualRotation !== 0) {
        const rad = -globalVisualRotation * Math.PI / 180;
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        const dx = rawX - cx;
        const dy = rawY - cy;

        return {
            x: dx * Math.cos(rad) - dy * Math.sin(rad) + cx,
            y: dx * Math.sin(rad) + dy * Math.cos(rad) + cy
        };
    }

    return { x: rawX, y: rawY };
}

function drawGhost() {
    if (window.vectorizeTempLines && window.vectorizeTempLines.length > 0 && tool !== "hatch") {
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = "rgba(100, 200, 100, 0.9)";
        ctx.lineWidth = getLineWidth(1.5);

        for (const line of window.vectorizeTempLines) {
            const from = v2disposSight2v2canvas(line.start);
            const to = v2disposSight2v2canvas(line.end);
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        }

        ctx.restore();
    }
    if (typeof mousePos === "undefined") return;

    let mousePosCanvas;
    let trueMousePosCanvas;

    if (!snapping) {
        trueMousePosCanvas = mousePosCanvas = v2disposSight2v2canvas(mousePos);
    }
    else {
        trueMousePosCanvas = v2disposSight2v2canvas(mousePos);

        const snapPos = snappingPos(mousePos);
        if (snapPos != null)
            mousePosCanvas = v2disposSight2v2canvas(snapPos);
        else
            mousePosCanvas = trueMousePosCanvas;
    }

    ctx.lineWidth = getLineWidth(1);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";

    function drawCircle(x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, getLineWidth(r), 0, 2 * Math.PI, false);
        ctx.closePath();
        ctx.fill();
    }

    function drawLine(x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.stroke();
    }

    function drawQuad(coords) {
        ctx.beginPath();
        ctx.moveTo(coords[0].x, coords[0].y);
        for (let i = 1; i < coords.length; i++) ctx.lineTo(coords[i].x, coords[i].y);
        ctx.closePath();
        ctx.fill();
    }

    switch (tool) {
        case "lines":
            if (drawing) {
                const from = v2disposSight2v2canvas(startPos);
                const to = trueMousePosCanvas;

                const outlineCheckBoxVal = el("outlineCheckBox").checked;

                if (outlineCheckBoxVal) {
                    ctx.beginPath();
                    ctx.moveTo(from.x, from.y);
                    ctx.lineTo(to.x, to.y);
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
                    ctx.lineWidth = getLineWidth(1);
                    ctx.stroke();
                }

                drawLine(from.x, from.y, to.x, to.y);
            }

            if (snapping) {
                drawCircle(mousePosCanvas.x, mousePosCanvas.y, 20);
            }

            break;

        case "quads":
            if (snapping) {
                drawCircle(mousePosCanvas.x, mousePosCanvas.y, 20);
            }

            if (quadPos.length === 0) {
                if (drawing && !snapping) {
                    drawCircle(mousePosCanvas.x, mousePosCanvas.y, 20);
                }
            }
            else if (quadPos.length === 1) {
                if (!drawing) {
                    drawCircle(v2disposSight2v2canvas(quadPos[0]).x, v2disposSight2v2canvas(quadPos[0]).y, 10);
                }

                drawLine(v2disposSight2v2canvas(quadPos[0]).x, v2disposSight2v2canvas(quadPos[0]).y, mousePosCanvas.x, mousePosCanvas.y);
            }
            else if (quadPos.length === 2) {
                if (!drawing) {
                    drawLine(v2disposSight2v2canvas(quadPos[0]).x, v2disposSight2v2canvas(quadPos[0]).y, v2disposSight2v2canvas(quadPos[1]).x, v2disposSight2v2canvas(quadPos[1]).y);
                }
                else {
                    drawQuad([
                        { x: v2disposSight2v2canvas(quadPos[0]).x, y: v2disposSight2v2canvas(quadPos[0]).y },
                        { x: v2disposSight2v2canvas(quadPos[1]).x, y: v2disposSight2v2canvas(quadPos[1]).y },
                        { x: mousePosCanvas.x, y: mousePosCanvas.y },
                    ]);
                }

                drawLine(v2disposSight2v2canvas(quadPos[1]).x, v2disposSight2v2canvas(quadPos[1]).y, mousePosCanvas.x, mousePosCanvas.y);
            }
            else if (quadPos.length === 3) {
                drawQuad([
                    { x: v2disposSight2v2canvas(quadPos[0]).x, y: v2disposSight2v2canvas(quadPos[0]).y },
                    { x: v2disposSight2v2canvas(quadPos[1]).x, y: v2disposSight2v2canvas(quadPos[1]).y },
                    { x: v2disposSight2v2canvas(quadPos[2]).x, y: v2disposSight2v2canvas(quadPos[2]).y },
                    { x: mousePosCanvas.x, y: mousePosCanvas.y },
                ]);
            }

            break;
        case "hatch":
            if (hatchPoints.length > 0) {
                for (let i = 0; i < hatchPoints.length; i++) {
                    const pointCanvas = v2disposSight2v2canvas(hatchPoints[i]);
                    drawCircle(pointCanvas.x, pointCanvas.y, 6);

                    if (i > 0) {
                        const prevCanvas = v2disposSight2v2canvas(hatchPoints[i - 1]);
                        drawLine(prevCanvas.x, prevCanvas.y, pointCanvas.x, pointCanvas.y);
                    }
                }

                if (hatchPoints.length >= 3) {
                    const firstCanvas = v2disposSight2v2canvas(hatchPoints[0]);
                    const lastCanvas = v2disposSight2v2canvas(hatchPoints[hatchPoints.length - 1]);
                    drawLine(lastCanvas.x, lastCanvas.y, firstCanvas.x, firstCanvas.y);
                }
            }

            if (previewHatchLines && previewHatchLines.length > 0) {
                ctx.save();
                ctx.globalAlpha = 0.6;
                ctx.strokeStyle = "rgba(100, 200, 100, 0.8)";
                ctx.lineWidth = getLineWidth(2);

                for (const line of previewHatchLines) {
                    const from = v2disposSight2v2canvas(line.start);
                    const to = v2disposSight2v2canvas(line.end);
                    ctx.beginPath();
                    ctx.moveTo(from.x, from.y);
                    ctx.lineTo(to.x, to.y);
                    ctx.stroke();
                }

                ctx.setLineDash([]);
                ctx.restore();
            }

            if (snapping) {
                drawCircle(mousePosCanvas.x, mousePosCanvas.y, 20);
            }
            break;
        case "curve":
            if (isDrawingCurve && curvePoints.length > 0) {
                ctx.beginPath();
                const startCanvas = v2disposSight2v2canvas(curvePoints[0]);
                ctx.moveTo(startCanvas.x, startCanvas.y);

                let limit = snapping ? curvePoints.length - 1 : curvePoints.length;

                for (let i = 1; i < limit; i++) {
                    const ptCanvas = v2disposSight2v2canvas(curvePoints[i]);
                    ctx.lineTo(ptCanvas.x, ptCanvas.y);
                }
                if (snapping) {
                    let snapP = snappingPos(mousePos);
                    let targetPos = snapP != null ? snapP : mousePos;
                    const targetCanvas = v2disposSight2v2canvas(targetPos);
                    ctx.lineTo(targetCanvas.x, targetCanvas.y);
                }

                ctx.strokeStyle = el("outlineCheckBox").checked ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.5)";
                ctx.lineWidth = getLineWidth(1);
                ctx.stroke();
            }
            if (snapping) {
                drawCircle(mousePosCanvas.x, mousePosCanvas.y, 20);
            }
            break;
        case "text":
            if (textToolState.active) {
                const rectCanvas = {
                    tl: v2disposSight2v2canvas({ x: textToolState.rect.x, y: textToolState.rect.y }),
                    br: v2disposSight2v2canvas({ x: textToolState.rect.x + textToolState.rect.w, y: textToolState.rect.y + textToolState.rect.h }),
                    tr: v2disposSight2v2canvas({ x: textToolState.rect.x + textToolState.rect.w, y: textToolState.rect.y }),
                    bl: v2disposSight2v2canvas({ x: textToolState.rect.x, y: textToolState.rect.y + textToolState.rect.h })
                };

                ctx.save();
                ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
                ctx.lineWidth = getLineWidth(1);
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(rectCanvas.tl.x, rectCanvas.tl.y, rectCanvas.br.x - rectCanvas.tl.x, rectCanvas.br.y - rectCanvas.tl.y);
                ctx.setLineDash([]);

                ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
                drawCircle(rectCanvas.tl.x, rectCanvas.tl.y, 8);
                drawCircle(rectCanvas.tr.x, rectCanvas.tr.y, 8);
                drawCircle(rectCanvas.bl.x, rectCanvas.bl.y, 8);
                drawCircle(rectCanvas.br.x, rectCanvas.br.y, 8);

                ctx.strokeStyle = el("outlineCheckBox").checked ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)";
                ctx.lineWidth = getLineWidth(1);
                previewTextLines.forEach(line => {
                    const from = v2disposSight2v2canvas(line.start);
                    const to = v2disposSight2v2canvas(line.end);
                    drawLine(from.x, from.y, to.x, to.y);
                });

                ctx.restore();
            }
            break;
    }
    if (tool === "select" && selectionRect && isSelecting) {
        const from = v2disposSight2v2canvas({ x: selectionRect.startX, y: selectionRect.startY });
        const to = v2disposSight2v2canvas({ x: selectionRect.endX, y: selectionRect.endY });

        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "rgba(0, 59, 185, 0.3)";
        ctx.fillRect(from.x, from.y, to.x - from.x, to.y - from.y);
        ctx.strokeStyle = "rgba(149, 183, 255, 0.8)";
        ctx.lineWidth = getLineWidth(2);
        ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
        ctx.restore();
    }
}

function drawReference(index) {
    const ref = referenceArray[index];

    if (ref.obj == null) return;

    const refAspectRatio = ref.obj.width / ref.obj.height;

    const centerX = ref.x;
    const centerY = ref.y;
    const halfWidth = (ref.size / 2) * refAspectRatio;
    const halfHeight = ref.size / 2;

    const centerCanvas = v2disposSight2v2canvas({ x: centerX, y: centerY });

    ctx.save();
    ctx.translate(centerCanvas.x, centerCanvas.y);
    ctx.rotate(ref.rotation * Math.PI / 180);

    ctx.globalAlpha = ref.opacity;

    try {
        const pixelWidth = (halfWidth * 2) * screenZoom * getBaseScale();
        const pixelHeight = (halfHeight * 2) * screenZoom * getBaseScale();

        ctx.drawImage(ref.obj, -pixelWidth / 2, -pixelHeight / 2, pixelWidth, pixelHeight);
    }
    catch (e) {
        ref.obj = null;
        alert(lang === ru ? "Картинка не найдена/не подходит!" : "Image not found/not applicable!");
    }

    ctx.restore();
    ctx.globalAlpha = 1;
}

function getArrowSources(object) {
    const arrowSources = [];

    switch (object.type) {
        case "line":
            arrowSources.push(v2disposSight2v2canvas(object.start));
            arrowSources.push(v2disposSight2v2canvas(object.end));

            break;

        case "quad":
            arrowSources.push(v2disposSight2v2canvas(object.pos1));
            arrowSources.push(v2disposSight2v2canvas(object.pos2));
            arrowSources.push(v2disposSight2v2canvas(object.pos3));
            arrowSources.push(v2disposSight2v2canvas(object.pos4));

            break;
    }

    return arrowSources;
}

let hoveredArrowHitbox = null;

function drawArrows() {
    if (selectedId == null) return;
    const object = objects.get(selectedId);

    ctx.globalAlpha = 0.5;

    const arrowSources = getArrowSources(object);
    const arrowHitboxes = getArrowHitboxes();

    hoveredArrowHitbox = null;

    for (let i = 0; i < arrowHitboxes.length; i++) {
        const hitbox = arrowHitboxes[i];

        if (mousePosWindow.x > hitbox.x1 && mousePosWindow.y > hitbox.y1
            && mousePosWindow.x < hitbox.x2 && mousePosWindow.y < hitbox.y2)
            hoveredArrowHitbox = i;
    }

    let hoveredSource = null;
    let hoveredAxis = null;

    if (hoveredArrowHitbox != null) {
        hoveredSource = Math.floor(hoveredArrowHitbox / 2);
        hoveredAxis = hoveredArrowHitbox - (hoveredSource * 2);
    }

    for (let i = 0; i < arrowSources.length; i++) {
        const pos = arrowSources[i];

        ctx.lineWidth = getLineWidth(5);

        const size100 = getLineWidth(100);
        const size80 = getLineWidth(80);
        const size10 = getLineWidth(10);

        // X
        ctx.strokeStyle = (hoveredSource === i && hoveredAxis === 0) ? "rgb(128, 0, 0, 1)" : "rgb(255, 0, 0, 1)";
        ctx.beginPath();

        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + size100, pos.y);

        ctx.moveTo(pos.x + size80, pos.y - size10);
        ctx.lineTo(pos.x + size100, pos.y);
        ctx.lineTo(pos.x + size80, pos.y + size10);


        ctx.stroke();

        // Y
        ctx.strokeStyle = (hoveredSource === i && hoveredAxis === 1) ? "rgb(0, 128, 0, 1)" : "rgb(0, 255, 0, 1)";
        ctx.beginPath();

        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x, pos.y - size100);

        ctx.moveTo(pos.x - size10, pos.y - size80);
        ctx.lineTo(pos.x, pos.y - size100);
        ctx.lineTo(pos.x + size10, pos.y - size80);


        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

function getArrowHitboxes() {
    // pos1x, pos1y, pos2x, pos2y etc.
    if (selectedId == null) return null;
    const object = objects.get(selectedId);

    const arrowSources = getArrowSources(object);
    const arrowHitboxes = [];

    const hitboxSize = ('ontouchstart' in window) ? 30 : 10;

    for (const src of arrowSources) {
        arrowHitboxes.push({
            x1: src.x - hitboxSize,
            y1: src.y - hitboxSize,
            x2: src.x + 100 + hitboxSize,
            y2: src.y + hitboxSize
        });
        arrowHitboxes.push({
            x1: src.x - hitboxSize,
            y1: src.y - 100 - hitboxSize,
            x2: src.x + hitboxSize,
            y2: src.y + hitboxSize
        });
    }

    return arrowHitboxes;
}

function isLineIntersectsRect(lineStart, lineEnd, rectMinX, rectMinY, rectMaxX, rectMaxY) {
    const startInside = (lineStart.x >= rectMinX && lineStart.x <= rectMaxX &&
        lineStart.y >= rectMinY && lineStart.y <= rectMaxY);
    const endInside = (lineEnd.x >= rectMinX && lineEnd.x <= rectMaxX &&
        lineEnd.y >= rectMinY && lineEnd.y <= rectMaxY);

    if (startInside || endInside) return true;

    const p1 = lineStart, p2 = lineEnd;

    if ((p1.x - rectMinX) * (p2.x - rectMinX) < 0) {
        const t = (rectMinX - p1.x) / (p2.x - p1.x);
        const y = p1.y + (p2.y - p1.y) * t;
        if (y >= rectMinY && y <= rectMaxY) return true;
    }
    if ((p1.x - rectMaxX) * (p2.x - rectMaxX) < 0) {
        const t = (rectMaxX - p1.x) / (p2.x - p1.x);
        const y = p1.y + (p2.y - p1.y) * t;
        if (y >= rectMinY && y <= rectMaxY) return true;
    }
    if ((p1.y - rectMinY) * (p2.y - rectMinY) < 0) {
        const t = (rectMinY - p1.y) / (p2.y - p1.y);
        const x = p1.x + (p2.x - p1.x) * t;
        if (x >= rectMinX && x <= rectMaxX) return true;
    }
    if ((p1.y - rectMaxY) * (p2.y - rectMaxY) < 0) {
        const t = (rectMaxY - p1.y) / (p2.y - p1.y);
        const x = p1.x + (p2.x - p1.x) * t;
        if (x >= rectMinX && x <= rectMaxX) return true;
    }

    return false;
}

function isQuadIntersectsRect(quad, rectMinX, rectMinY, rectMaxX, rectMaxY) {
    const points = [quad.pos1, quad.pos2, quad.pos3, quad.pos4];

    for (const p of points) {
        if (p.x >= rectMinX && p.x <= rectMaxX && p.y >= rectMinY && p.y <= rectMaxY) {
            return true;
        }
    }

    const edges = [
        [quad.pos1, quad.pos2], [quad.pos2, quad.pos3],
        [quad.pos3, quad.pos4], [quad.pos4, quad.pos1]
    ];

    for (const [p1, p2] of edges) {
        if (isLineIntersectsRect(p1, p2, rectMinX, rectMinY, rectMaxX, rectMaxY)) {
            return true;
        }
    }

    return false;
}

function updateSelectionFromRect() {
    if (!selectionRect) return;

    const minX = Math.min(selectionRect.startX, selectionRect.endX);
    const maxX = Math.max(selectionRect.startX, selectionRect.endX);
    const minY = Math.min(selectionRect.startY, selectionRect.endY);
    const maxY = Math.max(selectionRect.startY, selectionRect.endY);

    selectedObjectsSet.clear();

    for (const [id, obj] of objects) {
        let intersects = false;

        if (obj.type === "line" && (selectionFilterMode === 'all' || selectionFilterMode === 'lines')) {
            intersects = isLineIntersectsRect(obj.start, obj.end, minX, minY, maxX, maxY);
        } else if (obj.type === "quad" && (selectionFilterMode === 'all' || selectionFilterMode === 'quads')) {
            intersects = isQuadIntersectsRect(obj, minX, minY, maxX, maxY);
        }

        if (intersects) {
            selectedObjectsSet.add(id);
            obj.selected = true;
        } else {
            obj.selected = false;
        }
    }

    updateSelectionInfo();
}

let selectionFilterMode = 'all';

function setSelectionMode(mode) {
    selectionFilterMode = mode;

    const btnAll = document.getElementById('selModeAll');
    const btnLines = document.getElementById('selModeLines');
    const btnQuads = document.getElementById('selModeQuads');

    [btnAll, btnLines, btnQuads].forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = 'inherit';
        btn.style.border = '1px solid var(--border-col)';

        btn.onmouseover = () => {
            if (selectionFilterMode !== btn.id.replace('selMode', '').toLowerCase()) {
                btn.style.background = 'rgba(128, 128, 128, 0.3)';
            }
        };
        btn.onmouseout = () => {
            if (selectionFilterMode !== btn.id.replace('selMode', '').toLowerCase()) {
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

    updateSelectionFromRect();
}
setSelectionMode('all');

function clearSelection() {
    for (const [id, obj] of objects) {
        obj.selected = false;
    }
    selectedObjectsSet.clear();
    selectionRect = null;
    if (selectedId !== null) {
        selectedId = null;
        showInfo(null);
    }
}

function updateSelectionInfo() {
    const count = selectedObjectsSet.size;
    const infoMenu = el("infoMenu");
    const title = el("selObjectTitle");
    const table = el("infoTable");
    const deleteBtn = el("infoDeleteButton");

    if (count > 0) {
        show(infoMenu);
        title.textContent = `${lang.selectedObjectsCount}: ${count}`;
        table.innerHTML = `
            <tr>
                <td colspan="2" style="text-align: center; padding: 4px;">
                    <span style="font-size: 11px; color: #777777;">${lang.selectedObjectsHint}</span>
                </td>
            </tr>
        `;
        show(deleteBtn);
        deleteBtn.textContent = `${lang.deleteAllButton} ${count}`;
        deleteBtn.onclick = () => {
            deleteSelectedObjects();
        };
    } else if (selectedId !== null) {
        const obj = objects.get(selectedId);
        if (obj) {
            showInfo(selectedId);
        } else {
            hide(infoMenu);
            title.innerHTML = lang.selObjectTitle;
            table.innerHTML = "";
            hide(deleteBtn);
        }
    } else {
        hide(infoMenu);
        title.innerHTML = lang.selObjectTitle;
        table.innerHTML = "";
        hide(deleteBtn);
    }
}


function deleteSelectedObjects() {
    const idsToDelete = Array.from(selectedObjectsSet);

    if (idsToDelete.length === 0) return;

    let deletedObjects = [];

    for (const id of idsToDelete) {
        const obj = objects.get(id);
        if (obj) {
            deletedObjects.push({ id: id, object: obj });
            objects.delete(id);
        }
    }

    if (deletedObjects.length > 0) {
        pushEvent("delete_multiple", deletedObjects);
    }

    selectedObjectsSet.clear();
    selectionRect = null;
    selectedId = null;

    refreshObjectsList();
    updateSelectionInfo();
    showInfo(null);
}

// Canvas interaction

let canvasHover = false;

canvas.onpointerover = (e) => {
    canvasHover = true;
};

canvas.onpointerleave = (e) => {
    canvasHover = false;
    isHatchDragging = false;
    if (tool !== "hatch" || !isDrawingHatch) {
        clearDrawing();
    }
};

canvas.oncontextmenu = (e) => {
    e.preventDefault();
};

let dragging = false;

let arrowPulling = false;
let posPulled = null;

canvas.onpointerdown = (e) => {

    lastMousePosCanvas = getMousePos(e.offsetX, e.offsetY);

    if (e.button === 2) {
        dragging = true;
        //console.log("drag start");
    }

    if (e.button === 1) {
        e.preventDefault();
        selectNearest(v2canvas2v2disposSight(getMousePos(e.offsetX, e.offsetY)));
    }

    if (e.button === 0) {
        mousePos = v2canvas2v2disposSight(getMousePos(e.offsetX, e.offsetY));
        mousePosWindow = getMousePos(e.offsetX, e.offsetY);

        if (selectedId != null && hoveredArrowHitbox != null) // Arrow pulling
        {
            arrowPulling = true;
            posPulled = hoveredArrowHitbox;

            // Pull the pos
            const object = objects.get(selectedId);
            let prevValue;

            switch (object.type) {
                case "line":
                    switch (posPulled) {
                        case 0: prevValue = object.start.x; break;
                        case 1: prevValue = object.start.y; break;
                        case 2: prevValue = object.end.x; break;
                        case 3: prevValue = object.end.y; break;
                    }

                    break;

                case "quad":
                    switch (posPulled) {
                        case 0: prevValue = object.pos1.x; break;
                        case 1: prevValue = object.pos1.y; break;
                        case 2: prevValue = object.pos2.x; break;
                        case 3: prevValue = object.pos2.y; break;
                        case 4: prevValue = object.pos3.x; break;
                        case 5: prevValue = object.pos3.y; break;
                        case 6: prevValue = object.pos4.x; break;
                        case 7: prevValue = object.pos4.y; break;
                    }

                    break;
            }

            pushEvent("move", { id: selectedId, posPulled: posPulled, prevValue: prevValue });
        } else if (tool === "text") {
            const clickCanvas = getMousePos(e.offsetX, e.offsetY);
            let clickPos = v2canvas2v2disposSight(clickCanvas);

            if (!textToolState.active) {
                textToolState.active = true;
                textToolState.rect.x = clickPos.x;
                textToolState.rect.y = clickPos.y;

                const fontSize = parseFloat(document.getElementById('textFontSize').value) || 4;

                textToolState.rect.w = fontSize * 0.05; // Ширина
                textToolState.rect.h = fontSize * 0.012; // Высота

                document.getElementById('textInputContent').focus();
                updateTextPreview();
            } else {
                const hitRadius = 20 / screenZoom / getBaseScale();

                const dist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

                const tl = { x: textToolState.rect.x, y: textToolState.rect.y };
                const tr = { x: textToolState.rect.x + textToolState.rect.w, y: textToolState.rect.y };
                const bl = { x: textToolState.rect.x, y: textToolState.rect.y + textToolState.rect.h };
                const br = { x: textToolState.rect.x + textToolState.rect.w, y: textToolState.rect.y + textToolState.rect.h };

                if (dist(clickPos, br) < hitRadius) textToolState.action = 'resize_br';
                else if (dist(clickPos, tr) < hitRadius) textToolState.action = 'resize_tr';
                else if (dist(clickPos, bl) < hitRadius) textToolState.action = 'resize_bl';
                else if (dist(clickPos, tl) < hitRadius) textToolState.action = 'resize_tl';
                else if (clickPos.x > tl.x && clickPos.x < br.x && clickPos.y > tl.y && clickPos.y < br.y) {
                    textToolState.action = 'move';
                    textToolState.offsetX = clickPos.x - textToolState.rect.x;
                    textToolState.offsetY = clickPos.y - textToolState.rect.y;
                } else {
                    textToolState.rect.x = clickPos.x;
                    textToolState.rect.y = clickPos.y;
                    document.getElementById('textInputContent').focus();
                    updateTextPreview();
                }
            }
        } else if (tool === "select") {
            const clickCanvas = getMousePos(e.offsetX, e.offsetY);
            const clickWorld = v2canvas2v2disposSight(clickCanvas);

            // Проверяем, кликнули ли по выделенному объекту
            if (selectedObjectsSet.size > 0) {
                let clickedOnSelected = false;

                for (const id of selectedObjectsSet) {
                    const obj = objects.get(id);
                    if (obj) {
                        // Проверяем попадание в объект
                        if (obj.type === "line") {
                            // Проверяем, близка ли точка к линии
                            const dist = distanceToLine(clickWorld, obj.start, obj.end);
                            const hitRadius = 15 / screenZoom / getBaseScale();
                            if (dist < hitRadius) {
                                clickedOnSelected = true;
                                break;
                            }
                        } else if (obj.type === "quad") {
                            if (isPointInQuad(clickWorld, obj)) {
                                clickedOnSelected = true;
                                break;
                            }
                        }
                    }
                }

                if (clickedOnSelected) {
                    // Начинаем перетаскивание всех выделенных объектов
                    isDraggingSelected = true;
                    dragStartPos = clickWorld;

                    // Сохраняем начальные позиции для undo
                    dragObjectsData = [];
                    for (const id of selectedObjectsSet) {
                        const obj = objects.get(id);
                        if (obj) {
                            dragObjectsData.push({
                                id: id,
                                object: obj,
                                startData: getObjectMoveData(obj)
                            });
                        }
                    }
                    return;
                }
            }

            isSelecting = true;
            selectionRect = {
                startX: clickWorld.x,
                startY: clickWorld.y,
                endX: clickWorld.x,
                endY: clickWorld.y
            };

            for (const [id, obj] of objects) {
                obj.selected = false;
            }

            if (selectedId !== null) {
                selectedId = null;
                showInfo(null);
            }

            selectedObjectsSet.clear();
            updateSelectionInfo();
        }
        else {
            if (tool === "hatch") {
                const clickCanvas = getMousePos(e.offsetX, e.offsetY);
                let clickPos = v2canvas2v2disposSight(clickCanvas);

                if (snapping) {
                    const snapPos = snappingPos(clickPos, 40);
                    if (snapPos != null) clickPos = snapPos;
                }

                if (!isDrawingHatch) {
                    startHatchDrawing(clickPos);
                } else {
                    addHatchPoint(clickPos, false);
                }
                isHatchDragging = true;
            }
            else if (tool === "curve") {
                const clickCanvas = getMousePos(e.offsetX, e.offsetY);
                let clickPos = v2canvas2v2disposSight(clickCanvas);

                isDrawingCurve = true;
                curvePoints = [];

                if (snapping) {
                    const snapPos = snappingPos(clickPos);
                    if (snapPos != null) {
                        curvePoints.push(snapPos);
                    }
                }
                curvePoints.push(clickPos);
            }
            else {
                if (!snapping)
                    startDrawing(mousePos);
                else {
                    const snapPos = snappingPos(mousePos);
                    if (snapPos != null)
                        startDrawing(snapPos);
                    else
                        startDrawing(mousePos);
                }
            }
        }

        //const pixelPos = v2canvas2v2pixel(pos);
        //const sightPos = v2pixel2v2sight(pixelPos);
        //const disposSightPos = v2sight2v2disposSight(sightPos);
        //console.log(pos);
        //console.log(pixelPos);
        //console.log(sightPos);
        //console.log(disposSightPos);
        //console.log("drawing start");
    }
};

// let canvasDragSensitivity = 2;
// let canvasPullSensitivity = 1.5;

canvas.onpointermove = (e) => {
    const currentMousePosCanvas = getMousePos(e.offsetX, e.offsetY);

    const exactMovement = {
        x: currentMousePosCanvas.x - lastMousePosCanvas.x,
        y: currentMousePosCanvas.y - lastMousePosCanvas.y
    };

    lastMousePosCanvas = currentMousePosCanvas;

    mousePos = v2canvas2v2disposSight(currentMousePosCanvas);
    mousePosWindow = currentMousePosCanvas;

    if (tool === "curve" && isDrawingCurve) {
        let mousePos = v2canvas2v2disposSight(getMousePos(e.offsetX, e.offsetY));

        let lastPoint = curvePoints[curvePoints.length - 1];
        if (v2sqrmag(mousePos, lastPoint) > 0.0000001) {
            curvePoints.push(mousePos);
        }
    }
    if (tool === "hatch" && isDrawingHatch && isHatchDragging && snapping) {
        const snapPos = snappingPos(mousePos, 40);
        if (snapPos != null) {
            addHatchPoint(snapPos, true);
        }
    }
    const sightMovement = v2pixel2v2sight(exactMovement);
    const pullMovement = v2pixel2v2sight(exactMovement);
    if (tool === "text" && textToolState.action) {
        if (textToolState.action === 'move') {
            textToolState.rect.x = mousePos.x - textToolState.offsetX;
            textToolState.rect.y = mousePos.y - textToolState.offsetY;
        }
        else if (textToolState.action === 'resize_br') {
            textToolState.rect.w = Math.max(0.025, mousePos.x - textToolState.rect.x);
            textToolState.rect.h = Math.max(0.025, mousePos.y - textToolState.rect.y);
        }
        else if (textToolState.action === 'resize_tr') {
            textToolState.rect.w = Math.max(0.025, mousePos.x - textToolState.rect.x);
            let deltaY = textToolState.rect.y - mousePos.y;
            textToolState.rect.y = mousePos.y;
            textToolState.rect.h = Math.max(0.025, textToolState.rect.h + deltaY);
        }
        else if (textToolState.action === 'resize_bl') {
            let deltaX = textToolState.rect.x - mousePos.x;
            textToolState.rect.x = mousePos.x;
            textToolState.rect.w = Math.max(0.025, textToolState.rect.w + deltaX);
            textToolState.rect.h = Math.max(0.025, mousePos.y - textToolState.rect.y);
        }
        else if (textToolState.action === 'resize_tl') {
            let deltaX = textToolState.rect.x - mousePos.x;
            let deltaY = textToolState.rect.y - mousePos.y;
            textToolState.rect.x = mousePos.x;
            textToolState.rect.y = mousePos.y;
            textToolState.rect.w = Math.max(0.025, textToolState.rect.w + deltaX);
            textToolState.rect.h = Math.max(0.025, textToolState.rect.h + deltaY);
        }
        updateTextPreview();
    }
    if (dragging) {
        screenPos = v2add(screenPos, v2inv(sightMovement));
    }

    if (arrowPulling) {
        if (selectedId == null) {
            arrowPulling = false;
        }
        else {
            const object = objects.get(selectedId);

            function pullPos(object, index) {
                switch (object.type) {
                    case "line":
                        switch (index) {
                            case 0: object.start.x += pullMovement.x; break;
                            case 1: object.start.y += pullMovement.y; break;
                            case 2: object.end.x += pullMovement.x; break;
                            case 3: object.end.y += pullMovement.y; break;
                        }

                        break;

                    case "quad":
                        switch (index) {
                            case 0: object.pos1.x += pullMovement.x; break;
                            case 1: object.pos1.y += pullMovement.y; break;
                            case 2: object.pos2.x += pullMovement.x; break;
                            case 3: object.pos2.y += pullMovement.y; break;
                            case 4: object.pos3.x += pullMovement.x; break;
                            case 5: object.pos3.y += pullMovement.y; break;
                            case 6: object.pos4.x += pullMovement.x; break;
                            case 7: object.pos4.y += pullMovement.y; break;
                        }

                        break;
                }
            }

            pullPos(object, posPulled);
        }
    }
    if (isDraggingSelected && dragStartPos) {
        const currentWorld = v2canvas2v2disposSight(getMousePos(e.offsetX, e.offsetY));
        const delta = {
            x: currentWorld.x - dragStartPos.x,
            y: currentWorld.y - dragStartPos.y
        };
        dragStartPos = currentWorld;

        for (const item of dragObjectsData) {
            const obj = item.object;
            moveObject(obj, delta);
        }

        if (selectedObjectsSet.size > 0) {
            updateSelectionInfo();
        }
        return;
    }
    if (tool === "select" && isSelecting && selectionRect) {
        const mouseWorld = v2canvas2v2disposSight(getMousePos(e.offsetX, e.offsetY));
        selectionRect.endX = mouseWorld.x;
        selectionRect.endY = mouseWorld.y;
        updateSelectionFromRect();
    }
};

canvas.onpointerup = (e) => {
    if (e.button === 2) {
        dragging = false;
        //console.log("drag end");
    }

    if (e.button === 0) {

        if (tool === "text" && textToolState.action) {
            textToolState.action = null;
        }
        isHatchDragging = false;

        if (arrowPulling === true) {
            arrowPulling = false;
            showInfo(selectedId);
        } else if (tool === "curve" && isDrawingCurve) {
            isDrawingCurve = false;

            if (snapping) {
                const snapP = snappingPos(mousePos);
                if (snapP != null) {
                    curvePoints[curvePoints.length - 1] = snapP;
                }
            }

            finishCurve();
        }
        else {
            if (!snapping)
                endDrawing(v2canvas2v2disposSight(getMousePos(e.offsetX, e.offsetY)));
            else {
                const snapPos = snappingPos(v2canvas2v2disposSight(getMousePos(e.offsetX, e.offsetY)));
                if (snapPos != null)
                    endDrawing(snapPos);
                else
                    endDrawing(v2canvas2v2disposSight(getMousePos(e.offsetX, e.offsetY)));
            }
        }
        if (isDraggingSelected) {
            const endPos = v2canvas2v2disposSight(getMousePos(e.offsetX, e.offsetY));
            const totalDelta = {
                x: endPos.x - (dragStartPos ? dragStartPos.x : 0),
                y: endPos.y - (dragStartPos ? dragStartPos.y : 0)
            };

            if (dragObjectsData && dragObjectsData.length > 0) {
                pushEvent("move_multiple", {
                    objectsData: dragObjectsData.map(item => ({
                        id: item.id,
                        prevData: item.startData,
                        newData: getObjectMoveData(item.object)
                    }))
                });
            }

            isDraggingSelected = false;
            dragStartPos = null;
            dragObjectsData = null;
            return;
        }
        if (tool === "select" && isSelecting) {
            isSelecting = false;
            if (selectionRect &&
                Math.abs(selectionRect.endX - selectionRect.startX) < 0.002 &&
                Math.abs(selectionRect.endY - selectionRect.startY) < 0.002) {
                clearSelection();
                updateSelectionInfo();
            }
            selectionRect = null;
        }
        //console.log("drawing end");
    }
};

// Zooming

onwheel = (e) => {
    if (!canvasHover) return;

    const zoomIn = e.deltaY < 0;

    if (zoomIn) {
        screenZoom *= 1.1;
    }
    else {
        screenZoom /= 1.1;
        if (screenZoom <= 0.1) screenZoom = 0.1;
    }

    //console.log("Zoom: " + screenZoom);
};

function distanceToLine(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
        return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
    }

    let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;

    return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

function isPointInQuad(point, quad) {
    const corners = [quad.pos1, quad.pos2, quad.pos3, quad.pos4];
    let inside = false;

    for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
        const xi = corners[i].x, yi = corners[i].y;
        const xj = corners[j].x, yj = corners[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
}

function getObjectMoveData(obj) {
    if (obj.type === "line") {
        return {
            type: "line",
            start: { x: obj.start.x, y: obj.start.y },
            end: { x: obj.end.x, y: obj.end.y }
        };
    } else if (obj.type === "quad") {
        return {
            type: "quad",
            pos1: { x: obj.pos1.x, y: obj.pos1.y },
            pos2: { x: obj.pos2.x, y: obj.pos2.y },
            pos3: { x: obj.pos3.x, y: obj.pos3.y },
            pos4: { x: obj.pos4.x, y: obj.pos4.y }
        };
    }
    return null;
}

function moveObject(obj, delta) {
    if (obj.type === "line") {
        obj.start.x += delta.x;
        obj.start.y += delta.y;
        obj.end.x += delta.x;
        obj.end.y += delta.y;
    } else if (obj.type === "quad") {
        obj.pos1.x += delta.x;
        obj.pos1.y += delta.y;
        obj.pos2.x += delta.x;
        obj.pos2.y += delta.y;
        obj.pos3.x += delta.x;
        obj.pos3.y += delta.y;
        obj.pos4.x += delta.x;
        obj.pos4.y += delta.y;
    }
}