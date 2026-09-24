let currentOpentypeFont = null;
let textToolState = {
    active: false,
    rect: { x: 0, y: 0, w: 0.5, h: 0.1 }, 
    action: null, 
    offsetX: 0,
    offsetY: 0
};
let previewTextLines = [];
let previewTextQuads = [];

const fontSelector = document.getElementById('fontSelector');
const customFontDiv = document.getElementById('customFontDiv');
const fontFileNameDisplay = document.getElementById('fontFileName');

if (fontSelector) {
    fontSelector.addEventListener('change', function() {
        const val = this.value;

        if (val === "custom") {
            if(customFontDiv) customFontDiv.style.display = "block";
            fontFileNameDisplay.textContent = lang.uploadFontTextInfo;
        } else {
            if(customFontDiv) customFontDiv.style.display = "none";
            loadExternalFont(val);
        }
    });
}

function loadExternalFont(url) {
    fontFileNameDisplay.textContent = lang.loadingTextInfo;
    
    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(lang.networkErrorTextInfo + res.status);
            return res.arrayBuffer();
        })
        .then(buffer => {
            currentOpentypeFont = opentype.parse(buffer);
            let name = url.split('/').pop().replace('.ttf', '').replace('.otf', '');
            fontFileNameDisplay.textContent = lang.selectedTextInfo + name;
            updateTextPreview();
        })
        .catch(err => {
            fontFileNameDisplay.textContent = lang.loadingErrorTextInfo;
            console.error(lang.couldntLoadFontTextInfo, err);
        });
}

document.getElementById('fontFile').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    fontFileNameDisplay.textContent = lang.selectedTextInfo + file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            currentOpentypeFont = opentype.parse(e.target.result);
            updateTextPreview();
        } catch (err) {
            alert(lang.loadingFontErrorTextInfo + err.toString());
        }
    };
    reader.readAsArrayBuffer(file);
});

document.getElementById('textInputContent').addEventListener('input', updateTextPreview);
document.getElementById('textFontSize').addEventListener('input', updateTextPreview);
document.getElementById('textSimplifyInput').addEventListener('input', updateTextPreview);
const textFillCheckboxEl = document.getElementById('textFillCheckbox');
if (textFillCheckboxEl) {
    textFillCheckboxEl.addEventListener('change', updateTextPreview);
}

document.getElementById('textCancelBtn').addEventListener('click', clearTextState);
document.getElementById('textCreateBtn').addEventListener('click', convertTextToLines);

function clearTextState() {
    textToolState.active = false;
    document.getElementById('textInputContent').value = '';
    previewTextLines = [];
    previewTextQuads = [];
}

