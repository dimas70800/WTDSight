let hatchPoints = [];
let isDrawingHatch = false;
let previewHatchLines = [];
let hatchAngle = 45;
let hatchDensity = 0.03;
let hatchPhase = 0;

function startHatchDrawing(pos) {
    hatchPoints = [{
        x: Math.round(pos.x * 1000000) / 1000000,
        y: Math.round(pos.y * 1000000) / 1000000
    }];
    isDrawingHatch = true;
    previewHatchLines = [];
    hatchPhase = 0;
    updateHatchPreview();
}

function addHatchPoint(pos) {
    if (!isDrawingHatch) return;
    const roundedPos = {
        x: Math.round(pos.x * 1000000) / 1000000,
        y: Math.round(pos.y * 1000000) / 1000000
    };
    if (hatchPoints.length > 0) {
        const lastPoint = hatchPoints[hatchPoints.length - 1];
        if (Math.abs(roundedPos.x - lastPoint.x) < 0.000001 && 
            Math.abs(roundedPos.y - lastPoint.y) < 0.000001) {
            return;
        }
    }
    hatchPoints.push(roundedPos);
    updateHatchPreview();
}

function updateHatchPreview() {
    const countEl = document.getElementById('hatchPointsNum');
    if (countEl) countEl.innerText = hatchPoints.length;

    if (!isDrawingHatch || hatchPoints.length < 2) return;

    if (hatchPoints.length >= 3) {
        previewHatchLines = generateHatchLines(hatchPoints, hatchAngle, hatchDensity, hatchPhase);
    } else {
        previewHatchLines = [];
    }
}

function generateHatchLines(points, angleDeg, spacing, phase) {
    const lines = [];
    if (points.length < 3) return lines;
    if (spacing <= 0) return lines;

    let normalizedAngle = angleDeg % 360;
    if (normalizedAngle < 0) normalizedAngle += 360;

    const adjustedAngle = normalizedAngle - 90;
    const angleRad = adjustedAngle * Math.PI / 180;

    const lineDirX = Math.cos(angleRad);
    const lineDirY = Math.sin(angleRad);
    const perpX = -Math.sin(angleRad);
    const perpY = Math.cos(angleRad);

    const projValues = points.map(p => p.x * perpX + p.y * perpY);
    let minProj = Math.min(...projValues);
    let maxProj = Math.max(...projValues);

    const base = 0;
    const kMin = Math.floor((minProj - base - phase) / spacing);
    const kMax = Math.ceil((maxProj - base - phase) / spacing);

    const maxLines = 5000;
    if (kMax - kMin + 1 > maxLines) {
        console.warn(`Слишком много линий (${kMax - kMin + 1}), ограничено до ${maxLines}`);
        return lines;
    }

    for (let k = kMin; k <= kMax; k++) {
        const proj = base + phase + k * spacing;
        const intersections = [];
        
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const proj1 = p1.x * perpX + p1.y * perpY;
            const proj2 = p2.x * perpX + p2.y * perpY;

            if ((proj1 - proj) * (proj2 - proj) < 0) {
                const t = (proj - proj1) / (proj2 - proj1);
                const ix = p1.x + (p2.x - p1.x) * t;
                const iy = p1.y + (p2.y - p1.y) * t;
                const along = ix * lineDirX + iy * lineDirY;
                intersections.push({ x: ix, y: iy, along: along });
            }
        }

        if (intersections.length < 2) continue;
        intersections.sort((a, b) => a.along - b.along);

        for (let i = 0; i < intersections.length - 1; i += 2) {
            lines.push({
                start: { x: intersections[i].x, y: intersections[i].y },
                end: { x: intersections[i + 1].x, y: intersections[i + 1].y }
            });
        }
    }
    return lines;
}

function finalizeHatch() {
    if (hatchPoints.length < 3) {
        alert(lang === ru ? "Для штриховки необходимо минимум 3 точки!" : "At least 3 points are required for hatching!");
        cancelHatch();
        return;
    }

    const finalLines = generateHatchLines(hatchPoints, hatchAngle, hatchDensity, hatchPhase);

    if (finalLines.length === 0) {
        alert(lang === ru ? "Не удалось сгенерировать линии штриховки!" : "Failed to generate hatch lines!");
        cancelHatch();
        return;
    }

    for (const line of finalLines) {
        const objIdStr = nextId().toString();
        const object = {
            name: lang.line + " " + objIdStr,
            type: "line",
            start: { 
                x: Math.round(line.start.x * 1000000) / 1000000,
                y: Math.round(line.start.y * 1000000) / 1000000
            },
            end: { 
                x: Math.round(line.end.x * 1000000) / 1000000,
                y: Math.round(line.end.y * 1000000) / 1000000
            },
            selected: false
        };
        objects.set(objIdStr, object);
        pushEvent("add", { id: objIdStr, object: object });
    }

    refreshObjectsList(true);
    cancelHatch();
    markAllTools();
}

function cancelHatch() {
    hatchPoints = [];
    isDrawingHatch = false;
    previewHatchLines = [];
    hatchPhase = 0;
    const countEl = document.getElementById('hatchPointsNum');
    if (countEl) countEl.innerText = "0";
}

function clearHatchState() {
    cancelHatch();
}

document.addEventListener('DOMContentLoaded', () => {
    const angleInput = document.getElementById('hatchAngleInput');
    const densityInput = document.getElementById('hatchDensityInput');
    const phaseInput = document.getElementById('hatchPhaseInput');
    const createBtn = document.getElementById('hatchCreateBtn');
    const cancelBtn = document.getElementById('hatchCancelBtn');

    if (angleInput) {
        angleInput.oninput = (e) => {
            let newAngle = parseFloat(angleInput.value);
            if (isNaN(newAngle)) newAngle = 0;
            hatchAngle = newAngle;
            updateHatchPreview();
        };
    }

    if (densityInput) {
        densityInput.oninput = (e) => {
            let newDensity = parseFloat(densityInput.value);
            if (isNaN(newDensity)) newDensity = 0.05;
            if (newDensity < 0.001) newDensity = 0.001;
            if (newDensity > 0.5) newDensity = 0.5;
            hatchDensity = newDensity;
            densityInput.value = hatchDensity;
            updateHatchPreview();
        };
    }

    if (phaseInput) {
        phaseInput.oninput = (e) => {
            let newPhase = parseFloat(phaseInput.value);
            if (isNaN(newPhase)) newPhase = 0;
            hatchPhase = newPhase;
            updateHatchPreview();
        };
    }

    if (createBtn) createBtn.onclick = () => finalizeHatch();
    if (cancelBtn) cancelBtn.onclick = () => cancelHatch();
});