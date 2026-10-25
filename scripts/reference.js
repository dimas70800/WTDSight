function createEmptyReference() {
    return {
        obj: null,
        originalObj: null,
        isEnhanced: false,
        size: 1,
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 0.5,
        url: null,
        fileName: "",
        originalBlob: null
    };
}

const referenceArray = [createEmptyReference()];
let currentReference = 0;
if (typeof window !== 'undefined') {
    window.referenceArray = referenceArray;
}

const REF_DB_NAME = "wtdsight_references";
const REF_STORE_NAME = "references_store";
let isSaveRefOnReload = false;
let isRefStorageLoaded = false;
let saveRefTimeout = null;
let cachedRefDB = null;

function openRefDB() {
    if (cachedRefDB) return Promise.resolve(cachedRefDB);
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || !window.indexedDB) return resolve(null);
        try {
            const req = indexedDB.open(REF_DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(REF_STORE_NAME)) {
                    db.createObjectStore(REF_STORE_NAME);
                }
            };
            req.onsuccess = () => {
                cachedRefDB = req.result;
                cachedRefDB.onclose = () => { cachedRefDB = null; };
                cachedRefDB.onversionchange = () => { cachedRefDB.close(); cachedRefDB = null; };
                resolve(cachedRefDB);
            };
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

async function saveReferencesToStorage() {
    if (!isSaveRefOnReload) return;
    try {
        const db = await openRefDB();
        if (!db) return;
        const validRefs = referenceArray.filter(ref => ref && (ref.originalBlob != null || (typeof ref.url === 'string' && ref.url.trim() !== "")));

        let savedCurrentIdx = 0;
        let validCount = 0;
        for (let i = 0; i < referenceArray.length; i++) {
            const r = referenceArray[i];
            const isValid = r && (r.originalBlob != null || (typeof r.url === 'string' && r.url.trim() !== ""));
            if (i === currentReference) {
                savedCurrentIdx = validCount;
            }
            if (isValid) {
                validCount++;
            }
        }

        const dataToSave = {
            currentIndex: savedCurrentIdx,
            items: validRefs.map(ref => ({
                size: ref.size,
                x: ref.x,
                y: ref.y,
                rotation: ref.rotation,
                opacity: ref.opacity,
                fileName: ref.fileName || "",
                url: ref.url || null,
                blob: ref.originalBlob || null
            }))
        };
        const tx = db.transaction(REF_STORE_NAME, "readwrite");
        const store = tx.objectStore(REF_STORE_NAME);
        store.put(dataToSave, "all_references");
        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } catch (e) {
        console.warn("Failed to save references to storage:", e);
    }
}

function scheduleSaveReferences() {
    if (!isSaveRefOnReload) return;
    if (saveRefTimeout) clearTimeout(saveRefTimeout);
    saveRefTimeout = setTimeout(() => {
        saveRefTimeout = null;
        saveReferencesToStorage();
    }, 250);
}

async function clearSavedReferences() {
    try {
        const db = await openRefDB();
        if (!db) return;
        const tx = db.transaction(REF_STORE_NAME, "readwrite");
        const store = tx.objectStore(REF_STORE_NAME);
        store.delete("all_references");
        await new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } catch (e) {
        console.warn("Failed to clear references in storage:", e);
    }
}

