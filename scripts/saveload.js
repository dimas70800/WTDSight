const saver = el("saver");

function formSaveData() {
    const data = Object.fromEntries(objects);

    return JSON.stringify(data);
}

function sanitizeFileName(name) {
    if (!name) return "sight";

    if (name.toLowerCase().endsWith('.blk')) {
        name = name.slice(0, -4);
    }

    const ru2en = {
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };

    let processedName = name.split('').map(char => ru2en[char] !== undefined ? ru2en[char] : char).join('');

    processedName = processedName.replace(/[^a-zA-Z0-9_]/g, '_');
    processedName = processedName.replace(/_+/g, '_');
    processedName = processedName.replace(/^_|_$/g, '');

    if (!processedName) {
        return "sight";
    }

    return processedName;
}

async function save() {
    const file = new Blob([formSaveData()], { type: "application/json" });
    saver.href = URL.createObjectURL(file);

    const name = el("saveFileName").value;
    saver.download = name.length !== 0 ? name : "sight";
    saver.click();

    setTimeout(() => URL.revokeObjectURL(saver.href), 100);
}

el("loadButtonInput").onchange = () => {
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

function loadFromFile(e) {
    load(e.target.result);
}

function load(rawData, forceReplace = false) {
    const replace = forceReplace || (document.getElementById("replaceObjectsOnLoad")?.checked !== false);
    const loadedMap = new Map(Object.entries(JSON.parse(rawData)));

    if (replace) {
        objects = loadedMap;
        clearEvents();
    } else {
        for (const [_, obj] of loadedMap) {
            const newId = nextId().toString();
            objects.set(newId, obj);
        }
    }
    
    refreshObjectsList();
    unselectAnyObjects();
}

async function saveExport(data) {
    const file = new Blob([data], { type: "text/plain" });
    saver.href = URL.createObjectURL(file);

    const name = el("saveFileName").value;
    saver.download = name.length !== 0 ? name.trim() : "sight";
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

function applyScale(str, scale) {
    const val = parseFloat(str) * scale;
    return parseFloat(val.toFixed(9));
}
 
function loadFromBlk(text) {
    const newObjects = new Map();
    let idx = 0;
 
    const linesBlock = extractBlock(text, "drawLines");
    const quadsBlock = extractBlock(text, "drawQuads");
 
    const lineBlockPattern = /line\s*\{[^}]*\}/gi;
    const lineBlocks = linesBlock.match(lineBlockPattern) || [];
 
    for (const block of lineBlocks) {
        const coordMatch = block.match(/line:p4\s*=\s*(-?\d+\.?\d*(?:[eE][-+]?\d+)?)\s*,\s*(-?\d+\.?\d*(?:[eE][-+]?\d+)?)\s*,\s*(-?\d+\.?\d*(?:[eE][-+]?\d+)?)\s*,\s*(-?\d+\.?\d*(?:[eE][-+]?\d+)?)/i);
        const lineThousandth = /thousandth\s*:\s*b\s*=\s*(yes|true)/i.test(block);
        const scale = lineThousandth ? 0.001 : 1;
        if (coordMatch) {
            newObjects.set(String(idx), {
                name: (typeof lang !== 'undefined' ? lang.line : "Линия") + " " + idx,
                type: "line",
                start: { x: applyScale(coordMatch[1], scale), y: applyScale(coordMatch[2], scale) },
                end: { x: applyScale(coordMatch[3], scale), y: applyScale(coordMatch[4], scale) },
                selected: false
            });
            idx++;
        }
    }
 
    const quadBlocks = quadsBlock.match(/quad\s*\{[^}]*\}/gi) || [];
 
    for (const block of quadBlocks) {
        const tlMatch = block.match(/tl:p2\s*=\s*(-?\d+\.?\d*(?:[eE][-+]?\d+)?)\s*,\s*(-?\d+\.?\d*(?:[eE][-+]?\d+)?)/i);
        const trMatch = block.match(/tr:p2\s*=\s*(-?\d+\.?\d*(?:[eE][-+]?\d+)?)\s*,\s*(-?\d+\.?\d*(?:[eE][-+]?\d+)?)/i);
        const brMatch = block.match(/br:p2\s*=\s*(-?\d+\.?\d*(?:[eE][-+]?\d+)?)\s*,\s*(-?\d+\.?\d*(?:[eE][-+]?\d+)?)/i);
        const blMatch = block.match(/bl:p2\s*=\s*(-?\d+\.?\d*(?:[eE][-+]?\d+)?)\s*,\s*(-?\d+\.?\d*(?:[eE][-+]?\d+)?)/i);
        const quadThousandth = /thousandth\s*:\s*b\s*=\s*(yes|true)/i.test(block);
        const scale = quadThousandth ? 0.001 : 1;
 
        if (tlMatch && trMatch && brMatch && blMatch) {
            newObjects.set(String(idx), {
                name: (typeof lang !== 'undefined' ? lang.quad : "Четырёхугольник") + " " + idx,
                type: "quad",
                pos1: { x: applyScale(tlMatch[1], scale), y: applyScale(tlMatch[2], scale) },
                pos2: { x: applyScale(trMatch[1], scale), y: applyScale(trMatch[2], scale) },
                pos3: { x: applyScale(brMatch[1], scale), y: applyScale(brMatch[2], scale) },
                pos4: { x: applyScale(blMatch[1], scale), y: applyScale(blMatch[2], scale) },
                selected: false
            });
            idx++;
        }
    }
 
    if (newObjects.size === 0) {
        alert('Не найдено объектов для импорта. Проверьте формат BLK файла.');
        return;
    }
 
    const replace = document.getElementById("replaceObjectsOnLoad")?.checked !== false;
 
    if (replace) {
        objects = newObjects;
        clearEvents();
    } else {
        for (const [_, obj] of newObjects) {
            const newId = nextId().toString();
            objects.set(newId, obj);
        }
    }
 
    refreshObjectsList();
    unselectAnyObjects();
    
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

let archiveFilesQueue = [];

function updateArchiveListUI() {
    const list = el("archiveFilesList");
    if (!list) return;

    list.innerHTML = "";

    archiveFilesQueue.forEach((file, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.style.display = "flex";
        itemDiv.style.justify = "space-between";
        itemDiv.style.alignItems = "center";
        itemDiv.style.padding = "4px 2px";
        itemDiv.style.paddingLeft = "6px";
        itemDiv.style.borderRadius = "4px";
        itemDiv.style.background = "rgba(255, 255, 255, 0.03)";
        itemDiv.style.fontSize = "14px";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = file.name;
        nameSpan.title = file.name;
        nameSpan.style.overflow = "hidden";
        nameSpan.style.textOverflow = "ellipsis";
        nameSpan.style.whiteSpace = "nowrap";
        nameSpan.style.maxWidth = "85%";
        nameSpan.style.flex = "1";
        nameSpan.style.marginRight = "8px";

        const deleteBtn = document.createElement("span");
        deleteBtn.innerHTML = "<img src='images/trashIcon.svg' alt='Trash'>";
        deleteBtn.style.cursor = "pointer";
        deleteBtn.style.opacity = "0";
        deleteBtn.style.transition = "opacity 0.15s ease";
        deleteBtn.style.fontSize = "13px";
        deleteBtn.style.width = "1.5em";
        deleteBtn.style.height = "1.5em";
        deleteBtn.style.margin = "4px";

        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            archiveFilesQueue.splice(index, 1);
            updateArchiveListUI();
        };

        itemDiv.onmouseenter = () => {
            itemDiv.style.background = "rgba(255, 255, 255, 0.08)";
            deleteBtn.style.opacity = "1";
        };
        itemDiv.onmouseleave = () => {
            itemDiv.style.background = "rgba(255, 255, 255, 0.03)";
            deleteBtn.style.opacity = "0";
        };

        itemDiv.appendChild(nameSpan);
        itemDiv.appendChild(deleteBtn);
        list.appendChild(itemDiv);
    });
}

