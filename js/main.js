/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

import {
    HeuristicSolver, GuillotineSolver, MaximalSpacesSolver, SimulatedAnnealingSolver,
    Box, Container, Pallet,
    BOX_PRESETS, CONTAINER_PRESETS, PALLET_PRESETS
} from './BinPackingSolver.js';

import { BoxViewer, RenderableBox, RenderableContainer, resetGroupColors } from './BoxViewer.js';
import { PanelManager }  from './ui/PanelManager.js';
import { StatsDisplay }  from './ui/StatsDisplay.js';
import { BoxTable }      from './ui/BoxTable.js';
import { Vector3D }      from './models/Vector3D.js';

// ─── Color palette (perceptually distinct, high-saturation colours) ────────────
const COLOR_PALETTE = [
    '#e6194b', '#3cb44b', '#4169e1', '#ff8c00', '#911eb4',
    '#00ced1', '#ff69b4', '#8db600', '#dc143c', '#00bfff',
    '#ff6347', '#7b68ee', '#20b2aa', '#ff1493', '#daa520',
    '#4682b4', '#d2691e', '#9400d3', '#228b22', '#ff4500',
];
let _colorIdx = 0;
const nextColor = () => COLOR_PALETTE[_colorIdx++ % COLOR_PALETTE.length];

// ─── App state ────────────────────────────────────────────────────────────────
let boxViewer, renderableContainer;
let appBoxes = [];
let currentContainerType = 'container';
let selectedAlgo = 'heuristic';
let panelManager, statsDisplay, boxTable;

// ─── Step playback state ──────────────────────────────────────────────────────
let _packedBoxes  = [];
let _currentStep  = 0;
let _playTimer    = null;
let _playInterval = 600;

// ─── GPU / Worker state ───────────────────────────────────────────────────────
let _gpuAvailable = false;

// ─── Bootstrap ────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    _initViewer();
    _initUI();
    applyContainer();
    await _detectGPU();
});

function _initViewer() {
    const canvas = document.getElementById('canvas');
    boxViewer = new BoxViewer(canvas);
    renderableContainer = new RenderableContainer(boxViewer);

    (function loop() {
        boxViewer.update();
        requestAnimationFrame(loop);
    })();

    new ResizeObserver(() => boxViewer && boxViewer.resize())
        .observe(document.getElementById('canvas-wrapper'));
}

function _initUI() {
    statsDisplay = new StatsDisplay();
    boxTable = new BoxTable(
        document.getElementById('box-table-body'),
        document.getElementById('box-count-badge')
    );
    panelManager = new PanelManager(document.getElementById('sidebar'));
    new PanelManager(document.getElementById('main-area'), {
        enableDrag: false,
        enableSidebarResize: false
    });
}

// ─── GPU detection ────────────────────────────────────────────────────────────
async function _detectGPU() {
    const badge = document.getElementById('gpu-badge');
    if (!badge) return;

    if (!navigator.gpu) {
        badge.textContent  = 'GPU: 不可用';
        badge.title        = 'WebGPU 不受支持（极大空间算法将使用 CPU）';
        badge.className    = 'gpu-badge gpu-off';
        return;
    }
    try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('no adapter');
        _gpuAvailable = true;
        badge.textContent = 'GPU: 已启用';
        badge.title       = 'WebGPU 可用 — 极大空间算法已启用 GPU 加速，空间上限从 200 提升至 2000';
        badge.className   = 'gpu-badge gpu-on';
    } catch {
        badge.textContent = 'GPU: 不可用';
        badge.className   = 'gpu-badge gpu-off';
    }
}

// ─── Container ────────────────────────────────────────────────────────────────
window.setContainerType = function(type) {
    currentContainerType = type;
    document.getElementById('btn-type-container').classList.toggle('active', type === 'container');
    document.getElementById('btn-type-pallet').classList.toggle('active', type === 'pallet');
    document.getElementById('container-presets-row').style.display = type === 'container' ? '' : 'none';
    document.getElementById('pallet-presets-row').style.display    = type === 'pallet'    ? '' : 'none';
    document.getElementById('deck-height-row').style.display       = type === 'pallet'    ? '' : 'none';

    if (type === 'pallet') {
        document.getElementById('pallet-preset').value = 'EUR';
        applyPalletPreset();
    } else {
        document.getElementById('container-preset').value = '';
    }
};

