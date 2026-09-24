let events = [];
let redoEvents = [];
const capacity = 500;

function applyObjectCoordinates(obj, coords) {
    if (!obj || !coords) return;

    if (obj.type === "line") {
        obj.start.x = coords.start.x;
        obj.start.y = coords.start.y;
        obj.end.x = coords.end.x;
        obj.end.y = coords.end.y;
    } else if (obj.type === "quad") {
        obj.pos1.x = coords.pos1.x;
        obj.pos1.y = coords.pos1.y;
        obj.pos2.x = coords.pos2.x;
        obj.pos2.y = coords.pos2.y;
        obj.pos3.x = coords.pos3.x;
        obj.pos3.y = coords.pos3.y;
        obj.pos4.x = coords.pos4.x;
        obj.pos4.y = coords.pos4.y;
    }
}

function cloneObjectCoordinates(coords) {
    if (!coords) return null;
    if (coords.type === "line" || coords.start) {
        return {
            type: "line",
            start: { x: coords.start.x, y: coords.start.y },
            end: { x: coords.end.x, y: coords.end.y }
        };
    } else if (coords.type === "quad" || coords.pos1) {
        return {
            type: "quad",
            pos1: { x: coords.pos1.x, y: coords.pos1.y },
            pos2: { x: coords.pos2.x, y: coords.pos2.y },
            pos3: { x: coords.pos3.x, y: coords.pos3.y },
            pos4: { x: coords.pos4.x, y: coords.pos4.y }
        };
    }
    return coords;
}

function getObjectVertexCoord(obj, index) {
    if (!obj) return 0;
    if (obj.type === 'line') {
        switch (index) {
            case 0: return obj.start.x;
            case 1: return obj.start.y;
            case 2: return obj.end.x;
            case 3: return obj.end.y;
        }
    } else if (obj.type === 'quad') {
        switch (index) {
            case 0: return obj.pos1.x;
            case 1: return obj.pos1.y;
            case 2: return obj.pos2.x;
            case 3: return obj.pos2.y;
            case 4: return obj.pos3.x;
            case 5: return obj.pos3.y;
            case 6: return obj.pos4.x;
            case 7: return obj.pos4.y;
        }
    }
    return 0;
}

function setObjectVertexCoord(obj, index, value) {
    if (!obj) return;
    if (obj.type === 'line') {
        switch (index) {
            case 0: obj.start.x = value; break;
            case 1: obj.start.y = value; break;
            case 2: obj.end.x = value; break;
            case 3: obj.end.y = value; break;
        }
    } else if (obj.type === 'quad') {
        switch (index) {
            case 0: obj.pos1.x = value; break;
            case 1: obj.pos1.y = value; break;
            case 2: obj.pos2.x = value; break;
            case 3: obj.pos2.y = value; break;
            case 4: obj.pos3.x = value; break;
            case 5: obj.pos3.y = value; break;
            case 6: obj.pos4.x = value; break;
            case 7: obj.pos4.y = value; break;
        }
    }
}

function pushEvent(type, data) {
    redoEvents = [];
    events.push({ type, data });
    if (events.length > capacity) events.shift();
}

function popEvent() {
    if (events.length === 0) return;

    const event = events.pop();
    const { type, data } = event;

    let redoEvent = null;

    switch (type) {
        case 'add': {
            const { id, object } = data;
            if (!objects.has(id)) break;
            objects.delete(id);
            if (selectedId === id) {
                unselectAnyObjects();
                showInfo(null);
            }
            redoEvent = { type: 'add', data: { id, object } };
            break;
        }
        case 'delete': {
            const { id, object } = data;
            if (objects.has(id)) break;
            object.selected = false;
            objects.set(id, object);
            redoEvent = { type: 'delete', data: { id, object } };
            break;
        }
        case 'move': {
            const { id, posPulled, prevValue } = data;
            const obj = objects.get(id);
            if (!obj) break;

            const currentValue = getObjectVertexCoord(obj, posPulled);
            setObjectVertexCoord(obj, posPulled, prevValue);

            redoEvent = {
                type: 'move',
                data: { id, posPulled, prevValue: currentValue, newValue: prevValue }
            };
            break;
        }
        case 'add_multiple': {
            for (const item of data) {
                if (objects.has(item.id)) {
                    objects.delete(item.id);
                    if (typeof selectedId !== 'undefined' && selectedId === item.id) {
                        unselectAnyObjects();
                        showInfo(null);
                    }
                }
            }
            redoEvent = { type: 'add_multiple', data: data };
            break;
        }

        case 'delete_multiple': {
            for (const item of data) {
                if (!objects.has(item.id)) {
                    item.object.selected = false;
                    objects.set(item.id, item.object);
                }
            }
            redoEvent = { type: 'delete_multiple', data: data };
            break;
        }
        case 'move_multiple': {
            const { objectsData } = data;
            const newRedoData = [];

            for (const item of objectsData) {
                const obj = objects.get(item.id);
                if (!obj) continue;

                newRedoData.push({
                    id: item.id,
                    prevData: cloneObjectCoordinates(item.prevData),
                    newData: cloneObjectCoordinates(item.newData)
                });

                applyObjectCoordinates(obj, item.prevData);
            }

            redoEvent = {
                type: 'move_multiple',
                data: { objectsData: newRedoData }
            };
            break;
        }
        default:
            break;
    }

    if (redoEvent) {
        redoEvents.push(redoEvent);
        if (redoEvents.length > capacity) redoEvents.shift();
    }

    refreshObjectsList();
}

function clearEvents() {
    events = [];
    redoEvents = [];
}