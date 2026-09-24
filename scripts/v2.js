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