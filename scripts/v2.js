function v2add(a, b)
{
    return { x: a.x + b.x, y: a.y + b.y };
}

function v2inv(a)
{
    return { x: -a.x, y: -a.y };
}

function v2sub(a, b)
{
    return { x: a.x - b.x, y: a.y - b.y };
}

function v2mul(a, c)
{
    return { x: a.x * c, y: a.y * c };
}

function v2equal(a, b)
{
    return a.x === b.x && a.y === b.y;
}

function v2sqrmag(a, b)
{
    return (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
}

function v2copy(a)
{
    return { x: a.x, y: a.y };
}

function v2avg(positions)
{
    const len = positions.length;
    if (len === 0) return { x: 0, y: 0 };

    let sumX = 0, sumY = 0;
    for (let i = 0; i < len; i++)
    {
        sumX += positions[i].x;
        sumY += positions[i].y;
    }

    return { x: sumX / len, y: sumY / len };
}

function isGeometryIdentical(added, deleted) {
    if (!added || !deleted || added.length !== deleted.length) return false;
    if (added.length === 0) return true;

    const used = new Uint8Array(deleted.length);
    for (let i = 0; i < added.length; i++) {
        const a = added[i].object || added[i];
        let matched = false;
        for (let j = 0; j < deleted.length; j++) {
            if (used[j]) continue;
            const d = deleted[j].object || deleted[j];
            if (a.type !== d.type) continue;

            if (a.type === 'line') {
                const d1 = Math.hypot(a.start.x - d.start.x, a.start.y - d.start.y) +
                           Math.hypot(a.end.x - d.end.x, a.end.y - d.end.y);
                const d2 = Math.hypot(a.start.x - d.end.x, a.start.y - d.end.y) +
                           Math.hypot(a.end.x - d.start.x, a.end.y - d.start.y);
                if (d1 < 1e-4 || d2 < 1e-4) {
                    used[j] = 1;
                    matched = true;
                    break;
                }
            } else if (a.type === 'quad') {
                const aPts = [a.pos1, a.pos2, a.pos3, a.pos4];
                const dPts = [d.pos1, d.pos2, d.pos3, d.pos4];
                let quadMatch = false;
                for (let shift = 0; shift < 4; shift++) {
                    let diffFwd = 0;
                    let diffRev = 0;
                    for (let k = 0; k < 4; k++) {
                        diffFwd += Math.hypot(aPts[k].x - dPts[(k + shift) % 4].x, aPts[k].y - dPts[(k + shift) % 4].y);
                        diffRev += Math.hypot(aPts[k].x - dPts[(4 - k + shift) % 4].x, aPts[k].y - dPts[(4 - k + shift) % 4].y);
                    }
                    if (diffFwd < 1e-4 || diffRev < 1e-4) {
                        quadMatch = true;
                        break;
                    }
                }
                if (quadMatch) {
                    used[j] = 1;
                    matched = true;
                    break;
                }
            }
        }
        if (!matched) return false;
    }
    return true;
}