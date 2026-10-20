const referenceArray = [];
for (let i = 0; i < 3; i++) {
    referenceArray.push({
        obj: null,
        originalObj: null,
        isEnhanced: false,
        size: 1,
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 0.5,
        url: null,
        fileName: ""
    });
}

let currentReference = 0;

function setReference() {
    const url = el("refUrl").value;
    if (url && url.trim() !== "") {
        setReferenceSrc(url);
    }
}

function setReferenceSize() {
    referenceArray[currentReference].size = parseFloat(el("refSize").value);
}

function setReferenceX() {
    referenceArray[currentReference].x = parseFloat(el("refShiftX").value);
}

function setReferenceY() {
    referenceArray[currentReference].y = -parseFloat(el("refShiftY").value);
}

function setReferenceRotation() {
    referenceArray[currentReference].rotation = parseFloat(el("refRotation").value);
}

function setReferenceOpacity() {
    const val = parseFloat(el("refOpacityInput").value);
    referenceArray[currentReference].opacity = val;

    const sharedSlider = el("refOpacityInputShared");
    if (sharedSlider) {
        sharedSlider.value = val;
    }
}

function setReferenceOpacityShared(value) {
    const mainSlider = el("refOpacityInput");
    if (mainSlider) {
        mainSlider.value = value;
    }
    referenceArray[currentReference].opacity = parseFloat(value);
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

        revokeReferenceBlobs(referenceArray[currentReference]);
        referenceArray[currentReference].fileName = file.name;

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            referenceArray[currentReference].obj = img;
            referenceArray[currentReference].originalObj = img;
            referenceArray[currentReference].isEnhanced = false;
            referenceArray[currentReference].url = null;
            setReferenceMenu();
        };
        img.src = url;
    };
}

function setReferenceSrc(url) {
    if (typeof abortCurrentEnhancement === 'function') abortCurrentEnhancement();
    revokeReferenceBlobs(referenceArray[currentReference]);
    referenceArray[currentReference].fileName = "";
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
        referenceArray[currentReference].obj = img;
        referenceArray[currentReference].originalObj = img;
        referenceArray[currentReference].isEnhanced = false;
        referenceArray[currentReference].url = url;
        setReferenceMenu();
    };
    img.onerror = () => {
        console.error("Failed to load image:", url);
        referenceArray[currentReference].obj = null;
        referenceArray[currentReference].originalObj = null;
        referenceArray[currentReference].isEnhanced = false;
        referenceArray[currentReference].url = null;
        setReferenceMenu();
    };
    img.src = url;
}

function setReferenceMenu() {
    const nextBtn = el("nextRefButton");
    if (nextBtn) nextBtn.innerHTML = (currentReference + 1) + "/3 >";

    const ref = referenceArray[currentReference];
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

    const fileNameSpan = el("refFileName");
    if (fileNameSpan) {
        if (ref.fileName) {
            fileNameSpan.textContent = ref.fileName;
        } else if (ref.url) {
            fileNameSpan.textContent = "Загружено по URL";
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