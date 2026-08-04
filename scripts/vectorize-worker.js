self.importScripts('opencv.js');

let cvReady = false;
let messageQueue = [];

cv.onRuntimeInitialized = () => {
    cvReady = true;
    while (messageQueue.length > 0) {
        processMessage(messageQueue.shift());
    }
};

self.onmessage = function(e) {
    if (!cvReady) {
        messageQueue.push(e.data);
    } else {
        processMessage(e.data);
    }
};

function grayscaleFast(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        data[i] = data[i+1] = data[i+2] = gray;
    }
    return imageData;
}

function gaussianBlurCustom(imageData, radius) {
    if (radius === 0) return imageData;
    const w = imageData.width, h = imageData.height;
    const kernel = radius === 1 ? [1,2,1,2,4,2,1,2,1] : [1,4,7,4,1,4,16,26,16,4,7,26,41,26,7,4,16,26,16,4,1,4,7,4,1];
    const ksize = radius === 1 ? 3 : 5;
    const ksum = radius === 1 ? 16 : 273;
    const src = new Uint8ClampedArray(imageData.data);
    const dst = new Uint8ClampedArray(src.length);
    const offset = Math.floor(ksize/2);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0, g = 0, b = 0;
            for (let ky = -offset; ky <= offset; ky++) {
                for (let kx = -offset; kx <= offset; kx++) {
                    const xi = Math.min(w-1, Math.max(0, x + kx));
                    const yi = Math.min(h-1, Math.max(0, y + ky));
                    const idx = (yi * w + xi) * 4;
                    const kval = kernel[(ky+offset)*ksize + (kx+offset)];
                    r += src[idx] * kval;
                    g += src[idx+1] * kval;
                    b += src[idx+2] * kval;
                }
            }
            const idxDst = (y * w + x) * 4;
            dst[idxDst] = r / ksum;
            dst[idxDst+1] = g / ksum;
            dst[idxDst+2] = b / ksum;
            dst[idxDst+3] = 255;
        }
    }
    imageData.data.set(dst);
    return imageData;
}

function sobelEdgesWithSharpness(imageData, sharpness) {
    const w = imageData.width, h = imageData.height;
    const data = imageData.data;
    const gradMag = new Float32Array(w*h);
    const gradDir = new Float32Array(w*h);
    for (let y = 1; y < h-1; y++) {
        for (let x = 1; x < w-1; x++) {
            const idx = y*w + x;
            let gx = (-data[((y-1)*w + (x-1))*4] + data[((y-1)*w + (x+1))*4] 
                        -2*data[(y*w + (x-1))*4] + 2*data[(y*w + (x+1))*4] 
                        -data[((y+1)*w + (x-1))*4] + data[((y+1)*w + (x+1))*4]);
            let gy = (data[((y-1)*w + (x-1))*4] + 2*data[((y-1)*w + x)*4] + data[((y-1)*w + (x+1))*4] 
                        -data[((y+1)*w + (x-1))*4] - 2*data[((y+1)*w + x)*4] - data[((y+1)*w + (x+1))*4]);
            gx *= sharpness;
            gy *= sharpness;
            gradMag[idx] = Math.hypot(gx, gy);
            let angle = Math.atan2(gy, gx) * 180 / Math.PI;
            if (angle < 0) angle += 180;
            gradDir[idx] = angle;
        }
    }
    return { mag: gradMag, dir: gradDir, w, h };
}

