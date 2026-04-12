const saver = el("saver");

function formSaveData()
{
    const data = Object.fromEntries(objects);

    return JSON.stringify(data);
}

async function save()
{
    const file = new Blob([formSaveData()], {type: "application/json"});
    saver.href = URL.createObjectURL(file);

    const name = el("saveFileName").value;
    saver.download = name.length !== 0 ? name : "sight";
    saver.click();

    setTimeout(() => URL.revokeObjectURL(saver.href), 100);
}

el("loadButtonInput").onchange = () =>
{
    const fileInput = el("loadButtonInput");
    const file = fileInput.files[0];
    
    if (!file) return;
    
    const fr = new FileReader();
    fr.onload = (e) => {
        loadFromFile(e);
        fileInput.value = "";
    };
    fr.onerror = () => {
        fileInput.value = "";
    };
    fr.readAsText(file);
};

function loadFromFile(e)
{
    load(e.target.result);
}

function load(rawData)
{
    objects = new Map(Object.entries(JSON.parse(rawData)));
    refreshObjectsList();
    unselectAnyObjects();
    clearEvents();
}

async function saveExport(data)
{
    const file = new Blob([data], {type: "text/plain"});
    saver.href = URL.createObjectURL(file);

    const name = el("saveFileName").value;
    saver.download = name.length !== 0 ? name : "sight";
    saver.click();
}