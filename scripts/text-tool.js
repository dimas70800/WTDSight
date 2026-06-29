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
        const pathsToRender = getEvenOddPaths(textRegions);
        for (const path of pathsToRender) {
            const quads = generateFillQuads(path);
            previewTextQuads = previewTextQuads.concat(quads);
        }
    }
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