function updateTextPreview() {
    if (!textToolState.active || !currentOpentypeFont) {
        previewTextLines = [];
        previewTextQuads = [];
        return;
    }

    const text = document.getElementById('textInputContent').value;
    const fontSize = parseFloat(document.getElementById('textFontSize').value);
    const simplifyVal = parseFloat(document.getElementById('textSimplifyInput').value); 
    const epsilon = simplifyVal * 0.0005; 
    
    const isFilled = document.getElementById('textFillCheckbox') && document.getElementById('textFillCheckbox').checked;

    if (!text || isNaN(fontSize)) {
        previewTextLines = [];
        previewTextQuads = [];
        return;
    }

    const scaledFontSize = fontSize * 0.01;
    const scale = (1 / currentOpentypeFont.unitsPerEm) * scaledFontSize;
    const lineHeight = (currentOpentypeFont.tables.os2.sTypoAscender - currentOpentypeFont.tables.os2.sTypoDescender) * scale * 1.2;

    const paragraphs = text.split('\n');
    const wrappedLines = [];

    paragraphs.forEach(paragraph => {
        const words = paragraph.split(' ');
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine.length === 0 ? word : currentLine + ' ' + word;
            const testWidth = currentOpentypeFont.getAdvanceWidth(testLine, scaledFontSize);

            if (testWidth > textToolState.rect.w && currentLine.length > 0) {
                wrappedLines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
        wrappedLines.push(currentLine);
    });

    const requiredHeight = wrappedLines.length * lineHeight;
    if (requiredHeight > textToolState.rect.h) {
        textToolState.rect.h = requiredHeight;
    }

    previewTextLines = [];
    previewTextQuads = [];
    
    let textRegions = [];
    let currentY = textToolState.rect.y + (currentOpentypeFont.tables.os2.sTypoAscender * scale);

    wrappedLines.forEach(lineText => {
        if (lineText.length === 0) {
            currentY += lineHeight;
            return;
        }

        const path = currentOpentypeFont.getPath(lineText, textToolState.rect.x, currentY, scaledFontSize);
        const cmds = path.commands;
        
        let currentPos = {x: 0, y: 0};
        let startPos = {x: 0, y: 0};
        let currentRegion = [];

        for (let i = 0; i < cmds.length; i++) {
            const cmd = cmds[i];
            
            if (cmd.type === 'M') {
                if (currentRegion.length > 0) {
                    textRegions.push(currentRegion);
                }
                currentPos = {x: cmd.x, y: cmd.y};
                startPos = {x: cmd.x, y: cmd.y};
                currentRegion = [{x: cmd.x, y: cmd.y}];
            } 
            else if (cmd.type === 'L') {
                previewTextLines.push({ start: {x: currentPos.x, y: currentPos.y}, end: {x: cmd.x, y: cmd.y} });
                currentPos = {x: cmd.x, y: cmd.y};
                currentRegion.push({x: cmd.x, y: cmd.y});
            } 
            else if (cmd.type === 'Q' || cmd.type === 'C') {
                let pts = [currentPos];
                const steps = 15; 
                
                for(let tStep = 1; tStep <= steps; tStep++) {
                    const t = tStep / steps;
                    const mt = 1 - t;
                    if (cmd.type === 'C') {
                        pts.push({
                            x: mt*mt*mt*currentPos.x + 3*mt*mt*t*cmd.x1 + 3*mt*t*t*cmd.x2 + t*t*t*cmd.x,
                            y: mt*mt*mt*currentPos.y + 3*mt*mt*t*cmd.y1 + 3*mt*t*t*cmd.y2 + t*t*t*cmd.y
                        });
                    } else { 
                        pts.push({
                            x: mt*mt*currentPos.x + 2*mt*t*cmd.x1 + t*t*cmd.x,
                            y: mt*mt*currentPos.y + 2*mt*t*cmd.y1 + t*t*cmd.y
                        });
                    }
                }
                
                const simplified = simplifyRDP(pts, epsilon);
                
                for(let j = 0; j < simplified.length - 1; j++) {
                    previewTextLines.push({ start: simplified[j], end: simplified[j+1] });
                }
                for(let j = 1; j < simplified.length; j++) {
                    currentRegion.push({x: simplified[j].x, y: simplified[j].y});
                }
                currentPos = {x: cmd.x, y: cmd.y};
            }
            else if (cmd.type === 'Z') {
                previewTextLines.push({ start: {x: currentPos.x, y: currentPos.y}, end: {x: startPos.x, y: startPos.y} });
                currentPos = {x: startPos.x, y: startPos.y};
                if (currentRegion.length > 0) {
                    textRegions.push(currentRegion);
                    currentRegion = [];
                }
            }
        }
        if (currentRegion.length > 0) {
            textRegions.push(currentRegion);
            currentRegion = [];
        }
        currentY += lineHeight;
    });

    if (isFilled && textRegions.length > 0) {
        previewTextQuads = generateTextFillQuads(textRegions);
    }
}

function generateTextFillQuads(contours) {
    if (!contours || contours.length === 0) return [];

    const getEarcut = () => {
        if (typeof earcut === 'function') return earcut;
        if (typeof earcut !== 'undefined' && typeof earcut.default === 'function') return earcut.default;
        if (typeof window !== 'undefined') {
            if (typeof window.earcut === 'function') return window.earcut;
            if (window.earcut && typeof window.earcut.default === 'function') return window.earcut.default;
        }
        return null;
    };

    const earcutFn = getEarcut();
    const hasClipper = typeof ClipperLib !== 'undefined' && ClipperLib.Clipper;

    // Очистка контуров от дублирующихся точек и замыкающих повторов
    const cleanedContours = [];
    for (const poly of contours) {
        if (!poly || poly.length < 3) continue;
        const pts = [];
        for (const p of poly) {
            if (pts.length === 0 || Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y) > 1e-7) {
                pts.push({ x: p.x, y: p.y });
            }
        }
        if (pts.length > 1 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) <= 1e-7) {
            pts.pop();
        }
        if (pts.length >= 3) {
            cleanedContours.push(pts);
        }
    }

    if (cleanedContours.length === 0) return [];

    if (hasClipper && earcutFn) {
        const SCALE = 1000000;
        const clipperPaths = cleanedContours.map(poly =>
            poly.map(pt => ({ X: Math.round(pt.x * SCALE), Y: Math.round(pt.y * SCALE) }))
        );

        const clipper = new ClipperLib.Clipper();
        clipper.AddPaths(clipperPaths, ClipperLib.PolyType.ptSubject, true);
        const polyTree = new ClipperLib.PolyTree();
        clipper.Execute(
            ClipperLib.ClipType.ctUnion,
            polyTree,
            ClipperLib.PolyFillType.pftNonZero,
            ClipperLib.PolyFillType.pftNonZero
        );

        const quads = [];

        function processPolyNode(node) {
            if (!node.IsHole()) {
                const outer = node.Contour().map(p => ({ x: p.X / SCALE, y: p.Y / SCALE }));
                const holes = [];
                for (let i = 0; i < node.ChildCount(); i++) {
                    const childNode = node.Childs()[i];
                    if (childNode.IsHole()) {
                        holes.push(childNode.Contour().map(p => ({ x: p.X / SCALE, y: p.Y / SCALE })));
                        for (let j = 0; j < childNode.ChildCount(); j++) {
                            processPolyNode(childNode.Childs()[j]);
                        }
                    }
                }
                const nodeQuads = triangulatePolygonWithEarcut(outer, holes, earcutFn);
                for (let k = 0; k < nodeQuads.length; k++) {
                    quads.push(nodeQuads[k]);
                }
            } else {
                for (let i = 0; i < node.ChildCount(); i++) {
                    processPolyNode(node.Childs()[i]);
                }
            }
        }

        for (let i = 0; i < polyTree.ChildCount(); i++) {
            processPolyNode(polyTree.Childs()[i]);
        }

        return quads;
    }

    if (typeof getEvenOddPaths === 'function' && typeof generateFillQuads === 'function') {
        const pathsToRender = getEvenOddPaths(cleanedContours);
        let fallbackQuads = [];
        for (const path of pathsToRender) {
            fallbackQuads = fallbackQuads.concat(generateFillQuads(path));
        }
        return fallbackQuads;
    }

    return [];
}

