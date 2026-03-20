/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

import { BaseSolver } from './BaseSolver.js';
import { Vector3D } from '../models/Vector3D.js';
import { sortBoxesForPacking } from '../utils/sorting.js';
import { gravityDrop, isSufficientlySupported } from '../utils/physics.js';

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
            const validOrientations = box.getValidOrientations();

            // Collect all (space, orientation) pairs that geometrically fit,
            // sorted by Best Short Side Fit score so the preferred space is tried
            // first.  If that space fails physical checks (gravity + support +
            // collision), we fall through to the next candidate instead of
            // immediately marking the box as unpackable.
            const fitCandidates = [];
            for (let si = 0; si < freeSpaces.length; si++) {
                const sp = freeSpaces[si];
                for (const ori of validOrientations) {
                    box.orientation = ori;
                    const { x: bw, y: bh, z: bd } = box.size;
                    if (bw <= sp.w + TOL && bh <= sp.h + TOL && bd <= sp.d + TOL) {
                        const score = Math.min(sp.w - bw, sp.d - bd);
                        fitCandidates.push({ si, ori, score });
                    }
                }
            }
            fitCandidates.sort((a, b) => a.score - b.score);

            if (fitCandidates.length === 0) { unPackable.push(box); continue; }

            let placedSi = -1;
            for (const { si, ori } of fitCandidates) {
                const sp = freeSpaces[si];
                box.orientation = ori;
                box.position = new Vector3D(sp.x, sp.y, sp.z);
                gravityDrop(box, container);
                if (!isSufficientlySupported(box, container)) continue;
                if (!container.canHold(box)) continue;
                placedSi = si;
                break;
            }

            if (placedSi === -1) { unPackable.push(box); continue; }

            container.put(box);

            const sp = freeSpaces[placedSi];
            const { x: bw, y: bh, z: bd } = box.size;
            freeSpaces.splice(placedSi, 1);

            // Generate 3 new sub-spaces
            if (sp.w - bw > TOL) freeSpaces.push({ x: sp.x + bw, y: sp.y, z: sp.z, w: sp.w - bw, h: sp.h, d: sp.d });
            if (sp.h - bh > TOL) freeSpaces.push({ x: sp.x, y: sp.y + bh, z: sp.z, w: bw,       h: sp.h - bh, d: sp.d });
            if (sp.d - bd > TOL) freeSpaces.push({ x: sp.x, y: sp.y,       z: sp.z + bd, w: bw,  h: bh,       d: sp.d - bd });
        }

        return unPackable;
    }
}
