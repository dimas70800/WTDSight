let objects = new Map; // All drawn stuff

// Lines drawing mode
let startPos = null;

// Quads drawing mode
let quadPos = [];

let drawing = false;

function clearIntermediateDrawing() {
    quadPos = [];
    if (typeof clearHatchState === 'function') {
        clearHatchState();
    }
}

function nextId() {
    let i = 0;
    let release = false;

    while (!release) {
        release = true;

        for (const [id, obj] of objects) {
            if (id === i.toString()) {
                release = false;
                i++;
            }
        }
    }

    return i;
}

function clearEverything() {
    if (confirm(lang === ru ? "Рисунок будет полностью стёрт, продолжить?" : "The drawing will be entirely cleared, continue?")) {
        load("{}", true);
    }
}

function startDrawing(pos) {
    switch (tool) {
        case "lines":
            startPos = startPos = {
                x: Math.round(pos.x * 1000000) / 1000000,
                y: Math.round(pos.y * 1000000) / 1000000
            };
            break;
    }

    drawing = true;
}

function endDrawing(pos) {
    if (tool === "lines" && startPos == null) return;

    const roundedPos = {
        x: Math.round(pos.x * 1000000) / 1000000,
        y: Math.round(pos.y * 1000000) / 1000000
    };

    const objIdStr = nextId().toString();

    switch (tool) {
        case "lines":
            const object =
            {
                name: lang.line + " " + objIdStr,
                type: "line",
                start: startPos,
                end: roundedPos,
                selected: false
            };

            objects.set(objIdStr, object);
            pushEvent("add", { id: objIdStr, object: object });

            break;

        case "quads":
            if (quadPos.length < 3) {
                quadPos.push(roundedPos);
            }
            else {
                // Check if convex

                function cross(pm, p1, p2) {
                    const x1 = p1.x - pm.x;
                    const y1 = p1.y - pm.y;

                    const x2 = p2.x - pm.x;
                    const y2 = p2.y - pm.y;

                    return (x1 * y2) - (y1 * x2);
                }

                function isConvex(p) {
                    let prevCross = 0;

                    for (let i = 0; i < 4; i++) {
                        const curCross = cross(p[i], p[(i + 1) % 4], p[(i + 2) % 4]);
                        if (curCross != 0) {
                            if (curCross * prevCross < 0) {
                                return false;
                            }

                            prevCross = curCross;
                        }
                    }

                    return true;
                }

                const isObjectConvex = isConvex([quadPos[0], quadPos[1], quadPos[2], roundedPos]);

                // Draw only if convex

                if (isObjectConvex) {
                    const object =
                    {
                        name: lang.quad + " " + objIdStr,
                        type: "quad",
                        pos1: quadPos[0],
                        pos2: quadPos[1],
                        pos3: quadPos[2],
                        pos4: roundedPos,
                        selected: false
                    };

                    objects.set(objIdStr, object);
                    pushEvent("add", { id: objIdStr, object: object });

                    quadPos = [];
                }
                else {
                    alert(lang === ru ? "Четырёхугольники должны быть только выпуклыми!" : "Quads must only be convex!");

                    quadPos = [];
                }
            }

            break;
    }

    refreshObjectsList(true);
    startPos = null;
    drawing = false;
}

function clearDrawing() {
    startPos = null;
    drawing = false;
    if (typeof clearHatchState === 'function') {
        clearHatchState();
    }
}

function getMassTransform() {
    const massX = parseFloat(el("massX").value);
    const massY = -parseFloat(el("massY").value);
    const massR = parseFloat(el("massR").value) * (2.0 * Math.PI / 360.0);
    const massSX = parseFloat(el("massSX").value);
    const massSY = parseFloat(el("massSY").value);

    return { x: massX, y: massY, r: massR, sx: massSX, sy: massSY };
}

