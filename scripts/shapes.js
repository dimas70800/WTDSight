let shapesToolState = {
    active: false,
    type: 'square',
    box: { cx: 0, cy: 0, w: 0.1, h: 0.1, angle: 0 },
    action: null,
    startBox: null,
    startAngle: 0,
    offsetX: 0,
    offsetY: 0
};

let previewShapeLines = [];

const SHAPES = {
    square: [
        { x: -0.4, y: -0.4 }, { x: 0.4, y: -0.4 },
        { x: 0.4, y: 0.4 }, { x: -0.4, y: 0.4 }
    ],
    triangle: [
        { x: 0, y: -0.4 }, { x: 0.4, y: 0.4 }, { x: -0.4, y: 0.4 }
    ],
    circle: generateCircle(32),
    star: generateStar(5, 0.4, 0.16),
    animeStar: [
        { x: 0, y: -0.4 }, { x: 0.04, y: -0.16 }, { x: 0.08, y: -0.08 }, { x: 0.16, y: -0.04 },
        { x: 0.4, y: 0 }, { x: 0.16, y: 0.04 }, { x: 0.08, y: 0.08 }, { x: 0.04, y: 0.16 },
        { x: 0, y: 0.4 }, { x: -0.04, y: 0.16 }, { x: -0.08, y: 0.08 }, { x: -0.16, y: 0.04 },
        { x: -0.4, y: 0 }, { x: -0.16, y: -0.04 }, { x: -0.08, y: -0.08 }, { x: -0.04, y: -0.16 }
    ],
    heart: generateHeart(),
    cross: [
        { x: 0, y: -0.1 }, { x: 0.3, y: -0.4 }, { x: 0.4, y: -0.3 },
        { x: 0.1, y: 0 }, { x: 0.4, y: 0.3 }, { x: 0.3, y: 0.4 },
        { x: 0, y: 0.1 }, { x: -0.3, y: 0.4 }, { x: -0.4, y: 0.3 },
        { x: -0.1, y: 0 }, { x: -0.4, y: -0.3 }, { x: -0.3, y: -0.4 }
    ],
    checkmark: [
        { x: -0.4, y: -0.05 }, { x: -0.1, y: 0.2 }, { x: 0.4, y: -0.25 },
        { x: 0.32, y: -0.35 }, { x: -0.1, y: 0.05 }, { x: -0.32, y: -0.15 }
    ]
};

function generateCircle(segments = 32) {
    let points = [];
    for (let i = 0; i < segments; i++) {
        let theta = (i / segments) * Math.PI * 2;
        points.push({
            x: Math.cos(theta) * 0.4,
            y: Math.sin(theta) * 0.4
        });
    }
    return points;
}

function generateStar(points, outer, inner) {
    let pts = [];
    const step = Math.PI / points;
    for (let i = 0; i < 2 * points; i++) {
        const r = (i % 2 === 0) ? outer : inner;
        const angle = i * step - Math.PI / 2;
        pts.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
    }
    return pts;
}

function generateHeart() {
    let pts = [];
    const totalPoints = 50;
    for (let i = 0; i < totalPoints; i++) {
        let t = (i / totalPoints) * Math.PI * 2;
        let x = 16 * Math.pow(Math.sin(t), 3);
        let y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        pts.push({
            x: (x / 17.5) * 0.4,
            y: ((y / 17.5) - 0.05) * 0.4
        });
    }
    return pts;
}

function getShapesTransformHandles(box) {
    if (!box) return [];
    const { cx, cy, w, h, angle } = box;
    const cos = Math.cos(angle), sin = Math.sin(angle);

    const localPts = {
        scale_tl: { x: -w / 2, y: -h / 2 },
        scale_t: { x: 0, y: -h / 2 },
        scale_tr: { x: w / 2, y: -h / 2 },
        scale_r: { x: w / 2, y: 0 },
        scale_br: { x: w / 2, y: h / 2 },
        scale_b: { x: 0, y: h / 2 },
        scale_bl: { x: -w / 2, y: h / 2 },
        scale_l: { x: -w / 2, y: 0 },
        rotate: { x: 0, y: -h / 2 - 30 / (screenZoom * getBaseScale()) }
    };

    return Object.entries(localPts).map(([id, pt]) => ({
        id: id,
        p: { x: cx + pt.x * cos - pt.y * sin, y: cy + pt.x * sin + pt.y * cos }
    }));
}

function updateShapesPreview() {
    if (!shapesToolState.active) {
        previewShapeLines = [];
        return;
    }

    const points = SHAPES[shapesToolState.type];
    const box = shapesToolState.box;
    const cos = Math.cos(box.angle);
    const sin = Math.sin(box.angle);

    previewShapeLines = [];

    for (let i = 0; i < points.length; i++) {
        let p1 = points[i];
        let p2 = points[(i + 1) % points.length];

        let lx1 = p1.x * box.w, ly1 = p1.y * box.h;
        let lx2 = p2.x * box.w, ly2 = p2.y * box.h;

        let finalP1 = {
            x: box.cx + lx1 * cos - ly1 * sin,
            y: box.cy + lx1 * sin + ly1 * cos
        };
        let finalP2 = {
            x: box.cx + lx2 * cos - ly2 * sin,
            y: box.cy + lx2 * sin + ly2 * cos
        };

        previewShapeLines.push({ start: finalP1, end: finalP2 });
    }
}

function clearShapesState() {
    shapesToolState.active = false;
    previewShapeLines = [];
}

function convertShapeToLines() {
    if (previewShapeLines.length === 0) return;

    let newObjects = [];
    previewShapeLines.forEach(line => {
        const objIdStr = nextId().toString();
        const object = {
            name: (typeof lang !== 'undefined' && lang.line ? lang.line : "Line") + " " + objIdStr,
            type: "line",
            start: { x: Math.round(line.start.x * 1000000) / 1000000, y: Math.round(line.start.y * 1000000) / 1000000 },
            end: { x: Math.round(line.end.x * 1000000) / 1000000, y: Math.round(line.end.y * 1000000) / 1000000 },
            selected: false
        };
        objects.set(objIdStr, object);
        newObjects.push({ id: objIdStr, object: object });
    });

    if (newObjects.length > 0) {
        pushEvent("add_multiple", newObjects);
    }

    refreshObjectsList(true);
    clearShapesState();
}

document.addEventListener('DOMContentLoaded', () => {
    const btns = document.querySelectorAll('.shape-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            shapesToolState.type = btn.getAttribute('data-shape');
            if (shapesToolState.active) updateShapesPreview();
        });
    });

    const createBtn = document.getElementById('shapesCreateBtn');
    const cancelBtn = document.getElementById('shapesCancelBtn');

    if (createBtn) createBtn.addEventListener('click', convertShapeToLines);
    if (cancelBtn) cancelBtn.addEventListener('click', clearShapesState);
});