function nonMaxSuppress(mag, dir, w, h) {
    const suppressed = new Float32Array(w*h);
    for (let y = 1; y < h-1; y++) {
        for (let x = 1; x < w-1; x++) {
            const idx = y*w + x;
            const angle = dir[idx];
            let dirIdx = 0;
            if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) dirIdx = 0;
            else if (angle >= 22.5 && angle < 67.5) dirIdx = 1;
            else if (angle >= 67.5 && angle < 112.5) dirIdx = 2;
            else dirIdx = 3;
            
            let n1, n2;
            if (dirIdx === 0) { n1 = mag[y*w + (x-1)]; n2 = mag[y*w + (x+1)]; }
            else if (dirIdx === 1) { n1 = mag[(y-1)*w + (x+1)]; n2 = mag[(y+1)*w + (x-1)]; }
            else if (dirIdx === 2) { n1 = mag[(y-1)*w + x]; n2 = mag[(y+1)*w + x]; }
            else { n1 = mag[(y-1)*w + (x-1)]; n2 = mag[(y+1)*w + (x+1)]; }
            
            if (mag[idx] >= n1 && mag[idx] > n2) suppressed[idx] = mag[idx];
        }
    }
    return suppressed;
}

function hysteresisThreshold(suppressed, lowVal, highVal, w, h) {
    const strong = 255, weak = 100;
    const out = new Uint8Array(w*h);
    for (let i = 0; i < w*h; i++) {
        const val = suppressed[i];
        if (val >= highVal) out[i] = strong;
        else if (val >= lowVal) out[i] = weak;
    }
    const queue = [];
    for (let i=0; i<w*h; i++) if (out[i] === strong) queue.push(i);
    const dirs = [-w-1, -w, -w+1, -1, 1, w-1, w, w+1];
    while (queue.length) {
        const idx = queue.shift();
        for (let d of dirs) {
            const ni = idx + d;
            if (ni >= 0 && ni < w*h && out[ni] === weak) {
                out[ni] = strong;
                queue.push(ni);
            }
        }
    }
    for (let i=0; i<w*h; i++) if (out[i] !== strong) out[i] = 0;
    return out;
}

function traceContours(binary, w, h) {
    const visited = new Uint8Array(w * h);
    const isEdge = (x, y) => x >= 0 && x < w && y >= 0 && y < h && binary[y * w + x] !== 0;

    const getNeighbors = (cx, cy) => {
        const nb = [];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                if (isEdge(cx + dx, cy + dy)) nb.push({x: cx + dx, y: cy + dy});
            }
        }
        return nb;
    };

    const getBestNeighbor = (cx, cy, px, py) => {
        const nbs = getNeighbors(cx, cy).filter(n => !visited[n.y * w + n.x]);
        if (nbs.length === 0) return null;
        if (nbs.length === 1) return nbs[0];

        if (px !== -1) {
            let bestDot = -Infinity;
            let bestN = null;
            let dx1 = cx - px, dy1 = cy - py;
            let len1 = Math.hypot(dx1, dy1) || 1;
            dx1 /= len1; dy1 /= len1;

            for (let n of nbs) {
                let dx2 = n.x - cx, dy2 = n.y - cy;
                let len2 = Math.hypot(dx2, dy2) || 1;
                dx2 /= len2; dy2 /= len2;

                let dot = dx1 * dx2 + dy1 * dy2;
                if (dot > bestDot) {
                    bestDot = dot;
                    bestN = n;
                }
            }
            return bestN;
        }
        return nbs.find(n => Math.abs(n.x - cx) + Math.abs(n.y - cy) === 1) || nbs[0];
    };

    const traceDirection = (startX, startY) => {
        let pts = [];
        let cx = startX, cy = startY;
        let prevX = -1, prevY = -1;

        while (true) {
            const idx = cy * w + cx;
            if (visited[idx]) break;
            
            visited[idx] = 1;
            pts.push({x: cx, y: cy});

            const next = getBestNeighbor(cx, cy, prevX, prevY);
            if (!next) break;

            prevX = cx;
            prevY = cy;
            cx = next.x;
            cy = next.y;
        }
        return pts;
    };

    const burnNeighbors = (path) => {
        for (let i = 0; i < path.length; i++) {
            const p = path[i];
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = p.x + dx, ny = p.y + dy;
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                        visited[ny * w + nx] = 1;
                    }
                }
            }
        }
    };

    let segments = [];

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!isEdge(x, y) || visited[y * w + x]) continue;
            let nbs = getNeighbors(x, y).filter(n => !visited[n.y * w + n.x]);
            if (nbs.length === 1) {
                let path = traceDirection(x, y);
                if (path.length >= 8) {
                    segments.push(path);
                    burnNeighbors(path);
                }
            }
        }
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!isEdge(x, y) || visited[y * w + x]) continue;
            let path = traceDirection(x, y);
            if (path.length >= 8) {
                segments.push(path);
                burnNeighbors(path);
            }
        }
    }

    return segments;
}

