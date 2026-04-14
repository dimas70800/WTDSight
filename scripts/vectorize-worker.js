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

self.onmessage = function(e) {
    const { type, imageData, test, target, denoiseLevel, params } = e.data;
    
    if (type === 'auto' || test) {
        const testData = test || params;
        const targetVal = target || (params ? params.target : 2000);
        const denoise = denoiseLevel || (params ? params.denoiseLevel : 1);
        
        try {
            const w = imageData.width, h = imageData.height;
            let work = new ImageData(new Uint8ClampedArray(imageData.data), w, h);
            
            grayscaleFast(work);
            if (denoise >= 1) gaussianBlurCustom(work, 1);
            if (denoise >= 2) gaussianBlurCustom(work, 1);
            
            const { mag, dir } = sobelEdgesWithSharpness(work, testData.sharp);
            const suppressed = nonMaxSuppress(mag, dir, w, h);
            
            let low = testData.low, high = testData.high;
            if (testData.sharp > 1.2) {
                low = Math.min(120, low * 1.2);
                high = Math.min(200, high * 1.15);
            }
            
            const binary = hysteresisThreshold(suppressed, low, high, w, h);
            let segments = traceContours(binary, w, h);
            
            let linesCount = 0;
            let lines = [];
            if (segments.length > 0) {
                lines = findEpsilonForTarget(segments, targetVal, testData.simp);
                linesCount = lines.length;
            }
            
            self.postMessage({
                testId: testData.id,
                linesCount: linesCount,
                lines: lines,
                params: testData
            });
            
        } catch(error) {
            self.postMessage({
                testId: testData.id,
                linesCount: 0,
                lines: [],
                error: error.message,
                params: testData
            });
        }
    }
    
    else if (type === 'process' && params) {
        try {
            const w = imageData.width, h = imageData.height;
            let work = new ImageData(new Uint8ClampedArray(imageData.data), w, h);
            
            grayscaleFast(work);
            if (params.denoiseLevel >= 1) gaussianBlurCustom(work, 1);
            if (params.denoiseLevel >= 2) gaussianBlurCustom(work, 1);
            
            const { mag, dir } = sobelEdgesWithSharpness(work, params.sharpness);
            const suppressed = nonMaxSuppress(mag, dir, w, h);
            const binary = hysteresisThreshold(suppressed, params.low, params.high, w, h);
            
            let segments = traceContours(binary, w, h);
            
            let lines = [];
            if (segments.length > 0) {
                lines = findEpsilonForTarget(segments, params.target, params.simplifyFactor);
            }
            
            self.postMessage({
                lines: lines,
                linesCount: lines.length
            });
            
        } catch(error) {
            self.postMessage({
                lines: [],
                linesCount: 0,
                error: error.message
            });
        }
    }
};