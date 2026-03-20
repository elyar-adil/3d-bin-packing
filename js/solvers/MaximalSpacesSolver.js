/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

import { BaseSolver }           from './BaseSolver.js';
import { Vector3D }             from '../models/Vector3D.js';
import { sortBoxesForPacking }  from '../utils/sorting.js';
import { gravityDrop, isSufficientlySupported } from '../utils/physics.js';

export class MaximalSpacesSolver extends BaseSolver {
    static getName()        { return '极大空间算法'; }
    static getDescription() { return '维护最大自由空间集合，装箱率最优'; }

    /**
     * Optional WebGPU dominance checker.
     * When set (by solver-worker.js or main.js), the dominance-filter step
     * runs on the GPU instead of CPU, allowing a much larger MAX_SPACES.
     * @type {import('../utils/GPUDominanceChecker.js').GPUDominanceChecker|null}
     */
    gpuChecker = null;

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
            { x: sx,       y: sy,       z: sz,       w: bx - sx,              h: sh,                   d: sd                   },
            { x: bx + bw,  y: sy,       z: sz,       w: sx + sw - (bx + bw),  h: sh,                   d: sd                   },
            { x: sx,       y: sy,       z: sz,       w: sw,                   h: by - sy,               d: sd                   },
            { x: sx,       y: by + bh,  z: sz,       w: sw,                   h: sy + sh - (by + bh),   d: sd                   },
            { x: sx,       y: sy,       z: sz,       w: sw,                   h: sh,                    d: bz - sz              },
            { x: sx,       y: sy,       z: bz + bd,  w: sw,                   h: sh,                    d: sz + sd - (bz + bd)  },
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

    /**
     * CPU dominance filter — O(m²).
     * Used when GPU is not available or the space count is small.
     */
    _filterCPU(spaces) {
        return spaces.filter((sp, _, arr) => !this._isDominated(sp, arr));
    }

    /**
     * Async solve() that uses GPU for the dominance filter when this.gpuChecker
     * is set.  Caller (solver-worker.js) awaits the returned promise.
     * When GPU is unavailable the method falls back to CPU and returns normally
     * (the promise resolves immediately).
     */
    solve() {
        // If GPU checker is attached, delegate to the async variant.
        if (this.gpuChecker) return this._solveAsync();
        return this._solveCPU();
    }

    _solveCPU() {
        const { container }  = this;
        // CPU: keep space list bounded to avoid O(m²) blowing up
        const MAX_SPACES = 200;
        const TOL        = 0.001;

        let freeSpaces = [{
            x: 0, y: 0, z: 0,
            w: container.size.x,
            h: container.size.y,
            d: container.size.z,
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
            // sorted by space volume ascending (smallest-fit-first heuristic).
            // If the top candidate fails physical checks (gravity + support +
            // collision) we try the next one rather than immediately giving up.
            const fitCandidates = [];
            for (let si = 0; si < freeSpaces.length; si++) {
                const sp = freeSpaces[si];
                for (const ori of validOrientations) {
                    box.orientation = ori;
                    const { x: bw, y: bh, z: bd } = box.size;
                    if (bw <= sp.w + TOL && bh <= sp.h + TOL && bd <= sp.d + TOL) {
                        const spVol = sp.w * sp.h * sp.d;
                        fitCandidates.push({ si, ori, spVol });
                    }
                }
            }
            fitCandidates.sort((a, b) => a.spVol - b.spVol);

            if (fitCandidates.length === 0) { unPackable.push(box); continue; }

            let placedSi = -1;
            for (const { si, ori } of fitCandidates) {
                const sp = freeSpaces[si];
                box.orientation = ori;
                box.position    = new Vector3D(sp.x, sp.y, sp.z);
                gravityDrop(box, container);
                // Gravity drop must not lift the box above the selected space's floor.
                if (box.position.y > sp.y) box.position.y = sp.y;
                if (!isSufficientlySupported(box, container)) continue;
                if (!container.canHold(box)) continue;
                placedSi = si;
                break;
            }

            if (placedSi === -1) { unPackable.push(box); continue; }

            container.put(box);

            const newSpaces = [];
            for (const s of freeSpaces) {
                if (this._intersects(box, s)) newSpaces.push(...this._split(s, box));
                else                          newSpaces.push(s);
            }

            let cleaned = this._filterCPU(newSpaces);
            if (cleaned.length > MAX_SPACES) {
                cleaned.sort((a, b) => (b.w * b.h * b.d) - (a.w * a.h * a.d));
                cleaned = cleaned.slice(0, MAX_SPACES);
            }
            freeSpaces = cleaned;
        }

        return unPackable;
    }

    /**
     * GPU-accelerated variant.
     * The dominance filter runs on the GPU, so we can raise MAX_SPACES to 2000,
     * giving significantly better packing quality on complex layouts.
     */
    async _solveAsync() {
        const { container }  = this;
        // GPU: larger space budget because the O(m²) dominance check is now cheap
        const MAX_SPACES = 2000;
        const TOL        = 0.001;

        let freeSpaces = [{
            x: 0, y: 0, z: 0,
            w: container.size.x,
            h: container.size.y,
            d: container.size.z,
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

            const fitCandidates = [];
            for (let si = 0; si < freeSpaces.length; si++) {
                const sp = freeSpaces[si];
                for (const ori of validOrientations) {
                    box.orientation = ori;
                    const { x: bw, y: bh, z: bd } = box.size;
                    if (bw <= sp.w + TOL && bh <= sp.h + TOL && bd <= sp.d + TOL) {
                        const spVol = sp.w * sp.h * sp.d;
                        fitCandidates.push({ si, ori, spVol });
                    }
                }
            }
            fitCandidates.sort((a, b) => a.spVol - b.spVol);

            if (fitCandidates.length === 0) { unPackable.push(box); continue; }

            let placedSi = -1;
            for (const { si, ori } of fitCandidates) {
                const sp = freeSpaces[si];
                box.orientation = ori;
                box.position    = new Vector3D(sp.x, sp.y, sp.z);
                gravityDrop(box, container);
                if (box.position.y > sp.y) box.position.y = sp.y;
                if (!isSufficientlySupported(box, container)) continue;
                if (!container.canHold(box)) continue;
                placedSi = si;
                break;
            }

            if (placedSi === -1) { unPackable.push(box); continue; }

            container.put(box);

            const newSpaces = [];
            for (const s of freeSpaces) {
                if (this._intersects(box, s)) newSpaces.push(...this._split(s, box));
                else                          newSpaces.push(s);
            }

            // GPU dominance filter (or CPU fallback if checker failed mid-session)
            let cleaned;
            try {
                const dominated = await this.gpuChecker.check(newSpaces);
                cleaned = newSpaces.filter((_, i) => !dominated[i]);
            } catch {
                cleaned = this._filterCPU(newSpaces);
            }

            if (cleaned.length > MAX_SPACES) {
                cleaned.sort((a, b) => (b.w * b.h * b.d) - (a.w * a.h * a.d));
                cleaned = cleaned.slice(0, MAX_SPACES);
            }
            freeSpaces = cleaned;
        }

        return unPackable;
    }
}