function applyMassTransform() {
    const mass = getMassTransform();

    for (const [id, object] of objects) {
        switch (object.type) {
            case "line":
                object.start = massTransformPoint(object.start, mass.x, mass.y, mass.r, mass.sx, mass.sy);
                object.end = massTransformPoint(object.end, mass.x, mass.y, mass.r, mass.sx, mass.sy);

                break;

            case "quad":
                object.pos1 = massTransformPoint(object.pos1, mass.x, mass.y, mass.r, mass.sx, mass.sy);
                object.pos2 = massTransformPoint(object.pos2, mass.x, mass.y, mass.r, mass.sx, mass.sy);
                object.pos3 = massTransformPoint(object.pos3, mass.x, mass.y, mass.r, mass.sx, mass.sy);
                object.pos4 = massTransformPoint(object.pos4, mass.x, mass.y, mass.r, mass.sx, mass.sy);

                break;
        }
    }

    el("massX").value = "0";
    el("massY").value = "0";
    el("massR").value = "0";
    el("massSX").value = "1";
    el("massSY").value = "1";
}

const objectsList = el("objectsList");

function refreshObjectsList(scrollDown) {
    el("objCount").innerHTML = objects.size;
    objectsList.innerHTML = "";

    for (const [id, obj] of objects) {
        const span = document.createElement("span");
        objectsList.appendChild(span);
        span.innerHTML = obj.name;
        span.className = "objectRow";
        span.onclick = () => { showInfo(id); };
    }

    if (scrollDown) objectsList.scrollTop = objectsList.scrollHeight;
}

function unselectAnyObjects() {
    if (typeof clearSelection === 'function') {
        clearSelection();
    }
}

let selectedId = null;

function showInfo(id) {
    if (typeof selectedObjectsSet !== 'undefined' && selectedObjectsSet.size > 0) {
        clearSelection();
    }

    const infoMenu = el("infoMenu");
    const table = el("infoTable");
    table.innerHTML = "";
    el("selObjectTitle").innerHTML = lang.selObjectTitle;
    el("infoDeleteButton").innerHTML = lang.infoDeleteButton;

    function addInput(name, value, isNumber, callback) {
        const tr = document.createElement("tr");
        const tdName = document.createElement("td");
        const tdInput = document.createElement("td");
        table.appendChild(tr);
        tr.appendChild(tdName);
        tr.appendChild(tdInput);

        tdName.innerHTML = name + ":";

        const input = document.createElement("input");
        tdInput.appendChild(input);
        input.value = value;
        input.style.userSelect = "auto";
        input.type = isNumber ? "number" : "text";
        input.onchange = () => { callback(input.value); };
    }

    if (objects.has(selectedId)) objects.get(selectedId).selected = false;

    hide(el("infoDeleteButton"));

    if (id == null) {
        hide(infoMenu);
        selectedId = null;
        return;
    }
    show(infoMenu);

    selectedId = id;
    if (id == null) return;

    show(el("infoDeleteButton"));

    const obj = objects.get(id);
    obj.selected = true;

    for (const property in obj) {
        switch (property) {
            case "name":
                addInput(lang.nameInfo, obj.name, false, (v) => {
                    if (v.trim().length === 0) return;
                    obj.name = v;
                });
                refreshObjectsList();
                break;

            // lines
            case "start":
                addInput(lang.startX, obj.start.x, true, (v) => {
                    if (isNaN(parseFloat(v))) return;
                    obj.start.x = parseFloat(v);
                });
                addInput(lang.startY, obj.start.y, true, (v) => {
                    if (isNaN(parseFloat(v))) return;
                    obj.start.y = parseFloat(v);
                });
                break;

            case "end":
                addInput(lang.endX, obj.end.x, true, (v) => {
                    if (isNaN(parseFloat(v))) return;
                    obj.end.x = parseFloat(v);
                });
                addInput(lang.endY, obj.end.y, true, (v) => {
                    if (isNaN(parseFloat(v))) return;
                    obj.end.y = parseFloat(v);
                });
                break;

            // quads
            case "pos1":
                addInput(lang.pos1X, obj.pos1.x, true, (v) => {
                    if (isNaN(parseFloat(v))) return;
                    obj.pos1.x = parseFloat(v);
                });
                addInput(lang.pos1Y, obj.pos1.y, true, (v) => {
                    if (isNaN(parseFloat(v))) return;
                    obj.pos1.y = parseFloat(v);
                });
                break;

            case "pos2":
                addInput(lang.pos2X, obj.pos2.x, true, (v) => {
                    if (isNaN(parseFloat(v))) return;
                    obj.pos2.x = parseFloat(v);
                });
                addInput(lang.pos2Y, obj.pos2.y, true, (v) => {
                    if (isNaN(parseFloat(v))) return;
                    obj.pos2.y = parseFloat(v);
                });
                break;

            case "pos3":
                addInput(lang.pos3X, obj.pos3.x, true, (v) => {
                    if (isNaN(parseFloat(v))) return;
                    obj.pos3.x = parseFloat(v);
                });
                addInput(lang.pos3Y, obj.pos3.y, true, (v) => {
                    if (isNaN(parseFloat(v))) return;
                    obj.pos3.y = parseFloat(v);
                });
                break;

            case "pos4":
                addInput(lang.pos4X, obj.pos4.x, true, (v) => {
                    if (isNaN(parseFloat(v))) return;
                    obj.pos4.x = parseFloat(v);
                });
                addInput(lang.pos4Y, obj.pos4.y, true, (v) => {
                    if (isNaN(parseFloat(v))) return;
                    obj.pos4.y = parseFloat(v);
                });
                break;
        }
    }

    el("infoDeleteButton").onclick = () => {
        pushEvent("delete", { id: selectedId, object: objects.get(selectedId) });
        deleteObject(selectedId);
    }
}

