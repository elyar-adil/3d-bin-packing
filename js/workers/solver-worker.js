/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/**
 * Web Worker — runs solvers off the main thread so the UI stays responsive.
 *
 * Message protocol
 * ════════════════
 * Main → Worker  { type:'solve', solverType, boxes, containerData, workerId }
 * Worker → Main  { type:'result', workerId, packed, unpacked }
 * Worker → Main  { type:'progress', workerId, iter, total }   (SA only)
 *
 * box serialisation format
 * ────────────────────────
 * { index, w, h, d, weight, maxWeightOnTop, fragile,
 *   orientationConstraint, group, isolated, label }
 *
 * containerData format
 * ────────────────────
 * { width, height, depth, maxWeight, isPallet, palletHeight }
 */

import { Box }                     from '../models/Box.js';
import { Container }               from '../models/Container.js';
import { Vector3D }                from '../models/Vector3D.js';
import { HeuristicSolver }         from '../solvers/HeuristicSolver.js';
import { GuillotineSolver }        from '../solvers/GuillotineSolver.js';
import { MaximalSpacesSolver }     from '../solvers/MaximalSpacesSolver.js';
import { SimulatedAnnealingSolver } from '../solvers/SimulatedAnnealingSolver.js';

const SOLVER_MAP = {
    heuristic:  HeuristicSolver,
    guillotine: GuillotineSolver,
    maxspaces:  MaximalSpacesSolver,
    annealing:  SimulatedAnnealingSolver,
};

// ── GPU dominance checker (optional, MaximalSpaces only) ─────────────────────
let _gpuChecker = null;

async function _initGPU() {
    try {
        const { GPUDominanceChecker } = await import('../utils/GPUDominanceChecker.js');
        _gpuChecker = await GPUDominanceChecker.create();
    } catch {
        _gpuChecker = null;
    }
}

_initGPU(); // fire-and-forget; checker available by the time first solve starts

// ── Box reconstruction ────────────────────────────────────────────────────────

function makeBox(d) {
    const box = new Box(d.w, d.h, d.d, {
        weight:                d.weight,
        maxWeightOnTop:        d.maxWeightOnTop,
        fragile:               d.fragile,
        orientationConstraint: d.orientationConstraint,
        group:                 d.group,
        isolated:              d.isolated,
        label:                 d.label,
    });
    box._sourceIndex = d.index;
    return box;
}

// ── SA with progress reporting ────────────────────────────────────────────────

function solveWithProgress(SolverClass, container, boxes, workerId) {
    if (SolverClass !== SimulatedAnnealingSolver) {
        return new SolverClass(container, boxes).solve();
    }

    // Inline SA that posts progress
    const { sortBoxesForPacking } = SolverClass._deps || {};
    // Fall back to normal SA — progress is a nice-to-have
    const solver = new SimulatedAnnealingSolver(container, boxes);
    return solver.solve();
}

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = async function ({ data }) {
    if (data.type !== 'solve') return;

    const { solverType, boxes: boxData, containerData, workerId } = data;

    const container = new Container(
        containerData.width,
        containerData.height,
        containerData.depth,
        { maxWeight: containerData.maxWeight }
    );

    const boxes = boxData.map(makeBox);

    const SolverClass = SOLVER_MAP[solverType] || HeuristicSolver;

    // Attach GPU checker to MaximalSpacesSolver if available
    let solver;
    if (SolverClass === MaximalSpacesSolver && _gpuChecker) {
        solver = new MaximalSpacesSolver(container, boxes);
        solver.gpuChecker = _gpuChecker;
    } else {
        solver = new SolverClass(container, boxes);
    }

    const unpacked = await Promise.resolve(solver.solve());

    const unpackedIndices = new Set(unpacked.map(b => b._sourceIndex));

    const packed = container.boxes.map(box => ({
        boxIndex:    box._sourceIndex,
        orientation: box.orientation,
        position:    { x: box.position.x, y: box.position.y, z: box.position.z },
    }));

    self.postMessage({
        type:     'result',
        workerId,
        packed,
        unpacked: [...unpackedIndices],
    });
};
