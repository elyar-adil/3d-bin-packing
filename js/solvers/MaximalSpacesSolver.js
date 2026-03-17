/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

import { BaseSolver } from './BaseSolver.js';
import { Vector3D } from '../models/Vector3D.js';
import { sortBoxesForPacking } from '../utils/sorting.js';
import { gravityDrop } from '../utils/physics.js';

export class MaximalSpacesSolver extends BaseSolver {
    static getName()        { return '极大空间算法'; }
    static getDescription() { return '维护最大自由空间集合，装箱率最优'; }

    _intersects(box, sp) {
        const TOL = 0.001;
        const { x: bx, y: by, z: bz } = box.position;
        const { x: bw, y: bh, z: bd } = box.size;
        return bx < sp.x + sp.w - TOL && bx + bw > sp.x + TOL
            && by < sp.y + sp.h - TOL && by + bh > sp.y + TOL
            && bz < sp.z + sp.d - TOL && bz + bd > sp.z + TOL;
    }

    _split(sp, box) {
        const TOL = 0.001;
        const { x: bx, y: by, z: bz } = box.position;
        const { x: bw, y: bh, z: bd } = box.size;
        const { x: sx, y: sy, z: sz, w: sw, h: sh, d: sd } = sp;
        return [
            { x: sx,       y: sy,       z: sz,       w: bx - sx,            h: sh,         d: sd         },
            { x: bx + bw,  y: sy,       z: sz,       w: sx + sw - (bx + bw),h: sh,         d: sd         },
            { x: sx,       y: sy,       z: sz,       w: sw,                  h: by - sy,    d: sd         },
            { x: sx,       y: by + bh,  z: sz,       w: sw,                  h: sy + sh - (by + bh), d: sd },
            { x: sx,       y: sy,       z: sz,       w: sw,                  h: sh,         d: bz - sz    },
            { x: sx,       y: sy,       z: bz + bd,  w: sw,                  h: sh,         d: sz + sd - (bz + bd) }
        ].filter(c => c.w > TOL && c.h > TOL && c.d > TOL);
    }

    _isDominated(sp, others) {
        const TOL = 0.001;
        return others.some(o => o !== sp
            && o.x <= sp.x + TOL && o.y <= sp.y + TOL && o.z <= sp.z + TOL
            && o.x + o.w >= sp.x + sp.w - TOL
            && o.y + o.h >= sp.y + sp.h - TOL
            && o.z + o.d >= sp.z + sp.d - TOL);
    }

    solve() {
        const { container } = this;
        const MAX_SPACES = 200;
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
            let bestVol = Infinity, bestSpaceIdx = -1, bestOrientation = -1;
            const validOrientations = box.getValidOrientations();

            for (let si = 0; si < freeSpaces.length; si++) {
                const sp = freeSpaces[si];
                for (const ori of validOrientations) {
                    box.orientation = ori;
                    const { x: bw, y: bh, z: bd } = box.size;
                    if (bw <= sp.w + TOL && bh <= sp.h + TOL && bd <= sp.d + TOL) {
                        const spVol = sp.w * sp.h * sp.d;
                        if (spVol < bestVol) { bestVol = spVol; bestSpaceIdx = si; bestOrientation = ori; }
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

            // Split all intersecting spaces
            const newSpaces = [];
            for (const s of freeSpaces) {
                if (this._intersects(box, s)) {
                    newSpaces.push(...this._split(s, box));
                } else {
                    newSpaces.push(s);
                }
            }

            // Remove dominated spaces, then prune if needed
            let cleaned = newSpaces.filter((sp, _, arr) => !this._isDominated(sp, arr));
            if (cleaned.length > MAX_SPACES) {
                cleaned.sort((a, b) => (b.w * b.h * b.d) - (a.w * a.h * a.d));
                cleaned = cleaned.slice(0, MAX_SPACES);
            }
            freeSpaces = cleaned;
        }

        return unPackable;
    }
}
