let events = [];
let redoEvents = [];
const capacity = 500;

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