const saver = el("saver");

function formSaveData()
{
    const data = Object.fromEntries(objects);

    return JSON.stringify(data);
}

async function save()
{
    const file = new Blob([formSaveData()], {type: "application/json"});
    saver.href = URL.createObjectURL(file);

    const name = el("saveFileName").value;
    saver.download = name.length !== 0 ? name : "sight";
    saver.click();

    setTimeout(() => URL.revokeObjectURL(saver.href), 100);
}

el("loadButtonInput").onchange = () =>
{
    const fileInput = el("loadButtonInput");
    const file = fileInput.files[0];
    
    if (!file) return;
    
    const fr = new FileReader();
    fr.onload = (e) => {
        loadFromFile(e);
        fileInput.value = "";
    };
    fr.onerror = () => {
        fileInput.value = "";
    };
    fr.readAsText(file);
};

function loadFromFile(e)
{
    load(e.target.result);
}

function load(rawData)
{
    objects = new Map(Object.entries(JSON.parse(rawData)));
    refreshObjectsList();
    unselectAnyObjects();
    clearEvents();
}

async function saveExport(data)
{
    const file = new Blob([data], {type: "text/plain"});
    saver.href = URL.createObjectURL(file);

    const name = el("saveFileName").value;
    saver.download = name.length !== 0 ? name : "sight";
    saver.click();
}

function extractBlock(text, blockName) {
    const pattern = new RegExp(blockName + '\\s*\\{');
    const match = text.match(pattern);
    if (!match) return "";
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < text.length) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
            depth--;
            if (depth === 0) return text.substring(start, i);
        }
        i++;
    }
    return "";
}

function loadFromBlk(text) {
    const newObjects = new Map();
    let idx = 0;

    const linesBlock = extractBlock(text, "drawLines");
    const quadsBlock = extractBlock(text, "drawQuads");

    const lineBlockPattern = /line\s*\{[^}]*\}/gi;
    const lineBlocks = linesBlock.match(lineBlockPattern) || [];
    
    for (const block of lineBlocks) {
        const coordMatch = block.match(/line:p4\s*=\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i);
        if (coordMatch) {
            newObjects.set(String(idx), {
                name: (typeof lang !== 'undefined' ? lang.line : "Линия") + " " + idx,
                type: "line",
                start: { x: parseFloat(coordMatch[1]), y: parseFloat(coordMatch[2]) },
                end: { x: parseFloat(coordMatch[3]), y: parseFloat(coordMatch[4]) },
                selected: false
            });
            idx++;
        }
    }

    const quadBlocks = quadsBlock.match(/quad\s*\{[^}]*\}/gi) || [];
    
    for (const block of quadBlocks) {
        const tlMatch = block.match(/tl:p2\s*=\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i);
        const trMatch = block.match(/tr:p2\s*=\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i);
        const brMatch = block.match(/br:p2\s*=\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i);
        const blMatch = block.match(/bl:p2\s*=\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i);
        
        if (tlMatch && trMatch && brMatch && blMatch) {
            newObjects.set(String(idx), {
                name: (typeof lang !== 'undefined' ? lang.quad : "Четырёхугольник") + " " + idx,
                type: "quad",
                pos1: { x: parseFloat(tlMatch[1]), y: parseFloat(tlMatch[2]) },
                pos2: { x: parseFloat(trMatch[1]), y: parseFloat(trMatch[2]) },
                pos3: { x: parseFloat(brMatch[1]), y: parseFloat(brMatch[2]) },
                pos4: { x: parseFloat(blMatch[1]), y: parseFloat(blMatch[2]) },
                selected: false
            });
            idx++;
        }
    }

    if (newObjects.size === 0) {
        alert('Не найдено объектов для импорта. Проверьте формат BLK файла.');
        return;
    }

    objects = newObjects;
    refreshObjectsList();
    unselectAnyObjects();
    clearEvents();
    
    if (typeof showNotification === 'function') {
        showNotification(`${lang.loaded} ${newObjects.size} ${lang.objectsFromBLK}`);
    }
}

el("loadBlkInput").onchange = () => {
    const fileInput = el("loadBlkInput");
    const file = fileInput.files[0];
    if (!file) return;
    
    const fr = new FileReader();
    fr.onload = (e) => {
        loadFromBlk(e.target.result);
        fileInput.value = "";
    };
    fr.onerror = () => {
        fileInput.value = "";
    };
    fr.readAsText(file);
};