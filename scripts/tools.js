let tool = "lines";

const toolNames = [ "lines", "quads", "hatch", "vectorize", "select" ];
for (const toolName of toolNames)
{
    const buttonName = "tools" + toolName.substring(0, 1).toUpperCase() + toolName.substring(1) + "Button";

    el(buttonName).onclick = () =>
    {
        tool = toolName;
        
        clearIntermediateDrawing();
        if (toolName === "hatch") {
            if (typeof cancelHatch === 'function') cancelHatch();
        }
        if (toolName === "vectorize") {
            if (typeof toggleVectorizePanel === 'function') toggleVectorizePanel(true);
        } else {
            if (typeof hideVectorizePreview === 'function') hideVectorizePreview();
            const panel = document.getElementById('vectorizePanel');
            if (panel) panel.style.display = 'none';
        }
        
        if (toolName === "select") {
            selectionRect = null;
            isSelecting = false;
        }
        
        markAllTools();
    }

}
markAllTools();

function markAllTools()
{
    for (const toolName of toolNames)
    {
        const buttonName = "tools" + toolName.substring(0, 1).toUpperCase() + toolName.substring(1) + "Button";

        markTool(buttonName, toolName === tool);
    }
}

function markTool(name, isSelected)
{
    const btn = el(name);
    if (btn) btn.disabled = isSelected;
}