window.applyContainerPreset = function() {
    const idx = document.getElementById('container-preset').value;
    if (idx === '') return;
    const p = CONTAINER_PRESETS[parseInt(idx)];
    document.getElementById('cont-w').value         = p.width;
    document.getElementById('cont-h').value         = p.height;
    document.getElementById('cont-d').value         = p.depth;
    document.getElementById('cont-maxweight').value = p.maxWeight || 30000;
    applyContainer();
};

window.applyPalletPreset = function() {
    const key = document.getElementById('pallet-preset').value;
    if (!key) return;
    const p = PALLET_PRESETS[key];
    document.getElementById('cont-w').value         = p.width;
    document.getElementById('cont-h').value         = p.height;
    document.getElementById('cont-d').value         = p.depth;
    document.getElementById('cont-deck-h').value    = p.deckHeight;
    document.getElementById('cont-maxweight').value = p.maxWeight;
    applyContainer();
};

window.applyContainer = function applyContainer() {
    const w         = parseFloat(document.getElementById('cont-w').value)         || 300;
    const h         = parseFloat(document.getElementById('cont-h').value)         || 250;
    const d         = parseFloat(document.getElementById('cont-d').value)         || 250;
    const maxWeight = parseFloat(document.getElementById('cont-maxweight').value) || Infinity;
    const isPallet  = currentContainerType === 'pallet';
    const deckH     = isPallet ? (parseFloat(document.getElementById('cont-deck-h').value) || 0) : 0;
    const interiorH = isPallet ? Math.max(1, h - deckH) : h;

    renderableContainer.makeEmpty();
    renderableContainer.changeSize(w, interiorH, d, { isPallet, palletHeight: deckH, maxWeight });
};

// ─── Box presets ──────────────────────────────────────────────────────────────
window.applyBoxPreset = function() {
    const idx = document.getElementById('box-preset').value;
    if (idx === '') return;
    const p = BOX_PRESETS[parseInt(idx)];
    document.getElementById('box-w').value       = p.width;
    document.getElementById('box-h').value       = p.height;
    document.getElementById('box-d').value       = p.depth;
    document.getElementById('box-weight').value  = p.weight || 0;
    document.getElementById('box-maxwtop').value = p.maxWeightOnTop || 0;
    document.getElementById('box-label').value   = p.label || '';
};

// ─── Add boxes ────────────────────────────────────────────────────────────────
window.addBoxes = function() {
    const w   = parseFloat(document.getElementById('box-w').value);
    const h   = parseFloat(document.getElementById('box-h').value);
    const d   = parseFloat(document.getElementById('box-d').value);
    const qty = parseInt(document.getElementById('box-qty').value) || 1;

    if (!w || !h || !d || w <= 0 || h <= 0 || d <= 0) {
        alert('请输入有效的箱子尺寸');
        return;
    }

    const opts = {
        weight:                parseFloat(document.getElementById('box-weight').value) || 0,
        maxWeightOnTop:        parseFloat(document.getElementById('box-maxwtop').value),
        fragile:               document.getElementById('box-fragile').checked,
        orientationConstraint: document.getElementById('box-orientation').value,
        group:                 document.getElementById('box-group').value.trim() || null,
        isolated:              document.getElementById('box-isolated').checked,
        label:                 document.getElementById('box-label').value.trim()
    };
    if (isNaN(opts.maxWeightOnTop)) opts.maxWeightOnTop = Infinity;
    if (!opts.label) opts.label = `${w}×${h}×${d}`;

    const color = nextColor();

    for (let i = 0; i < qty; i++) {
        const box = new RenderableBox(color, boxViewer, w, h, d, opts);
        box.visible = false;
        appBoxes.push(box);
    }

    boxTable.addRow(color, w, h, d, qty, opts.weight, opts, (deletedQty) => {
        const removed = appBoxes.splice(appBoxes.length - deletedQty, deletedQty);
        removed.forEach(b => b.removeFromScene());
        boxTable.updateBadge(appBoxes.length);
    });

    boxTable.updateBadge(appBoxes.length);
};

// ─── Clear all ────────────────────────────────────────────────────────────────
window.clearAllBoxes = function(event) {
    if (event) event.stopPropagation();
    appBoxes.forEach(b => b.removeFromScene());
    appBoxes = [];
    boxTable.clearAll();
    boxTable.updateBadge(0);
    resetGroupColors();
    _colorIdx = 0;
    renderableContainer.makeEmpty();
    statsDisplay.update(null);
};