function addCurrentSightToArchive() {
    try {
        const settings = saveExportSettings();
        let blkContent = generateBlkContent(settings);
        blkContent = addDrawingObjectsToBlk(blkContent);

        const rawName = el("saveFileName").value;
        const cleanName = sanitizeFileName(rawName);
        const fileName = cleanName.endsWith(".blk") ? cleanName : cleanName + ".blk";

        const existingIndex = archiveFilesQueue.findIndex(f => f.name === fileName);
        if (existingIndex !== -1) {
            archiveFilesQueue[existingIndex].content = blkContent;
        } else {
            archiveFilesQueue.push({ name: fileName, content: blkContent });
        }

        updateArchiveListUI();

        if (typeof showNotification === 'function') {
            showNotification(typeof lang !== 'undefined' && lang === en ? "Sight added to archive!" : "Прицел добавлен в архив!");
        }
    } catch (error) {
        console.error("Ошибка добавления прицела:", error);
        alert("Не удалось сгенерировать прицел: " + error.message);
    }
}

const archiveFileInput = el("archiveFileInput");
if (archiveFileInput) {
    archiveFileInput.addEventListener("change", (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            const existingIndex = archiveFilesQueue.findIndex(f => f.name === file.name);

            const fileData = {
                name: file.name,
                content: file
            };

            if (existingIndex !== -1) {
                archiveFilesQueue[existingIndex] = fileData;
            } else {
                archiveFilesQueue.push(fileData);
            }
            updateArchiveListUI();
        });

        archiveFileInput.value = "";
    });
}

