function updateColorValues(id, hex) {
    const r = parseInt(hex.substr(1,2), 16);
    const g = parseInt(hex.substr(3,2), 16);
    const b = parseInt(hex.substr(5,2), 16);
    const a = document.getElementById(`exp_${id}_a`).value;
    document.getElementById(`exp_${id}_values`).textContent = `${r},${g},${b},${a}`;
}

function hexToRgb(hex) {
    return {
        r: parseInt(hex.substr(1,2), 16),
        g: parseInt(hex.substr(3,2), 16),
        b: parseInt(hex.substr(5,2), 16)
    };
}

function loadExportSettings() {
    try {
        const saved = localStorage.getItem('exportSettings');
        if (!saved) return;
        
        const s = JSON.parse(saved);
        
        // Цвета
        if (s.color1) {
            document.getElementById('exp-color1').value = s.color1.hex;
            document.getElementById('exp_color1_a').value = s.color1.a;
            updateColorValues('color1', s.color1.hex);
        }
        if (s.color2) {
            document.getElementById('exp_color2').value = s.color2.hex;
            document.getElementById('exp_color2_a').value = s.color2.a;
            updateColorValues('color2', s.color2.hex);
        }
        if (s.color3) {
            document.getElementById('exp_color3').value = s.color3.hex;
            document.getElementById('exp_color3_a').value = s.color3.a;
            updateColorValues('color3', s.color3.hex);
        }
        if (s.color4) {
            document.getElementById('exp_color4').value = s.color4.hex;
            document.getElementById('exp_color4_a').value = s.color4.a;
            updateColorValues('color4', s.color4.hex);
        }
        
        // Числовые параметры
        if (s.rangefinderTextScale) document.getElementById('exp_rangefinderTextScale').value = s.rangefinderTextScale;
        if (s.rangefinderVerticalOffset) document.getElementById('exp_rangefinderVerticalOffset').value = s.rangefinderVerticalOffset;
        if (s.rangefinderHorizontalOffset) document.getElementById('exp_rangefinderHorizontalOffset').value = s.rangefinderHorizontalOffset;
        if (s.fontSizeMult) document.getElementById('exp_fontSizeMult').value = s.fontSizeMult;
        if (s.lineSizeMult) document.getElementById('exp_lineSizeMult').value = s.lineSizeMult;
        
        // Чекбоксы
        if (s.drawCentralLineVert !== undefined) document.getElementById('exp_drawCentralLineVert').checked = s.drawCentralLineVert;
        if (s.drawCentralLineHorz !== undefined) document.getElementById('exp_drawCentralLineHorz').checked = s.drawCentralLineHorz;
        
        // Множители рисок
        if (s.cdhsa1) document.getElementById('exp_cdhsa1').value = s.cdhsa1;
        if (s.cdhsa2) document.getElementById('exp_cdhsa2').value = s.cdhsa2;
        if (s.cdhsm1) document.getElementById('exp_cdhsm1').value = s.cdhsm1;
        if (s.cdhsm2) document.getElementById('exp_cdhsm2').value = s.cdhsm2;
        
        // Смещение поправки
        if (s.dcp1) document.getElementById('exp_dcp1').value = s.dcp1;
        if (s.dcp2) document.getElementById('exp_dcp2').value = s.dcp2;
        
        // Дополнительные параметры
        if (s.drawDistanceCorrection !== undefined) document.getElementById('exp_drawDistanceCorrection').checked = s.drawDistanceCorrection;
        if (s.useSmoothEdge !== undefined) document.getElementById('exp_useSmoothEdge').checked = s.useSmoothEdge;
        if (s.rangefinderUseThousandth !== undefined) document.getElementById('exp_rangefinderUseThousandth').checked = s.rangefinderUseThousandth;
        
        // Обнаружение союзника
        if (s.detectAllyTextScale) document.getElementById('exp_detectAllyTextScale').value = s.detectAllyTextScale;
        if (s.detectAllyOffset_1) document.getElementById('exp_detectAllyOffset_1').value = s.detectAllyOffset_1;
        if (s.detectAllyOffset_2) document.getElementById('exp_detectAllyOffset_2').value = s.detectAllyOffset_2;
        
    } catch (e) {
        console.log('Ошибка загрузки настроек', e);
    }
}