function exportToClipboard() {
    let string = "";

    let areLinesPresent = false;
    let areQuadsPresent = false;

    objects.forEach((obj, k, m) => {
        if (obj.type === "line") areLinesPresent = true;
        else areQuadsPresent = true;
    });

    if (areLinesPresent) {
        // Lines
        string += "drawLines{\r\n";
        for (const [id, object] of objects) {
            if (object.type !== "line") continue;

            string += "  line {line:p4=";

            string += object.start.x + ",";
            string += object.start.y + ",";
            string += object.end.x + ",";
            string += object.end.y + ";";

            string += "move:b=false;}\r\n";
        }
        string += "\r\n}\r\n";
    }

    if (areQuadsPresent) {
        // Quads
        string += "drawQuads{\r\n";
        for (const [id, object] of objects) {
            if (object.type !== "quad") continue;

            string += "  quad {";

            string += "tl:p2 = " + object.pos1.x + "," + object.pos1.y + ";";
            string += "tr:p2 = " + object.pos2.x + "," + object.pos2.y + ";";
            string += "br:p2 = " + object.pos3.x + "," + object.pos3.y + ";";
            string += "bl:p2 = " + object.pos4.x + "," + object.pos4.y + ";";

            string += "}\r\n"; //move:b=false;
        }
        string += "\r\n}\r\n";
    }

    if (objects.size === 0) {
        alert(lang === ru ? "Нечего экспортировать!" : "There is nothing to export!");
    }
    else {
        navigator.clipboard.writeText(string);

        if (confirm(lang === ru ? "Скопировано в буфер обмена! Сохранить копию в файл?" : "Copied to the clipboard! Save a copy to a file?")) {
            saveExport(string);
        }
    }
}

function deleteObject(id) {
    if (id == null) return;

    if (selectedObjectsSet.has(id)) {
        selectedObjectsSet.delete(id);
    }

    if (selectedObjectsSet.size === 0) {
        selectionRect = null;
        updateSelectionInfo();
    }

    objects.delete(id);
    refreshObjectsList();
    showInfo(null);
}

let snapping = false;
let mobileSnappingActive = false;

function toggleMobileSnapping() {
    mobileSnappingActive = !mobileSnappingActive;
    const btn = document.getElementById("snapBtn");
    if (btn) {
        btn.style.background = mobileSnappingActive ? "#228025" : "var(--bg-main-panel)";
    }
}