async function loadReferencesFromStorage() {
    if (!isSaveRefOnReload) return false;
    try {
        const db = await openRefDB();
        if (!db) return false;
        const savedData = await new Promise((resolve) => {
            const tx = db.transaction(REF_STORE_NAME, "readonly");
            const store = tx.objectStore(REF_STORE_NAME);
            const req = store.get("all_references");
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });

        const rawItems = (savedData && Array.isArray(savedData.items)) ? savedData.items : [];
        const validItems = rawItems.filter(item => {
            return item && (item.blob != null || (typeof item.url === 'string' && item.url.trim() !== ""));
        });

        if (validItems.length === 0) {
            referenceArray.forEach(revokeReferenceBlobs);
            referenceArray.length = 0;
            referenceArray.push(createEmptyReference());
            currentReference = 0;
            setReferenceMenu();
            return false;
        }

        referenceArray.forEach(revokeReferenceBlobs);
        referenceArray.length = 0;

        for (const item of validItems) {
            const ref = createEmptyReference();
            ref.size = typeof item.size === 'number' ? item.size : 1;
            ref.x = typeof item.x === 'number' ? item.x : 0;
            ref.y = typeof item.y === 'number' ? item.y : 0;
            ref.rotation = typeof item.rotation === 'number' ? item.rotation : 0;
            ref.opacity = 0.5;
            ref.fileName = item.fileName || "";
            ref.url = item.url || null;
            ref.originalBlob = item.blob || null;

            if (item.blob) {
                const blobUrl = URL.createObjectURL(item.blob);
                const img = new Image();
                img.onload = () => {
                    ref.obj = img;
                    ref.originalObj = img;
                    if (typeof setReferenceMenu === 'function') setReferenceMenu();
                };
                img.src = blobUrl;
            } else if (item.url) {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => {
                    ref.obj = img;
                    ref.originalObj = img;
                    if (typeof setReferenceMenu === 'function') setReferenceMenu();
                };
                img.src = item.url;
            }
            referenceArray.push(ref);
        }

        if (referenceArray.length === 0) {
            referenceArray.push(createEmptyReference());
        }

        const targetIdx = (typeof savedData.currentIndex === 'number') ? savedData.currentIndex : 0;
        currentReference = Math.max(0, Math.min(targetIdx, referenceArray.length - 1));
        setReferenceMenu();
        return true;
    } catch (e) {
        console.warn("Failed to load references from storage:", e);
        return false;
    }
}

function toggleSaveRefOnReload(checked) {
    isSaveRefOnReload = !!checked;
    if (isSaveRefOnReload) {
        saveReferencesToStorage();
    } else {
        clearSavedReferences();
    }
    if (typeof saveAllSettings === 'function') {
        saveAllSettings();
    }
}

async function applySaveRefOnReloadSetting(enabled) {
    isSaveRefOnReload = !!enabled;
    const chk = el('saveRefOnReloadCheckBox');
    if (chk) chk.checked = isSaveRefOnReload;

    if (isSaveRefOnReload && !isRefStorageLoaded) {
        isRefStorageLoaded = true;
        await loadReferencesFromStorage();
    }
}

async function initRefStorage() {
    if (isRefStorageLoaded) return;
    if (typeof loadSettings === 'function') {
        const s = loadSettings();
        if (s && s.saveRefOnReload) {
            await applySaveRefOnReloadSetting(true);
        }
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRefStorage);
    } else {
        initRefStorage();
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (isSaveRefOnReload && saveRefTimeout) {
            clearTimeout(saveRefTimeout);
            saveRefTimeout = null;
            saveReferencesToStorage();
        }
    });
}

function setReference() {
    const url = el("refUrl").value;
    if (url && url.trim() !== "") {
        setReferenceSrc(url);
    }
}

function setReferenceSize() {
    referenceArray[currentReference].size = parseFloat(el("refSize").value);
    scheduleSaveReferences();
}

function setReferenceX() {
    referenceArray[currentReference].x = parseFloat(el("refShiftX").value);
    scheduleSaveReferences();
}

function setReferenceY() {
    referenceArray[currentReference].y = -parseFloat(el("refShiftY").value);
    scheduleSaveReferences();
}

function setReferenceRotation() {
    referenceArray[currentReference].rotation = parseFloat(el("refRotation").value);
    scheduleSaveReferences();
}

function setReferenceOpacity() {
    const val = parseFloat(el("refOpacityInput").value);
    referenceArray[currentReference].opacity = val;

    const sharedSlider = el("refOpacityInputShared");
    if (sharedSlider) {
        sharedSlider.value = val;
    }
    scheduleSaveReferences();
}

function setReferenceOpacityShared(value) {
    const mainSlider = el("refOpacityInput");
    if (mainSlider) {
        mainSlider.value = value;
    }
    referenceArray[currentReference].opacity = parseFloat(value);
    scheduleSaveReferences();
}

function revokeReferenceBlobs(ref) {
    if (!ref) return;
    if (ref.obj && ref.obj.src && ref.obj.src.startsWith('blob:')) {
        URL.revokeObjectURL(ref.obj.src);
    }
    if (ref.originalObj && ref.originalObj.src && ref.originalObj.src.startsWith('blob:') && ref.originalObj !== ref.obj) {
        URL.revokeObjectURL(ref.originalObj.src);
    }
}

