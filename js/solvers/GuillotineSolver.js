/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

import { BaseSolver } from './BaseSolver.js';
import { Vector3D } from '../models/Vector3D.js';
import { sortBoxesForPacking } from '../utils/sorting.js';
import { gravityDrop } from '../utils/physics.js';

export class GuillotineSolver extends BaseSolver {
    static getName()        { return '断切算法'; }
    static getDescription() { return '基于空间切割的算法，空间利用率较高'; }

    solve() {
        const { container } = this;
        const TOL = 0.001;

        let freeSpaces = [{
            x: 0, y: 0, z: 0,
            w: container.size.x,
            h: container.size.y,
            d: container.size.z
        }];

        const sortedBoxes = sortBoxesForPacking(this.boxes.slice())
            .sort((a, b) => {
                const volA = a.sizeInAllOrientation.reduce((m, s) => Math.max(m, s.x * s.y * s.z), 0);
                const volB = b.sizeInAllOrientation.reduce((m, s) => Math.max(m, s.x * s.y * s.z), 0);
                return volB - volA;
            });

        const unPackable = [];

        for (const box of sortedBoxes) {
            let bestScore = Infinity, bestSpaceIdx = -1, bestOrientation = -1;
            const validOrientations = box.getValidOrientations();

            for (let si = 0; si < freeSpaces.length; si++) {
                const sp = freeSpaces[si];
                for (const ori of validOrientations) {
                    box.orientation = ori;
                    const { x: bw, y: bh, z: bd } = box.size;
                    if (bw <= sp.w + TOL && bh <= sp.h + TOL && bd <= sp.d + TOL) {
                        // Best Short Side Fit
                        const score = Math.min(sp.w - bw, sp.d - bd);
                        if (score < bestScore) {
                            bestScore = score;
                            bestSpaceIdx = si;
                            bestOrientation = ori;
                        }
                    }
                }
            }

            if (bestSpaceIdx === -1) { unPackable.push(box); continue; }

            const sp = freeSpaces[bestSpaceIdx];
            box.orientation = bestOrientation;
            box.position = new Vector3D(sp.x, sp.y, sp.z);
            gravityDrop(box, container);

            if (!container.canHold(box)) { unPackable.push(box); continue; }
            container.put(box);

            const { x: bw, y: bh, z: bd } = box.size;
            freeSpaces.splice(bestSpaceIdx, 1);

            // Generate 3 new sub-spaces
            if (sp.w - bw > TOL) freeSpaces.push({ x: sp.x + bw, y: sp.y, z: sp.z, w: sp.w - bw, h: sp.h, d: sp.d });
            if (sp.h - bh > TOL) freeSpaces.push({ x: sp.x, y: sp.y + bh, z: sp.z, w: bw,       h: sp.h - bh, d: sp.d });
            if (sp.d - bd > TOL) freeSpaces.push({ x: sp.x, y: sp.y,       z: sp.z + bd, w: bw,  h: bh,       d: sp.d - bd });
        }

        return unPackable;
    }
}