async function createZipArchive() {
    if (archiveFilesQueue.length === 0) {
        alert(typeof lang !== 'undefined' && lang === en ? "The file list is empty!" : "Список файлов пуст!");
        return;
    }

    if (typeof JSZip === 'undefined') {
        alert("Библиотека JSZip не найдена");
        return;
    }

    try {
        const zip = new JSZip();

        const folder = zip.folder("UserSights").folder("all_tanks");

        archiveFilesQueue.forEach(file => {
            const isBinary = file.content instanceof Blob || file.content instanceof File;

            folder.file(file.name, file.content, { binary: isBinary });
        });

        let archiveName = el("archiveFileName").value;
        if (!archiveName || archiveName.trim() === "") archiveName = "MySights";
        if (!archiveName.endsWith(".zip")) archiveName += ".zip";

        const blobContent = await zip.generateAsync({ type: "blob" });

        const url = window.URL.createObjectURL(blobContent);
        const tempLink = document.createElement('a');
        tempLink.style.display = 'none';
        tempLink.href = url;
        tempLink.download = archiveName;

        document.body.appendChild(tempLink);
        tempLink.click();

        setTimeout(() => {
            document.body.removeChild(tempLink);
            window.URL.revokeObjectURL(url);
        }, 100);

    } catch (error) {
        console.error("Ошибка архивации:", error);
        alert("Ошибка при создании архива: " + error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const shareBtn = document.getElementById('shareSightBtn');
    const copyBtn = document.getElementById('copyShareLinkBtn');

    if (shareBtn) {
        shareBtn.addEventListener('click', shareSight);
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const input = document.getElementById('shareLinkInput');
            if (input && input.value) {
                navigator.clipboard.writeText(input.value);
                if (typeof showNotification === 'function') {
                    showNotification(typeof lang !== 'undefined' && lang === en ? "Copied!" : "Скопировано!");
                }
            }
        });
    }
});