const refFileInputElem = el("refFile");
if (refFileInputElem) {
    refFileInputElem.onchange = () => {
        if (typeof abortCurrentEnhancement === 'function') abortCurrentEnhancement();
        const file = refFileInputElem.files[0];
        if (!file) return;

        const ref = referenceArray[currentReference];
        revokeReferenceBlobs(ref);
        ref.fileName = file.name;
        ref.originalBlob = file;
        ref.url = null;
        ref.isEnhanced = false;

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            ref.obj = img;
            ref.originalObj = img;
            setReferenceMenu();
            saveReferencesToStorage();
            refFileInputElem.value = "";
        };
        img.src = url;
    };
}

function setReferenceSrc(url) {
    if (typeof abortCurrentEnhancement === 'function') abortCurrentEnhancement();
    const ref = referenceArray[currentReference];
    revokeReferenceBlobs(ref);
    ref.fileName = "";
    ref.originalBlob = null;
    ref.url = url;
    ref.isEnhanced = false;
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
        ref.obj = img;
        ref.originalObj = img;
        setReferenceMenu();
        saveReferencesToStorage();
    };
    img.onerror = () => {
        console.error("Failed to load image:", url);
        ref.obj = null;
        ref.originalObj = null;
        ref.url = null;
        setReferenceMenu();
        saveReferencesToStorage();
    };
    img.src = url;
}

function updateReferenceNavUI() {
    const input = el("refIndexInput");
    if (input) {
        if (document.activeElement === input) {
            input.value = currentReference + 1;
        } else {
            input.value = (currentReference + 1) + "/" + referenceArray.length;
        }
    }
    const addBtn = el("addRefBtn");
    if (addBtn) {
        if (referenceArray.length >= 20) {
            addBtn.disabled = true;
            addBtn.style.opacity = "0.5";
            addBtn.style.cursor = "not-allowed";
        } else {
            addBtn.disabled = false;
            addBtn.style.opacity = "1";
            addBtn.style.cursor = "pointer";
        }
    }
}

function onRefIndexFocus(input) {
    if (!input) input = el("refIndexInput");
    if (input) {
        input.value = currentReference + 1;
        input.select();
    }
}

function onRefIndexBlur(input) {
    if (!input) input = el("refIndexInput");
    if (!input) return;
    let val = parseInt(input.value, 10);
    if (!isNaN(val)) {
        val = Math.max(1, Math.min(val, referenceArray.length));
        const newIdx = val - 1;
        if (newIdx !== currentReference) {
            if (typeof abortCurrentEnhancement === 'function') abortCurrentEnhancement();
            currentReference = newIdx;
            setReferenceMenu();
            scheduleSaveReferences();
            return;
        }
    }
    updateReferenceNavUI();
}

function changeReference(dir) {
    if (referenceArray.length <= 1) return;
    if (typeof abortCurrentEnhancement === 'function') abortCurrentEnhancement();
    currentReference = (currentReference + dir + referenceArray.length) % referenceArray.length;
    setReferenceMenu();
    scheduleSaveReferences();
}

function setReferenceFromInput() {
    onRefIndexBlur(el("refIndexInput"));
}

function addReferenceSlot() {
    if (referenceArray.length >= 20) {
        if (typeof showNotification === 'function') {
            const isEn = (typeof lang !== 'undefined' && typeof en !== 'undefined' && lang === en);
            showNotification(isEn ? "Maximum 20 reference slots!" : "Максимум 20 слотов для референсов!", true);
        }
        return;
    }
    if (typeof abortCurrentEnhancement === 'function') abortCurrentEnhancement();
    referenceArray.push(createEmptyReference());
    currentReference = referenceArray.length - 1;
    setReferenceMenu();
    scheduleSaveReferences();
}

function deleteReferenceSlot() {
    if (typeof abortCurrentEnhancement === 'function') abortCurrentEnhancement();
    if (referenceArray.length > 1) {
        revokeReferenceBlobs(referenceArray[currentReference]);
        referenceArray.splice(currentReference, 1);
        if (currentReference >= referenceArray.length) {
            currentReference = referenceArray.length - 1;
        }
    } else {
        revokeReferenceBlobs(referenceArray[0]);
        referenceArray[0] = createEmptyReference();
        currentReference = 0;
    }
    setReferenceMenu();
    saveReferencesToStorage();
}