function triangulatePolygonWithEarcut(outer, holes, earcutFn) {
    if (!outer || outer.length < 3) return [];

    const points = [];
    const vertices = [];
    const holeIndices = [];

    for (const p of outer) {
        points.push(p);
        vertices.push(p.x, p.y);
    }

    let offset = outer.length;
    for (const hole of holes) {
        if (!hole || hole.length < 3) continue;
        holeIndices.push(offset);
        for (const p of hole) {
            points.push(p);
            vertices.push(p.x, p.y);
        }
        offset += hole.length;
    }

    let indices;
    try {
        indices = earcutFn(vertices, holeIndices, 2);
    } catch (e) {
        console.error('Earcut triangulation error:', e);
        return [];
    }

    if (!indices || indices.length < 3) return [];

    const triangles = [];
    for (let i = 0; i < indices.length; i += 3) {
        const p0 = points[indices[i]];
        const p1 = points[indices[i + 1]];
        const p2 = points[indices[i + 2]];
        if (!p0 || !p1 || !p2) continue;
        triangles.push([p0, p1, p2]);
    }

    return mergeTrianglesToQuads(triangles);
}

function mergeTrianglesToQuads(triangles) {
    if (!triangles || !triangles.length) return [];

    function samePoint(p1, p2) {
        return Math.hypot(p1.x - p2.x, p1.y - p2.y) < 1e-6;
    }

    function cross(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    function isConvex(pts) {
        let sign = 0;
        for (let i = 0; i < 4; i++) {
            const a = pts[i];
            const b = pts[(i + 1) % 4];
            const c = pts[(i + 2) % 4];
            const cr = cross(a, b, c);
            if (Math.abs(cr) < 1e-10) return false;
            if (sign === 0) {
                sign = cr > 0 ? 1 : -1;
            } else if ((cr > 0 ? 1 : -1) !== sign) {
                return false;
            }
        }
        return true;
    }

    function tryMerge(t1, t2) {
        let shared = 0;
        for (let p1 of t1) {
            if (t2.some(p2 => samePoint(p1, p2))) shared++;
        }
        if (shared !== 2) return null;

        const ptsList = [...t1];
        for (const p of t2) {
            if (!ptsList.some(pt => samePoint(pt, p))) ptsList.push(p);
        }
        if (ptsList.length !== 4) return null;

        const cx = (ptsList[0].x + ptsList[1].x + ptsList[2].x + ptsList[3].x) / 4;
        const cy = (ptsList[0].y + ptsList[1].y + ptsList[2].y + ptsList[3].y) / 4;
        ptsList.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
        return isConvex(ptsList) ? ptsList : null;
    }

    const m = triangles.length;
    const quadPairs = new Map();
    const adj = Array.from({ length: m }, () => []);

    for (let i = 0; i < m; i++) {
        for (let j = i + 1; j < m; j++) {
            const q = tryMerge(triangles[i], triangles[j]);
            if (q) {
                adj[i].push(j);
                adj[j].push(i);
                quadPairs.set(i + ':' + j, q);
            }
        }
    }

    const match = new Int32Array(m).fill(-1);
    const vis = new Uint8Array(m);

    function dfs(u) {
        for (const v of adj[u]) {
            if (vis[v]) continue;
            vis[v] = 1;
            if (match[v] < 0 || dfs(match[v])) {
                match[v] = u;
                match[u] = v;
                return true;
            }
        }
        return false;
    }

    for (let u = 0; u < m; u++) {
        if (match[u] < 0) {
            for (const v of adj[u]) {
                if (match[v] < 0) { match[u] = v; match[v] = u; break; }
            }
        }
    }
    for (let u = 0; u < m; u++) {
        if (match[u] < 0) {
            vis.fill(0);
            dfs(u);
        }
    }

    const quads = [];
    const used = new Uint8Array(m);
    for (let i = 0; i < m; i++) {
        if (used[i]) continue;
        const j = match[i];
        if (j > i) {
            quads.push(quadPairs.get(i + ':' + j));
            used[i] = 1;
            used[j] = 1;
        } else if (j < 0) {
            const t = triangles[i];
            quads.push([t[0], t[1], t[2], t[2]]);
            used[i] = 1;
        }
    }

    return quads;
}

function convertTextToLines() {
    const isFilled = document.getElementById('textFillCheckbox') && document.getElementById('textFillCheckbox').checked;
    if (!isFilled && previewTextLines.length === 0) return;
    if (isFilled && previewTextQuads.length === 0) return;

    let newObjects = [];
    
    if (isFilled) {
        previewTextQuads.forEach(q => {
            const objIdStr = nextId().toString();
            const object = {
                name: (typeof lang !== 'undefined' && lang.quad ? lang.quad : "Quad") + " " + objIdStr,
                type: "quad",
                pos1: { x: Math.round(q[0].x * 1000000) / 1000000, y: Math.round(q[0].y * 1000000) / 1000000 },
                pos2: { x: Math.round(q[1].x * 1000000) / 1000000, y: Math.round(q[1].y * 1000000) / 1000000 },
                pos3: { x: Math.round(q[2].x * 1000000) / 1000000, y: Math.round(q[2].y * 1000000) / 1000000 },
                pos4: { x: Math.round(q[3].x * 1000000) / 1000000, y: Math.round(q[3].y * 1000000) / 1000000 },
                selected: false
            };
            objects.set(objIdStr, object);
            newObjects.push({ id: objIdStr, object: object });
        });
    } else {
        previewTextLines.forEach(line => {
            const objIdStr = nextId().toString();
            const object = {
                name: (typeof lang !== 'undefined' && lang.line ? lang.line : "Line") + " " + objIdStr,
                type: "line",
                start: { x: Math.round(line.start.x * 1000000) / 1000000, y: Math.round(line.start.y * 1000000) / 1000000 },
                end:   { x: Math.round(line.end.x * 1000000) / 1000000,   y: Math.round(line.end.y * 1000000) / 1000000 },
                selected: false
            };
            objects.set(objIdStr, object);
            newObjects.push({ id: objIdStr, object: object });
        });
    }

    if (newObjects.length > 0) {
        pushEvent("add_multiple", newObjects);
    }
    
    refreshObjectsList(true);
    clearTextState();
}

window.addEventListener('load', () => {
    if (fontSelector && fontSelector.value && fontSelector.value !== "custom") {
        if(customFontDiv) customFontDiv.style.display = "none";
        loadExternalFont(fontSelector.value);
    }
});