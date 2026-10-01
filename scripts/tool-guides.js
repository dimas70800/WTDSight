(function () {
    'use strict';

    let tooltipEl = null;
    let canvasEl = null;
    let ctx = null;
    let cursorEl = null;
    let rippleEl = null;
    let brushCircleEl = null;
    let titleEl = null;
    let hotkeyEl = null;
    let descEl = null;
    let createBtnEl = null;

    let hoverTimer = null;
    let activeToolId = null;
    let activeTargetBtn = null;
    let animFrameId = null;
    let animStartTime = null;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let isTooltipVisible = false;

    const DPR = Math.max(window.devicePixelRatio || 1, 2.5);

    // Задержка
    const HOVER_DELAY = 800;

    const toolHotkeyActions = {
        lines: 'actionLinesTool',
        curve: 'actionCurveTool',
        brush: 'actionBrushTool',
        eraser: 'actionEraserTool',
        hatch: 'actionHatchTool',
        fill: 'actionFillTool',
        select: 'actionSelectTool'
    };

    const toolGuidesData = {
        lines: {
            titleKey: 'linesTitleText',
            descKey: 'linesDescription',
            hasBrushCircle: false,
            duration: 4400
        },
        curve: {
            titleKey: 'curveTitleText',
            descKey: 'curveDescription',
            hasBrushCircle: false,
            duration: 5000
        },
        brush: {
            titleKey: 'brushTitleText',
            descKey: 'brushDescription',
            hasBrushCircle: true,
            duration: 5200
        },
        eraser: {
            titleKey: 'eraserTitleText',
            descKey: 'eraserDescription',
            hasBrushCircle: false,
            hasEraserCircle: true,
            duration: 5200
        },
        quads: {
            titleKey: 'quadsTitleText',
            descKey: 'quadsDescription',
            hasBrushCircle: false,
            duration: 5400
        },
        hatch: {
            titleKey: 'hatchTitleText',
            descKey: 'hatchDescription',
            hasBrushCircle: false,
            duration: 6600
        },
        fill: {
            titleKey: 'fillTitleText',
            descKey: 'fillDescription',
            hasBrushCircle: false,
            duration: 6800
        },
        select: {
            titleKey: 'selectTitleText',
            descKey: 'selectDescription',
            hasBrushCircle: false,
            duration: 5200
        },
        shapes: {
            titleKey: 'shapesTitleText',
            descKey: 'shapesDescription',
            hasBrushCircle: false,
            duration: 4800
        },
        text: {
            titleKey: 'textTitleText',
            descKey: 'textDescription',
            hasBrushCircle: false,
            duration: 5600
        },
        vectorize: {
            titleKey: 'vectorizeTitle',
            hasBrushCircle: false,
            duration: 5400
        }
    };

    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function easeInQuad(t) {
        return t * t;
    }

    function getBezierPoint(P0, P1, P2, P3, t) {
        const it = 1 - t;
        const it2 = it * it;
        const it3 = it2 * it;
        const t2 = t * t;
        const t3 = t2 * t;
        return {
            x: it3 * P0.x + 3 * it2 * t * P1.x + 3 * it * t2 * P2.x + t3 * P3.x,
            y: it3 * P0.y + 3 * it2 * t * P1.y + 3 * it * t2 * P2.y + t3 * P3.y
        };
    }

    function getSubCurve(P0, P1, P2, P3, t) {
        const it = 1 - t;
        const p01 = { x: it * P0.x + t * P1.x, y: it * P0.y + t * P1.y };
        const p12 = { x: it * P1.x + t * P2.x, y: it * P1.y + t * P2.y };
        const p23 = { x: it * P2.x + t * P3.x, y: it * P2.y + t * P3.y };

        const p012 = { x: it * p01.x + t * p12.x, y: it * p01.y + t * p12.y };
        const p123 = { x: it * p12.x + t * p23.x, y: it * p12.y + t * p23.y };

        const p0123 = { x: it * p012.x + t * p123.x, y: it * p012.y + t * p123.y };

        return {
            start: P0,
            cp1: p01,
            cp2: p012,
            end: p0123
        };
    }

    
    function ensureTooltipDOM() {
        if (tooltipEl && document.body.contains(tooltipEl)) return;

        tooltipEl = document.getElementById('toolGuideTooltip');
        if (!tooltipEl) return;

        canvasEl = document.getElementById('toolGuideCanvas');
        ctx = canvasEl ? canvasEl.getContext('2d') : null;
        cursorEl = document.getElementById('toolGuideCursor');
        rippleEl = document.getElementById('toolGuideRipple');
        brushCircleEl = document.getElementById('toolGuideBrushCircle');
        titleEl = document.getElementById('toolGuideTitle');
        hotkeyEl = document.getElementById('toolGuideHotkey');
        descEl = document.getElementById('toolGuideDesc');
        createBtnEl = document.getElementById('toolGuideCreateBtn');
    }

    
    const vectorizeImages = {
        source: new Image(),
        green: new Image(),
        result: new Image()
    };
    vectorizeImages.source.src = 'images/vectorizeFoxSource.png';
    vectorizeImages.green.src = 'images/vectorizeFoxGreen.png';
    vectorizeImages.result.src = 'images/vectorizeFoxResult.png';

    function setCreateBtn(visible, isPressed = false, label = null, variant = 'green') {
        if (!createBtnEl) return;
        if (visible) {
            const curLang = (typeof lang !== 'undefined' && lang) ? lang : (typeof ru !== 'undefined' ? ru : {});
            const isEn = (curLang === (typeof en !== 'undefined' ? en : null));
            if (label === 'process') {
                createBtnEl.textContent = isEn ? 'Process' : 'Обработать';
            } else {
                createBtnEl.textContent = label || (isEn ? 'Create' : 'Создать');
            }

            if (variant === 'blue' || label === 'process') {
                createBtnEl.style.background = isPressed ? '#2d5c8a' : '#3f7cb9';
            } else {
                createBtnEl.style.background = isPressed ? '#19631c' : '#228025';
            }

            createBtnEl.classList.add('visible');
            if (isPressed) {
                createBtnEl.classList.add('pressed');
            } else {
                createBtnEl.classList.remove('pressed');
            }
        } else {
            createBtnEl.classList.remove('visible');
            createBtnEl.classList.remove('pressed');
            createBtnEl.style.background = '';
        }
    }

    
    let lastPressedState = false;

    function setCursorState(x, y, isPressed) {
        if (!cursorEl) return;
        cursorEl.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;

        if (isPressed) {
            cursorEl.classList.add('pressed');
            if (!lastPressedState && rippleEl) {
                rippleEl.classList.remove('animate');
                void rippleEl.offsetWidth;
                rippleEl.classList.add('animate');
            }
        } else {
            cursorEl.classList.remove('pressed');
        }
        lastPressedState = isPressed;
    }

    
    function runAnimationLoop(timestamp) {
        if (!isTooltipVisible || !activeToolId) return;

        if (!animStartTime) animStartTime = timestamp;
        const conf = toolGuidesData[activeToolId] || toolGuidesData.brush;
        const duration = conf.duration || 5000;
        const elapsed = (timestamp - animStartTime) % duration;
        const progress = elapsed / duration;

        const box = document.getElementById('toolGuidePreviewBox');
        if (!box || !canvasEl || !ctx) return;

        const width = box.clientWidth || 246;
        const height = box.clientHeight || 184;

        if (canvasEl.width !== Math.floor(width * DPR) || canvasEl.height !== Math.floor(height * DPR)) {
            canvasEl.width = Math.floor(width * DPR);
            canvasEl.height = Math.floor(height * DPR);
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
        }

        ctx.clearRect(0, 0, width, height);

        if (!['hatch', 'fill', 'shapes', 'text', 'vectorize'].includes(activeToolId)) {
            setCreateBtn(false);
        }

        switch (activeToolId) {
            case 'brush':
                renderBrushAnimation(progress, width, height);
                break;
            case 'lines':
                renderLinesAnimation(progress, width, height);
                break;
            case 'eraser':
                renderEraserAnimation(progress, width, height);
                break;
            case 'curve':
                renderCurveAnimation(progress, width, height);
                break;
            case 'quads':
                renderQuadsAnimation(progress, width, height);
                break;
            case 'hatch':
                renderHatchAnimation(progress, width, height);
                break;
            case 'fill':
                renderFillAnimation(progress, width, height);
                break;
            case 'select':
                renderSelectAnimation(progress, width, height);
                break;
            case 'shapes':
                renderShapesAnimation(progress, width, height);
                break;
            case 'text':
                renderTextAnimation(progress, width, height);
                break;
            case 'vectorize':
                renderVectorizeAnimation(progress, width, height);
                break;
            default:
                renderDefaultAnimation(progress, width, height);
                break;
        }

        animFrameId = requestAnimationFrame(runAnimationLoop);
    }

    
    // Кисть
    function renderBrushAnimation(progress, W, H) {

        const P0 = { x: 0.16 * W, y: 0.62 * H };
        const P1 = { x: 0.36 * W, y: 0.16 * H };
        const P2 = { x: 0.58 * W, y: 0.80 * H };
        const P3 = { x: 0.78 * W, y: 0.40 * H };

        const entry = { x: -30, y: P0.y + 15 };
        const aside = { x: P3.x + 16, y: P3.y - 6 };
        const exit  = { x: W + 35, y: P3.y - 20 };

        let cursorX = entry.x;
        let cursorY = entry.y;
        let isPressed = false;
        let curveProgress = 0;
        let lineState = 'none';
        let lineAlpha = 1.0;

        if (progress < 0.13) {
            const t = easeOutCubic(progress / 0.13);
            cursorX = entry.x + (P0.x - entry.x) * t;
            cursorY = entry.y + (P0.y - entry.y) * t;
            isPressed = false;
            lineState = 'none';
        } else if (progress < 0.19) {
            cursorX = P0.x;
            cursorY = P0.y;
            isPressed = (progress >= 0.15);
            curveProgress = 0;
            lineState = (progress >= 0.15) ? 'preview' : 'none';
        } else if (progress < 0.58) {
            const u = (progress - 0.19) / (0.58 - 0.19);
            const t = easeInOutCubic(u);
            const pt = getBezierPoint(P0, P1, P2, P3, t);
            cursorX = pt.x;
            cursorY = pt.y;
            isPressed = true;
            curveProgress = t;
            lineState = 'preview';
        } else if (progress < 0.64) {
            cursorX = P3.x;
            cursorY = P3.y;
            isPressed = false;
            curveProgress = 1.0;
            lineState = 'committed';
        } else if (progress < 0.73) {
            const u = (progress - 0.64) / (0.73 - 0.64);
            const t = easeOutCubic(u);
            cursorX = P3.x + (aside.x - P3.x) * t;
            cursorY = P3.y + (aside.y - P3.y) * t;
            isPressed = false;
            curveProgress = 1.0;
            lineState = 'committed';
        } else if (progress < 0.86) {
            cursorX = aside.x;
            cursorY = aside.y;
            isPressed = false;
            curveProgress = 1.0;
            lineState = 'committed';
        } else if (progress < 0.94) {
            const u = (progress - 0.86) / (0.94 - 0.86);
            const t = easeInQuad(u);
            cursorX = aside.x + (exit.x - aside.x) * t;
            cursorY = aside.y + (exit.y - aside.y) * t;
            isPressed = false;
            curveProgress = 1.0;
            lineState = 'committed';
        } else {
            cursorX = exit.x;
            cursorY = exit.y;
            isPressed = false;
            curveProgress = 1.0;
            lineState = 'committed';
            const u = (progress - 0.94) / (1.00 - 0.94);
            lineAlpha = Math.max(0, 1 - u);
        }

        if (lineState !== 'none' && lineAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = lineAlpha;
            const strokeColor = (lineState === 'preview') ? 'rgba(0, 0, 0, 0.45)' : '#000000';
            const lineWidth = Math.max(8, Math.round(W * 0.042));

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (curveProgress > 0) {
                const sub = getSubCurve(P0, P1, P2, P3, curveProgress);
                ctx.beginPath();
                ctx.moveTo(sub.start.x, sub.start.y);
                ctx.bezierCurveTo(sub.cp1.x, sub.cp1.y, sub.cp2.x, sub.cp2.y, sub.end.x, sub.end.y);
                ctx.stroke();
            } else if (lineState === 'preview') {
                ctx.beginPath();
                ctx.arc(P0.x, P0.y, lineWidth / 2, 0, Math.PI * 2);
                ctx.fillStyle = strokeColor;
                ctx.fill();
            }
            ctx.restore();
        }

        setCursorState(cursorX, cursorY, isPressed);
    }

    
    // Линии
    function renderLinesAnimation(progress, W, H) {
        const P0 = { x: 0.22 * W, y: 0.78 * H };
        const P1 = { x: 0.78 * W, y: 0.24 * H };
        const entry = { x: -25, y: P0.y + 10 };
        const aside = { x: P1.x + 16, y: P1.y - 6 };
        const exit  = { x: W + 30, y: P1.y - 18 };

        let cursorX = entry.x;
        let cursorY = entry.y;
        let isPressed = false;
        let lineT = 0;
        let lineState = 'none';
        let lineAlpha = 1.0;

        if (progress < 0.14) {
            const t = easeOutCubic(progress / 0.14);
            cursorX = entry.x + (P0.x - entry.x) * t;
            cursorY = entry.y + (P0.y - entry.y) * t;
        } else if (progress < 0.20) {
            cursorX = P0.x;
            cursorY = P0.y;
            isPressed = (progress >= 0.16);
            lineState = (progress >= 0.16) ? 'preview' : 'none';
            lineT = 0;
        } else if (progress < 0.58) {
            const u = (progress - 0.20) / (0.58 - 0.20);
            lineT = easeInOutCubic(u);
            cursorX = P0.x + (P1.x - P0.x) * lineT;
            cursorY = P0.y + (P1.y - P0.y) * lineT;
            isPressed = true;
            lineState = 'preview';
        } else if (progress < 0.64) {
            cursorX = P1.x;
            cursorY = P1.y;
            isPressed = false;
            lineT = 1.0;
            lineState = 'committed';
        } else if (progress < 0.73) {
            const u = (progress - 0.64) / (0.73 - 0.64);
            const t = easeOutCubic(u);
            cursorX = P1.x + (aside.x - P1.x) * t;
            cursorY = P1.y + (aside.y - P1.y) * t;
            lineT = 1.0;
            lineState = 'committed';
        } else if (progress < 0.86) {
            cursorX = aside.x;
            cursorY = aside.y;
            lineT = 1.0;
            lineState = 'committed';
        } else if (progress < 0.94) {
            const u = (progress - 0.86) / (0.94 - 0.86);
            const t = easeInQuad(u);
            cursorX = aside.x + (exit.x - aside.x) * t;
            cursorY = aside.y + (exit.y - aside.y) * t;
            lineT = 1.0;
            lineState = 'committed';
        } else {
            cursorX = exit.x;
            cursorY = exit.y;
            lineT = 1.0;
            lineState = 'committed';
            lineAlpha = Math.max(0, 1 - (progress - 0.94) / 0.06);
        }

        if (lineState !== 'none' && lineAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = lineAlpha;
            ctx.strokeStyle = (lineState === 'preview') ? 'rgba(0, 0, 0, 0.45)' : '#000000';
            ctx.lineWidth = 2.6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(P0.x, P0.y);
            ctx.lineTo(P0.x + (P1.x - P0.x) * lineT, P0.y + (P1.y - P0.y) * lineT);
            ctx.stroke();
            ctx.restore();
        }

        setCursorState(cursorX, cursorY, isPressed);
    }

    
    // Ластик
    function renderEraserAnimation(progress, W, H) {
        const sqX = (2 / 6) * W;
        const sqY = (1 / 4) * H;
        const sqW = (2 / 6) * W + 0.5;
        const sqH = (2 / 4) * H;

        const cutP0 = { x: (1.5 / 6) * W, y: 0.58 * H };
        const cutP1 = { x: sqX + sqW * 0.32, y: 0.26 * H };
        const cutP2 = { x: sqX + sqW * 0.68, y: 0.68 * H };
        const cutP3 = { x: (4.6 / 6) * W, y: 0.50 * H };

        const entry = { x: -25, y: cutP0.y };
        const aside = { x: cutP3.x + 18, y: cutP3.y };
        const exit  = { x: W + 35, y: cutP3.y };

        let cursorX = entry.x;
        let cursorY = entry.y;
        let isPressed = false;
        let cutT = 0;
        let isCutDone = false;
        let fadeAlpha = 1.0;

        if (progress < 0.12) {
            const t = easeOutCubic(progress / 0.12);
            cursorX = entry.x + (cutP0.x - entry.x) * t;
            cursorY = entry.y;
        } else if (progress < 0.18) {
            cursorX = cutP0.x;
            cursorY = cutP0.y;
            isPressed = (progress >= 0.14);
            cutT = 0;
        } else if (progress < 0.58) {
            const u = (progress - 0.18) / (0.58 - 0.18);
            cutT = easeInOutCubic(u);
            const pt = getBezierPoint(cutP0, cutP1, cutP2, cutP3, cutT);
            cursorX = pt.x;
            cursorY = pt.y;
            isPressed = true;
        } else if (progress < 0.64) {
            cursorX = cutP3.x;
            cursorY = cutP3.y;
            isPressed = false;
            cutT = 1.0;
            isCutDone = true;
        } else if (progress < 0.74) {
            const u = (progress - 0.64) / (0.74 - 0.64);
            const t = easeOutCubic(u);
            cursorX = cutP3.x + (aside.x - cutP3.x) * t;
            cursorY = cutP3.y + (aside.y - cutP3.y) * t;
            isCutDone = true;
        } else if (progress < 0.86) {
            cursorX = aside.x;
            cursorY = aside.y;
            isCutDone = true;
        } else if (progress < 0.94) {
            const u = (progress - 0.86) / (0.94 - 0.86);
            const t = easeInQuad(u);
            cursorX = aside.x + (exit.x - aside.x) * t;
            cursorY = aside.y;
            isCutDone = true;
        } else {
            cursorX = exit.x;
            cursorY = exit.y;
            isCutDone = true;
            fadeAlpha = Math.max(0, 1 - (progress - 0.94) / 0.06);
        }

        ctx.save();
        ctx.globalAlpha = fadeAlpha;

        ctx.fillStyle = '#000000';
        ctx.fillRect(sqX, sqY, sqW, sqH);

        const cutLineWidth = 14;

        if (isCutDone) {

            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = cutLineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(cutP0.x, cutP0.y);
            ctx.bezierCurveTo(cutP1.x, cutP1.y, cutP2.x, cutP2.y, cutP3.x, cutP3.y);
            ctx.stroke();
            ctx.restore();
        } else if (isPressed && cutT > 0) {

            ctx.save();
            ctx.strokeStyle = 'rgba(235, 80, 72, 0.55)';
            ctx.lineWidth = cutLineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            const sub = getSubCurve(cutP0, cutP1, cutP2, cutP3, cutT);
            ctx.beginPath();
            ctx.moveTo(sub.start.x, sub.start.y);
            ctx.bezierCurveTo(sub.cp1.x, sub.cp1.y, sub.cp2.x, sub.cp2.y, sub.end.x, sub.end.y);
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
        setCursorState(cursorX, cursorY, isPressed);
    }

    
    // Кривая
    function renderCurveAnimation(progress, W, H) {
        const P0 = { x: 0.16 * W, y: 0.62 * H };
        const P1 = { x: 0.36 * W, y: 0.16 * H };
        const P2 = { x: 0.58 * W, y: 0.80 * H };
        const P3 = { x: 0.78 * W, y: 0.40 * H };

        const entry = { x: -30, y: P0.y + 15 };
        const aside = { x: P3.x + 16, y: P3.y - 6 };
        const exit  = { x: W + 35, y: P3.y - 20 };

        let cursorX = entry.x;
        let cursorY = entry.y;
        let isPressed = false;
        let curveProgress = 0;
        let isCommitted = false;
        let lineAlpha = 1.0;

        if (progress < 0.13) {
            const t = easeOutCubic(progress / 0.13);
            cursorX = entry.x + (P0.x - entry.x) * t;
            cursorY = entry.y + (P0.y - entry.y) * t;
        } else if (progress < 0.19) {
            cursorX = P0.x;
            cursorY = P0.y;
            isPressed = (progress >= 0.15);
        } else if (progress < 0.58) {
            const u = (progress - 0.19) / (0.58 - 0.19);
            const t = easeInOutCubic(u);
            const pt = getBezierPoint(P0, P1, P2, P3, t);
            cursorX = pt.x;
            cursorY = pt.y;
            isPressed = true;
            curveProgress = t;
        } else if (progress < 0.64) {
            cursorX = P3.x;
            cursorY = P3.y;
            isPressed = false;
            curveProgress = 1.0;
            isCommitted = true;
        } else if (progress < 0.73) {
            const u = (progress - 0.64) / (0.73 - 0.64);
            const t = easeOutCubic(u);
            cursorX = P3.x + (aside.x - P3.x) * t;
            cursorY = P3.y + (aside.y - P3.y) * t;
            isCommitted = true;
            curveProgress = 1.0;
        } else if (progress < 0.86) {
            cursorX = aside.x;
            cursorY = aside.y;
            isCommitted = true;
            curveProgress = 1.0;
        } else if (progress < 0.94) {
            const u = (progress - 0.86) / (0.94 - 0.86);
            const t = easeInQuad(u);
            cursorX = aside.x + (exit.x - aside.x) * t;
            cursorY = aside.y + (exit.y - aside.y) * t;
            isCommitted = true;
            curveProgress = 1.0;
        } else {
            cursorX = exit.x;
            cursorY = exit.y;
            isCommitted = true;
            curveProgress = 1.0;
            lineAlpha = Math.max(0, 1 - (progress - 0.94) / 0.06);
        }

        if (curveProgress > 0 && lineAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = lineAlpha;
            ctx.strokeStyle = isCommitted ? '#000000' : 'rgba(0, 0, 0, 0.45)';
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const sub = getSubCurve(P0, P1, P2, P3, curveProgress);
            ctx.beginPath();
            ctx.moveTo(sub.start.x, sub.start.y);
            ctx.bezierCurveTo(sub.cp1.x, sub.cp1.y, sub.cp2.x, sub.cp2.y, sub.end.x, sub.end.y);
            ctx.stroke();
            ctx.restore();
        }

        setCursorState(cursorX, cursorY, isPressed);
    }

    
    // Четырехугольник
    function renderQuadsAnimation(progress, W, H) {
        const pts = [
            { x: 0.22 * W, y: 0.30 * H },
            { x: 0.78 * W, y: 0.25 * H },
            { x: 0.80 * W, y: 0.73 * H },
            { x: 0.20 * W, y: 0.69 * H }
        ];

        const downPos = { x: pts[3].x + 6, y: pts[3].y + 16 };
        const exit = { x: W + 35, y: downPos.y };

        let cursorX = -25;
        let cursorY = pts[0].y;
        let isPressed = false;
        let visibleCount = 0;
        let isCommitted = false;
        let alpha = 1.0;

        if (progress < 0.10) {
            const t = easeOutCubic(progress / 0.10);
            cursorX = -25 + (pts[0].x + 25) * t;
            cursorY = pts[0].y;
        } else if (progress < 0.17) {
            cursorX = pts[0].x; cursorY = pts[0].y;
            isPressed = (progress >= 0.12 && progress < 0.155);
            visibleCount = (progress >= 0.12) ? 1 : 0;
        } else if (progress < 0.28) {
            const t = easeInOutCubic((progress - 0.17) / 0.11);
            cursorX = pts[0].x + (pts[1].x - pts[0].x) * t;
            cursorY = pts[0].y + (pts[1].y - pts[0].y) * t;
            visibleCount = 1;
        } else if (progress < 0.35) {
            cursorX = pts[1].x; cursorY = pts[1].y;
            isPressed = (progress >= 0.30 && progress < 0.335);
            visibleCount = (progress >= 0.30) ? 2 : 1;
        } else if (progress < 0.46) {
            const t = easeInOutCubic((progress - 0.35) / 0.11);
            cursorX = pts[1].x + (pts[2].x - pts[1].x) * t;
            cursorY = pts[1].y + (pts[2].y - pts[1].y) * t;
            visibleCount = 2;
        } else if (progress < 0.53) {
            cursorX = pts[2].x; cursorY = pts[2].y;
            isPressed = (progress >= 0.48 && progress < 0.515);
            visibleCount = (progress >= 0.48) ? 3 : 2;
        } else if (progress < 0.64) {
            const t = easeInOutCubic((progress - 0.53) / 0.11);
            cursorX = pts[2].x + (pts[3].x - pts[2].x) * t;
            cursorY = pts[2].y + (pts[3].y - pts[2].y) * t;
            visibleCount = 3;
        } else if (progress < 0.70) {

            cursorX = pts[3].x; cursorY = pts[3].y;
            isPressed = (progress >= 0.65 && progress < 0.685);
            visibleCount = (progress >= 0.65) ? 4 : 3;
            isCommitted = (progress >= 0.65);
        } else if (progress < 0.78) {

            const t = easeOutCubic((progress - 0.70) / 0.08);
            cursorX = pts[3].x + (downPos.x - pts[3].x) * t;
            cursorY = pts[3].y + (downPos.y - pts[3].y) * t;
            visibleCount = 4;
            isCommitted = true;
        } else if (progress < 0.86) {

            cursorX = downPos.x;
            cursorY = downPos.y;
            visibleCount = 4;
            isCommitted = true;
        } else if (progress < 0.94) {

            const t = easeInQuad((progress - 0.86) / 0.08);
            cursorX = downPos.x + (exit.x - downPos.x) * t;
            cursorY = downPos.y;
            visibleCount = 4;
            isCommitted = true;
        } else {
            cursorX = exit.x;
            cursorY = exit.y;
            visibleCount = 4;
            isCommitted = true;
            alpha = Math.max(0, 1 - (progress - 0.94) / 0.06);
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        if (isCommitted) {

            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            ctx.lineTo(pts[1].x, pts[1].y);
            ctx.lineTo(pts[2].x, pts[2].y);
            ctx.lineTo(pts[3].x, pts[3].y);
            ctx.closePath();
            ctx.fillStyle = '#000000';
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2.0;
            ctx.stroke();
        } else if (visibleCount > 0) {
            if (visibleCount > 1) {
                ctx.beginPath();
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < visibleCount; i++) {
                    ctx.lineTo(pts[i].x, pts[i].y);
                }
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1.8;
                ctx.stroke();
            }

            if (progress >= 0.17 && visibleCount < 4) {
                ctx.beginPath();
                ctx.moveTo(pts[visibleCount - 1].x, pts[visibleCount - 1].y);
                ctx.lineTo(cursorX, cursorY);
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            pts.slice(0, visibleCount).forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
                ctx.fillStyle = '#eb5048';
                ctx.fill();
                ctx.strokeStyle = '#c53932';
                ctx.lineWidth = 1.0;
                ctx.stroke();
            });
        }
        ctx.restore();

        setCursorState(cursorX, cursorY, isPressed);
    }

    
    // Выделение
    function renderSelectAnimation(progress, W, H) {
        const center = { x: 0.50 * W, y: 0.50 * H };
        const radius = 0.24 * H;
        const selStart = { x: 0.20 * W, y: 0.16 * H };
        const selEnd   = { x: 0.80 * W, y: 0.84 * H };

        let cursorX = -25;
        let cursorY = selStart.y;
        let isPressed = false;
        let selT = 0;
        let isSelected = false;
        let alpha = 1.0;

        if (progress < 0.14) {
            const t = easeOutCubic(progress / 0.14);
            cursorX = -25 + (selStart.x + 25) * t;
            cursorY = selStart.y;
        } else if (progress < 0.22) {
            cursorX = selStart.x; cursorY = selStart.y;
            isPressed = (progress >= 0.17);
        } else if (progress < 0.58) {
            const u = (progress - 0.22) / (0.58 - 0.22);
            selT = easeInOutCubic(u);
            cursorX = selStart.x + (selEnd.x - selStart.x) * selT;
            cursorY = selStart.y + (selEnd.y - selStart.y) * selT;
            isPressed = true;
        } else if (progress < 0.65) {
            cursorX = selEnd.x; cursorY = selEnd.y;
            isPressed = false;
            isSelected = true;
        } else if (progress < 0.85) {

            const u = (progress - 0.65) / 0.20;
            const t = easeOutCubic(u);
            cursorX = selEnd.x + 18 * t;
            cursorY = selEnd.y - 10 * t;
            isSelected = true;
        } else if (progress < 0.94) {
            const t = easeInQuad((progress - 0.85) / 0.09);
            cursorX = selEnd.x + 18 + (W + 35 - (selEnd.x + 18)) * t;
            cursorY = selEnd.y - 10 - 15 * t;
            isSelected = true;
        } else {
            cursorX = W + 35;
            cursorY = selEnd.y - 25;
            isSelected = true;
            alpha = Math.max(0, 1 - (progress - 0.94) / 0.06);
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? '#7088ff' : '#000000';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        if (isPressed && selT > 0) {
            const curW = (selEnd.x - selStart.x) * selT;
            const curH = (selEnd.y - selStart.y) * selT;
            ctx.fillStyle = 'rgba(70, 130, 250, 0.12)';
            ctx.fillRect(selStart.x, selStart.y, curW, curH);
            ctx.strokeStyle = 'rgba(70, 130, 250, 0.85)';
            ctx.lineWidth = 1.4;
            ctx.strokeRect(selStart.x, selStart.y, curW, curH);
        }

        if (isSelected) {
            const bx = center.x - radius;
            const by = center.y - radius;
            const bw = radius * 2;
            const bh = radius * 2;
            const stem = 12;

            ctx.strokeStyle = 'rgba(96, 165, 250, 0.95)';
            ctx.lineWidth = 1.3;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(bx, by, bw, bh);

            ctx.beginPath();
            ctx.moveTo(center.x, by);
            ctx.lineTo(center.x, by - stem);
            ctx.stroke();
            ctx.setLineDash([]);

            const handles = [
                { x: bx, y: by },
                { x: center.x, y: by },
                { x: bx + bw, y: by },
                { x: bx + bw, y: center.y },
                { x: bx + bw, y: by + bh },
                { x: center.x, y: by + bh },
                { x: bx, y: by + bh },
                { x: bx, y: center.y },
                { x: center.x, y: by - stem }
            ];

            handles.forEach(h => {
                ctx.beginPath();
                ctx.arc(h.x, h.y, 3.2, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.strokeStyle = 'rgba(96, 165, 250, 0.95)';
                ctx.lineWidth = 1.3;
                ctx.stroke();
            });
        }

        ctx.restore();
        setCursorState(cursorX, cursorY, isPressed);
    }

    
    // Штриховка
    function renderHatchAnimation(progress, W, H) {
        const pts = [
            { x: 0.22 * W, y: 0.25 * H },
            { x: 0.78 * W, y: 0.20 * H },
            { x: 0.76 * W, y: 0.68 * H },
            { x: 0.20 * W, y: 0.64 * H }
        ];
        const btnPos = { x: W - 44, y: H - 18 };
        const aside = { x: W - 30, y: 0.44 * H };
        const exit  = { x: W + 35, y: 0.44 * H };

        let cursorX = -25;
        let cursorY = pts[0].y;
        let isPressed = false;
        let pointsPlaced = 0;
        let isBtnVisible = false;
        let isBtnPressed = false;
        let isCommitted = false;
        let alpha = 1.0;

        if (progress < 0.08) {
            const t = easeOutCubic(progress / 0.08);
            cursorX = -25 + (pts[0].x + 25) * t;
            cursorY = pts[0].y;
        } else if (progress < 0.13) {
            cursorX = pts[0].x; cursorY = pts[0].y;
            isPressed = (progress >= 0.095 && progress < 0.12);
            pointsPlaced = (progress >= 0.095) ? 1 : 0;
        } else if (progress < 0.21) {
            const t = easeInOutCubic((progress - 0.13) / 0.08);
            cursorX = pts[0].x + (pts[1].x - pts[0].x) * t;
            cursorY = pts[0].y + (pts[1].y - pts[0].y) * t;
            pointsPlaced = 1;
        } else if (progress < 0.26) {
            cursorX = pts[1].x; cursorY = pts[1].y;
            isPressed = (progress >= 0.225 && progress < 0.25);
            pointsPlaced = (progress >= 0.225) ? 2 : 1;
        } else if (progress < 0.34) {
            const t = easeInOutCubic((progress - 0.26) / 0.08);
            cursorX = pts[1].x + (pts[2].x - pts[1].x) * t;
            cursorY = pts[1].y + (pts[2].y - pts[1].y) * t;
            pointsPlaced = 2;
        } else if (progress < 0.39) {
            cursorX = pts[2].x; cursorY = pts[2].y;
            isPressed = (progress >= 0.355 && progress < 0.38);
            pointsPlaced = (progress >= 0.355) ? 3 : 2;
        } else if (progress < 0.47) {
            const t = easeInOutCubic((progress - 0.39) / 0.08);
            cursorX = pts[2].x + (pts[3].x - pts[2].x) * t;
            cursorY = pts[2].y + (pts[3].y - pts[2].y) * t;
            pointsPlaced = 3;
        } else if (progress < 0.52) {
            cursorX = pts[3].x; cursorY = pts[3].y;
            isPressed = (progress >= 0.485 && progress < 0.51);
            pointsPlaced = (progress >= 0.485) ? 4 : 3;
            isBtnVisible = true;
        } else if (progress < 0.62) {
            const t = easeInOutCubic((progress - 0.52) / 0.10);
            cursorX = pts[3].x + (btnPos.x - pts[3].x) * t;
            cursorY = pts[3].y + (btnPos.y - pts[3].y) * t;
            pointsPlaced = 4;
            isBtnVisible = true;
        } else if (progress < 0.69) {
            cursorX = btnPos.x; cursorY = btnPos.y;
            isPressed = true;
            isBtnVisible = true;
            isBtnPressed = true;
            pointsPlaced = 4;
        } else if (progress < 0.77) {
            const t = easeOutCubic((progress - 0.69) / 0.08);
            cursorX = btnPos.x + (aside.x - btnPos.x) * t;
            cursorY = btnPos.y + (aside.y - btnPos.y) * t;
            isCommitted = true;
            isBtnVisible = false;
        } else if (progress < 0.88) {
            cursorX = aside.x; cursorY = aside.y;
            isCommitted = true;
            isBtnVisible = false;
        } else if (progress < 0.94) {
            const t = easeInQuad((progress - 0.88) / 0.06);
            cursorX = aside.x + (exit.x - aside.x) * t;
            cursorY = aside.y;
            isCommitted = true;
            isBtnVisible = false;
        } else {
            cursorX = exit.x; cursorY = exit.y;
            isCommitted = true;
            isBtnVisible = false;
            alpha = Math.max(0, 1 - (progress - 0.94) / 0.06);
        }

        setCreateBtn(isBtnVisible, isBtnPressed);

        ctx.save();
        ctx.globalAlpha = alpha;

        if (pointsPlaced >= 3 || isCommitted) {
            ctx.save();
            ctx.beginPath();
            const activePts = isCommitted ? pts : pts.slice(0, pointsPlaced);
            ctx.moveTo(activePts[0].x, activePts[0].y);
            for (let i = 1; i < activePts.length; i++) {
                ctx.lineTo(activePts[i].x, activePts[i].y);
            }
            ctx.closePath();
            ctx.clip();

            ctx.strokeStyle = isCommitted ? '#000000' : 'rgba(100, 200, 100, 0.85)';
            ctx.lineWidth = isCommitted ? 2.0 : 1.6;

            const spacing = 11;

            for (let lx = -H; lx < W + H; lx += spacing) {
                ctx.beginPath();
                ctx.moveTo(lx, H);
                ctx.lineTo(lx + H, 0);
                ctx.stroke();
            }
            ctx.restore();
        }

        if (!isCommitted && pointsPlaced > 0) {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pointsPlaced; i++) {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
            if (pointsPlaced >= 3) {
                ctx.lineTo(pts[0].x, pts[0].y);
            }
            ctx.strokeStyle = 'rgba(100, 200, 100, 0.85)';
            ctx.lineWidth = 1.6;
            ctx.stroke();

            for (let i = 0; i < pointsPlaced; i++) {
                ctx.beginPath();
                ctx.arc(pts[i].x, pts[i].y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = '#eb5048';
                ctx.fill();
                ctx.strokeStyle = '#c53932';
                ctx.lineWidth = 1.0;
                ctx.stroke();
            }
        }

        ctx.restore();
        setCursorState(cursorX, cursorY, isPressed);
    }

    
    // Заливка
    function renderFillAnimation(progress, W, H) {

        const pt1 = { x: 0.28 * W, y: 0.70 * H };
        const pt2 = { x: 0.33 * W, y: 0.38 * H };
        const pt3 = { x: 0.63 * W, y: 0.28 * H };
        const pt4 = { x: 0.75 * W, y: 0.54 * H };
        const pt5 = { x: 0.64 * W, y: 0.71 * H };

        const btnPos = { x: W - 44, y: H - 18 };
        const aside = { x: W - 30, y: 0.44 * H };
        const exit  = { x: W + 35, y: 0.44 * H };

        let cursorX = -25;
        let cursorY = pt1.y;
        let isPressed = false;
        let step = 0;
        let isBtnVisible = false;
        let isBtnPressed = false;
        let isCommitted = false;
        let alpha = 1.0;

        if (progress < 0.06) {
            const t = easeOutCubic(progress / 0.06);
            cursorX = -25 + (pt1.x + 25) * t;
            cursorY = pt1.y;
        } else if (progress < 0.10) {
            cursorX = pt1.x; cursorY = pt1.y;
            isPressed = (progress >= 0.075 && progress < 0.095);
            step = (progress >= 0.075) ? 1 : 0;
        } else if (progress < 0.17) {
            const t = easeInOutCubic((progress - 0.10) / 0.07);
            cursorX = pt1.x + (pt2.x - pt1.x) * t;
            cursorY = pt1.y + (pt2.y - pt1.y) * t;
            step = 1;
        } else if (progress < 0.21) {
            cursorX = pt2.x; cursorY = pt2.y;
            isPressed = (progress >= 0.185 && progress < 0.205);
            step = (progress >= 0.185) ? 2 : 1;
        } else if (progress < 0.28) {
            const t = easeInOutCubic((progress - 0.21) / 0.07);
            cursorX = pt2.x + (pt3.x - pt2.x) * t;
            cursorY = pt2.y + (pt3.y - pt2.y) * t;
            step = 2;
        } else if (progress < 0.32) {
            cursorX = pt3.x; cursorY = pt3.y;
            isPressed = (progress >= 0.295 && progress < 0.315);
            step = (progress >= 0.295) ? 3 : 2;
        } else if (progress < 0.39) {
            const t = easeInOutCubic((progress - 0.32) / 0.07);
            cursorX = pt3.x + (pt4.x - pt3.x) * t;
            cursorY = pt3.y + (pt4.y - pt3.y) * t;
            step = 3;
        } else if (progress < 0.44) {

            cursorX = pt4.x; cursorY = pt4.y;
            isPressed = (progress >= 0.405 && progress < 0.43);
            step = (progress >= 0.405) ? 4 : 3;
        } else if (progress < 0.52) {

            const t = easeInOutCubic((progress - 0.44) / 0.08);
            cursorX = pt4.x + (pt5.x - pt4.x) * t;
            cursorY = pt4.y + (pt5.y - pt4.y) * t;
            step = 4;
        } else if (progress < 0.58) {

            cursorX = pt5.x; cursorY = pt5.y;
            isPressed = (progress >= 0.545 && progress < 0.57);
            step = (progress >= 0.545) ? 5 : 4;
            isBtnVisible = (progress >= 0.545);
        } else if (progress < 0.68) {

            const t = easeInOutCubic((progress - 0.58) / 0.10);
            cursorX = pt5.x + (btnPos.x - pt5.x) * t;
            cursorY = pt5.y + (btnPos.y - pt5.y) * t;
            step = 5;
            isBtnVisible = true;
        } else if (progress < 0.74) {

            cursorX = btnPos.x; cursorY = btnPos.y;
            isPressed = true;
            isBtnVisible = true;
            isBtnPressed = true;
            step = 5;
        } else if (progress < 0.82) {

            const t = easeOutCubic((progress - 0.74) / 0.08);
            cursorX = btnPos.x + (aside.x - btnPos.x) * t;
            cursorY = btnPos.y + (aside.y - btnPos.y) * t;
            isCommitted = true;
            isBtnVisible = false;
        } else if (progress < 0.89) {
            cursorX = aside.x; cursorY = aside.y;
            isCommitted = true;
            isBtnVisible = false;
        } else if (progress < 0.94) {
            const t = easeInQuad((progress - 0.89) / 0.05);
            cursorX = aside.x + (exit.x - aside.x) * t;
            cursorY = aside.y;
            isCommitted = true;
            isBtnVisible = false;
        } else {
            cursorX = exit.x; cursorY = exit.y;
            isCommitted = true;
            isBtnVisible = false;
            alpha = Math.max(0, 1 - (progress - 0.94) / 0.06);
        }

        setCreateBtn(isBtnVisible, isBtnPressed);

        ctx.save();
        ctx.globalAlpha = alpha;

        const blueFill = 'rgba(145, 185, 255, 0.45)';
        const blueStroke = 'rgba(100, 155, 255, 0.85)';

        if (isCommitted) {

            ctx.fillStyle = '#000000';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.lineTo(pt3.x, pt3.y);
            ctx.lineTo(pt4.x, pt4.y);
            ctx.lineTo(pt5.x, pt5.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (step === 5) {

            ctx.fillStyle = blueFill;
            ctx.strokeStyle = blueStroke;
            ctx.lineWidth = 1.6;

            ctx.beginPath();
            ctx.moveTo(pt2.x, pt2.y);
            ctx.lineTo(pt3.x, pt3.y);
            ctx.lineTo(pt4.x, pt4.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.lineTo(pt4.x, pt4.y);
            ctx.lineTo(pt5.x, pt5.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            [pt1, pt2, pt3, pt4, pt5].forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(220, 225, 235, 0.9)';
                ctx.fill();
                ctx.strokeStyle = blueStroke;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            });
        } else if (step === 4) {

            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.lineTo(pt3.x, pt3.y);
            ctx.lineTo(pt4.x, pt4.y);
            ctx.closePath();
            ctx.fillStyle = blueFill;
            ctx.fill();
            ctx.strokeStyle = blueStroke;
            ctx.lineWidth = 1.6;
            ctx.stroke();

            [pt1, pt2, pt3, pt4].forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(220, 225, 235, 0.9)';
                ctx.fill();
                ctx.strokeStyle = blueStroke;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            });
        } else if (step === 3) {
            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.lineTo(pt3.x, pt3.y);
            ctx.closePath();
            ctx.fillStyle = blueFill;
            ctx.fill();
            ctx.strokeStyle = blueStroke;
            ctx.lineWidth = 1.6;
            ctx.stroke();

            [pt1, pt2, pt3].forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(220, 225, 235, 0.9)';
                ctx.fill();
                ctx.strokeStyle = blueStroke;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            });
        } else if (step === 2) {
            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.strokeStyle = blueStroke;
            ctx.lineWidth = 1.6;
            ctx.stroke();

            [pt1, pt2].forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(220, 225, 235, 0.9)';
                ctx.fill();
                ctx.strokeStyle = blueStroke;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            });
        } else if (step === 1) {
            ctx.beginPath();
            ctx.arc(pt1.x, pt1.y, 2.8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(220, 225, 235, 0.9)';
            ctx.fill();
            ctx.strokeStyle = blueStroke;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        ctx.restore();
        setCursorState(cursorX, cursorY, isPressed);
    }

    
    // Фигуры
    function renderShapesAnimation(progress, W, H) {
        const center = { x: 0.50 * W, y: 0.50 * H };
        const radius = (33 / 164) * H;
        const bx = (2 / 6) * W;
        const by = (1 / 4) * H;
        const bw = (2 / 6) * W;
        const bh = (2 / 4) * H;
        const stem = 11;

        const btnPos = { x: W - 44, y: H - 18 };
        const aside = { x: W - 30, y: 0.44 * H };
        const exit  = { x: W + 35, y: 0.44 * H };

        let cursorX = -25;
        let cursorY = center.y;
        let isPressed = false;
        let isPlaced = false;
        let isBtnVisible = false;
        let isBtnPressed = false;
        let isCommitted = false;
        let alpha = 1.0;

        if (progress < 0.12) {

            const t = easeOutCubic(progress / 0.12);
            cursorX = -25 + (center.x + 25) * t;
            cursorY = center.y;
        } else if (progress < 0.20) {

            cursorX = center.x; cursorY = center.y;
            isPressed = (progress >= 0.14 && progress < 0.19);
            isPlaced = (progress >= 0.14);
        } else if (progress < 0.42) {

            cursorX = center.x; cursorY = center.y;
            isPlaced = true;
            isBtnVisible = true;
        } else if (progress < 0.56) {

            const t = easeInOutCubic((progress - 0.42) / 0.14);
            cursorX = center.x + (btnPos.x - center.x) * t;
            cursorY = center.y + (btnPos.y - center.y) * t;
            isPlaced = true;
            isBtnVisible = true;
        } else if (progress < 0.64) {

            cursorX = btnPos.x; cursorY = btnPos.y;
            isPressed = true;
            isPlaced = true;
            isBtnVisible = true;
            isBtnPressed = true;
        } else if (progress < 0.74) {

            const t = easeOutCubic((progress - 0.64) / 0.10);
            cursorX = btnPos.x + (aside.x - btnPos.x) * t;
            cursorY = btnPos.y + (aside.y - btnPos.y) * t;
            isCommitted = true;
            isBtnVisible = false;
        } else if (progress < 0.88) {
            cursorX = aside.x; cursorY = aside.y;
            isCommitted = true;
            isBtnVisible = false;
        } else if (progress < 0.94) {
            const t = easeInQuad((progress - 0.88) / 0.06);
            cursorX = aside.x + (exit.x - aside.x) * t;
            cursorY = aside.y;
            isCommitted = true;
            isBtnVisible = false;
        } else {
            cursorX = exit.x; cursorY = exit.y;
            isCommitted = true;
            isBtnVisible = false;
            alpha = Math.max(0, 1 - (progress - 0.94) / 0.06);
        }

        setCreateBtn(isBtnVisible, isBtnPressed);

        if (isPlaced || isCommitted) {
            ctx.save();
            ctx.globalAlpha = alpha;

            ctx.beginPath();
            ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.4;
            ctx.stroke();

            if (!isCommitted) {

                ctx.strokeStyle = 'rgba(55, 55, 55, 0.85)';
                ctx.lineWidth = 1.1;
                ctx.setLineDash([3, 3]);
                ctx.strokeRect(bx, by, bw, bh);

                ctx.beginPath();
                ctx.moveTo(center.x, by);
                ctx.lineTo(center.x, by - stem);
                ctx.stroke();
                ctx.setLineDash([]);

                const handles = [
                    { x: bx, y: by },
                    { x: center.x, y: by },
                    { x: bx + bw, y: by },
                    { x: bx + bw, y: center.y },
                    { x: bx + bw, y: by + bh },
                    { x: center.x, y: by + bh },
                    { x: bx, y: by + bh },
                    { x: bx, y: center.y },
                    { x: center.x, y: by - stem }
                ];

                handles.forEach(h => {
                    ctx.beginPath();
                    ctx.arc(h.x, h.y, 2.7, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(45, 45, 45, 0.9)';
                    ctx.lineWidth = 1.1;
                    ctx.stroke();
                });
            }

            ctx.restore();
        }

        setCursorState(cursorX, cursorY, isPressed);
    }

    
    // Текст
    function renderTextAnimation(progress, W, H) {
        const tl = { x: 0.272 * W, y: 0.385 * H };
        const br = { x: 0.722 * W, y: 0.550 * H };
        const bw = br.x - tl.x;
        const bh = br.y - tl.y;

        const btnPos = { x: W - 44, y: H - 18 };
        const aside = { x: W - 30, y: 0.44 * H };
        const exit  = { x: W + 35, y: 0.44 * H };
        const restPos = { x: tl.x, y: (br.y + btnPos.y) / 2 };

        let cursorX = -25;
        let cursorY = tl.y;
        let isPressed = false;
        let isBoxPlaced = false;
        let isBtnVisible = false;
        let isBtnPressed = false;
        let isCommitted = false;
        let alpha = 1.0;
        let charsCount = 0;

        if (progress < 0.10) {
            const t = easeOutCubic(progress / 0.10);
            cursorX = -25 + (tl.x + 25) * t;
            cursorY = tl.y;
        } else if (progress < 0.15) {
            cursorX = tl.x; cursorY = tl.y;
            isPressed = (progress >= 0.11 && progress < 0.14);
            isBoxPlaced = (progress >= 0.11);
        } else if (progress < 0.22) {
            const t = easeInOutCubic((progress - 0.15) / 0.07);
            cursorX = tl.x + (restPos.x - tl.x) * t;
            cursorY = tl.y + (restPos.y - tl.y) * t;
            isBoxPlaced = true;
            charsCount = 0;
        } else if (progress < 0.26) {
            cursorX = restPos.x; cursorY = restPos.y;
            isBoxPlaced = true;
            charsCount = 0;
        } else if (progress < 0.62) {
            cursorX = restPos.x; cursorY = restPos.y;
            isBoxPlaced = true;
            const typeP = (progress - 0.26) / (0.62 - 0.26);
            charsCount = Math.min(8, Math.floor(typeP * 8) + 1);
        } else if (progress < 0.67) {
            cursorX = restPos.x; cursorY = restPos.y;
            isBoxPlaced = true;
            charsCount = 8;
            isBtnVisible = true;
        } else if (progress < 0.75) {
            const t = easeInOutCubic((progress - 0.67) / 0.08);
            cursorX = restPos.x + (btnPos.x - restPos.x) * t;
            cursorY = restPos.y + (btnPos.y - restPos.y) * t;
            isBoxPlaced = true;
            charsCount = 8;
            isBtnVisible = true;
        } else if (progress < 0.81) {
            cursorX = btnPos.x; cursorY = btnPos.y;
            isPressed = (progress >= 0.76 && progress < 0.80);
            isBoxPlaced = true;
            charsCount = 8;
            isBtnVisible = true;
            isBtnPressed = isPressed;
        } else if (progress < 0.88) {
            const t = easeOutCubic((progress - 0.81) / 0.07);
            cursorX = btnPos.x + (aside.x - btnPos.x) * t;
            cursorY = btnPos.y + (aside.y - btnPos.y) * t;
            isCommitted = true;
            charsCount = 8;
            isBtnVisible = false;
        } else if (progress < 0.93) {
            cursorX = aside.x; cursorY = aside.y;
            isCommitted = true;
            charsCount = 8;
            isBtnVisible = false;
        } else if (progress < 0.96) {
            const t = easeInQuad((progress - 0.93) / 0.03);
            cursorX = aside.x + (exit.x - aside.x) * t;
            cursorY = aside.y;
            isCommitted = true;
            charsCount = 8;
            isBtnVisible = false;
        } else {
            cursorX = exit.x; cursorY = exit.y;
            isCommitted = true;
            charsCount = 8;
            isBtnVisible = false;
            alpha = Math.max(0, 1 - (progress - 0.96) / 0.04);
        }

        setCreateBtn(isBtnVisible, isBtnPressed);

        if (isBoxPlaced || isCommitted) {
            ctx.save();
            ctx.globalAlpha = alpha;

            if (!isCommitted) {
                ctx.strokeStyle = 'rgba(75, 75, 75, 0.75)';
                ctx.lineWidth = 1.0;
                ctx.setLineDash([3, 3]);
                ctx.strokeRect(tl.x, tl.y, bw, bh);
                ctx.setLineDash([]);

                const corners = [
                    { x: tl.x, y: tl.y },
                    { x: br.x, y: tl.y },
                    { x: br.x, y: br.y },
                    { x: tl.x, y: br.y }
                ];
                corners.forEach(c => {
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, 2.6, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(70, 70, 70, 0.85)';
                    ctx.fill();
                });
            }

            if (charsCount > 0) {
                const fullText = "WTDSight";
                const textToDraw = fullText.slice(0, charsCount);
                const textX = tl.x + 3;
                const textY = 0.50 * H;

                ctx.font = 'bold 23px "Times New Roman", Times, Georgia, serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';

                if (!isCommitted) {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
                    ctx.fillText(textToDraw, textX, textY);

                    ctx.save();
                    ctx.globalCompositeOperation = 'source-atop';
                    ctx.strokeStyle = 'rgba(20, 20, 20, 0.75)';
                    ctx.lineWidth = 0.9;
                    ctx.beginPath();
                    for (let rx = textX - 10; rx < textX + bw + 10; rx += 7) {
                        ctx.moveTo(rx, tl.y - 2);
                        ctx.lineTo(rx + 15, br.y + 2);
                        ctx.moveTo(rx + 5, tl.y - 2);
                        ctx.lineTo(rx - 8, br.y + 2);
                    }
                    ctx.stroke();
                    ctx.restore();

                    ctx.strokeStyle = 'rgba(30, 30, 30, 0.95)';
                    ctx.lineWidth = 1.0;
                    ctx.strokeText(textToDraw, textX, textY);
                } else {
                    ctx.fillStyle = '#000000';
                    ctx.fillText(textToDraw, textX, textY);
                }
            }

            ctx.restore();
        }

        setCursorState(cursorX, cursorY, isPressed);
    }

    
    // Векторизация
    function renderVectorizeAnimation(progress, W, H) {
        const btnPos = { x: W - 44, y: H - 18 };
        const aside = { x: W - 30, y: 0.44 * H };
        const exit  = { x: W + 35, y: 0.44 * H };

        let cursorX = -25;
        let cursorY = btnPos.y;
        let isPressed = false;
        let isBtnVisible = false;
        let isBtnPressed = false;
        let btnLabel = null;
        let btnVariant = 'green';

        let loopAlpha = 1.0;
        if (progress < 0.10) {
            loopAlpha = easeOutCubic(progress / 0.10);
        } else if (progress > 0.90) {
            loopAlpha = Math.max(0, 1 - easeInQuad((progress - 0.90) / 0.10));
        }

        if (progress < 0.14) {

            cursorX = -25;
            cursorY = btnPos.y;
        } else if (progress < 0.22) {

            isBtnVisible = true;
            btnLabel = 'process';
            btnVariant = 'blue';
            const t = easeOutCubic((progress - 0.14) / 0.08);
            cursorX = -25 + (btnPos.x + 25) * t;
            cursorY = btnPos.y;
        } else if (progress < 0.32) {

            cursorX = btnPos.x; cursorY = btnPos.y;
            isBtnVisible = true;
            btnLabel = 'process';
            btnVariant = 'blue';
        } else if (progress < 0.38) {

            cursorX = btnPos.x; cursorY = btnPos.y;
            isPressed = true;
            isBtnVisible = true;
            isBtnPressed = true;
            btnLabel = 'process';
            btnVariant = 'blue';
        } else if (progress < 0.46) {

            isBtnVisible = false;
            const t = easeOutCubic((progress - 0.38) / 0.08);
            cursorX = btnPos.x - 16 * t;
            cursorY = btnPos.y - 12 * t;
        } else if (progress < 0.54) {

            isBtnVisible = true;
            btnLabel = null;
            btnVariant = 'green';
            cursorX = btnPos.x - 16;
            cursorY = btnPos.y - 12;
        } else if (progress < 0.62) {

            isBtnVisible = true;
            btnLabel = null;
            btnVariant = 'green';
            const t = easeInOutCubic((progress - 0.54) / 0.08);
            cursorX = (btnPos.x - 16) + 16 * t;
            cursorY = (btnPos.y - 12) + 12 * t;
        } else if (progress < 0.70) {

            cursorX = btnPos.x; cursorY = btnPos.y;
            isPressed = true;
            isBtnVisible = true;
            isBtnPressed = true;
            btnLabel = null;
            btnVariant = 'green';
        } else if (progress < 0.80) {

            isBtnVisible = false;
            const t = easeOutCubic((progress - 0.70) / 0.10);
            cursorX = btnPos.x + (aside.x - btnPos.x) * t;
            cursorY = btnPos.y + (aside.y - btnPos.y) * t;
        } else if (progress < 0.88) {
            cursorX = aside.x; cursorY = aside.y;
            isBtnVisible = false;
        } else if (progress < 0.94) {
            const t = easeInQuad((progress - 0.88) / 0.06);
            cursorX = aside.x + (exit.x - aside.x) * t;
            cursorY = aside.y;
            isBtnVisible = false;
        } else {
            cursorX = exit.x; cursorY = exit.y;
            isBtnVisible = false;
        }

        setCreateBtn(isBtnVisible, isBtnPressed, btnLabel, btnVariant);

        const drawLayer = (img, layerAlpha) => {
            if (layerAlpha <= 0.001 || !img || !img.complete || img.naturalWidth === 0) return;
            ctx.save();
            ctx.globalAlpha = loopAlpha * layerAlpha;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, W, H);
            ctx.restore();
        };

        if (progress < 0.38) {
            drawLayer(vectorizeImages.source, 1.0);
        } else if (progress < 0.46) {

            const cf = easeInOutCubic((progress - 0.38) / 0.08);
            drawLayer(vectorizeImages.source, 1 - cf);
            drawLayer(vectorizeImages.green, cf);
        } else if (progress < 0.70) {
            drawLayer(vectorizeImages.green, 1.0);
        } else if (progress < 0.78) {

            const cf = easeInOutCubic((progress - 0.70) / 0.08);
            drawLayer(vectorizeImages.green, 1 - cf);
            drawLayer(vectorizeImages.result, cf);
        } else {
            drawLayer(vectorizeImages.result, 1.0);
        }

        setCursorState(cursorX, cursorY, isPressed);
    }

    
    function renderDefaultAnimation(progress, W, H) {
        setCreateBtn(false);
        renderLinesAnimation(progress, W, H);
    }

    
    function showToolGuide(toolId, targetBtn) {
        ensureTooltipDOM();
        if (!tooltipEl) return;

        activeToolId = toolId;
        activeTargetBtn = targetBtn || document.querySelector(`.tab-button[data-target="${toolId}"]`);
        const conf = toolGuidesData[toolId] || {
            titleKey: 'toolTitle',
            hasBrushCircle: false
        };

        const curLang = (typeof lang !== 'undefined' && lang) ? lang : (typeof ru !== 'undefined' ? ru : {});
        const titleStr = curLang[conf.titleKey] || toolId;
        if (titleEl) titleEl.textContent = titleStr;

        const hotkeyAction = toolHotkeyActions[toolId];
        let hotkeyStr = '';
        if (hotkeyAction && typeof currentHotkeys !== 'undefined' && currentHotkeys[hotkeyAction]) {
            if (typeof getReadableHotkeyString === 'function') {
                hotkeyStr = getReadableHotkeyString(currentHotkeys[hotkeyAction]);
            }
        }
        if (hotkeyEl) {
            if (hotkeyStr) {
                hotkeyEl.textContent = hotkeyStr;
                hotkeyEl.style.display = 'inline-flex';
            } else {
                hotkeyEl.style.display = 'none';
            }
        }

        const descStr = conf.descKey ? (curLang[conf.descKey] || '') : '';
        if (descEl) {
            descEl.textContent = descStr;
            descEl.style.display = descStr ? '' : 'none';
        }

        if (brushCircleEl) {
            if (conf.hasBrushCircle) {
                brushCircleEl.style.display = 'block';
                brushCircleEl.style.width = '11px';
                brushCircleEl.style.height = '11px';
                brushCircleEl.style.marginLeft = '-5.5px';
                brushCircleEl.style.marginTop = '-5.5px';
                brushCircleEl.style.border = '1.2px solid rgba(0, 0, 0, 0.7)';
                brushCircleEl.style.background = 'transparent';
                brushCircleEl.classList.remove('eraser-circle');
            } else if (conf.hasEraserCircle) {
                brushCircleEl.style.display = 'block';
                brushCircleEl.style.width = '14px';
                brushCircleEl.style.height = '14px';
                brushCircleEl.style.marginLeft = '-7px';
                brushCircleEl.style.marginTop = '-7px';
                brushCircleEl.style.border = '1.2px solid rgba(235, 80, 72, 0.75)';
                brushCircleEl.style.background = 'transparent';
                brushCircleEl.classList.add('eraser-circle');
            } else {
                brushCircleEl.style.display = 'none';
                brushCircleEl.classList.remove('eraser-circle');
            }
        }

        const pad = 12;
        let btnRect = activeTargetBtn ? activeTargetBtn.getBoundingClientRect() : null;
        

        tooltipEl.style.visibility = 'hidden';
        tooltipEl.classList.add('visible');
        const tipRect = tooltipEl.getBoundingClientRect();
        tooltipEl.style.visibility = 'visible';

        let posX = btnRect ? (btnRect.right + 14) : (lastMouseX + 18);
        if (lastMouseX > posX) {
            posX = lastMouseX + 18;
        }
        posX = Math.max(92, posX);
        let posY = btnRect ? (btnRect.top + btnRect.height / 2 - tipRect.height / 2) : (lastMouseY - 24);

        if (posX + tipRect.width > window.innerWidth - pad) {
            if (btnRect) {
                posX = Math.max(pad, btnRect.left - tipRect.width - 12);
            } else {
                posX = Math.max(pad, window.innerWidth - tipRect.width - pad);
            }
        }
        if (posY + tipRect.height > window.innerHeight - pad) {
            posY = Math.max(pad, window.innerHeight - tipRect.height - pad);
        }
        if (posY < pad) posY = pad;

        tooltipEl.style.left = `${Math.round(posX)}px`;
        tooltipEl.style.top = `${Math.round(posY)}px`;
        isTooltipVisible = true;
        setCreateBtn(false);

        animStartTime = null;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        animFrameId = requestAnimationFrame(runAnimationLoop);
    }

    function hideToolGuide(immediate = false) {
        setCreateBtn(false);
        if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
        }

        isTooltipVisible = false;
        activeToolId = null;
        activeTargetBtn = null;

        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }

        if (tooltipEl) {
            if (immediate) {
                tooltipEl.style.transition = 'none';
                tooltipEl.classList.remove('visible');
                requestAnimationFrame(() => {
                    if (tooltipEl) tooltipEl.style.transition = '';
                });
            } else {
                tooltipEl.classList.remove('visible');
            }
        }

        if (cursorEl) {
            cursorEl.style.transform = 'translate3d(-100px, -100px, 0)';
            cursorEl.classList.remove('pressed');
        }
        lastPressedState = false;
    }

    
    function attachToolGuideListeners() {
        ensureTooltipDOM();

        document.addEventListener('mouseover', (e) => {
            const btn = e.target.closest('.tab-button[data-target]');
            if (!btn) return;

            const targetId = btn.getAttribute('data-target');
            if (!targetId || !toolGuidesData[targetId]) return;

            if (activeTargetBtn === btn) return;

            if (hoverTimer) clearTimeout(hoverTimer);
            activeTargetBtn = btn;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            hoverTimer = setTimeout(() => {
                showToolGuide(targetId, btn);
            }, HOVER_DELAY);
        }, true);

        document.addEventListener('mousemove', (e) => {
            const btn = e.target.closest('.tab-button[data-target]');
            if (btn) {
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            }
        }, true);

        document.addEventListener('mouseout', (e) => {
            const btn = e.target.closest('.tab-button[data-target]');
            if (!btn) return;

            const related = e.relatedTarget ? e.relatedTarget.closest('.tab-button[data-target]') : null;
            if (related !== btn) {
                if (hoverTimer) {
                    clearTimeout(hoverTimer);
                    hoverTimer = null;
                }
                if (!related) {
                    hideToolGuide(false);
                }
            }
        }, true);

        document.addEventListener('mousedown', (e) => {
            const btn = e.target.closest('.tab-button[data-target]');
            if (btn) {
                hideToolGuide(true);
            }
        }, true);

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-button[data-target]');
            if (btn) {
                hideToolGuide(true);
            }
        }, true);
    }

    window.showToolGuide = showToolGuide;
    window.hideToolGuide = hideToolGuide;
    window.toolGuideRenderers = {
        lines: renderLinesAnimation,
        curve: renderCurveAnimation,
        brush: renderBrushAnimation,
        eraser: renderEraserAnimation,
        quads: renderQuadsAnimation,
        hatch: renderHatchAnimation,
        fill: renderFillAnimation,
        select: renderSelectAnimation,
        shapes: renderShapesAnimation,
        text: renderTextAnimation,
        vectorize: renderVectorizeAnimation
    };
    window.renderToolGuideTest = function(toolId, progress, cEl, curEl, btnEl, circleEl) {
        const oldCanvas = canvasEl, oldCtx = ctx, oldCursor = cursorEl, oldBtn = createBtnEl, oldCircle = brushCircleEl;
        canvasEl = cEl;
        ctx = cEl.getContext('2d');
        cursorEl = curEl;
        createBtnEl = btnEl;
        brushCircleEl = circleEl;
        const fn = window.toolGuideRenderers[toolId];
        if (fn) {
            cEl.width = 246;
            cEl.height = 164;
            fn(progress, 246, 164);
        }
        canvasEl = oldCanvas;
        ctx = oldCtx;
        cursorEl = oldCursor;
        createBtnEl = oldBtn;
        brushCircleEl = oldCircle;
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachToolGuideListeners);
    } else {
        attachToolGuideListeners();
    }
})();