if (typeof window !== 'undefined') {
    window.changeReference = changeReference;
    window.setReferenceFromInput = setReferenceFromInput;
    window.onRefIndexFocus = onRefIndexFocus;
    window.onRefIndexBlur = onRefIndexBlur;
    window.addReferenceSlot = addReferenceSlot;
    window.deleteReferenceSlot = deleteReferenceSlot;
    window.toggleSaveRefOnReload = toggleSaveRefOnReload;
    window.saveReferencesToStorage = saveReferencesToStorage;
    window.scheduleSaveReferences = scheduleSaveReferences;
    window.applySaveRefOnReloadSetting = applySaveRefOnReloadSetting;
    window.loadReferencesFromStorage = loadReferencesFromStorage;
    window.clearSavedReferences = clearSavedReferences;
}

function setReferenceMenu() {
    updateReferenceNavUI();

    const nextBtn = el("nextRefButton");
    if (nextBtn) nextBtn.innerHTML = (currentReference + 1) + "/" + referenceArray.length + " >";

    const ref = referenceArray[currentReference];
    if (!ref) return;
    const urlInput = el("refUrl");

    if (ref.url) {
        urlInput.value = ref.url;
    } else {
        urlInput.value = "";
    }

    el("refSize").value = ref.size;
    el("refShiftX").value = ref.x;
    el("refShiftY").value = -ref.y;
    el("refRotation").value = ref.rotation;
    el("refOpacityInput").value = ref.opacity;

    const sharedSlider = el("refOpacityInputShared");
    if (sharedSlider) {
        sharedSlider.value = ref.opacity;
    }

    const fileNameSpan = el("refFileName");
    if (fileNameSpan) {
        if (ref.fileName) {
            fileNameSpan.textContent = ref.fileName;
        } else if (ref.url) {
            const isRu = (typeof lang === 'undefined' || typeof ru === 'undefined' || lang === ru);
            fileNameSpan.textContent = isRu ? "Загружено по URL" : "Loaded from URL";
        } else {
            fileNameSpan.textContent = "";
        }
    }
    if (typeof updateRefEnhanceButtonState === 'function') {
        updateRefEnhanceButtonState();
    }
}

let isRefFreeMove = false;
let refTransformState = {
    action: null,
    startRef: null,
    startMouse: null,
    startAngle: 0,
    offsetX: 0,
    offsetY: 0
};

function getRefTransformBox() {
    const ref = referenceArray[currentReference];
    if (!ref || !ref.obj) return null;
    const aspectRatio = ref.obj.width / ref.obj.height;
    return {
        cx: ref.x,
        cy: ref.y,
        w: ref.size * aspectRatio,
        h: ref.size,
        angle: ref.rotation * Math.PI / 180
    };
}

var WAIFU2X_MODEL_URL = "https://huggingface.co/deepghs/waifu2x_onnx/resolve/main/20250502/onnx_models/swin_unet/art/noise3_scale2x.onnx";
var ORT_WASM_JSEP_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort-wasm-simd-threaded.jsep.wasm";

var WAIFU2X_MODEL_SIZE = 16727049;
var ORT_WASM_JSEP_SIZE = 28312028;
var WAIFU2X_DB_NAME = "wtdsight_ai_models";
var WAIFU2X_DB_STORE = "models";

var cachedWasmBuffer = null;
var cachedModelBuffer = null;
var isModelCached = false;
var pendingDownloadBytes = 0;
var isEnhancing = false;
var currentUpscaleWorker = null;

document.addEventListener('DOMContentLoaded', () => {
    const cb = document.getElementById('refFreeMoveCheckbox');
    if (cb) {
        cb.addEventListener('change', (e) => {
            isRefFreeMove = e.target.checked;
        });
    }
    checkModelCache();
});

