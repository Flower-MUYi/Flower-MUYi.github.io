// grapher.js —— 交互式 2D Canvas 可视化引擎 (含图层与特征点/阴影联动过滤)

function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function parseMathString(str) {
    if (!str && str !== 0) return { name: '', latex: '' };
    str = String(str).trim();

    // 匹配中文/分类名称前缀，例如：驻点 (1/2, 0), Y轴截距 (0, 1), 积分下限 a=1, 特解 (C = 0)
    const match = str.match(/^([\u4e00-\u9fa5A-Za-z0-9_]+轴?[\u4e00-\u9fa5\w\s]*?)\s*[:：]?\s*([\(（\[].*|L\s*=.*|a\s*=.*|b\s*=.*|f\(.*|F\(.*|y\(.*|C\s*=.*)$/);
    if (match) {
        let name = match[1].trim();
        let latex = match[2].trim();
        let note = '';
        const noteMatch = latex.match(/^(.*?)\s*[:：]\s*([\u4e00-\u9fa5\w\s]+)$/);
        if (noteMatch) {
            latex = noteMatch[1].trim();
            note = noteMatch[2].trim();
        }
        return { name, latex, note };
    }

    return { name: '', latex: str };
}

export function renderMath(latex, options = {}) {
    if (!latex && latex !== 0) return '';
    let formula = String(latex).trim();
    if (!formula) return '';

    // 若全局 KaTeX 引擎可用，进行高质量排版输出
    if (typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function') {
        try {
            return window.katex.renderToString(formula, {
                displayMode: options.displayMode || false,
                throwOnError: false
            });
        } catch (e) {
            console.warn('KaTeX render warning:', e);
        }
    }

    // 兜底：若 KaTeX 暂未加载，动态拉取并在加载完成后广播事件
    if (typeof document !== 'undefined' && !window.__katexLoading && !window.katex) {
        window.__katexLoading = true;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
        script.onload = () => {
            window.dispatchEvent(new CustomEvent('katex-loaded'));
        };
        document.head.appendChild(script);
    }

    return `<span class="raw-math">${escapeHtml(formula)}</span>`;
}

export class InteractiveGrapher {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error(`Container #${containerId} not found`);

        this.initDOM();
        this.initEvents();

        this.view = {
            centerX: 0,
            centerY: 0,
            scale: 40
        };

        this.plotData = { layers: [], points: [], areas: [] };
        this.hoveredPoint = null;
        this.hoveredCurve = null;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.viewStart = { x: 0, y: 0 };
        this.detectedIntersections = [];
        this.renderPending = false;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // 当 KaTeX 动态加载就绪后自动重绘刷新公式
        window.addEventListener('katex-loaded', () => {
            this.updateLegend();
            this.requestRender();
        });
    }

    requestRender() {
        if (!this.renderPending) {
            this.renderPending = true;
            requestAnimationFrame(() => {
                this.requestRender();
                this.renderPending = false;
            });
        }
    }

    initDOM() {
        this.container.innerHTML = `
            <div class="graph-wrapper" style="position: relative; width: 100%; height: 320px; background: #0f172a; border-radius: 12px; overflow: hidden; border: 1px solid #334155; user-select: none; touch-action: none;">
                <canvas id="graph-canvas" style="display: block; width: 100%; height: 100%; cursor: grab;"></canvas>
                
                <div id="graph-legend" style="position: absolute; top: 10px; left: 10px; display: flex; flex-wrap: wrap; gap: 6px; z-index: 10; max-width: calc(100% - 60px);"></div>

                <div style="position: absolute; bottom: 10px; right: 10px; display: flex; flex-direction: column; gap: 6px; z-index: 10;">
                    <button id="btn-zoom-in" title="放大" style="width: 36px; height: 36px; background: #1e293b; color: #94a3b8; border: 1px solid #475569; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; touch-action: manipulation;">+</button>
                    <button id="btn-zoom-out" title="缩小" style="width: 36px; height: 36px; background: #1e293b; color: #94a3b8; border: 1px solid #475569; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; touch-action: manipulation;">−</button>
                    <button id="btn-reset" title="复位原点" style="width: 36px; height: 36px; background: #1e293b; color: #94a3b8; border: 1px solid #475569; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px; touch-action: manipulation;">⟲</button>
                    <button id="btn-autofit" title="自适应居中" style="width: 36px; height: 36px; background: #1e293b; color: #94a3b8; border: 1px solid #475569; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px; touch-action: manipulation;">⊡</button>
                </div>

                <div id="graph-tooltip" style="position: absolute; display: none; pointer-events: none; background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(8px); color: #f8fafc; border: 1px solid rgba(148, 163, 184, 0.35); padding: 8px 12px; border-radius: 8px; font-size: 12px; line-height: 1.45; box-shadow: 0 8px 24px rgba(0,0,0,0.5); z-index: 30; max-width: calc(100% - 30px); transition: opacity 0.15s ease;"></div>
            </div>
        `;

        this.canvas = this.container.querySelector('#graph-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.legendContainer = this.container.querySelector('#graph-legend');
        this.tooltip = this.container.querySelector('#graph-tooltip');
    }

    initEvents() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            this.isDragging = true;
            this.canvas.style.cursor = 'grabbing';
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.viewStart = { x: this.view.centerX, y: this.view.centerY };
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                this.view.centerX = this.viewStart.x - dx / this.view.scale;
                this.view.centerY = this.viewStart.y + dy / this.view.scale;
                this.requestRender();
            } else {
                this.handleMouseMove(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.canvas.style.cursor = this.hoveredPoint ? 'pointer' : 'grab';
                this.requestRender();
            }
        });

        // 移动端触摸交互支持 (单指平移、双指捏合缩放、点击特征点查看提示)
        let touchMode = null;
        let initialPinchDist = 0;
        let initialScale = 40;
        let pinchCenterMath = { x: 0, y: 0 };
        let pinchCenterScreen = { x: 0, y: 0 };

        const getTouchDist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const getTouchCenter = (t1, t2) => ({ x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 });

        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                touchMode = 'drag';
                const t = e.touches[0];
                this.isDragging = true;
                this.dragStart = { x: t.clientX, y: t.clientY };
                this.viewStart = { x: this.view.centerX, y: this.view.centerY };
                this.handleMouseMove(t);
            } else if (e.touches.length === 2) {
                touchMode = 'pinch';
                this.isDragging = false;
                initialPinchDist = getTouchDist(e.touches[0], e.touches[1]);
                initialScale = this.view.scale;

                const center = getTouchCenter(e.touches[0], e.touches[1]);
                const rect = this.canvas.getBoundingClientRect();
                pinchCenterScreen = { x: center.x - rect.left, y: center.y - rect.top };
                pinchCenterMath = {
                    x: this.screenToMathX(pinchCenterScreen.x),
                    y: this.screenToMathY(pinchCenterScreen.y)
                };
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (touchMode === 'drag' && e.touches.length === 1) {
                const t = e.touches[0];
                const dx = t.clientX - this.dragStart.x;
                const dy = t.clientY - this.dragStart.y;
                this.view.centerX = this.viewStart.x - dx / this.view.scale;
                this.view.centerY = this.viewStart.y + dy / this.view.scale;
                this.requestRender();
                this.handleMouseMove(t);
            } else if (touchMode === 'pinch' && e.touches.length === 2) {
                const currentDist = getTouchDist(e.touches[0], e.touches[1]);
                if (initialPinchDist > 0) {
                    const factor = currentDist / initialPinchDist;
                    const newScale = Math.min(Math.max(initialScale * factor, 5), 1000);
                    this.view.centerX = pinchCenterMath.x - (pinchCenterScreen.x - this.width / 2) / newScale;
                    this.view.centerY = pinchCenterMath.y + (pinchCenterScreen.y - this.height / 2) / newScale;
                    this.view.scale = newScale;
                    this.requestRender();
                }
            }
        }, { passive: false });

        const endTouch = () => {
            touchMode = null;
            if (this.isDragging) {
                this.isDragging = false;
                this.requestRender();
            }
        };

        this.canvas.addEventListener('touchend', endTouch);
        this.canvas.addEventListener('touchcancel', endTouch);

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const mouseScreenX = e.clientX - rect.left;
            const mouseScreenY = e.clientY - rect.top;

            const mathX = this.screenToMathX(mouseScreenX);
            const mathY = this.screenToMathY(mouseScreenY);

            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
            const newScale = Math.min(Math.max(this.view.scale * zoomFactor, 5), 1000);

            this.view.centerX = mathX - (mouseScreenX - this.width / 2) / newScale;
            this.view.centerY = mathY + (mouseScreenY - this.height / 2) / newScale;
            this.view.scale = newScale;

            this.requestRender();
            this.handleMouseMove(e);
        }, { passive: false });

        this.container.querySelector('#btn-zoom-in').onclick = () => this.zoom(1.25);
        this.container.querySelector('#btn-zoom-out').onclick = () => this.zoom(0.8);
        this.container.querySelector('#btn-reset').onclick = () => this.resetView();
        this.container.querySelector('#btn-autofit').onclick = () => this.autoFit();
    }

    zoom(factor) {
        this.view.scale = Math.min(Math.max(this.view.scale * factor, 5), 1000);
        this.requestRender();
    }

    resetView() {
        this.view.centerX = 0;
        this.view.centerY = 0;
        this.view.scale = 40;
        this.requestRender();
    }

    autoFit() {
        const visiblePoints = this.getVisiblePoints();
        if (!visiblePoints || visiblePoints.length === 0) {
            this.resetView();
            return;
        }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        visiblePoints.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });

        if (minX === maxX) { minX -= 5; maxX += 5; }
        if (minY === maxY) { minY -= 5; maxY += 5; }

        this.view.centerX = (minX + maxX) / 2;
        this.view.centerY = (minY + maxY) / 2;

        const scaleX = (this.width * 0.7) / (maxX - minX);
        const scaleY = (this.height * 0.7) / (maxY - minY);
        this.view.scale = Math.min(Math.max(Math.min(scaleX, scaleY), 10), 200);

        this.requestRender();
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.dpr = window.devicePixelRatio || 1;
        this.width = rect.width;
        this.height = rect.height;

        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);

        this.requestRender();
    }

    screenToMathX(sx) { return this.view.centerX + (sx - this.width / 2) / this.view.scale; }
    screenToMathY(sy) { return this.view.centerY - (sy - this.height / 2) / this.view.scale; }
    mathToScreenX(mx) { return this.width / 2 + (mx - this.view.centerX) * this.view.scale; }
    mathToScreenY(my) { return this.height / 2 - (my - this.view.centerY) * this.view.scale; }

    // 判断图层是否可见
    isLayerVisible(layerId) {
        if (!layerId) return true;
        const layer = (this.plotData.layers || []).find(l => l.id === layerId);
        return layer ? layer.visible !== false : true;
    }

    // 动态提取当前所有处于可见状态的特征点
    getVisiblePoints() {
        const staticPoints = (this.plotData.points || []).filter(p => this.isLayerVisible(p.layerId));
        return [...staticPoints, ...(this.detectedIntersections || [])];
    }

    setData(plotData) {
        this.plotData = plotData || { layers: [], points: [], areas: [] };
        this.updateLegend();
        this.detectIntersections();
        this.requestRender();
    }

    updateLegend() {
        this.legendContainer.innerHTML = '';
        if (!this.plotData.layers || this.plotData.layers.length === 0) return;

        this.plotData.layers.forEach((layer) => {
            const item = document.createElement('div');
            item.className = 'graph-legend-item';
            item.style.cssText = `
                display: inline-flex; align-items: center; gap: 5px; background: rgba(15, 23, 42, 0.88);
                backdrop-filter: blur(8px); border: 1px solid rgba(71, 85, 105, 0.75); padding: 3px 8px;
                border-radius: 6px; font-size: 11px; color: #e2e8f0; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 2px 8px rgba(0,0,0,0.3); user-select: none;
            `;

            const colorBadge = document.createElement('span');
            colorBadge.style.cssText = `width: 9px; height: 9px; border-radius: 3px; background: ${layer.color}; display: inline-block; flex-shrink: 0; box-shadow: 0 0 5px ${layer.color}88;`;

            const labelSpan = document.createElement('span');
            labelSpan.className = 'graph-legend-formula';
            labelSpan.style.cssText = `display: inline-flex; align-items: center; gap: 3px; line-height: 1.2;`;

            const parsed = layer.latex ? { name: layer.name, latex: layer.latex } : parseMathString(layer.label);
            let contentHtml = '';
            if (parsed.name) {
                contentHtml += `<span style="font-size: 10px; color: #94a3b8; font-weight: 500;">${escapeHtml(parsed.name)}</span>`;
            }
            if (parsed.latex) {
                contentHtml += `<span class="katex-formula" style="color: #f8fafc;">${renderMath(parsed.latex)}</span>`;
            } else if (!parsed.name) {
                contentHtml = escapeHtml(layer.label || '');
            }
            labelSpan.innerHTML = contentHtml;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = layer.visible !== false;
            checkbox.style.cursor = 'pointer';
            checkbox.style.accentColor = layer.color || '#38bdf8';
            checkbox.style.margin = '0';

            item.appendChild(checkbox);
            item.appendChild(colorBadge);
            item.appendChild(labelSpan);

            item.onclick = (e) => {
                if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
                layer.visible = checkbox.checked;
                item.style.opacity = layer.visible ? '1' : '0.45';
                item.style.filter = layer.visible ? 'none' : 'grayscale(0.6)';
                this.detectIntersections(); // 图层切换时重新计算交点
                this.requestRender();
            };

            this.legendContainer.appendChild(item);
        });
    }

    detectIntersections() {
        this.detectedIntersections = [];
        const activeLayers = (this.plotData.layers || []).filter(l => l.visible !== false && typeof l.fn === 'function');
        if (activeLayers.length < 2) return;

        const xMin = this.screenToMathX(0);
        const xMax = this.screenToMathX(this.width);
        const step = (xMax - xMin) / 300;

        for (let i = 0; i < activeLayers.length; i++) {
            for (let j = i + 1; j < activeLayers.length; j++) {
                const f1 = activeLayers[i].fn;
                const f2 = activeLayers[j].fn;

                let prevX = xMin;
                let prevDiff = f1(prevX) - f2(prevX);

                for (let x = xMin + step; x <= xMax; x += step) {
                    const diff = f1(x) - f2(x);
                    if (!isNaN(prevDiff) && !isNaN(diff) && prevDiff * diff <= 0 && Math.abs(diff - prevDiff) < 50) {
                        let l = x - step, r = x;
                        for (let k = 0; k < 12; k++) {
                            const mid = (l + r) / 2;
                            const midDiff = f1(mid) - f2(mid);
                            if (midDiff * (f1(l) - f2(l)) <= 0) r = mid;
                            else l = mid;
                        }
                        const rootX = (l + r) / 2;
                        const rootY = f1(rootX);
                        if (!isNaN(rootY) && Math.abs(rootY) < 1e5) {
                            const name1 = activeLayers[i].name || activeLayers[i].label;
                            const name2 = activeLayers[j].name || activeLayers[j].label;
                            this.detectedIntersections.push({
                                x: rootX,
                                y: rootY,
                                label: `交点 (${name1} ∩ ${name2})`,
                                name: '曲线交点',
                                latex: `\\left(${rootX.toFixed(2)}, ${rootY.toFixed(2)}\\right)`,
                                note: `${name1} ∩ ${name2}`,
                                type: 'intersection',
                                style: 'solid',
                                color: '#eab308'
                            });
                        }
                    }
                    prevX = x;
                    prevDiff = diff;
                }
            }
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;

        // 仅对可见特征点执行拾取
        const allVisiblePoints = this.getVisiblePoints();
        const hitRadius = 10;

        // 1. 优先吸附特征点
        const clustered = allVisiblePoints.filter(p => {
            const px = this.mathToScreenX(p.x);
            const py = this.mathToScreenY(p.y);
            return Math.hypot(px - sx, py - sy) <= hitRadius;
        });

        if (clustered.length > 0) {
            this.hoveredPoint = clustered;
            this.hoveredCurve = null;
            this.canvas.style.cursor = 'pointer';

            const p0 = clustered[0];
            const px = this.mathToScreenX(p0.x);
            const py = this.mathToScreenY(p0.y);

            const labelsHtml = clustered.map(p => {
                const parsed = p.latex ? { name: p.name, latex: p.latex, note: p.note } : parseMathString(p.label);
                const titleText = parsed.name || p.name || '特征点';
                const formulaHtml = parsed.latex ? renderMath(parsed.latex) : '';
                const noteHtml = (p.note || parsed.note) ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px;">${escapeHtml(p.note || parsed.note)}</div>` : '';

                return `
                    <div style="margin-bottom: 5px; padding-bottom: 3px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
                            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${p.color || '#38bdf8'};flex-shrink:0;box-shadow:0 0 5px ${p.color || '#38bdf8'};"></span>
                            <span style="font-weight:600;font-size:11px;color:#f1f5f9;">${escapeHtml(titleText)}</span>
                        </div>
                        ${formulaHtml ? `<div style="font-size:12px;color:#38bdf8;padding:1px 0;">${formulaHtml}</div>` : ''}
                        ${noteHtml}
                    </div>
                `;
            }).join('');

            const coordHtml = `
                <div style="display:flex;gap:10px;color:#94a3b8;font-family:'JetBrains Mono',monospace;font-size:10px;margin-top:3px;">
                    <span>x: <b style="color:#e2e8f0;">${p0.x.toFixed(3)}</b></span>
                    <span>y: <b style="color:#e2e8f0;">${p0.y.toFixed(3)}</b></span>
                </div>
            `;

            this.tooltip.innerHTML = labelsHtml + coordHtml;
            this.tooltip.style.display = 'block';

            const tipWidth = this.tooltip.offsetWidth || 160;
            const tipHeight = this.tooltip.offsetHeight || 55;
            let left = px + 12;
            let top = py - tipHeight / 2;
            if (left + tipWidth > this.width - 8) left = px - tipWidth - 12;
            if (left < 8) left = 8;
            if (top + tipHeight > this.height - 8) top = this.height - tipHeight - 8;
            if (top < 8) top = 8;

            this.tooltip.style.left = `${left}px`;
            this.tooltip.style.top = `${top}px`;
            this.requestRender();
            return;
        }

        // 2. 曲线悬停与吸附检测
        let nearestCurve = null;
        let minCurveDist = 12;
        const mathX = this.screenToMathX(sx);

        const activeLayers = (this.plotData.layers || []).filter(l => l.visible !== false && typeof l.fn === 'function');
        for (const layer of activeLayers) {
            try {
                const mathY = layer.fn(mathX);
                if (typeof mathY === 'number' && !isNaN(mathY) && isFinite(mathY)) {
                    const screenY = this.mathToScreenY(mathY);
                    const dist = Math.abs(screenY - sy);
                    if (dist < minCurveDist) {
                        minCurveDist = dist;
                        nearestCurve = {
                            layer,
                            x: mathX,
                            y: mathY,
                            screenX: sx,
                            screenY: screenY
                        };
                    }
                }
            } catch (e) { }
        }

        if (nearestCurve) {
            this.hoveredPoint = null;
            this.hoveredCurve = nearestCurve;
            this.canvas.style.cursor = 'crosshair';

            const layer = nearestCurve.layer;
            const parsed = layer.latex ? { name: layer.name, latex: layer.latex } : parseMathString(layer.label);
            const formulaHtml = parsed.latex ? renderMath(parsed.latex) : escapeHtml(layer.label || '');

            this.tooltip.innerHTML = `
                <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;">
                    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${layer.color || '#38bdf8'};flex-shrink:0;box-shadow:0 0 5px ${layer.color || '#38bdf8'};"></span>
                    <span style="font-weight:600;font-size:11px;color:#f1f5f9;">${escapeHtml(parsed.name || '函数曲线')}</span>
                </div>
                <div style="font-size:12px;color:#38bdf8;padding:1px 0;margin-bottom:3px;">
                    ${formulaHtml}
                </div>
                <div style="display:flex;gap:10px;color:#94a3b8;font-family:'JetBrains Mono',monospace;font-size:10px;">
                    <span>x: <b style="color:#e2e8f0;">${nearestCurve.x.toFixed(3)}</b></span>
                    <span>y: <b style="color:#e2e8f0;">${nearestCurve.y.toFixed(3)}</b></span>
                </div>
            `;
            this.tooltip.style.display = 'block';

            const tipWidth = this.tooltip.offsetWidth || 160;
            const tipHeight = this.tooltip.offsetHeight || 55;
            let left = sx + 12;
            let top = nearestCurve.screenY - tipHeight / 2;
            if (left + tipWidth > this.width - 8) left = sx - tipWidth - 12;
            if (left < 8) left = 8;
            if (top + tipHeight > this.height - 8) top = this.height - tipHeight - 8;
            if (top < 8) top = 8;

            this.tooltip.style.left = `${left}px`;
            this.tooltip.style.top = `${top}px`;
        } else {
            this.hoveredPoint = null;
            this.hoveredCurve = null;
            this.canvas.style.cursor = this.isDragging ? 'grabbing' : 'grab';
            this.tooltip.style.display = 'none';
        }
        this.requestRender();
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        this.drawGrid();
        this.drawAreas();
        this.drawLayers();
        this.drawPoints();
    }

    drawGrid() {
        const ctx = this.ctx;
        const xMin = this.screenToMathX(0);
        const xMax = this.screenToMathX(this.width);
        const yMin = this.screenToMathY(this.height);
        const yMax = this.screenToMathY(0);

        const rawStep = 60 / this.view.scale;
        const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const residual = rawStep / mag;
        let step = mag;
        if (residual > 5) step = 10 * mag;
        else if (residual > 2) step = 5 * mag;
        else if (residual > 1) step = 2 * mag;

        ctx.lineWidth = 1;
        ctx.strokeStyle = '#1e293b';
        ctx.beginPath();

        const firstX = Math.floor(xMin / step) * step;
        for (let x = firstX; x <= xMax; x += step) {
            const sx = this.mathToScreenX(x);
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, this.height);
        }

        const firstY = Math.floor(yMin / step) * step;
        for (let y = firstY; y <= yMax; y += step) {
            const sy = this.mathToScreenY(y);
            ctx.moveTo(0, sy);
            ctx.lineTo(this.width, sy);
        }
        ctx.stroke();

        const originX = this.mathToScreenX(0);
        const originY = this.mathToScreenY(0);

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (originY >= 0 && originY <= this.height) {
            ctx.moveTo(0, originY); ctx.lineTo(this.width, originY);
        }
        if (originX >= 0 && originX <= this.width) {
            ctx.moveTo(originX, 0); ctx.lineTo(originX, this.height);
        }
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelY = Math.min(Math.max(originY + 4, 4), this.height - 18);
        for (let x = firstX; x <= xMax; x += step) {
            if (Math.abs(x) < 1e-6) continue;
            const sx = this.mathToScreenX(x);
            ctx.fillText(Number(x.toFixed(4)).toString(), sx, labelY);
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const labelX = Math.min(Math.max(originX - 6, 30), this.width - 6);
        for (let y = firstY; y <= yMax; y += step) {
            if (Math.abs(y) < 1e-6) continue;
            const sy = this.mathToScreenY(y);
            ctx.fillText(Number(y.toFixed(4)).toString(), labelX, sy);
        }
    }

    drawAreas() {
        if (!this.plotData.areas) return;
        const ctx = this.ctx;

        this.plotData.areas.forEach(area => {
            // 联动判断：如果关联图层被关闭，则不绘制对应面积
            if (area.layerId && !this.isLayerVisible(area.layerId)) return;

            const fromX = Math.max(area.from, this.screenToMathX(0));
            const toX = Math.min(area.to, this.screenToMathX(this.width));
            if (fromX >= toX) return;

            ctx.fillStyle = area.color || 'rgba(56, 189, 248, 0.2)';
            ctx.beginPath();

            const step = (toX - fromX) / (this.isDragging ? 20 : 60);
            ctx.moveTo(this.mathToScreenX(fromX), this.mathToScreenY(area.bottomFn ? area.bottomFn(fromX) : 0));

            for (let x = fromX; x <= toX; x += step) {
                ctx.lineTo(this.mathToScreenX(x), this.mathToScreenY(area.topFn(x)));
            }
            ctx.lineTo(this.mathToScreenX(toX), this.mathToScreenY(area.topFn(toX)));

            for (let x = toX; x >= fromX; x -= step) {
                ctx.lineTo(this.mathToScreenX(x), this.mathToScreenY(area.bottomFn ? area.bottomFn(x) : 0));
            }

            ctx.closePath();
            ctx.fill();
        });
    }

    drawLayers() {
        if (!this.plotData.layers) return;
        const ctx = this.ctx;
        const pixelStep = this.isDragging ? 8 : 2;

        this.plotData.layers.forEach(layer => {
            if (layer.visible === false || typeof layer.fn !== 'function') return;

            ctx.strokeStyle = layer.color || '#38bdf8';
            ctx.lineWidth = layer.lineWidth || 2;
            ctx.setLineDash(layer.dash || []);

            ctx.beginPath();
            let isDrawing = false;
            let lastY = 0;

            for (let sx = 0; sx <= this.width; sx += pixelStep) {
                const mx = this.screenToMathX(sx);
                const my = layer.fn(mx);

                if (isNaN(my) || !isFinite(my)) {
                    isDrawing = false;
                    continue;
                }

                const sy = this.mathToScreenY(my);

                if (isDrawing && Math.abs(sy - lastY) > this.height * 0.9) {
                    isDrawing = false;
                }

                if (!isDrawing) {
                    ctx.moveTo(sx, sy);
                    isDrawing = true;
                } else {
                    ctx.lineTo(sx, sy);
                }
                lastY = sy;
            }
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }

    drawPoints() {
        const ctx = this.ctx;
        const visiblePoints = this.getVisiblePoints();

        visiblePoints.forEach(p => {
            const sx = this.mathToScreenX(p.x);
            const sy = this.mathToScreenY(p.y);
            if (sx < -20 || sx > this.width + 20 || sy < -20 || sy > this.height + 20) return;

            const isHovered = this.hoveredPoint && this.hoveredPoint.some(hp => Math.hypot(hp.x - p.x, hp.y - p.y) < 1e-5);
            const radius = isHovered ? 6 : 4.5;
            const color = p.color || '#38bdf8';

            if (isHovered) {
                ctx.fillStyle = color.startsWith('#') ? `${color}44` : 'rgba(56, 189, 248, 0.3)';
                ctx.beginPath();
                ctx.arc(sx, sy, radius + 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, Math.PI * 2);

            if (p.style === 'hollow') {
                ctx.fillStyle = '#0f172a';
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        });

        // 若当前鼠标/触控吸附在某条曲线上，渲染动态吸附追踪圆点
        if (this.hoveredCurve && !this.hoveredPoint) {
            const hc = this.hoveredCurve;
            const sx = this.mathToScreenX(hc.x);
            const sy = this.mathToScreenY(hc.y);
            const color = hc.layer.color || '#38bdf8';

            // 外发光光晕
            ctx.fillStyle = color.startsWith('#') ? `${color}44` : 'rgba(56, 189, 248, 0.3)';
            ctx.beginPath();
            ctx.arc(sx, sy, 8, 0, Math.PI * 2);
            ctx.fill();

            // 中心实心圆点与白色边框
            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }
}