const referenceArray = [];
for (let i = 0; i < 3; i++) {
    referenceArray.push({
        obj: null,
        size: 1,
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 0.5,
        url: null
    });
}

let currentReference = 0;

function setReference() {
    const url = el("refUrl").value;
    if (url && url.trim() !== "") {
        setReferenceSrc(url);
    }
}

function setReferenceSize() {
    referenceArray[currentReference].size = parseFloat(el("refSize").value);
}

function setReferenceX() {
    referenceArray[currentReference].x = parseFloat(el("refShiftX").value);
}

function setReferenceY() {
    referenceArray[currentReference].y = -parseFloat(el("refShiftY").value);
}

function setReferenceRotation() {
    referenceArray[currentReference].rotation = parseFloat(el("refRotation").value);
}

function setReferenceOpacity() {
    referenceArray[currentReference].opacity = parseFloat(el("refOpacityInput").value);
}

el("refFile").onchange = () => {
    const fileInput = el("refFile");
    const file = fileInput.files[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
        referenceArray[currentReference].obj = img;
        referenceArray[currentReference].url = null;
        setReferenceMenu();
    };
    img.src = url;
};

function setReferenceSrc(url) {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
        referenceArray[currentReference].obj = img;
        referenceArray[currentReference].url = url;
        setReferenceMenu();
    };
    img.onerror = () => {
        console.error("Failed to load image:", url);
        referenceArray[currentReference].obj = null;
        referenceArray[currentReference].url = null;
        setReferenceMenu();
    };
    img.src = url;
}

function setReferenceMenu() {
    const nextBtn = el("nextRefButton");
    if (nextBtn) nextBtn.innerHTML = (currentReference + 1) + "/3 >";
    
    const ref = referenceArray[currentReference];
    const urlInput = el("refUrl");
    
    if (ref.url) {
        urlInput.value = ref.url;
    } else {
        urlInput.value = "";
    }
    
    el("refSize").value = ref.size;
    el("refShiftX").value = ref.x;
    el("refShiftY").value = -ref.y;
    el("refRotation").value = ref.rotation;
    el("refOpacityInput").value = ref.opacity;
}

/*function calc()
{
    const canv = document.createElement("canvas");

    const w = referenceArray[currentReference].obj.width;
    const h = referenceArray[currentReference].obj.height;
    const pixels = w * h;

    canv.width = w;
    canv.height = h;
    const canvctx = canv.getContext("2d");
    canvctx.drawImage(referenceArray[currentReference].obj, 0, 0);
    const data = canvctx.getImageData(0, 0, canv.width, canv.height);
    const brightnesses = [];

    for (let i = 0; i < pixels; i++)
    {
        brightnesses[i] = data.data[i * 4];
    }

    function addQuad(id, pos1, pos2, pos3, pos4)
    {
        const object =
            {
                name: lang.quad + id,
                type: "quad",
                pos1: pos1,
                pos2: pos2,
                pos3: pos3,
                pos4: pos4,
                selected: false
            };

        objects.set(id, object);
    }

    const decimation = 5.5;
    const size = 1 / h * decimation;
    let id = 100;
    const xS = -0.5 * (w/h);
    const yS = -0.5;
    const threshold = 10;

    for (let y = 0; y < h; y += decimation)
    {
        for (let x = 0; x < w; x += decimation)
        {
            const v = brightnesses[Math.floor(y) * w + Math.floor(x)];
            //if (v === 255) continue;
            if (v >= 255 - threshold) continue;
            const r = 1 - (v / 255);

            const x0 = xS + ((x + 0.5) / decimation) * size - (r * 0.5 * size);
            const y0 = yS + ((y + 0.5) / decimation) * size - (r * 0.5 * size);
            const x1 = xS + ((x + 0.5) / decimation) * size + (r * 0.5 * size);
            const y1 = yS + ((y + 0.5) / decimation) * size + (r * 0.5 * size);

            addQuad(id, {x: x0, y: y0}, {x: x1, y: y0}, {x: x1, y: y1}, {x: x0, y: y1});
            id++;
        }
    }

    console.log(id - 100);
}*/