let isCtrlUsedInCombo = false;

function checkHotkey(actionKey, e) {
    const hk = currentHotkeys[actionKey];
    return e.code === hk.code && 
           !!e.ctrlKey === !!hk.ctrl && 
           !!e.altKey === !!hk.alt && 
           !!e.shiftKey === !!hk.shift;
}

document.onkeydown = (e) => {
    const activeElem = document.activeElement;
    if (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA' || activeElem.isContentEditable) {
        if (e.code === "Escape") activeElem.blur();

        if (e.ctrlKey && e.key !== 'Control') {
            isCtrlUsedInCombo = true;
        }
        else if (e.key === 'Control') {
            isCtrlUsedInCombo = false;
        }

        return;
    }
    
    if (typeof isRebinding !== 'undefined' && isRebinding !== null) return;

    if(checkHotkey('actionLinesTool', e)) {
        e.preventDefault();
        switchTool('lines');
    }
    if(checkHotkey('actionCurveTool', e)) {
        e.preventDefault();
        switchTool('curve');
    }
    if(checkHotkey('actionBrushTool', e)) {
        e.preventDefault();
        switchTool('brush');
    }
    if(checkHotkey('actionHatchTool', e)) {
        e.preventDefault();
        switchTool('hatch');
    }
    if(checkHotkey('actionFillTool', e)) {
        e.preventDefault();
        switchTool('fill');
    }
    if(checkHotkey('actionSelectTool', e)) {
        e.preventDefault();
        switchTool('select');
    }

    if (checkHotkey('actionCreate', e)) {
        event.preventDefault();
        switch (tool) {
            case 'hatch':
                document.getElementById('hatchCreateBtn')?.click();
                break;
            case 'fill':
                document.getElementById('fillCreateBtn')?.click();
                break;
            case 'shapes':
                document.getElementById('shapesCreateBtn')?.click();
                break;
            case 'text':
                document.getElementById('textCreateBtn')?.click();
                break;
        }
    }

    if (checkHotkey('actionCancel', e)) {
        event.preventDefault();
        switch (tool) {
            case 'hatch':
                document.getElementById('hatchCancelBtn')?.click();
                break;
            case 'fill':
                document.getElementById('fillCancelBtn')?.click();
                break;
            case 'shapes':
                document.getElementById('shapesCancelBtn')?.click();
                break;
            case 'text':
                document.getElementById('textCancelBtn')?.click();
                break;
        }
    }

    if (isAnimatingDrawing) {
        if (e.code === "Escape") stopDrawingAnimation();
        return;
    }

    if (checkHotkey('actionSave', e)) {
        e.preventDefault();
        forcedSave();
        showNotification(lang.savedNotificationText)
    }

    if (checkHotkey('actionRotLeft', e)) {
        changeVisualRotation(-15);
    }
    if (checkHotkey('actionRotRight', e)) {
        changeVisualRotation(15);
    }
    if (checkHotkey('actionUndo', e)) {
        e.preventDefault();
        popEvent();
        refreshObjectsList();
    }

    if (checkHotkey('actionRedo', e)) {
        e.preventDefault();
        popRedo();
        refreshObjectsList();
    }


    if (checkHotkey('actionDelete', e)) {
        e.preventDefault();
        if (selectedObjectsSet.size > 0) {
            deleteSelectedObjects();
        }
        else if (selectedId !== null) {
            const obj = objects.get(selectedId);
            if (obj) {
                pushEvent("delete", { id: selectedId, object: obj });
                deleteObject(selectedId);
                refreshObjectsList();
            }
        }
    }

    if (e.code === "ControlLeft") {
        snapping = true;
    }

    if (checkHotkey('actionClearSel', e)) {
        e.preventDefault();
        unselectAnyObjects();
    }
};

