/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/**
 * 3D spatial hash grid for fast box-box collision candidate lookup.
 *
 * Divides space into cubic cells of size `cellSize`. Each cell stores a Set
 * of boxes that intersect it. Querying for collision candidates returns only
 * boxes sharing at least one cell with the query volume — typically O(1)
 * instead of the O(n) linear scan.
 *
 * Key encoding uses packed integers (no string concatenation) for speed.
 * Supports containers up to 20 000 units with cellSize ≥ 1.
 */
export class SpatialGrid {
    /**
     * @param {number} cellSize  Side length of each grid cell (default 30 cm).
     *                           Choose ≈ the median box dimension for best performance.
     */
    constructor(cellSize = 30) {
        this._cs = cellSize;
        this._cells = new Map();
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /**
     * Compact numeric key for cell (ix, iy, iz).
     * Supports up to 1 000 cells per axis (= 30 000 cm / 30 cm cell).
     * Result fits within JS safe-integer range (< 2^53).
     */
    _key(ix, iy, iz) {
        // 1 000 000 * 1 000 = 1e9 < 2^53 – safe
        return ix * 1_000_000 + iy * 1_000 + iz;
    }

    /** Return [x0, y0, z0, x1, y1, z1] cell-index ranges for a box AABB. */
    _range(pos, size) {
        const cs = this._cs;
        const x0 = Math.floor(pos.x / cs);
        const y0 = Math.floor(pos.y / cs);
        const z0 = Math.floor(pos.z / cs);
        // Shrink upper bound by tiny epsilon so a box edge doesn't spill into the next cell
        const x1 = Math.floor((pos.x + size.x - 0.001) / cs);
        const y1 = Math.floor((pos.y + size.y - 0.001) / cs);
        const z1 = Math.floor((pos.z + size.z - 0.001) / cs);
        return [x0, y0, z0, x1, y1, z1];
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Register a placed box in the grid.
     * Must be called every time a box is added to the container.
     */
    add(box) {
        const [x0, y0, z0, x1, y1, z1] = this._range(box.position, box.size);
        for (let ix = x0; ix <= x1; ix++) {
            for (let iy = y0; iy <= y1; iy++) {
                for (let iz = z0; iz <= z1; iz++) {
                    const k = this._key(ix, iy, iz);
                    let cell = this._cells.get(k);
                    if (!cell) { cell = new Set(); this._cells.set(k, cell); }
                    cell.add(box);
                }
            }
        }
    }

    /**
     * Return a Set of placed boxes that share at least one grid cell with
     * the query volume (pos, size). Only these boxes can possibly collide.
     */
    getCandidates(pos, size) {
        const [x0, y0, z0, x1, y1, z1] = this._range(pos, size);
        const result = new Set();
        for (let ix = x0; ix <= x1; ix++) {
            for (let iy = y0; iy <= y1; iy++) {
                for (let iz = z0; iz <= z1; iz++) {
                    const cell = this._cells.get(this._key(ix, iy, iz));
                    if (cell) for (const b of cell) result.add(b);
                }
            }
        }
        return result;
    }

    /**
     * Return boxes that overlap the XZ footprint (pos, size) at ANY height
     * up to `maxY`. Used by gravityDrop to find support surfaces quickly.
     */
    getXZCandidates(pos, size, maxY) {
        const cs = this._cs;
        const x0 = Math.floor(pos.x / cs);
        const z0 = Math.floor(pos.z / cs);
        const x1 = Math.floor((pos.x + size.x - 0.001) / cs);
        const z1 = Math.floor((pos.z + size.z - 0.001) / cs);
        const yMax = Math.max(0, Math.floor((maxY - 0.001) / cs));
        const result = new Set();
        for (let ix = x0; ix <= x1; ix++) {
            for (let iy = 0; iy <= yMax; iy++) {
                for (let iz = z0; iz <= z1; iz++) {
                    const cell = this._cells.get(this._key(ix, iy, iz));
                    if (cell) for (const b of cell) result.add(b);
                }
            }
        }
        return result;
    }

    /** Remove all boxes from the grid (called on container.makeEmpty()). */
    clear() {
        this._cells.clear();
    }
}