function saveExportSettings() {
    const settings = {
        // Цвета
        color1: {
            hex: document.getElementById('exp-color1').value,
            a: document.getElementById('exp_color1_a').value
        },
        color2: {
            hex: document.getElementById('exp_color2').value,
            a: document.getElementById('exp_color2_a').value
        },
        color3: {
            hex: document.getElementById('exp_color3').value,
            a: document.getElementById('exp_color3_a').value
        },
        color4: {
            hex: document.getElementById('exp_color4').value,
            a: document.getElementById('exp_color4_a').value
        },
        
        // Числовые параметры
        rangefinderTextScale: document.getElementById('exp_rangefinderTextScale').value,
        rangefinderVerticalOffset: document.getElementById('exp_rangefinderVerticalOffset').value,
        rangefinderHorizontalOffset: document.getElementById('exp_rangefinderHorizontalOffset').value,
        fontSizeMult: document.getElementById('exp_fontSizeMult').value,
        lineSizeMult: document.getElementById('exp_lineSizeMult').value,
        
        // Чекбоксы
        drawCentralLineVert: document.getElementById('exp_drawCentralLineVert').checked,
        drawCentralLineHorz: document.getElementById('exp_drawCentralLineHorz').checked,
        
        // Множители рисок
        cdhsa1: document.getElementById('exp_cdhsa1').value,
        cdhsa2: document.getElementById('exp_cdhsa2').value,
        cdhsm1: document.getElementById('exp_cdhsm1').value,
        cdhsm2: document.getElementById('exp_cdhsm2').value,
        
        // Смещение поправки
        dcp1: document.getElementById('exp_dcp1').value,
        dcp2: document.getElementById('exp_dcp2').value,
        
        // Дополнительные параметры
        drawDistanceCorrection: document.getElementById('exp_drawDistanceCorrection').checked,
        useSmoothEdge: document.getElementById('exp_useSmoothEdge').checked,
        rangefinderUseThousandth: document.getElementById('exp_rangefinderUseThousandth').checked,
        
        // Обнаружение союзника
        detectAllyTextScale: document.getElementById('exp_detectAllyTextScale').value,
        detectAllyOffset_1: document.getElementById('exp_detectAllyOffset_1').value,
        detectAllyOffset_2: document.getElementById('exp_detectAllyOffset_2').value
    };
    
    localStorage.setItem('exportSettings', JSON.stringify(settings));
    return settings;
}

function generateBlkContent(settings) {
    const color1 = hexToRgb(settings.color1.hex);
    const color2 = hexToRgb(settings.color2.hex);
    const color3 = hexToRgb(settings.color3.hex);
    const color4 = hexToRgb(settings.color4.hex);
    
    let blk = '';
    blk += `rangefinderProgressBarColor1:c = ${color1.r}, ${color1.g}, ${color1.b}, ${settings.color1.a}\n`;
    blk += `rangefinderProgressBarColor2:c = ${color2.r}, ${color2.g}, ${color2.b}, ${settings.color2.a}\n`;
    blk += `rangefinderTextScale:r = ${settings.rangefinderTextScale}\n`;
    blk += `rangefinderVerticalOffset:r = ${settings.rangefinderVerticalOffset}\n`;
    blk += `rangefinderHorizontalOffset:r = ${settings.rangefinderHorizontalOffset}\n`;
    blk += `fontSizeMult:r = ${settings.fontSizeMult}\n`;
    blk += `lineSizeMult:r = ${settings.lineSizeMult}\n`;
    blk += `drawCentralLineVert:b = ${settings.drawCentralLineVert ? 'yes' : 'no'}\n`;
    blk += `drawCentralLineHorz:b = ${settings.drawCentralLineHorz ? 'yes' : 'no'}\n`;
    blk += `crosshairColor:c = ${color3.r}, ${color3.g}, ${color3.b}, ${settings.color3.a}\n`;
    blk += `crosshairLightColor:c = ${color4.r}, ${color4.g}, ${color4.b}, ${settings.color4.a}\n`;
    blk += `crosshairDistHorSizeMain:p2 = ${settings.cdhsm1}, ${settings.cdhsm2}\n`;
    blk += `crosshairDistHorSizeAdditional:p2 = ${settings.cdhsa1}, ${settings.cdhsa2}\n`;
    blk += `distanceCorrectionPos:p2 = ${settings.dcp1}, ${settings.dcp2}\n`;
    blk += `drawDistanceCorrection:b = ${settings.drawDistanceCorrection ? 'yes' : 'no'}\n`;
    blk += `useSmoothEdge:b = ${settings.useSmoothEdge ? 'yes' : 'no'}\n`;
    blk += `rangefinderUseThousandth:b = ${settings.rangefinderUseThousandth ? 'yes' : 'no'}\n`;
    blk += `detectAllyTextScale:r = ${settings.detectAllyTextScale}\n`;
    blk += `detectAllyOffset:p2 = ${settings.detectAllyOffset_1}, ${settings.detectAllyOffset_2}\n\n`;
    
    blk += `crosshair_distances{\n`;
    for (let d = 200; d <= 6000; d += 200) {
        if (d % 400 === 0) {
            const val = d / 100;
            blk += `  distance:p3=${d}, ${val}, 0\n`;
        } else {
            blk += `  distance:p3=${d}, 0, 0\n`;
        }
    }
    blk += `}\n\n`;
    
    blk += `crosshair_hor_ranges{\n`;
    blk += `}\n\n`;
    
    blk += `matchExpClass {\n`;
    blk += `  exp_tank:b = yes\n`;
    blk += `  exp_heavy_tank:b = yes\n`;
    blk += `  exp_tank_destroyer:b = yes\n`;
    blk += `  exp_SPAA:b = yes\n`;
    blk += `}\n\n`;
    
    return blk;
}