document.onkeyup = (e) => {
    const activeElem = document.activeElement;
    if (activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA' || activeElem.isContentEditable)) {
        if (e.key === 'Control' && !isCtrlUsedInCombo) {
            activeElem.blur();
        }
    }
    if (e.code === "ControlLeft") {
        snapping = false;
        if (!arrowPulling && !isPullingCenter) {
            showInfo(null);
        }
    }
};

function snappingPos(mouse, maxPixelRadius = Infinity, ignoreId = null) {
    let closestPos = null;
    let closestSqrMag = Infinity;

    let maxSqrMag = Infinity;
    if (maxPixelRadius !== Infinity) {
        const radiusSight = maxPixelRadius / screenZoom / getBaseScale();
        maxSqrMag = radiusSight * radiusSight;
    }

    let snapInfo = null;

    function comp(pos, info = null) {
        const sqrMag = v2sqrmag(mouse, pos);
        if (sqrMag < closestSqrMag && sqrMag <= maxSqrMag) {
            closestPos = pos;
            closestSqrMag = sqrMag;
            snapInfo = info;
        }
    }

    for (const [id, obj] of objects) {
        if (id === ignoreId) continue;

        switch (obj.type) {
            case "line":
                comp(obj.start);
                comp(obj.end);
                break;
            case "quad":
                comp(obj.pos1);
                comp(obj.pos2);
                comp(obj.pos3);
                comp(obj.pos4);

                if (tool !== "hatch" && tool !== "fill") {
                    comp(v2avg([obj.pos1, obj.pos2]), { isEdge: true, p1: obj.pos1, p2: obj.pos2 });
                    comp(v2avg([obj.pos2, obj.pos3]), { isEdge: true, p1: obj.pos2, p2: obj.pos3 });
                    comp(v2avg([obj.pos3, obj.pos4]), { isEdge: true, p1: obj.pos3, p2: obj.pos4 });
                    comp(v2avg([obj.pos4, obj.pos1]), { isEdge: true, p1: obj.pos4, p2: obj.pos1 });
                    break;
                }
        }
    }

    if (closestPos != null) {
        const result = {
            x: Math.round(closestPos.x * 1000000) / 1000000,
            y: Math.round(closestPos.y * 1000000) / 1000000
        };
        if (snapInfo) result.snapInfo = snapInfo;
        return result;
    }
    return null;
}

