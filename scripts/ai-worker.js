self.importScripts('ort.all.min.js');

let session = null;

self.onmessage = async function (e) {
    const data = e.data;
    if (!data || data.action !== 'enhance') return;

    const { wasmBuffer, modelBuffer, srcPixels, sw, sh } = data;

    try {
        if (!session) {
            self.ort.env.logLevel = 'error';
            self.ort.env.wasm.wasmPaths = new URL('.', self.location.href).href;
            if (wasmBuffer && wasmBuffer.byteLength > 0) {
                self.ort.env.wasm.wasmBinary = wasmBuffer;
            }

            let providerUsed = 'webgpu';
            let deviceLabel = 'GPU';
            try {
                if (typeof self.navigator === 'undefined' || !self.navigator.gpu) {
                    throw new Error("WebGPU not supported in worker");
                }
                if (!self.ort.env.webgpu) self.ort.env.webgpu = {};
                self.ort.env.webgpu.powerPreference = 'high-performance';
                const adapter = await self.navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
                if (adapter) {
                    self.ort.env.webgpu.adapter = adapter;
                    const info = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : null);
                    if (info) {
                        const raw = info.description || info.device || '';
                        const m = raw.match(/(RTX\s*\d+\w*|GTX\s*\d+\w*|GeForce\s*[\w\d]*|Radeon\s*[\w\d]*|Intel\s*[\w\d]*)/i);
                        deviceLabel = m ? m[0] : (raw ? raw.slice(0, 16) : 'GPU');
                    }
                }
                session = await self.ort.InferenceSession.create(modelBuffer.slice(0), {
                    executionProviders: ['webgpu'],
                    logSeverityLevel: 3
                });
            } catch (gpuErr) {
                providerUsed = 'wasm';
                deviceLabel = 'CPU';
                session = await self.ort.InferenceSession.create(modelBuffer.slice(0), {
                    executionProviders: ['wasm'],
                    logSeverityLevel: 3
                });
            }

            self.postMessage({
                type: 'init',
                provider: providerUsed,
                device: deviceLabel
            });
        }

        const scale = 2;
        const dw = sw * scale;
        const dh = sh * scale;

        const TILE_IN = 160;
        const OFFSET = 8;
        const BLEND_OUT = 16;
        const STEP_IN = 136;
        const TILE_OUT = 288;
        const STEP_OUT = STEP_IN * scale;

        const numX = Math.max(1, Math.ceil(sw / STEP_IN));
        const numY = Math.max(1, Math.ceil(sh / STEP_IN));
        const totalTiles = numX * numY;
        let completedTiles = 0;

        const tileWeight = new Float32Array(TILE_OUT * TILE_OUT);
        const wx = new Float32Array(TILE_OUT);
        for (let i = 0; i < TILE_OUT; i++) {
            if (i < BLEND_OUT) wx[i] = (i + 0.5) / BLEND_OUT;
            else if (i >= TILE_OUT - BLEND_OUT) wx[i] = (TILE_OUT - 1 - i + 0.5) / BLEND_OUT;
            else wx[i] = 1.0;
        }
        for (let y = 0; y < TILE_OUT; y++) {
            const row = y * TILE_OUT;
            const wy = wx[y];
            for (let x = 0; x < TILE_OUT; x++) {
                tileWeight[row + x] = wx[x] * wy;
            }
        }

        const accumR = new Float32Array(dw * dh);
        const accumG = new Float32Array(dw * dh);
        const accumB = new Float32Array(dw * dh);
        const accumW = new Float32Array(dw * dh);

        const inPlaneSize = TILE_IN * TILE_IN;
        const outPlaneSize = TILE_OUT * TILE_OUT;
        const inputTensorData = new Float32Array(3 * inPlaneSize);
        const inputName = session.inputNames ? session.inputNames[0] : 'x';
        const outputName = session.outputNames ? session.outputNames[0] : 'y';

        for (let yi = 0; yi < numY; yi++) {
            for (let xi = 0; xi < numX; xi++) {
                const x0 = xi * STEP_IN;
                const y0 = yi * STEP_IN;

                for (let ty = 0; ty < TILE_IN; ty++) {
                    const py = y0 - OFFSET + ty;
                    const clampedY = Math.max(0, Math.min(sh - 1, py));
                    const rowOffset = clampedY * sw;

                    for (let tx = 0; tx < TILE_IN; tx++) {
                        const px = x0 - OFFSET + tx;
                        const clampedX = Math.max(0, Math.min(sw - 1, px));
                        const srcIdx = (rowOffset + clampedX) * 4;

                        const tileIdx = ty * TILE_IN + tx;
                        inputTensorData[tileIdx] = srcPixels[srcIdx] / 255.0;
                        inputTensorData[inPlaneSize + tileIdx] = srcPixels[srcIdx + 1] / 255.0;
                        inputTensorData[inPlaneSize * 2 + tileIdx] = srcPixels[srcIdx + 2] / 255.0;
                    }
                }

                const inputTensor = new self.ort.Tensor('float32', inputTensorData, [1, 3, TILE_IN, TILE_IN]);
                const feeds = {};
                feeds[inputName] = inputTensor;
                const results = await session.run(feeds);
                const yData = results[outputName].data;

                const outStartX = xi * STEP_OUT;
                const outStartY = yi * STEP_OUT;
                const validW = Math.min(TILE_OUT, dw - outStartX);
                const validH = Math.min(TILE_OUT, dh - outStartY);

                for (let oy = 0; oy < validH; oy++) {
                    const dstY = outStartY + oy;
                    const dstRow = dstY * dw;
                    const outRow = oy * TILE_OUT;

                    for (let ox = 0; ox < validW; ox++) {
                        const outIdx = outRow + ox;
                        const w = tileWeight[outIdx];
                        const dstIdx = dstRow + outStartX + ox;

                        accumR[dstIdx] += yData[outIdx] * w;
                        accumG[dstIdx] += yData[outPlaneSize + outIdx] * w;
                        accumB[dstIdx] += yData[outPlaneSize * 2 + outIdx] * w;
                        accumW[dstIdx] += w;
                    }
                }

                completedTiles++;
                const pct = Math.round((completedTiles / totalTiles) * 100);
                self.postMessage({
                    type: 'progress',
                    current: completedTiles,
                    total: totalTiles,
                    pct: pct
                });
            }
        }

        const totalPixels = dw * dh;
        const outRgb = new Uint8ClampedArray(totalPixels * 3);
        for (let i = 0; i < totalPixels; i++) {
            const w = accumW[i] || 1.0;
            const idx3 = i * 3;
            const rVal = isNaN(accumR[i]) ? 0 : accumR[i];
            const gVal = isNaN(accumG[i]) ? 0 : accumG[i];
            const bVal = isNaN(accumB[i]) ? 0 : accumB[i];
            outRgb[idx3] = Math.max(0, Math.min(255, Math.round((rVal / w) * 255)));
            outRgb[idx3 + 1] = Math.max(0, Math.min(255, Math.round((gVal / w) * 255)));
            outRgb[idx3 + 2] = Math.max(0, Math.min(255, Math.round((bVal / w) * 255)));
        }

        self.postMessage({
            type: 'complete',
            outRgb: outRgb,
            dw: dw,
            dh: dh
        }, [outRgb.buffer]);

    } catch (err) {
        self.postMessage({
            type: 'error',
            error: err.message || String(err)
        });
    }
};