function rdpSimplify(points, epsilon) {
    if (points.length < 3) return points.slice();
    const stack = [[0, points.length-1]];
    const keep = new Array(points.length).fill(false);
    keep[0] = keep[points.length-1] = true;
    while (stack.length) {
        const [start, end] = stack.pop();
        if (end - start <= 1) continue;
        let maxDist = 0, idx = start;
        const p1 = points[start], p2 = points[end];
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        for (let i = start+1; i < end; i++) {
            const p = points[i];
            let dist;
            if (len < 0.001) dist = Math.hypot(p.x-p1.x, p.y-p1.y);
            else {
                const t = ((p.x-p1.x)*dx + (p.y-p1.y)*dy) / (len*len);
                if (t <= 0) dist = Math.hypot(p.x-p1.x, p.y-p1.y);
                else if (t >= 1) dist = Math.hypot(p.x-p2.x, p.y-p2.y);
                else {
                    const projx = p1.x + t*dx, projy = p1.y + t*dy;
                    dist = Math.hypot(p.x-projx, p.y-projy);
                }
            }
            if (dist > maxDist) { maxDist = dist; idx = i; }
        }
        if (maxDist > epsilon) {
            keep[idx] = true;
            stack.push([start, idx], [idx, end]);
        }
    }
    return points.filter((_,i) => keep[i]);
}

function segmentsToLines(segments, epsilon) {
    let allLines = [];
    for (let seg of segments) {
        if (seg.length < 2) continue;
        let simp = rdpSimplify(seg, epsilon);
        if (simp.length < 2) continue;
        for (let i = 0; i < simp.length-1; i++) {
            allLines.push({x1: simp[i].x, y1: simp[i].y, x2: simp[i+1].x, y2: simp[i+1].y});
        }
        const last = simp[simp.length-1], first = simp[0];
        if (Math.hypot(last.x-first.x, last.y-first.y) < 5 && simp.length > 2) {
            allLines.push({x1: last.x, y1: last.y, x2: first.x, y2: first.y});
        }
    }
    return allLines;
}

function findEpsilonForTarget(segments, targetLines, simplifyFactor) {
    if (segments.length === 0) return [];
    
    segments.sort((a, b) => b.length - a.length);

    let low = 0.2, high = 12.0;
    let bestLines = null, bestEps = low;
    for (let iter = 0; iter < 12; iter++) {
        const mid = (low + high) / 2;
        const lines = segmentsToLines(segments, mid * simplifyFactor);
        if (lines.length <= targetLines) {
            bestLines = lines;
            bestEps = mid;
            high = mid;
        } else {
            low = mid;
        }
        if (high - low < 0.1) break;
    }
    const finalEps = (bestEps + 0.05) * simplifyFactor;
    let final = segmentsToLines(segments, finalEps);
    
    if (final.length > targetLines) final = final.slice(0, targetLines);
    return final;
}

function smoothPathCoordinates(path, iterations = 3) {
    if (path.length < 3) return path;
    let result = path;
    
    for (let iter = 0; iter < iterations; iter++) {
        let temp = [{ x: result[0].x, y: result[0].y }];
        
        for (let i = 1; i < result.length - 1; i++) {
            temp.push({
                x: result[i-1].x * 0.25 + result[i].x * 0.5 + result[i+1].x * 0.25,
                y: result[i-1].y * 0.25 + result[i].y * 0.5 + result[i+1].y * 0.25
            });
        }
        
        temp.push({ x: result[result.length - 1].x, y: result[result.length - 1].y });
        result = temp;
    }
    return result;
}

