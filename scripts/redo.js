function popRedo() {
    if (redoEvents.length === 0) return;

    const redoEvent = redoEvents.pop();
    const { type, data } = redoEvent;

    let undoEvent = null;

    switch (type) {
        case 'add': {
            const { id, object } = data;
            if (objects.has(id)) break;
            object.selected = false;
            objects.set(id, object);
            undoEvent = { type: 'add', data: { id, object } };
            break;
        }
        case 'delete': {
            const { id, object } = data;
            if (!objects.has(id)) break;
            objects.delete(id);
            if (selectedId === id) {
                unselectAnyObjects();
                showInfo(null);
            }
            undoEvent = { type: 'delete', data: { id, object } };
            break;
        }
        case 'move': {
            const { id, posPulled, newValue } = data;
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
                        case 0: obj.start.x = newValue; break;
                        case 1: obj.start.y = newValue; break;
                        case 2: obj.end.x = newValue; break;
                        case 3: obj.end.y = newValue; break;
                    }
                    break;
                case 'quad':
                    switch (posPulled) {
                        case 0: obj.pos1.x = newValue; break;
                        case 1: obj.pos1.y = newValue; break;
                        case 2: obj.pos2.x = newValue; break;
                        case 3: obj.pos2.y = newValue; break;
                        case 4: obj.pos3.x = newValue; break;
                        case 5: obj.pos3.y = newValue; break;
                        case 6: obj.pos4.x = newValue; break;
                        case 7: obj.pos4.y = newValue; break;
                    }
                    break;
            }

            undoEvent = {
                type: 'move',
                data: { id, posPulled, prevValue: currentValue, newValue }
            };
            break;
        }
        default:
            break;
    }

    if (undoEvent) {
        events.push(undoEvent);
        if (events.length > capacity) events.shift();
    }
    
    refreshObjectsList();
}