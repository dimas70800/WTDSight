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

function pushEvent(type, data) {

    redoEvents = [];

    let eventData;
    switch (type) {
        case 'add':
            eventData = data;
            break;
        case 'delete':
            eventData = data;
            break;
        case 'move':
            eventData = data;
            break;
        case 'move_multiple':
            eventData = data;
            break;
        default:
            eventData = data;
    }

    events.push({ type, data: eventData });
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

            let currentValue;
            switch (obj.type) {
                case 'line':
                    switch (posPulled) {
                        case 0: currentValue = obj.start.x; break;
                        case 1: currentValue = obj.start.y; break;
                        case 2: currentValue = obj.end.x; break;
                        case 3: currentValue = obj.end.y; break;
                    }
                    break;
                case 'quad':
                    switch (posPulled) {
                        case 0: currentValue = obj.pos1.x; break;
                        case 1: currentValue = obj.pos1.y; break;
                        case 2: currentValue = obj.pos2.x; break;
                        case 3: currentValue = obj.pos2.y; break;
                        case 4: currentValue = obj.pos3.x; break;
                        case 5: currentValue = obj.pos3.y; break;
                        case 6: currentValue = obj.pos4.x; break;
                        case 7: currentValue = obj.pos4.y; break;
                    }
                    break;
                default: break;
            }

            switch (obj.type) {
                case 'line':
                    switch (posPulled) {
                        case 0: obj.start.x = prevValue; break;
                        case 1: obj.start.y = prevValue; break;
                        case 2: obj.end.x = prevValue; break;
                        case 3: obj.end.y = prevValue; break;
                    }
                    break;
                case 'quad':
                    switch (posPulled) {
                        case 0: obj.pos1.x = prevValue; break;
                        case 1: obj.pos1.y = prevValue; break;
                        case 2: obj.pos2.x = prevValue; break;
                        case 3: obj.pos2.y = prevValue; break;
                        case 4: obj.pos3.x = prevValue; break;
                        case 5: obj.pos3.y = prevValue; break;
                        case 6: obj.pos4.x = prevValue; break;
                        case 7: obj.pos4.y = prevValue; break;
                    }
                    break;
            }

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
                    prevData: JSON.parse(JSON.stringify(item.prevData)),
                    newData: JSON.parse(JSON.stringify(item.newData))
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