// ─── Constraints toggle ───────────────────────────────────────────────────────
window.toggleConstraints = function() {
    const panel = document.getElementById('constraints-panel');
    const btn   = document.getElementById('constraints-toggle-btn');
    const open  = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : '';
    btn.innerHTML = (open ? '&#9656;' : '&#9662;') + ' 高级约束设置';
};

// ─── Algorithm selection ──────────────────────────────────────────────────────
window.selectAlgo = function(key, el) {
    selectedAlgo = key;
    document.querySelectorAll('.algo-option').forEach(o => {
        o.classList.remove('selected');
        o.querySelector('input[type=radio]').checked = false;
    });
    el.classList.add('selected');
    el.querySelector('input[type=radio]').checked = true;
};

// ─── Worker helpers ───────────────────────────────────────────────────────────

/** Serialise a Box (or RenderableBox) into a plain data object for the worker. */
function _serializeBox(box, index) {
    return {
        index,
        w:                     box._w,
        h:                     box._h,
        d:                     box._d,
        weight:                box.weight,
        maxWeightOnTop:        box.maxWeightOnTop,
        fragile:               box.fragile,
        orientationConstraint: box.orientationConstraint,
        group:                 box.group,
        isolated:              box.isolated,
        label:                 box.label,
    };
}

/** Serialise container dimensions for the worker. */
function _serializeContainer(c) {
    return {
        width:        c.size.x,
        height:       c.size.y,
        depth:        c.size.z,
        maxWeight:    c.maxWeight,
        isPallet:     c.isPallet,
        palletHeight: c.palletHeight,
    };
}

/** Spawn one solver worker and return its result as a Promise. */
function _runWorker(solverType, boxData, containerData, workerId) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(
            new URL('./workers/solver-worker.js', import.meta.url),
            { type: 'module' }
        );
        worker.onmessage = ({ data }) => {
            if (data.type === 'result') {
                worker.terminate();
                resolve(data);
            }
        };
        worker.onerror = (e) => { worker.terminate(); reject(e); };
        worker.postMessage({ type: 'solve', solverType, boxes: boxData, containerData, workerId });
    });
}

/**
 * Run the chosen solver via Web Worker(s).
 * For Simulated Annealing, run N parallel chains and take the best result.
 *
 * @returns {Promise<{packed, unpacked}>}
 */
async function _solveViaWorkers(solverType, appBoxes, container) {
    const boxData       = appBoxes.map((b, i) => _serializeBox(b, i));
    const containerData = _serializeContainer(container);

    if (solverType !== 'annealing') {
        // Single worker for deterministic solvers
        return _runWorker(solverType, boxData, containerData, 0);
    }

    // Parallel SA chains — one per logical CPU core (capped at 8)
    const cores = Math.min(Math.max(navigator.hardwareConcurrency || 4, 2), 8);
    const tasks = Array.from({ length: cores }, (_, i) =>
        _runWorker('annealing', boxData, containerData, i)
    );
    const results = await Promise.all(tasks);

    // Pick the chain that packed the most boxes (tie-break: more total volume)
    return results.reduce((best, cur) => {
        if (cur.packed.length > best.packed.length) return cur;
        if (cur.packed.length === best.packed.length
            && cur.packed.length > 0) return cur; // both equal, keep first
        return best;
    });
}

/** Apply worker result to the renderable container and boxes. */
function _applyWorkerResult(result, container, appBoxes) {
    container.makeEmpty();
    for (const item of result.packed) {
        const box = appBoxes[item.boxIndex];
        box.orientation = item.orientation;
        box.position    = new Vector3D(item.position.x, item.position.y, item.position.z);
        container.put(box);
    }
    return result.unpacked;
}