function processMessage(data) {
    const { type, imageData, test, target, denoiseLevel, params } = data;
    
    if (type === 'auto_batch') {
        const { tests } = data;
        let w = imageData.width, h = imageData.height;
        let src = cv.matFromImageData(imageData);
        let gray = new cv.Mat();
        
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
        if (denoiseLevel >= 1) cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
        if (denoiseLevel >= 2) cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);

        for (const t of tests) {
            try {
                let edges = new cv.Mat();
                let low = t.low / t.sharp;
                let high = t.high / t.sharp;
                
                if (t.sharp > 1.2) {
                    low = Math.min(120, low * 1.2);
                    high = Math.min(200, high * 1.15);
                }

                cv.Canny(gray, edges, low, high, 3, false);

                let segments = extractPathsFromBinary(edges);
                
                let smoothedSegments = segments.map(seg => smoothPathCoordinates(seg, 8));
                let lines = smoothedSegments.length > 0 ? findEpsilonForTarget(smoothedSegments, target, t.simp) : [];
                self.postMessage({
                    type: 'auto_result',
                    testId: t.id,
                    linesCount: lines.length,
                    lines: lines,
                    params: t
                });

                edges.delete();
            } catch (error) {
                self.postMessage({ type: 'auto_result', testId: t.id, linesCount: 0, lines: [], error: error.message, params: t });
            }
        }
        src.delete(); gray.delete();
        self.postMessage({ type: 'auto_done' });
    } 
    
    else if (type === 'process' && params) {
        try {
            let src = cv.matFromImageData(imageData);
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
            
            if (params.denoiseLevel >= 1) cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
            if (params.denoiseLevel >= 2) cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
            
            let low = params.low / params.sharpness;
            let high = params.high / params.sharpness;

            let edges = new cv.Mat();
            cv.Canny(gray, edges, low, high, 3, false);
            
            
            let segments = extractPathsFromBinary(edges);
            let smoothedSegments = segments.map(seg => smoothPathCoordinates(seg, 8));
            let lines = smoothedSegments.length > 0 ? findEpsilonForTarget(smoothedSegments, params.target, params.simplifyFactor) : [];
            
            self.postMessage({ lines: lines, linesCount: lines.length });
            
            src.delete(); gray.delete(); edges.delete();
        } catch(error) {
            self.postMessage({ lines: [], linesCount: 0, error: error.message });
        }
    }

    else if (type === 'process_quads' && params) {
        try {
            const result = buildQuadsForLimit(imageData, params);
            self.postMessage({
                quads: result.rects,
                quadsCount: result.rects.length,
                outWidth: result.w,
                outHeight: result.h,
                isAutoOptimized: result.isAutoOptimized
            });
        } catch (error) {
            self.postMessage({ quads: [], quadsCount: 0, error: error.message });
        }
    }

    else if (type === 'auto_batch_quads') {
        const { tests, target } = data;

        for (const t of tests) {
            try {
                const result = buildQuadsForLimit(imageData, {
                    maxQuads: target,
                    blurRadius: t.blur,
                    threshold: t.thresh,
                    denoiseEnabled: true
                });

                let singleCount = 0;
                for (const r of result.rects) {
                    if (r.w === 1 && r.h === 1) singleCount++;
                }

                self.postMessage({
                    type: 'auto_result_quads',
                    testId: t.id,
                    quadsCount: result.rects.length,
                    singleCount: singleCount,
                    isAutoOptimized: result.isAutoOptimized,
                    params: t
                });
            } catch (error) {
                self.postMessage({
                    type: 'auto_result_quads',
                    testId: t.id,
                    quadsCount: 0,
                    singleCount: 0,
                    isAutoOptimized: false,
                    error: error.message,
                    params: t
                });
            }
        }

        self.postMessage({ type: 'auto_done_quads' });
    }
}