function pointToSegmentDistSqr(p, v, w) {
    const l2 = v2sqrmag(v, w);
    if (l2 === 0) return v2sqrmag(p, v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return v2sqrmag(p, proj);
}

function getObjectDistanceSqr(mouse, obj) {
    if (obj.type === "line") {
        return pointToSegmentDistSqr(mouse, obj.start, obj.end);
    } else if (obj.type === "quad") {
        if (typeof isPointInQuad === "function" && isPointInQuad(mouse, obj)) {
            return 0;
        }
        const d1 = pointToSegmentDistSqr(mouse, obj.pos1, obj.pos2);
        const d2 = pointToSegmentDistSqr(mouse, obj.pos2, obj.pos3);
        const d3 = pointToSegmentDistSqr(mouse, obj.pos3, obj.pos4);
        const d4 = pointToSegmentDistSqr(mouse, obj.pos4, obj.pos1);
        return Math.min(d1, d2, d3, d4);
    }
    return Infinity;
}

function selectNearest(mouse) {
    if (objects.size === 0) return;

    const oldSelectionEl = document.getElementById('oldSelectionCheckBox');
    const isOldMode = oldSelectionEl ? oldSelectionEl.checked : false;

    if (isOldMode) {
        let closestId = null;
        let closestSqrMag = Infinity;

        function compOld(pos, id) {
            const sqrMag = v2sqrmag(mouse, pos);
            if (sqrMag < closestSqrMag) {
                closestId = id;
                closestSqrMag = sqrMag;
            }
        }

        for (const [id, obj] of objects) {
            switch (obj.type) {
                case "line":
                    compOld(v2avg([obj.start, obj.end]), id);
                    break;
                case "quad":
                    compOld(v2avg([obj.pos1, obj.pos2, obj.pos3, obj.pos4]), id);
                    break;
            }
        }

        if (closestId == null) return;

        clearSelection();
        showInfo(closestId);

    } else {
        let list = [];
        for (const [id, obj] of objects) {
            const distSqr = getObjectDistanceSqr(mouse, obj);
            list.push({ id: id, distSqr: distSqr });
        }

        list.sort((a, b) => a.distSqr - b.distSqr);

        const hitRadiusPixels = 20;
        const hitRadiusSight = hitRadiusPixels / (screenZoom * getBaseScale());
        const thresholdSqr = hitRadiusSight * hitRadiusSight;

        let overlappingItems = list.filter(item => item.distSqr <= thresholdSqr);

        if (overlappingItems.length === 0) {
            overlappingItems = [list[0]];
        }

        let targetId = overlappingItems[0].id;

        if (selectedId !== null) {
            const currentIndex = overlappingItems.findIndex(item => item.id === selectedId);
            if (currentIndex !== -1) {
                const nextIndex = (currentIndex + 1) % overlappingItems.length;
                targetId = overlappingItems[nextIndex].id;
            }
        }

        clearSelection();
        showInfo(targetId);
    }
}

function generateHorizontalAxis() {
    let minX = Infinity, maxX = -Infinity;

    function checkIntersection(p1, p2) {
        if (Math.abs(p1.y) < 1e-6 && Math.abs(p2.y) < 1e-6) return;
        if (Math.abs(p1.x) < 1e-6 && Math.abs(p2.x) < 1e-6) return;

        if (p1.y * p2.y <= 0 && p1.y !== p2.y) {
            let intersectX = p1.x + (p2.x - p1.x) * (0 - p1.y) / (p2.y - p1.y);
            if (intersectX >= -1.5 && intersectX <= 1.5) {
                minX = Math.min(minX, intersectX);
                maxX = Math.max(maxX, intersectX);
            }
        }
    }

    for (const [id, obj] of objects) {
        if (obj.type === "line") {
            checkIntersection(obj.start, obj.end);
        } else if (obj.type === "quad") {
            checkIntersection(obj.pos1, obj.pos2);
            checkIntersection(obj.pos2, obj.pos3);
            checkIntersection(obj.pos3, obj.pos4);
            checkIntersection(obj.pos4, obj.pos1);
        }
    }

    let newObjects = [];

    function addAxisLine(p1, p2) {
        if (Math.abs(p1.x - p2.x) < 1e-5 && Math.abs(p1.y - p2.y) < 1e-5) return;

        const objIdStr = nextId().toString();
        const object = {
            name: (typeof lang !== 'undefined' && lang.line ? lang.line : "Axis Line") + " " + objIdStr,
            type: "line",
            start: { x: Math.round(p1.x * 1000000) / 1000000, y: Math.round(p1.y * 1000000) / 1000000 },
            end: { x: Math.round(p2.x * 1000000) / 1000000, y: Math.round(p2.y * 1000000) / 1000000 },
            selected: false
        };
        objects.set(objIdStr, object);
        newObjects.push({ id: objIdStr, object: object });
    }

    if (minX !== Infinity) {
        if (minX > -1.5) addAxisLine({ x: -1.5, y: 0 }, { x: minX, y: 0 });
        if (maxX < 1.5) addAxisLine({ x: maxX, y: 0 }, { x: 1.5, y: 0 });
    } else {
        addAxisLine({ x: -1.5, y: 0 }, { x: 1.5, y: 0 });
    }

    if (newObjects.length > 0) {
        pushEvent("add_multiple", newObjects);
        refreshObjectsList(true);
    }
}

function generateVerticalAxis() {
    let minY = Infinity, maxY = -Infinity;

    function checkIntersection(p1, p2) {
        if (Math.abs(p1.y) < 1e-6 && Math.abs(p2.y) < 1e-6) return;
        if (Math.abs(p1.x) < 1e-6 && Math.abs(p2.x) < 1e-6) return;

        if (p1.x * p2.x <= 0 && p1.x !== p2.x) {
            let intersectY = p1.y + (p2.y - p1.y) * (0 - p1.x) / (p2.x - p1.x);
            if (intersectY >= -1.5 && intersectY <= 1.5) {
                minY = Math.min(minY, intersectY);
                maxY = Math.max(maxY, intersectY);
            }
        }
    }

    for (const [id, obj] of objects) {
        if (obj.type === "line") {
            checkIntersection(obj.start, obj.end);
        } else if (obj.type === "quad") {
            checkIntersection(obj.pos1, obj.pos2);
            checkIntersection(obj.pos2, obj.pos3);
            checkIntersection(obj.pos3, obj.pos4);
            checkIntersection(obj.pos4, obj.pos1);
        }
    }

    let newObjects = [];

    function addAxisLine(p1, p2) {
        if (Math.abs(p1.x - p2.x) < 1e-5 && Math.abs(p1.y - p2.y) < 1e-5) return;

        const objIdStr = nextId().toString();
        const object = {
            name: (typeof lang !== 'undefined' && lang.line ? lang.line : "Axis Line") + " " + objIdStr,
            type: "line",
            start: { x: Math.round(p1.x * 1000000) / 1000000, y: Math.round(p1.y * 1000000) / 1000000 },
            end: { x: Math.round(p2.x * 1000000) / 1000000, y: Math.round(p2.y * 1000000) / 1000000 },
            selected: false
        };
        objects.set(objIdStr, object);
        newObjects.push({ id: objIdStr, object: object });
    }

    if (minY !== Infinity) {
        if (minY > -1.5) addAxisLine({ x: 0, y: -1.5 }, { x: 0, y: minY });
        if (maxY < 1.5) addAxisLine({ x: 0, y: maxY }, { x: 0, y: 1.5 });
    } else {
        addAxisLine({ x: 0, y: -1.5 }, { x: 0, y: 1.5 });
    }

    if (newObjects.length > 0) {
        pushEvent("add_multiple", newObjects);
        refreshObjectsList(true);
    }
}

function transformAllObjects(type, axis, useCenter = false) {
    if (objects.size === 0) return;

    let centerX = 0;
    let centerY = 0;

    if (type === 'transfer' || useCenter) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [id, obj] of objects) {
            const pts = obj.type === 'line' ? [obj.start, obj.end] : [obj.pos1, obj.pos2, obj.pos3, obj.pos4];
            for (let p of pts) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
        }
        centerX = minX + (maxX - minX) / 2;
        centerY = minY + (maxY - minY) / 2;
    }

    const initialData = [];
    for (const [id, obj] of objects) {
        initialData.push({
            id: id,
            object: obj,
            prevData: getObjectMoveData(obj)
        });
    }

    for (const [id, obj] of objects) {
        const pts = obj.type === 'line' ? [obj.start, obj.end] : [obj.pos1, obj.pos2, obj.pos3, obj.pos4];

        for (let p of pts) {
            if (type === 'transfer') {
                if (axis === 'horz') p.x -= 2 * centerX;
                if (axis === 'vert') p.y -= 2 * centerY;
            } else if (type === 'mirror') {
                if (axis === 'horz') {
                    p.x = useCenter ? centerX - (p.x - centerX) : -p.x;
                } else if (axis === 'vert') {
                    p.y = useCenter ? centerY - (p.y - centerY) : -p.y;
                }
            }
        }
    }

    const moveEventData = initialData.map(item => ({
        id: item.id,
        prevData: item.prevData,
        newData: getObjectMoveData(item.object)
    }));
    pushEvent("move_multiple", { objectsData: moveEventData });

    if (typeof updateSelectionInfo === 'function') updateSelectionInfo();
    if (typeof transformState !== 'undefined' && transformState.active === false && typeof updateTransformBoxFromSelection === 'function') {
        updateTransformBoxFromSelection();
    }
}