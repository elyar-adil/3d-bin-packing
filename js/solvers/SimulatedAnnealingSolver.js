/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

import { BaseSolver } from './BaseSolver.js';
import { HeuristicSolver } from './HeuristicSolver.js';
import { sortBoxesForPacking } from '../utils/sorting.js';

export class SimulatedAnnealingSolver extends BaseSolver {
    static getName()        { return '模拟退火'; }
    static getDescription() { return '全局优化算法，装箱率最高但速度较慢'; }

    _evaluate(ordering, container) {
        container.makeEmpty();
        const solver = new HeuristicSolver(container, ordering);
        solver.boxes = ordering.slice();
        const unpacked = solver.solve();
        const usedVolume = container.boxes.reduce((sum, b) => sum + b.size.x * b.size.y * b.size.z, 0);
        return { unpackedCount: unpacked.length, usedVolume };
    }

    _isBetter(a, b) {
        if (a.unpackedCount !== b.unpackedCount) return a.unpackedCount < b.unpackedCount;
        return a.usedVolume > b.usedVolume;
    }

    solve() {
        const { container } = this;
        const totalVolume = container.size.x * container.size.y * container.size.z;

        let current = sortBoxesForPacking(this.boxes.slice());
        let currentResult = this._evaluate(current, container);
        let best = current.slice();
        let bestResult = { ...currentResult };

        const T_START = 1.0, T_END = 0.01, COOLING = 0.995, MAX_ITER = 300;
        let T = T_START;

        for (let iter = 0; iter < MAX_ITER; iter++) {
            const next = current.slice();
            const i = Math.floor(Math.random() * next.length);
            const j = Math.floor(Math.random() * next.length);
            [next[i], next[j]] = [next[j], next[i]];

            const nextResult = this._evaluate(next, container);
            const delta = (nextResult.unpackedCount - currentResult.unpackedCount) * 1000
                + (currentResult.usedVolume - nextResult.usedVolume) / totalVolume;

            if (delta <= 0 || Math.random() < Math.exp(-delta / T)) {
                current = next;
                currentResult = nextResult;
                if (this._isBetter(currentResult, bestResult)) {
                    best = current.slice();
                    bestResult = { ...currentResult };
                }
            }
            T = Math.max(T * COOLING, T_END);
        }

        container.makeEmpty();
        const finalSolver = new HeuristicSolver(container, best);
        finalSolver.boxes = best.slice();
        return finalSolver.solve();
    }
}