function boxBlurQuads(src, w, h, r) {
    if (r <= 0) return new Float32Array(src);
    const dst = new Float32Array(w * h);
    const temp = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
        let sum = 0;
        const yOffset = y * w;
        for (let x = -r; x <= r; x++) {
            const px = Math.min(w - 1, Math.max(0, x));
            sum += src[yOffset + px];
        }
        for (let x = 0; x < w; x++) {
            temp[yOffset + x] = sum / (2 * r + 1);
            const removePx = Math.max(0, x - r);
            const addPx = Math.min(w - 1, x + r + 1);
            sum += src[yOffset + addPx] - src[yOffset + removePx];
        }
    }

    for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let y = -r; y <= r; y++) {
            const py = Math.min(h - 1, Math.max(0, y));
            sum += temp[py * w + x];
        }
        for (let y = 0; y < h; y++) {
            dst[y * w + x] = sum / (2 * r + 1);
            const removePy = Math.max(0, y - r);
            const addPy = Math.min(h - 1, y + r + 1);
            sum += temp[addPy * w + x] - temp[removePy * w + x];
        }
    }
    return dst;
}

function resampleImageData(imageData, targetW, targetH) {
    const { width: srcW, height: srcH, data: srcData } = imageData;

    if (targetW === srcW && targetH === srcH) {
        return srcData;
    }

    if (typeof OffscreenCanvas !== 'undefined') {
        const srcCanvas = new OffscreenCanvas(srcW, srcH);
        const srcCtx = srcCanvas.getContext('2d');
        srcCtx.putImageData(new ImageData(new Uint8ClampedArray(srcData), srcW, srcH), 0, 0);

        const dstCanvas = new OffscreenCanvas(targetW, targetH);
        const dstCtx = dstCanvas.getContext('2d');
        dstCtx.drawImage(srcCanvas, 0, 0, targetW, targetH);

        return dstCtx.getImageData(0, 0, targetW, targetH).data;
    }

    const out = new Uint8ClampedArray(targetW * targetH * 4);
    const scaleX = srcW / targetW;
    const scaleY = srcH / targetH;
    for (let y = 0; y < targetH; y++) {
        const sy = Math.min(srcH - 1, Math.floor(y * scaleY));
        for (let x = 0; x < targetW; x++) {
            const sx = Math.min(srcW - 1, Math.floor(x * scaleX));
            const srcIdx = (sy * srcW + sx) * 4;
            const dstIdx = (y * targetW + x) * 4;
            out[dstIdx] = srcData[srcIdx];
            out[dstIdx + 1] = srcData[srcIdx + 1];
            out[dstIdx + 2] = srcData[srcIdx + 2];
            out[dstIdx + 3] = srcData[srcIdx + 3];
        }
    }
    return out;
}