function openModelsDB() {
    return new Promise((resolve) => {
        if (!window.indexedDB) return resolve(null);
        try {
            const req = indexedDB.open(WAIFU2X_DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(WAIFU2X_DB_STORE)) {
                    db.createObjectStore(WAIFU2X_DB_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

async function hasCachedFile(url) {
    try {
        const db = await openModelsDB();
        if (db) {
            return await new Promise((resolve) => {
                const tx = db.transaction(WAIFU2X_DB_STORE, "readonly");
                const store = tx.objectStore(WAIFU2X_DB_STORE);
                const req = store.count(url);
                req.onsuccess = () => resolve(req.result > 0);
                req.onerror = () => resolve(false);
            });
        }
    } catch (e) {}
    return false;
}

async function getCachedFileBuffer(url) {
    try {
        const db = await openModelsDB();
        if (db) {
            return await new Promise((resolve) => {
                const tx = db.transaction(WAIFU2X_DB_STORE, "readonly");
                const store = tx.objectStore(WAIFU2X_DB_STORE);
                const req = store.get(url);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        }
    } catch (e) {}
    return null;
}

async function saveCachedFile(url, buffer) {
    try {
        const db = await openModelsDB();
        if (db) {
            await new Promise((resolve) => {
                const tx = db.transaction(WAIFU2X_DB_STORE, "readwrite");
                const store = tx.objectStore(WAIFU2X_DB_STORE);
                const req = store.put(buffer, url);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
            });
        }
    } catch (e) {}
}

async function downloadFileWithProgress(url, defaultSize, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const contentLength = res.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : defaultSize;

    const reader = res.body.getReader();
    const chunks = [];
    let loadedBytes = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loadedBytes += value.length;
        if (onProgress && totalBytes > 0) {
            onProgress(loadedBytes, totalBytes);
        }
    }

    const combined = new Uint8Array(loadedBytes);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
    }

    const buffer = combined.buffer;
    await saveCachedFile(url, buffer);
    return buffer;
}

async function checkModelCache() {
    const wasmCached = !!cachedWasmBuffer || await hasCachedFile(ORT_WASM_JSEP_URL);
    const modelCached = !!cachedModelBuffer || await hasCachedFile(WAIFU2X_MODEL_URL);

    let needed = 0;
    if (!wasmCached) needed += ORT_WASM_JSEP_SIZE;
    if (!modelCached) needed += WAIFU2X_MODEL_SIZE;
    pendingDownloadBytes = needed;

    isModelCached = (pendingDownloadBytes === 0);
    updateRefEnhanceButtonState();
}

function getRefEnhanceButtonText() {
    const isEn = (typeof lang !== 'undefined' && lang === en);
    const baseText = (typeof lang !== 'undefined' && lang.refEnhanceBtn) ? lang.refEnhanceBtn : (isEn ? "Enhance photo" : "Улучшить фото");
    if (isModelCached || pendingDownloadBytes <= 0) {
        return baseText;
    }
    const mb = (pendingDownloadBytes / 1000000).toFixed(1);
    const sizeStr = isEn ? `${mb} MB` : `${mb} МБ`;
    return `${baseText} (${sizeStr})`;
}

function updateRefEnhanceButtonState() {
    const btn = el("refEnhanceBtn");
    const txt = el("refEnhanceBtnText");
    if (!btn || !txt) return;

    if (isEnhancing) {
        btn.disabled = true;
        btn.style.opacity = "0.7";
        btn.style.cursor = "wait";
        return;
    }

    const ref = referenceArray[currentReference];
    const hasImage = ref && ref.obj;

    if (!hasImage) {
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
        txt.textContent = getRefEnhanceButtonText();
        return;
    }

    if (ref.isEnhanced) {
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.style.cursor = "default";
        txt.textContent = (typeof lang !== 'undefined' && lang.refEnhanceDone) ? lang.refEnhanceDone : "Уже улучшено";
        return;
    }

    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
    txt.textContent = getRefEnhanceButtonText();
}

function abortCurrentEnhancement() {
    if (currentUpscaleWorker) {
        currentUpscaleWorker.terminate();
        currentUpscaleWorker = null;
    }
    if (isEnhancing) {
        isEnhancing = false;
        updateRefEnhanceButtonState();
    }
}

async function enhanceReferencePhoto() {
    const ref = referenceArray[currentReference];
    if (!ref || !ref.obj) return;
    if (ref.isEnhanced || isEnhancing) return;

    isEnhancing = true;
    updateRefEnhanceButtonState();

    const btnText = el("refEnhanceBtnText");
    const loadingLabel = (typeof lang !== 'undefined' && lang === en ? "Loading..." : "Загрузка...");

    let srcCanvas = null;
    let dstCanvas = null;

    try {
        const wasmUrl = ORT_WASM_JSEP_URL;
        const wasmExpected = ORT_WASM_JSEP_SIZE;
        const modelExpected = WAIFU2X_MODEL_SIZE;

        if (!cachedWasmBuffer) cachedWasmBuffer = await getCachedFileBuffer(wasmUrl);
        if (!cachedModelBuffer) cachedModelBuffer = await getCachedFileBuffer(WAIFU2X_MODEL_URL);

        const needDownloadWasm = !cachedWasmBuffer;
        const needDownloadModel = !cachedModelBuffer;
        const totalDownloadBytes = (needDownloadWasm ? wasmExpected : 0) + (needDownloadModel ? modelExpected : 0);
        let totalDownloadedSoFar = 0;

        function reportDownloadProgress(currentFileLoaded) {
            if (!btnText || !isEnhancing) return;
            if (totalDownloadBytes > 0) {
                const loaded = totalDownloadedSoFar + currentFileLoaded;
                const pct = Math.min(99, Math.round((loaded / totalDownloadBytes) * 100));
                const loadedMB = (loaded / 1000000).toFixed(1);
                const totalMB = (totalDownloadBytes / 1000000).toFixed(1);
                const isEn = (typeof lang !== 'undefined' && lang === en);
                const unit = isEn ? "MB" : "МБ";
                btnText.textContent = `${loadingLabel} ${loadedMB} / ${totalMB} ${unit} (${pct}%)`;
            } else {
                btnText.textContent = loadingLabel;
            }
        }

        if (needDownloadWasm) {
            reportDownloadProgress(0);
            cachedWasmBuffer = await downloadFileWithProgress(wasmUrl, wasmExpected, (loaded) => {
                reportDownloadProgress(loaded);
            });
            totalDownloadedSoFar += cachedWasmBuffer.byteLength;
        }

        if (!isEnhancing) return;

        if (needDownloadModel) {
            reportDownloadProgress(0);
            cachedModelBuffer = await downloadFileWithProgress(WAIFU2X_MODEL_URL, modelExpected, (loaded) => {
                reportDownloadProgress(loaded);
            });
            totalDownloadedSoFar += cachedModelBuffer.byteLength;
        }

        pendingDownloadBytes = 0;
        isModelCached = true;
        if (!isEnhancing) return;

        const isEn = (typeof lang !== 'undefined' && lang === en);
        const enhanceLabel = isEn ? "Enhancing" : "Улучшение";
        if (btnText) btnText.textContent = `${enhanceLabel}...`;

        const srcImg = ref.originalObj || ref.obj;
        const sw = srcImg.naturalWidth || srcImg.width;
        const sh = srcImg.naturalHeight || srcImg.height;
        if (!sw || !sh) throw new Error("Invalid image dimensions");

        srcCanvas = document.createElement("canvas");
        srcCanvas.width = sw;
        srcCanvas.height = sh;
        const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
        srcCtx.drawImage(srcImg, 0, 0);
        const srcPixels = srcCtx.getImageData(0, 0, sw, sh).data;
        srcCanvas.width = 0;
        srcCanvas.height = 0;
        srcCanvas = null;

        const scale = 2;
        const dw = sw * scale;
        const dh = sh * scale;

        let activeDevice = 'GPU';

        const workerResult = await new Promise((resolve, reject) => {
            const worker = new Worker('scripts/ai-worker.js?v=' + Date.now());
            currentUpscaleWorker = worker;

            worker.onmessage = (e) => {
                const msg = e.data;
                if (!msg) return;

                if (msg.type === 'init') {
                    activeDevice = msg.device || ((msg.provider === 'webgpu') ? 'GPU' : 'CPU');
                    if (btnText && isEnhancing) {
                        btnText.textContent = `${enhanceLabel} (${activeDevice})...`;
                    }
                } else if (msg.type === 'progress') {
                    if (btnText && isEnhancing) {
                        btnText.textContent = `${enhanceLabel} (${activeDevice})... ${msg.pct}%`;
                    }
                } else if (msg.type === 'complete') {
                    resolve(msg);
                } else if (msg.type === 'error') {
                    reject(new Error(msg.error));
                }
            };

            worker.onerror = (err) => {
                reject(new Error(err.message || "Worker execution failed"));
            };

            worker.postMessage({
                action: 'enhance',
                wasmBuffer: cachedWasmBuffer,
                modelBuffer: cachedModelBuffer,
                srcPixels: srcPixels,
                sw: sw,
                sh: sh
            });
        });

        if (!isEnhancing) return;

        dstCanvas = document.createElement("canvas");
        dstCanvas.width = dw;
        dstCanvas.height = dh;
        const dstCtx = dstCanvas.getContext("2d", { willReadFrequently: true });
        dstCtx.imageSmoothingEnabled = true;
        dstCtx.imageSmoothingQuality = "high";
        dstCtx.drawImage(srcImg, 0, 0, dw, dh);
        const dstData = dstCtx.getImageData(0, 0, dw, dh);

        const outRgb = workerResult.outRgb;
        const totalPixels = dw * dh;
        for (let i = 0; i < totalPixels; i++) {
            const idx4 = i * 4;
            const idx3 = i * 3;
            dstData.data[idx4] = outRgb[idx3];
            dstData.data[idx4 + 1] = outRgb[idx3 + 1];
            dstData.data[idx4 + 2] = outRgb[idx3 + 2];
        }
        dstCtx.putImageData(dstData, 0, 0);

        const blob = await new Promise((resolve) => dstCanvas.toBlob(resolve, "image/png"));
        const blobUrl = URL.createObjectURL(blob);

        const resultImg = new Image();
        await new Promise((resolve, reject) => {
            resultImg.onload = resolve;
            resultImg.onerror = reject;
            resultImg.src = blobUrl;
        });

        if (dstCanvas) { dstCanvas.width = 0; dstCanvas.height = 0; dstCanvas = null; }

        if (!isEnhancing) {
            URL.revokeObjectURL(blobUrl);
            return;
        }

        if (ref.obj && ref.obj.src && ref.obj.src.startsWith('blob:') && ref.obj !== ref.originalObj) {
            URL.revokeObjectURL(ref.obj.src);
        }

        ref.originalObj = srcImg;
        ref.obj = resultImg;
        ref.isEnhanced = true;

        if (typeof render === 'function') render();
    } catch (err) {
        if (isEnhancing) {
            alert((typeof lang !== 'undefined' && lang === en ? "Error enhancing photo: " : "Ошибка при улучшении фото: ") + err.message);
        }
    } finally {
        if (srcCanvas) { srcCanvas.width = 0; srcCanvas.height = 0; srcCanvas = null; }
        if (dstCanvas) { dstCanvas.width = 0; dstCanvas.height = 0; dstCanvas = null; }
        if (currentUpscaleWorker) {
            currentUpscaleWorker.terminate();
            currentUpscaleWorker = null;
        }
        cachedWasmBuffer = null;
        cachedModelBuffer = null;
        isEnhancing = false;
        updateRefEnhanceButtonState();
    }
}

/*function calc()
{
    const canv = document.createElement("canvas");

    const w = referenceArray[currentReference].obj.width;
    const h = referenceArray[currentReference].obj.height;
    const pixels = w * h;

    canv.width = w;
    canv.height = h;
    const canvctx = canv.getContext("2d");
    canvctx.drawImage(referenceArray[currentReference].obj, 0, 0);
    const data = canvctx.getImageData(0, 0, canv.width, canv.height);
    const brightnesses = [];

    for (let i = 0; i < pixels; i++)
    {
        brightnesses[i] = data.data[i * 4];
    }

    function addQuad(id, pos1, pos2, pos3, pos4)
    {
        const object =
            {
                name: lang.quad + id,
                type: "quad",
                pos1: pos1,
                pos2: pos2,
                pos3: pos3,
                pos4: pos4,
                selected: false
            };

        objects.set(id, object);
    }

    const decimation = 5.5;
    const size = 1 / h * decimation;
    let id = 100;
    const xS = -0.5 * (w/h);
    const yS = -0.5;
    const threshold = 10;

    for (let y = 0; y < h; y += decimation)
    {
        for (let x = 0; x < w; x += decimation)
        {
            const v = brightnesses[Math.floor(y) * w + Math.floor(x)];
            //if (v === 255) continue;
            if (v >= 255 - threshold) continue;
            const r = 1 - (v / 255);

            const x0 = xS + ((x + 0.5) / decimation) * size - (r * 0.5 * size);
            const y0 = yS + ((y + 0.5) / decimation) * size - (r * 0.5 * size);
            const x1 = xS + ((x + 0.5) / decimation) * size + (r * 0.5 * size);
            const y1 = yS + ((y + 0.5) / decimation) * size + (r * 0.5 * size);

            addQuad(id, {x: x0, y: y0}, {x: x1, y: y0}, {x: x1, y: y1}, {x: x0, y: y1});
            id++;
        }
    }

    console.log(id - 100);
}*/