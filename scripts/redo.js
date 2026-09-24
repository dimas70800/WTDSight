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

            const currentValue = getObjectVertexCoord(obj, posPulled);
            setObjectVertexCoord(obj, posPulled, newValue);

            undoEvent = {
                type: 'move',
                data: { id, posPulled, prevValue: currentValue, newValue }
            };
            break;
        }

        case 'add_multiple': {
            for (const item of data) {
                if (!objects.has(item.id)) {
                    item.object.selected = false;
                    objects.set(item.id, item.object);
                }
            }
            undoEvent = { type: 'add_multiple', data: data };
            break;
        }

        case 'delete_multiple': {
            for (const item of data) {
                if (objects.has(item.id)) {
                    objects.delete(item.id);
                    if (typeof selectedId !== 'undefined' && selectedId === item.id) {
                        unselectAnyObjects();
                        showInfo(null);
                    }
                }
            }
            undoEvent = { type: 'delete_multiple', data: data };
            break;
        }
        case 'move_multiple': {
            const { objectsData } = data;

            for (const item of objectsData) {
                const obj = objects.get(item.id);
                if (!obj) continue;

                applyObjectCoordinates(obj, item.newData);
            }

            undoEvent = { type: 'move_multiple', data: { objectsData: objectsData } };
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