function buildGridAndRectsQuads(imageData, targetW, targetH, cleanNoise, blurRadius, threshold) {
    const data = resampleImageData(imageData, targetW, targetH);

    const gray = new Float32Array(targetW * targetH);
    const inverted = new Float32Array(targetW * targetH);

    for (let i = 0; i < data.length; i += 4) {
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const idx = i / 4;
        gray[idx] = g;
        inverted[idx] = 255 - g;
    }

    const blurredInverted = boxBlurQuads(inverted, targetW, targetH, blurRadius);

    const grid = [];
    for (let y = 0; y < targetH; y++) {
        grid[y] = new Uint8Array(targetW);
    }

    for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
            const idx = y * targetW + x;
            const g = gray[idx];
            const b = blurredInverted[idx];

            let val;
            const denom = 255 - b;

            if (denom <= 0) {
                val = (g < 128) ? 0 : 255;
            } else {
                val = (g * 255) / denom;
            }

            grid[y][x] = (val < threshold || g < 20) ? 1 : 0;
        }
    }

    if (cleanNoise) {
        for (let y = 1; y < targetH - 1; y++) {
            for (let x = 1; x < targetW - 1; x++) {
                if (grid[y][x] === 1) {
                    const n = grid[y - 1][x] + grid[y + 1][x] + grid[y][x - 1] + grid[y][x + 1];
                    if (n === 0) grid[y][x] = 0;
                }
            }
        }
    }

    const rects = [];
    const visited = [];
    for (let y = 0; y < targetH; y++) {
        visited[y] = new Uint8Array(targetW);
    }

    for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
            if (grid[y][x] === 1 && !visited[y][x]) {
                let width = 0;
                while (x + width < targetW && grid[y][x + width] === 1 && !visited[y][x + width]) {
                    width++;
                }

                let height = 1;
                while (y + height < targetH) {
                    let canExtend = true;
                    for (let k = 0; k < width; k++) {
                        if (grid[y + height][x + k] !== 1 || visited[y + height][x + k]) {
                            canExtend = false;
                            break;
                        }
                    }
                    if (canExtend) height++;
                    else break;
                }

                for (let dy = 0; dy < height; dy++) {
                    for (let dx = 0; dx < width; dx++) {
                        visited[y + dy][x + dx] = 1;
                    }
                }

                rects.push({ x, y, w: width, h: height });
            }
        }
    }

    return rects;
}

function buildQuadsForLimit(imageData, params) {
    const origW = imageData.width;
    const origH = imageData.height;
    const maxQuadsLimit = params.maxQuads;
    const blurRadius = params.blurRadius;
    const threshold = params.threshold;
    const denoiseEnabled = params.denoiseEnabled;

    let currentW = origW;
    let currentH = origH;
    let rects = buildGridAndRectsQuads(imageData, currentW, currentH, denoiseEnabled, blurRadius, threshold);
    let isAutoOptimized = false;

    let attempts = 0;
    while (rects.length > maxQuadsLimit && attempts < 10) {
        isAutoOptimized = true;

        const factor = Math.sqrt(maxQuadsLimit / rects.length) * 0.95;
        currentW = Math.max(32, Math.floor(currentW * factor));
        currentH = Math.max(32, Math.floor(currentH * factor));

        rects = buildGridAndRectsQuads(imageData, currentW, currentH, denoiseEnabled, blurRadius, threshold);
        attempts++;
    }

    return { rects, w: currentW, h: currentH, isAutoOptimized };
}