function addDrawingObjectsToBlk(blk) {
    if (typeof objects === 'undefined' || !objects) return blk;
    
    let areLinesPresent = false;
    let areQuadsPresent = false;
    
    objects.forEach((obj) => { 
        if (obj && obj.type === "line") areLinesPresent = true;
        else if (obj && obj.type === "quad") areQuadsPresent = true;
    });
    
    if (areLinesPresent) {
        blk += `drawLines{\n`;
        objects.forEach((obj) => {
            if (!obj || obj.type !== "line") return;
            blk += `  line {line:p4=${obj.start.x},${obj.start.y},${obj.end.x},${obj.end.y}; move:b=false;}\n`;
        });
        blk += `}\n\n`;
    }
    
    if (areQuadsPresent) {
        blk += `drawQuads{\n`;
        objects.forEach((obj) => {
            if (!obj || obj.type !== "quad") return;
            blk += `  quad {tl:p2=${obj.pos1.x},${obj.pos1.y}; tr:p2=${obj.pos2.x},${obj.pos2.y}; br:p2=${obj.pos3.x},${obj.pos3.y}; bl:p2=${obj.pos4.x},${obj.pos4.y};}\n`;
        });
        blk += `}\n`;
    }

    blk += '\n//Made in WTDSight by dimas7080';
    
    return blk;
}

function getFileName() {
    try {
        const fileNameInput = document.getElementById('saveFileName');
        if (fileNameInput && fileNameInput.value) {
            return fileNameInput.value;
        }
    } catch (e) {}
    return 'sight';
}

function saveBlkFile(content, fileName) {
    try {
        const blob = new Blob([content], {type: "text/plain"});
        const url = window.URL.createObjectURL(blob);
        
        let saver = document.getElementById('saver');
        if (!saver) {
            saver = document.createElement('a');
            saver.id = 'saver';
            saver.style.display = 'none';
            document.body.appendChild(saver);
        }
        
        saver.href = url;
        saver.download = fileName + '.blk';
        saver.click();
        
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 100);
        
        return true;
    } catch (error) {
        console.error('Ошибка при создании файла:', error);
        alert('Ошибка при создании файла: ' + error.message);
        return false;
    }
}

function closeModal() {
    const modal = document.getElementById('exportModal');
    if (modal) modal.style.display = 'none';
}

function openModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.style.display = 'flex';
        loadExportSettings();
    }
}

function onModalClick(e) {
    if (e.target === document.getElementById('exportModal')) {
        closeModal();
    }
}

function onGenerateBlkClick() {
    try {
        const settings = saveExportSettings();
        let blk = generateBlkContent(settings);
        blk = addDrawingObjectsToBlk(blk);
        const fileName = getFileName();
        
        if (saveBlkFile(blk, fileName)) {
            closeModal();
        }
    } catch (error) {
        console.error('Ошибка при генерации BLK:', error);
        alert('Ошибка при генерации BLK: ' + error.message);
    }
}

function initExportModal() {
    if (typeof objects === 'undefined') {
        window.objects = new Map();
    }
    
    const modal = document.getElementById('exportModal');
    const exportBtn = document.getElementById('exportButtonBlk');
    const closeBtn = document.getElementById('closeExportBtn');
    const cancelBtn = document.getElementById('cancelExportBtn');
    const generateBtn = document.getElementById('generateBlkBtn');
    
    if (!modal || !exportBtn || !closeBtn || !cancelBtn || !generateBtn) {
        console.error('Не найдены элементы модального окна!');
        return;
    }
    
    exportBtn.onclick = openModal;
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    modal.onclick = onModalClick;
    generateBtn.onclick = onGenerateBlkClick;
    
    loadExportSettings();
}

document.addEventListener('DOMContentLoaded', initExportModal);