async function shareSight() {
    const shareBtn = el("shareSightBtn");
    const linkContainer = el("shareLinkContainer");
    const linkInput = el("shareLinkInput");

    if (!shareBtn) return;

    const originalText = shareBtn.innerHTML;
    shareBtn.innerHTML = (typeof lang !== 'undefined' && lang === en) ? "⏳ Creating link..." : "⏳ Создание ссылки...";
    shareBtn.disabled = true;
    linkContainer.style.display = "none";

    try {
        const data = formSaveData();

        const blob = new Blob([data], { type: "application/json" });
        const formData = new FormData();

        formData.append("reqtype", "fileupload");
        formData.append("time", "1h"); //1h, 12h, 24h или 72h
        formData.append("fileToUpload", blob, "sight.json");

        const response = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Catbox returned error status");

        const fileUrl = await response.text();

        if (!fileUrl.startsWith("https://")) {
            throw new Error("Invalid response from Catbox: " + fileUrl);
        }

        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?share=${encodeURIComponent(fileUrl.trim())}`;

        linkInput.value = shareUrl;
        linkContainer.style.display = "flex";

        try {
            try {
                await navigator.clipboard.writeText(shareUrl);
                showNotification(typeof lang !== 'undefined' && lang === en ? "Link generated and copied!" : "Ссылка создана и скопирована!");
            } catch (clipboardErr) {
                try {
                    linkInput.select();
                    linkInput.setSelectionRange(0, 99999);
                    const successful = document.execCommand('copy');
                    if (successful) {
                        showNotification(typeof lang !== 'undefined' && lang === en ? "Link generated and copied!" : "Ссылка создана и скопирована!");
                    }
                } catch (err) {
                    showNotification(typeof lang !== 'undefined' && lang === en ? "Link generated!" : "Ссылка создана!");
                }
            }
            if (typeof showNotification === 'function') {
                showNotification(typeof lang !== 'undefined' && lang === en
                    ? "Link generated and copied!"
                    : "Ссылка создана и скопирована!");
            }
        } catch (clipboardErr) {
            if (typeof showNotification === 'function') {
                showNotification(typeof lang !== 'undefined' && lang === en ? "Link generated!" : "Ссылка создана!");
            }
        }

    } catch (e) {
        console.error("Share error:", e);
        if (typeof showNotification === 'function') {
            showNotification(typeof lang !== 'undefined' && lang === en
                ? "Error creating share link. Try again."
                : "Ошибка создания ссылки. Попробуйте еще раз.", true);
        }
    } finally {
        shareBtn.innerHTML = originalText;
        shareBtn.disabled = false;
    }
}

window.addEventListener('load', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const fileUrl = urlParams.get('share');

    if (fileUrl) {
        try {
            window.history.replaceState({}, document.title, window.location.pathname);

            if (typeof showNotification === 'function') {
                showNotification(typeof lang !== 'undefined' && lang === en ? "Loading sight..." : "Загрузка прицела...");
            }

            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error("File could not be fetched");

            const loadedData = await response.text();

            JSON.parse(loadedData);

            load(loadedData);

            if (typeof showNotification === 'function') {
                showNotification(typeof lang !== 'undefined' && lang === en ? "Sight loaded successfully!" : "Прицел успешно загружен!");
            }
        } catch (e) {
            console.error("Load shared sight error:", e);
            if (typeof showNotification === 'function') {
                showNotification(typeof lang !== 'undefined' && lang === en
                    ? "Failed to load sight. Link might be expired or blocked."
                    : "Не удалось загрузить прицел. Возможно, ссылка истекла или заблокирована.", true);
            }
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const dragDropOverlay = document.getElementById('dragDropOverlay');
    
    let dragCounter = 0;

    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        dragDropOverlay.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            dragDropOverlay.classList.remove('active');
        }
    });

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        dragDropOverlay.classList.remove('active');

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            const name = file.name.toLowerCase();

            if (name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (typeof load === 'function') {
                        load(ev.target.result);
                    }
                };
                reader.readAsText(file);
            }
            else if (name.endsWith('.blk') || name.endsWith('.txt')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (typeof loadFromBlk === 'function') {
                        loadFromBlk(ev.target.result);
                    }
                };
                reader.readAsText(file);
            }
            else if (file.type.startsWith('image/')) {
                if (typeof referenceArray !== 'undefined' && typeof currentReference !== 'undefined') {
                    referenceArray[currentReference].fileName = file.name;
                    const url = URL.createObjectURL(file);
                    const img = new Image();
                    img.onload = () => {
                        referenceArray[currentReference].obj = img;
                        referenceArray[currentReference].url = null;
                        
                        if (typeof setReferenceMenu === 'function') setReferenceMenu();
                    };
                    img.src = url;
                }
            } 
            
            else {
                if (typeof showNotification === 'function') {
                    showNotification((typeof lang !== 'undefined' && lang === en) ? "Unsupported file format!" : "Неподдерживаемый формат файла!", true);
                }
            }
        }
    });
});