function extractPathsFromBinary(edgesMat) {
    let w = edgesMat.cols;
    let h = edgesMat.rows;
    let data = edgesMat.data; 
    let visited = new Uint8Array(w * h);
    let paths = [];

    function getNeighbors(cx, cy) {
        let nbs = [];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                let nx = cx + dx;
                let ny = cy + dy;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                    let idx = ny * w + nx;
                    if (data[idx] > 0 && visited[idx] === 0) {
                        nbs.push({ x: nx, y: ny, idx: idx });
                    }
                }
            }
        }
        return nbs;
    }

    function lookAhead(startNeighbor, cx, cy, prevX, prevY) {
        let localVisited = new Set();
        localVisited.add(startNeighbor.idx);
        
        let pathIndices = [startNeighbor.idx];
        let current = startNeighbor;
        let pX = cx;
        let pY = cy;
        
        let steps = 1;
        let maxSteps = 5;
        
        let firstDot = 1.0;
        if (prevX !== null && prevY !== null) {
            let dx1 = cx - prevX;
            let dy1 = cy - prevY;
            let len1 = Math.hypot(dx1, dy1) || 1;
            
            let dx2 = startNeighbor.x - cx;
            let dy2 = startNeighbor.y - cy;
            let len2 = Math.hypot(dx2, dy2) || 1;
            
            firstDot = (dx1 / len1) * (dx2 / len2) + (dy1 / len1) * (dy2 / len2);
        }

        while (steps < maxSteps) {
            let nbs = [];
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    let nx = current.x + dx;
                    let ny = current.y + dy;
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                        let idx = ny * w + nx;
                        if (data[idx] > 0 && visited[idx] === 0 && !localVisited.has(idx)) {
                            nbs.push({ x: nx, y: ny, idx: idx });
                        }
                    }
                }
            }
            
            if (nbs.length === 0) break;
            
            let nextN = nbs[0];
            if (nbs.length > 1) {
                let ldx = current.x - pX;
                let ldy = current.y - pY;
                let llen = Math.hypot(ldx, ldy) || 1;
                
                let bestScore = -Infinity;
                for (let n of nbs) {
                    let ndx = n.x - current.x;
                    let ndy = n.y - current.y;
                    let nlen = Math.hypot(ndx, ndy) || 1;
                    let score = (ldx / llen) * (ndx / nlen) + (ldy / llen) * (ndy / nlen);
                    if (score > bestScore) {
                        bestScore = score;
                        nextN = n;
                    }
                }
            }
            
            localVisited.add(nextN.idx);
            pathIndices.push(nextN.idx);
            pX = current.x;
            pY = current.y;
            current = nextN;
            steps++;
        }
        
        return {
            length: steps,
            path: pathIndices,
            dotProduct: firstDot
        };
    }

    function processJunctionAndGetBest(cx, cy, prevX, prevY, nbs) {
        if (nbs.length === 1) return nbs[0];
        
        let bestN = null;
        let bestScore = -Infinity;
        let evaluations = [];

        for (let n of nbs) {
            let evalResult = lookAhead(n, cx, cy, prevX, prevY);
            evaluations.push({ neighbor: n, eval: evalResult });
            
            let score = evalResult.length + (evalResult.dotProduct + 1.0) * 0.2;
            
            if (score > bestScore) {
                bestScore = score;
                bestN = n;
            }
        }

        for (let ev of evaluations) {
            if (ev.neighbor.idx !== bestN.idx) {
                if (ev.eval.length < 4) {
                    for (let idx of ev.eval.path) {
                        visited[idx] = 1;
                    }
                }
            }
        }

        return bestN;
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let startIdx = y * w + x;
            if (data[startIdx] > 0 && visited[startIdx] === 0) {
                let path = [{ x: x, y: y }];
                visited[startIdx] = 1;

                let currX = x, currY = y;
                let prevX = null, prevY = null;
                while (true) {
                    let nbs = getNeighbors(currX, currY);
                    if (nbs.length === 0) break;
                    
                    let next = processJunctionAndGetBest(currX, currY, prevX, prevY, nbs);
                    visited[next.idx] = 1;
                    path.push({ x: next.x, y: next.y });
                    
                    prevX = currX; prevY = currY;
                    currX = next.x; currY = next.y;
                }

                currX = x; currY = y;
                prevX = path.length > 1 ? path[1].x : null; 
                prevY = path.length > 1 ? path[1].y : null;
                
                let backPath = [];
                while (true) {
                    let nbs = getNeighbors(currX, currY);
                    if (nbs.length === 0) break;
                    
                    let next = processJunctionAndGetBest(currX, currY, prevX, prevY, nbs);
                    visited[next.idx] = 1;
                    backPath.push({ x: next.x, y: next.y });
                    
                    prevX = currX; prevY = currY;
                    currX = next.x; currY = next.y;
                }

                if (backPath.length > 0) {
                    backPath.reverse();
                    path = backPath.concat(path);
                }

                let pathLength = 0;
                for (let i = 1; i < path.length; i++) {
                    pathLength += Math.hypot(path[i].x - path[i-1].x, path[i].y - path[i-1].y);
                }
                
                if (pathLength >= 7.0) {
                    paths.push(path);
                }
            }
        }
    }
    return paths;
}