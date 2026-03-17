/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

import { BaseSolver } from './BaseSolver.js';
import { Vector3D } from '../models/Vector3D.js';
import { sortBoxesForPacking } from '../utils/sorting.js';
import { gravityDrop } from '../utils/physics.js';

export class HeuristicSolver extends BaseSolver {
    static getName()        { return '启发式贪心'; }
    static getDescription() { return '快速启发式算法，适合大多数场景'; }

    _orientBoxToFit(box, xLimit, yLimit) {
        for (const i of box.getValidOrientations()) {
            box.orientation = i;
            if (this.container.canHold(box)
                && (xLimit == null || box.size.x + box.position.x <= xLimit + 0.001)
                && (yLimit == null || box.size.y + box.position.y <= yLimit + 0.001)) {
                return true;
            }
        }
        return false;
    }

    _updateCandidatePositions(positions, box, removedIndex) {
        if (removedIndex != null) positions.splice(removedIndex, 1);
        positions.push(new Vector3D(box.position.x + box.size.x, box.position.y, box.position.z));
        positions.push(new Vector3D(box.position.x, box.position.y + box.size.y, box.position.z));
        positions.push(new Vector3D(box.position.x, box.position.y, box.position.z + box.size.z));
    }

    _moveBoxToShrink(box) {
        gravityDrop(box, this.container);
        let anyMovement = false;
        let boxMoved;
        do {
            let moveCount = 0;
            while (this.container.canHold(box)) { box.position.x -= 0.01; moveCount++; }
            box.position.x += 0.01; moveCount--;
            while (this.container.canHold(box)) { box.position.z -= 0.01; moveCount++; }
            box.position.z += 0.01; moveCount--;
            boxMoved = moveCount !== 0;
            if (boxMoved) anyMovement = true;
        } while (boxMoved);
        return anyMovement;
    }

    solve() {
        let unPacked = sortBoxesForPacking(this.boxes.slice()).reverse();
        const candidates = [new Vector3D(0, 0, 0)];
        const unPackable = [];
        let xLimit = 0, yLimit = 0;

        while (unPacked.length > 0) {
            const box = unPacked.pop();
            let placed = false;
            let posIdx = 0;

            candidates.sort((a, b) => {
                if (a.y !== b.y) return a.y - b.y;
                if (a.z !== b.z) return a.z - b.z;
                return a.x - b.x;
            });

            for (posIdx = 0; posIdx < candidates.length; posIdx++) {
                const c = candidates[posIdx];
                box.position = new Vector3D(c.x, c.y, c.z);
                placed = this._orientBoxToFit(box, xLimit, yLimit);
                if (placed) break;
            }

            if (!placed) {
                posIdx = null;
                if (xLimit === 0 || xLimit >= this.container.size.x - 0.001) {
                    box.position = new Vector3D(0, yLimit, 0);
                    placed = this._orientBoxToFit(box);
                    if (placed) {
                        yLimit += box.size.y;
                        xLimit = box.size.x;
                    } else if (yLimit < this.container.size.y) {
                        xLimit = this.container.size.x;
                        yLimit = this.container.size.y;
                        unPacked.push(box);
                    }
                } else {
                    for (posIdx = 0; posIdx < candidates.length; posIdx++) {
                        const p = candidates[posIdx];
                        if (Math.abs(p.x - xLimit) < 0.001 && p.z < 0.001) {
                            box.position = new Vector3D(p.x, p.y, p.z);
                            placed = this._orientBoxToFit(box, null, yLimit);
                            if (placed) xLimit = Math.min(xLimit + box.size.x, this.container.size.x);
                        }
                    }
                    if (!placed) { xLimit = this.container.size.x; unPacked.push(box); }
                }
            }

            if (xLimit >= this.container.size.x - 0.001
                && yLimit >= this.container.size.y - 0.001
                && !placed) {
                unPackable.push(box);
                continue;
            }

            if (placed) {
                const moved = this._moveBoxToShrink(box);
                if (!moved) posIdx = null;
                this.container.put(box);
                this._updateCandidatePositions(candidates, box, posIdx);
            }
        }
        return unPackable;
    }
}
