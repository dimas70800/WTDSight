
(function () {
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVectorize);
    } else {
        initVectorize();
    }

    function initVectorize() {
        const vectorizeBtn = document.getElementById('toolsVectorizeButton');
        if (!vectorizeBtn) {
            console.error("toolsVectorizeButton not found");
            return;
        }

        if (typeof toolNames !== 'undefined' && Array.isArray(toolNames)) {
            if (!toolNames.includes('vectorize')) {
                toolNames.push('vectorize');
            }
        }

        vectorizeBtn.onclick = (e) => {
            e.stopPropagation();
            tool = 'vectorize';
            if (typeof markAllTools === 'function') markAllTools();

            toggleVectorizePanel(true);
        };

        if (typeof markAllTools !== 'undefined') {
            const originalMarkAllTools = markAllTools;
            window.markAllTools = function () {
                originalMarkAllTools();
                const btn = document.getElementById('toolsVectorizeButton');
                if (btn) btn.disabled = (tool === 'vectorize');
            };
        }

        const vectorizePanel = document.getElementById('vectorizePanel');
        if (!vectorizePanel) {
            console.error("vectorizePanel not found");
            return;
        }
        vectorizePanel.style.display = 'none';

        let vectorizeLines = [];
        let vectorizePreviewLines = [];
        let vectorizeUpdateTimer = null;
        let isVectorizing = false;
        let isVectorizePreviewActive = false;
        let currentSourceImageData = null;
        let currentProcessedWidth = 0, currentProcessedHeight = 0;

        const sensitivityPresets = {
            very_soft: { low: 80, high: 160 },
            soft: { low: 65, high: 145 },
            semi_soft: { low: 50, high: 135 },
            balanced: { low: 38, high: 128 },
            semi_sharp: { low: 28, high: 110 },
            sharp: { low: 20, high: 95 },
            very_sharp: { low: 12, high: 75 }
        };

        // Функция для получения изображения из текущего референса
        function getCurrentReferenceImage() {
            const ref = referenceArray[currentReference];
            if (!ref || !ref.obj) return null;
            return ref.obj;
        }

        // Функция для загрузки изображения из референса
        function loadImageFromReference() {
            const img = getCurrentReferenceImage();
            if (!img) {
                const statusDiv = document.getElementById('vectorizeStatus');
                if (statusDiv) statusDiv.innerHTML = lang.vectorizeStatusNoImage;
                setTimeout(() => {
                    if (statusDiv) statusDiv.textContent = '';
                }, 3000);
                return false;
            }

            const src = img.src;
            if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                const statusDiv = document.getElementById('vectorizeStatus');
                if (statusDiv) {
                    statusDiv.innerHTML = lang.vectorizeStatusLocalOnly;
                    statusDiv.style.color = '#e74c3c';
                }
                setTimeout(() => {
                    if (statusDiv) {
                        statusDiv.textContent = '';
                        statusDiv.style.color = '#888';
                    }
                }, 5000);
                return false;
            }

            const statusDiv = document.getElementById('vectorizeStatus');
            if (statusDiv) statusDiv.innerHTML = lang.vectorizeStatusLoading;

            const tempCanvas = document.createElement('canvas');
            const imgWidth = img.width;
            const imgHeight = img.height;

            currentSourceWidth = imgWidth;
            currentSourceHeight = imgHeight;

            const maxSize = 2560;
            let drawWidth = imgWidth;
            let drawHeight = imgHeight;

            if (drawWidth > maxSize) {
                drawWidth = maxSize;
                drawHeight = (imgHeight * maxSize) / imgWidth;
            }
            if (drawHeight > maxSize) {
                drawHeight = maxSize;
                drawWidth = (imgWidth * maxSize) / imgHeight;
            }

            tempCanvas.width = drawWidth;
            tempCanvas.height = drawHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0, drawWidth, drawHeight);

            currentSourceImageData = tempCtx.getImageData(0, 0, drawWidth, drawHeight);
            currentProcessedWidth = drawWidth;
            currentProcessedHeight = drawHeight;

            if (statusDiv) {
                statusDiv.innerHTML = lang.vectorizeStatusLoaded;
                statusDiv.style.color = '#888';
            }
            setTimeout(() => {
                if (statusDiv && statusDiv.innerHTML === lang.vectorizeStatusLoaded) statusDiv.innerHTML = '';
            }, 2000);

            return true;
        }
        // Функция для преобразования линий в мировые координаты canvas
        function convertLinesToWorldCoordinates(lines, processedWidth, processedHeight) {
            if (!lines.length) return [];

            const ref = referenceArray[currentReference];
            if (!ref || !ref.obj) return [];

            const refX = ref.x;
            const refY = ref.y;
            const refSize = ref.size;
            const refRotation = ref.rotation * Math.PI / 180;
            const refAspectRatio = ref.obj.width / ref.obj.height;

            const refWidth = refSize * refAspectRatio;
            const refHeight = refSize;

            const scaleX = refWidth / processedWidth;
            const scaleY = refHeight / processedHeight;

            const result = [];

            for (const line of lines) {
                let x1 = (line.x1 - processedWidth / 2) * scaleX;
                let y1 = (line.y1 - processedHeight / 2) * scaleY;
                let x2 = (line.x2 - processedWidth / 2) * scaleX;
                let y2 = (line.y2 - processedHeight / 2) * scaleY;

                x1 += refX;
                y1 += refY;
                x2 += refX;
                y2 += refY;

                if (refRotation !== 0) {
                    const cos = Math.cos(refRotation);
                    const sin = Math.sin(refRotation);

                    let dx1 = x1 - refX;
                    let dy1 = y1 - refY;
                    x1 = refX + dx1 * cos - dy1 * sin;
                    y1 = refY + dx1 * sin + dy1 * cos;

                    let dx2 = x2 - refX;
                    let dy2 = y2 - refY;
                    x2 = refX + dx2 * cos - dy2 * sin;
                    y2 = refY + dx2 * sin + dy2 * cos;
                }

                result.push({
                    start: { x: x1, y: y1 },
                    end: { x: x2, y: y2 }
                });
            }

            return result;
        }

        function showVectorizePreview() {
            if (!isVectorizePreviewActive) return;
            window.vectorizeTempLines = vectorizePreviewLines;
        }

        function hideVectorizePreview() {
            isVectorizePreviewActive = false;
            window.vectorizeTempLines = null;
        }

        function scheduleVectorizeUpdate() {
            if (vectorizeUpdateTimer) clearTimeout(vectorizeUpdateTimer);
            vectorizeUpdateTimer = setTimeout(() => {
                if (currentSourceImageData && tool === 'vectorize') {
                    updateVectorizePreview();
                }
                vectorizeUpdateTimer = null;
            }, 150);
        }

        function updateVectorizePreview() {
            if (!currentSourceImageData || isVectorizing) return;

            isVectorizing = true;
            const statusDiv = document.getElementById('vectorizeStatus');
            if (statusDiv) statusDiv.innerHTML = lang.vectorizeStatusProcessing +' 0%...';

            const target = parseInt(document.getElementById('vectorizeTargetLines').value);
            const sensitivity = document.getElementById('vectorizeSensitivity').value;
            const denoiseLevel = parseInt(document.getElementById('vectorizeDenoise').value);
            const sharpness = parseFloat(document.getElementById('vectorizeSharpness').value);
            const simplifyFactor = parseFloat(document.getElementById('vectorizeSimplify').value);

            const preset = sensitivityPresets[sensitivity];
            let low = preset.low;
            let high = preset.high;

            if (sharpness > 1.2) {
                low = Math.min(120, low * 1.2);
                high = Math.min(200, high * 1.15);
            } else if (sharpness < 0.8) {
                low = Math.max(15, low * 0.85);
                high = Math.max(60, high * 0.9);
            }

            const worker = new Worker('scripts/vectorize-worker.js');

            worker.onmessage = function (e) {
                const result = e.data;

                if (result.error) {
                    console.error('Worker error:', result.error);
                    if (statusDiv) statusDiv.innerHTML = lang.vectorizeStatusError;
                    isVectorizing = false;
                    worker.terminate();
                    return;
                }

                if (result.lines !== undefined) {
                    vectorizeLines = result.lines;
                    document.getElementById('vectorizeLineCount').innerText = vectorizeLines.length;

                    if (vectorizeLines.length === 0) {
                        hideVectorizePreview();
                        if (statusDiv) statusDiv.innerHTML = lang.vectorizeStatusNoContours;
                        setTimeout(() => {
                            if (statusDiv && statusDiv.innerHTML === lang.vectorizeStatusNoContours) statusDiv.innerHTML = '';
                        }, 2000);
                    } else {
                        vectorizePreviewLines = convertLinesToWorldCoordinates(vectorizeLines, currentProcessedWidth, currentProcessedHeight);
                        isVectorizePreviewActive = true;
                        showVectorizePreview();

                        if (statusDiv) statusDiv.innerHTML = lang.vectorizeStatusDone + ` ${vectorizeLines.length} ${lang.vectorizeLinesText}`;
                        setTimeout(() => {
                            if (statusDiv && statusDiv.innerHTML === lang.vectorizeStatusDone + ` ${vectorizeLines.length} ${lang.vectorizeLinesText}`) statusDiv.innerHTML = '';
                        }, 2000);
                    }
                    isVectorizing = false;
                    worker.terminate();
                }
            };

            worker.onerror = function (e) {
                console.error('Worker error:', e);
                if (statusDiv) statusDiv.innerHTML = lang.vectorizeStatusError;
                isVectorizing = false;
                worker.terminate();
            };

            worker.postMessage({
                type: 'process',
                imageData: {
                    data: currentSourceImageData.data,
                    width: currentSourceImageData.width,
                    height: currentSourceImageData.height
                },
                params: {
                    low: low,
                    high: high,
                    denoiseLevel: denoiseLevel,
                    sharpness: sharpness,
                    simplifyFactor: simplifyFactor,
                    target: target
                }
            });
        }

        function processVectorize() {
            if (loadImageFromReference()) {
                scheduleVectorizeUpdate();
            }
        }

        function autoOptimizeVectorize() {
            if (!currentSourceImageData) {
                if (!loadImageFromReference()) return;
            }

            const target = parseInt(document.getElementById('vectorizeTargetLines').value);
            const denoiseLevel = parseInt(document.getElementById('vectorizeDenoise').value);
            const statusDiv = document.getElementById('vectorizeStatus');

            if (statusDiv) statusDiv.innerHTML = lang.vectorizeAutoProgress + ": 0%...";

            const tests = [
                { low: 98, high: 178, sharp: 0.32, simp: 1.95, id: 0 },
                { low: 95, high: 175, sharp: 0.34, simp: 1.92, id: 1 },
                { low: 93, high: 173, sharp: 0.36, simp: 1.89, id: 2 },
                { low: 90, high: 170, sharp: 0.38, simp: 1.86, id: 3 },
                { low: 88, high: 168, sharp: 0.4, simp: 1.83, id: 4 },
                { low: 86, high: 166, sharp: 0.42, simp: 1.8, id: 5 },
                { low: 84, high: 164, sharp: 0.44, simp: 1.78, id: 6 },
                { low: 82, high: 162, sharp: 0.46, simp: 1.76, id: 7 },
                { low: 80, high: 160, sharp: 0.48, simp: 1.74, id: 8 },
                { low: 78, high: 158, sharp: 0.5, simp: 1.72, id: 9 },

                { low: 76, high: 156, sharp: 0.52, simp: 1.7, id: 10 },
                { low: 74, high: 154, sharp: 0.54, simp: 1.68, id: 11 },
                { low: 72, high: 152, sharp: 0.56, simp: 1.66, id: 12 },
                { low: 70, high: 150, sharp: 0.58, simp: 1.64, id: 13 },
                { low: 68, high: 148, sharp: 0.6, simp: 1.62, id: 14 },
                { low: 66, high: 146, sharp: 0.62, simp: 1.6, id: 15 },
                { low: 64, high: 144, sharp: 0.64, simp: 1.58, id: 16 },
                { low: 62, high: 142, sharp: 0.66, simp: 1.56, id: 17 },
                { low: 60, high: 140, sharp: 0.68, simp: 1.54, id: 18 },

                { low: 58, high: 138, sharp: 0.7, simp: 1.52, id: 19 },
                { low: 56, high: 136, sharp: 0.72, simp: 1.5, id: 20 },
                { low: 54, high: 135, sharp: 0.74, simp: 1.48, id: 21 },
                { low: 52, high: 134, sharp: 0.76, simp: 1.46, id: 22 },
                { low: 50, high: 133, sharp: 0.78, simp: 1.44, id: 23 },
                { low: 48, high: 132, sharp: 0.8, simp: 1.42, id: 24 },
                { low: 46, high: 131, sharp: 0.82, simp: 1.4, id: 25 },
                { low: 45, high: 130, sharp: 0.84, simp: 1.38, id: 26 },
                { low: 44, high: 129, sharp: 0.86, simp: 1.36, id: 27 },
                { low: 43, high: 128, sharp: 0.88, simp: 1.34, id: 28 },
                { low: 42, high: 128, sharp: 0.9, simp: 1.32, id: 29 },
                { low: 41, high: 127, sharp: 0.92, simp: 1.3, id: 30 },
                { low: 40, high: 126, sharp: 0.94, simp: 1.28, id: 31 },
                { low: 39, high: 125, sharp: 0.96, simp: 1.26, id: 32 },
                { low: 38, high: 125, sharp: 0.98, simp: 1.24, id: 33 },
                { low: 37, high: 124, sharp: 1.0, simp: 1.22, id: 34 },
                { low: 36, high: 124, sharp: 1.0, simp: 1.2, id: 35 },
                { low: 35, high: 123, sharp: 1.02, simp: 1.18, id: 36 },

                { low: 34, high: 122, sharp: 1.04, simp: 1.16, id: 37 },
                { low: 33, high: 121, sharp: 1.06, simp: 1.14, id: 38 },
                { low: 32, high: 120, sharp: 1.08, simp: 1.12, id: 39 },
                { low: 31, high: 119, sharp: 1.1, simp: 1.1, id: 40 },
                { low: 30, high: 118, sharp: 1.12, simp: 1.08, id: 41 },
                { low: 29, high: 117, sharp: 1.14, simp: 1.06, id: 42 },
                { low: 28, high: 116, sharp: 1.16, simp: 1.04, id: 43 },
                { low: 27, high: 115, sharp: 1.18, simp: 1.02, id: 44 },
                { low: 26, high: 114, sharp: 1.2, simp: 1.0, id: 45 },

                { low: 24, high: 112, sharp: 1.22, simp: 0.97, id: 46 },
                { low: 22, high: 110, sharp: 1.25, simp: 0.94, id: 47 },
                { low: 20, high: 108, sharp: 1.28, simp: 0.91, id: 48 },
                { low: 18, high: 105, sharp: 1.3, simp: 0.88, id: 49 }
            ];

            const workers = [];
            const results = [];
            let completedTests = 0;

            function finishOptimization() {
                let bestResult = null;
                let bestDiff = Infinity;

                for (const result of results) {
                    if (result.error) continue;
                    const diff = Math.abs(result.linesCount - target);
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        bestResult = result;
                    }
                }

                if (bestResult && bestResult.linesCount > 0) {
                    const bestParams = bestResult.params;

                    document.getElementById('vectorizeSharpness').value = bestParams.sharp;
                    document.getElementById('vectorizeSharpnessVal').innerText = bestParams.sharp;
                    document.getElementById('vectorizeSimplify').value = bestParams.simp;
                    document.getElementById('vectorizeSimplifyVal').innerText = bestParams.simp;

                    const sensitivity = bestParams.low <= 30 ? 'sharp' : (bestParams.low >= 50 ? 'soft' : 'balanced');
                    document.getElementById('vectorizeSensitivity').value = sensitivity;

                    setTimeout(() => {
                        updateVectorizePreview();
                    }, 100);

                    if (statusDiv) {
                        statusDiv.innerHTML = lang.vectorizeStatusOptimized + ` ${bestResult.linesCount} ${lang.vectorizeLinesText}`;
                        setTimeout(() => {
                            if (statusDiv && statusDiv.innerHTML.includes(lang.vectorizeStatusOptimized)) statusDiv.innerHTML = '';
                        }, 3000);
                    }
                } else {
                    if (statusDiv) statusDiv.innerHTML = lang.vectorizeStatusAutoOptimizationFailed;
                }

                workers.forEach(w => w.terminate());
            }

            for (let i = 0; i < tests.length; i++) {
                const worker = new Worker('scripts/vectorize-worker.js');
                const test = tests[i];

                worker.onmessage = function (e) {
                    results.push(e.data);
                    completedTests++;

                    const percent = Math.round((completedTests / tests.length) * 100);
                    if (statusDiv) {
                        statusDiv.innerHTML = lang.vectorizeAutoProgress + `: ${percent}%...`;
                    }

                    if (completedTests === tests.length) {
                        finishOptimization();
                    }

                    worker.terminate();
                };

                worker.onerror = function (e) {
                    console.error(`Test ${test.id} worker error:`, e);
                    results.push({ testId: test.id, linesCount: 0, error: e.message, params: test });
                    completedTests++;

                    const percent = Math.round((completedTests / tests.length) * 100);
                    if (statusDiv) {
                        statusDiv.innerHTML = lang.vectorizeAutoProgress + `: ${percent}%...`;
                    }

                    if (completedTests === tests.length) {
                        finishOptimization();
                    }
                };

                worker.postMessage({
                    imageData: {
                        data: currentSourceImageData.data,
                        width: currentSourceImageData.width,
                        height: currentSourceImageData.height
                    },
                    test: test,
                    target: target,
                    denoiseLevel: denoiseLevel
                });

                workers.push(worker);
            }
        }

        function resetSettings() {
            const targetSlider = document.getElementById('vectorizeTargetLines');
            targetSlider.value = "2000";
            document.getElementById('vectorizeTargetVal').innerText = "2000";
            document.getElementById('vectorizeSensitivity').value = "balanced";
            document.getElementById('vectorizeDenoise').value = "1";
            document.getElementById('vectorizeSharpness').value = "1.0";
            document.getElementById('vectorizeSharpnessVal').innerText = "1.0";
            document.getElementById('vectorizeSimplify').value = "1.0";
            document.getElementById('vectorizeSimplifyVal').innerText = "1.0";

            if (currentSourceImageData) {
                scheduleVectorizeUpdate();
            }
        }

        function applyVectorizeToCanvas() {
            if (!vectorizeLines.length) {
                alert("Нет линий для применения! Сначала обработайте изображение.");
                return;
            }

            const worldLines = convertLinesToWorldCoordinates(vectorizeLines, currentProcessedWidth, currentProcessedHeight);

            for (const line of worldLines) {
                const objIdStr = nextId().toString();
                const object = {
                    name: lang.line + objIdStr,
                    type: "line",
                    start: { x: line.start.x, y: line.start.y },
                    end: { x: line.end.x, y: line.end.y },
                    selected: false
                };
                objects.set(objIdStr, object);
                pushEvent("add", { id: objIdStr, object: object });
            }

            refreshObjectsList(true);
            hideVectorizePreview();
        }

        function setupVectorizeEvents() {
            const targetSlider = document.getElementById('vectorizeTargetLines');
            const targetVal = document.getElementById('vectorizeTargetVal');
            const maxLinesSpan = document.getElementById('vectorizeMaxLines');
            const sensitivity = document.getElementById('vectorizeSensitivity');
            const denoise = document.getElementById('vectorizeDenoise');
            const sharpness = document.getElementById('vectorizeSharpness');
            const sharpnessVal = document.getElementById('vectorizeSharpnessVal');
            const simplify = document.getElementById('vectorizeSimplify');
            const simplifyVal = document.getElementById('vectorizeSimplifyVal');
            const processBtn = document.getElementById('vectorizeProcessBtn');
            const autoBtn = document.getElementById('vectorizeAutoBtn');
            const resetBtn = document.getElementById('vectorizeResetBtn');
            const applyBtn = document.getElementById('vectorizeApplyBtn');

            if (maxLinesSpan) maxLinesSpan.innerText = targetSlider.max;

            targetSlider.addEventListener('input', () => {
                targetVal.innerText = targetSlider.value;
                if (tool === 'vectorize') scheduleVectorizeUpdate();
            });

            sensitivity.addEventListener('change', () => {
                if (tool === 'vectorize') scheduleVectorizeUpdate();
            });
            denoise.addEventListener('change', () => {
                if (tool === 'vectorize') scheduleVectorizeUpdate();
            });

            sharpness.addEventListener('input', () => {
                sharpnessVal.innerText = sharpness.value;
                if (tool === 'vectorize') scheduleVectorizeUpdate();
            });

            simplify.addEventListener('input', () => {
                simplifyVal.innerText = simplify.value;
                if (tool === 'vectorize') scheduleVectorizeUpdate();
            });

            processBtn.onclick = () => processVectorize();
            autoBtn.onclick = () => autoOptimizeVectorize();
            resetBtn.onclick = resetSettings;
            applyBtn.onclick = () => applyVectorizeToCanvas();
        }

        let panelVisible = false;
        function toggleVectorizePanel(forceShow) {
            if (forceShow === true) {
                panelVisible = true;
                vectorizePanel.style.display = 'flex';
                if (currentSourceImageData) {
                    scheduleVectorizeUpdate();
                } else {
                    loadImageFromReference();
                }
            } else if (forceShow === false) {
                panelVisible = false;
                vectorizePanel.style.display = 'none';
                hideVectorizePreview();
            } else {
                panelVisible = !panelVisible;
                vectorizePanel.style.display = panelVisible ? 'flex' : 'none';
                if (panelVisible) {
                    if (currentSourceImageData) {
                        scheduleVectorizeUpdate();
                    } else {
                        loadImageFromReference();
                    }
                } else {
                    hideVectorizePreview();
                }
            }
        }

        function checkToolChange() {
            if (tool !== 'vectorize') {
                if (vectorizePanel.style.display === 'flex') {
                    vectorizePanel.style.display = 'none';
                    panelVisible = false;
                }
                hideVectorizePreview();
            }
        }

        setInterval(checkToolChange, 100);

        setupVectorizeEvents();

        function makeDraggableVectorizePanel(element) {
            const dragger = element.querySelector('#vectorizePanelDragger');
            if (!dragger) return;

            let posFrom = null;

            dragger.onmousedown = (e) => {
                e.preventDefault();
                posFrom = { x: e.clientX, y: e.clientY };
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            };

            function elementDrag(e) {
                e.preventDefault();
                const movement = { x: posFrom.x - e.clientX, y: posFrom.y - e.clientY };
                posFrom = { x: e.clientX, y: e.clientY };
                element.style.top = (element.offsetTop - movement.y) + "px";
                element.style.left = (element.offsetLeft - movement.x) + "px";
                element.style.right = "auto";
                element.style.bottom = "auto";
            }

            function closeDragElement() {
                document.onmouseup = null;
                document.onmousemove = null;
            }
        }

        makeDraggableVectorizePanel(vectorizePanel);

        window.vectorizeTempLines = null;

        window.hideVectorizePreview = hideVectorizePreview;
    }
})();