// ─── Solve ────────────────────────────────────────────────────────────────────
window.doSolve = async function() {
    if (appBoxes.length === 0) { alert('请先添加箱子'); return; }

    const btn     = document.getElementById('solve-button');
    const spinner = document.getElementById('spinner');
    const icon    = document.getElementById('solve-icon');
    const overlay = document.getElementById('spinner-overlay');
    const alertEl = document.getElementById('unpacked-alert');

    btn.disabled          = true;
    spinner.style.display = 'inline-block';
    icon.style.display    = 'none';
    overlay.classList.add('active');
    alertEl.style.display = 'none';
    appBoxes.forEach(b => { b.visible = false; });
    renderableContainer.makeEmpty();

    try {
        const result   = await _solveViaWorkers(selectedAlgo, appBoxes, renderableContainer);
        const unpacked = _applyWorkerResult(result, renderableContainer, appBoxes);

        _packedBoxes = renderableContainer.boxes.slice();
        _stopPlay();
        _currentStep = 0;
        _packedBoxes.forEach(b => { b.visible = false; });

        _updateStepControls();
        statsDisplay.update(renderableContainer.getStats(), appBoxes.length);

        if (_packedBoxes.length > 0) {
            setTimeout(() => togglePlay(), 120);
        }

        if (unpacked.length > 0) {
            alertEl.style.display = 'block';
            document.getElementById('unpacked-msg').textContent =
                `${unpacked.length} 个箱子无法放入容器`;
        }
    } catch (e) {
        console.error('Solve error:', e);
        // Fallback: run synchronously on main thread
        try {
            _solveSync();
        } catch (e2) {
            alert('求解出错: ' + e2.message);
        }
    } finally {
        btn.disabled          = false;
        spinner.style.display = 'none';
        icon.style.display    = '';
        overlay.classList.remove('active');
    }
};

/** Synchronous fallback (used when Web Workers are blocked or fail). */
function _solveSync() {
    const solverMap = {
        heuristic:  HeuristicSolver,
        guillotine: GuillotineSolver,
        maxspaces:  MaximalSpacesSolver,
        annealing:  SimulatedAnnealingSolver
    };
    const SolverClass = solverMap[selectedAlgo] || HeuristicSolver;
    const unpacked    = new SolverClass(renderableContainer, appBoxes).solve();

    _packedBoxes = renderableContainer.boxes.slice();
    _stopPlay();
    _currentStep = 0;
    _packedBoxes.forEach(b => { b.visible = false; });

    _updateStepControls();
    statsDisplay.update(renderableContainer.getStats(), appBoxes.length);

    if (_packedBoxes.length > 0) setTimeout(() => togglePlay(), 120);

    if (unpacked.length > 0) {
        const alertEl = document.getElementById('unpacked-alert');
        alertEl.style.display = 'block';
        document.getElementById('unpacked-msg').textContent =
            `${unpacked.length} 个箱子无法放入容器`;
    }
}

// ─── Step control helpers ─────────────────────────────────────────────────────
function _applyStep(n) {
    const total = _packedBoxes.length;
    n = Math.max(0, Math.min(total, n));
    for (let i = 0; i < total; i++) {
        _packedBoxes[i].visible = i < n;
    }
    _currentStep = n;
    _updateStepControls();
}

function _updateStepControls() {
    const total = _packedBoxes.length;
    const ctrl  = document.getElementById('step-controls');
    if (!ctrl) return;

    const hasResult = total > 0;
    ctrl.style.display = hasResult ? 'flex' : 'none';

    document.getElementById('step-slider').max   = total;
    document.getElementById('step-slider').value = _currentStep;
    document.getElementById('step-label').textContent = `${_currentStep} / ${total}`;

    document.getElementById('btn-step-first').disabled = _currentStep === 0;
    document.getElementById('btn-step-prev').disabled  = _currentStep === 0;
    document.getElementById('btn-step-next').disabled  = _currentStep === total;
    document.getElementById('btn-step-last').disabled  = _currentStep === total;
}

function _stopPlay() {
    if (_playTimer !== null) {
        clearInterval(_playTimer);
        _playTimer = null;
    }
    const btn = document.getElementById('btn-step-play');
    if (btn) btn.textContent = '▶';
}

window.stepFirst = function() { _stopPlay(); _applyStep(0); };
window.stepPrev  = function() { _stopPlay(); _applyStep(_currentStep - 1); };
window.stepNext  = function() { _stopPlay(); _applyStep(_currentStep + 1); };
window.stepLast  = function() { _stopPlay(); _applyStep(_packedBoxes.length); };

window.togglePlay = function() {
    if (_playTimer !== null) { _stopPlay(); return; }
    if (_currentStep >= _packedBoxes.length) _applyStep(0);
    document.getElementById('btn-step-play').textContent = '⏸';
    _playTimer = setInterval(() => {
        if (_currentStep >= _packedBoxes.length) _stopPlay();
        else _applyStep(_currentStep + 1);
    }, _playInterval);
};

window.onStepSlider = function(val) { _stopPlay(); _applyStep(parseInt(val)); };

window.onSpeedChange = function(val) {
    _playInterval = parseInt(val);
    document.getElementById('speed-label').textContent = val + 'ms';
};
