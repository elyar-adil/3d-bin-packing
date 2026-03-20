/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

import { BaseSolver }           from './BaseSolver.js';
import { Vector3D }             from '../models/Vector3D.js';
import { sortBoxesForPacking }  from '../utils/sorting.js';
import { gravityDrop, isSufficientlySupported } from '../utils/physics.js';

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

    /**
     * Compact the newly placed box toward the origin (−X then −Z).
     *
     * Previous implementation stepped by 0.01 cm at a time, calling canHold()
     * on each micro-step — O(n × distance / 0.01) = potentially tens of thousands
     * of calls per box.
     *
     * New implementation:  O(n) — one pass over placed boxes per axis.
     * For each axis we compute the maximum "blocker edge" among all placed
     * boxes that overlap in the other two dimensions (including the fragile-
     * adjacency constraint). That edge is exactly the leftmost valid position;
     * no iteration required.
     */
    _moveBoxToShrink(box) {
        gravityDrop(box, this.container);

        const TOL    = 0.001;
        const origX  = box.position.x;
        const origZ  = box.position.z;
        const placed = this.container.boxes;

        // ── Compact in X ──────────────────────────────────────────────────────
        // A placed box b blocks us from moving left if it overlaps in Y-Z AND
        // its right edge is between 0 and our current position.
        // Also: a fragile box directly below (adjacent Y) with Z overlap blocks us.
        let minX = 0;
        for (const b of placed) {
            const yOvlp = box.position.y + box.size.y > b.position.y + TOL
                       && box.position.y              < b.position.y + b.size.y - TOL;
            const yAdj  = b.fragile
                       && Math.abs(box.position.y - (b.position.y + b.size.y)) < TOL;
            const zOvlp = box.position.z + box.size.z > b.position.z + TOL
                       && box.position.z              < b.position.z + b.size.z - TOL;

            if ((yOvlp || yAdj) && zOvlp) {
                const re = b.position.x + b.size.x;
                if (re > minX && re <= box.position.x + TOL) minX = re;
            }
        }
        box.position.x = minX;

        // ── Compact in Z (using updated X position) ───────────────────────────
        let minZ = 0;
        for (const b of placed) {
            const yOvlp = box.position.y + box.size.y > b.position.y + TOL
                       && box.position.y              < b.position.y + b.size.y - TOL;
            const yAdj  = b.fragile
                       && Math.abs(box.position.y - (b.position.y + b.size.y)) < TOL;
            const xOvlp = box.position.x + box.size.x > b.position.x + TOL
                       && box.position.x              < b.position.x + b.size.x - TOL;

            if ((yOvlp || yAdj) && xOvlp) {
                const fe = b.position.z + b.size.z;
                if (fe > minZ && fe <= box.position.z + TOL) minZ = fe;
            }
        }
        box.position.z = minZ;

        return origX - box.position.x > TOL || origZ - box.position.z > TOL;
    }

    solve() {
        let unPacked = sortBoxesForPacking(this.boxes.slice()).reverse();
        const candidates  = [new Vector3D(0, 0, 0)];
        const unPackable  = [];
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
                        xLimit  = box.size.x;
                    } else if (yLimit < this.container.size.y) {
                        // The preferred new-layer origin is blocked (e.g. another
                        // box sits at (0, yLimit, 0)).  Before abandoning the box,
                        // scan all existing candidate positions without the yLimit
                        // constraint — this catches spaces on top of already-placed
                        // boxes that the constrained loop above could not see.
                        for (let i = 0; i < candidates.length; i++) {
                            const c = candidates[i];
                            box.position = new Vector3D(c.x, c.y, c.z);
                            placed = this._orientBoxToFit(box);
                            if (placed) break;
                        }
                        if (!placed) {
                            xLimit = this.container.size.x;
                            yLimit = this.container.size.y;
                            unPacked.push(box);
                        }
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
                // After gravity settling and compaction, verify the box has
                // enough contact area below (≥ 50 % of base).  Unstable
                // placements are rejected rather than left as floating boxes.
                if (!isSufficientlySupported(box, this.container)) {
                    unPackable.push(box);
                    continue;
                }
                if (!moved) posIdx = null;
                this.container.put(box);
                this._updateCandidatePositions(candidates, box, posIdx);
            }
        }
        return unPackable;
    }
}
