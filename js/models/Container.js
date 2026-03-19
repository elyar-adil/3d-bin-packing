/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

import { Vector3D }    from './Vector3D.js';
import { Box }         from './Box.js';
import { SpatialGrid } from '../utils/SpatialGrid.js';

export class Container {
    constructor(width, height, depth, options = {}) {
        this.size         = new Vector3D(width, height, depth);
        this.boxes        = [];
        this.maxWeight    = options.maxWeight !== undefined ? options.maxWeight : Infinity;
        this.currentWeight = 0;
        this.isPallet     = options.isPallet  || false;
        this.palletHeight = options.palletHeight || 0;

        // Spatial grid: cell size ≈ 30 cm gives good trade-off for typical shipping
        // containers (300–600 cm) and standard box sizes (20–80 cm).
        this._grid = new SpatialGrid(30);
    }

    makeEmpty() {
        this.boxes         = [];
        this.currentWeight = 0;
        this._grid.clear();
    }

    canHold(box) {
        const TOL = 0.001;

        // ── 1. Boundary check ──────────────────────────────────────────────────
        if (box.position.x < -TOL
            || box.position.y < -TOL
            || box.position.z < -TOL
            || box.position.x + box.size.x > this.size.x + TOL
            || box.position.y + box.size.y > this.size.y + TOL
            || box.position.z + box.size.z > this.size.z + TOL) {
            return false;
        }

        // ── 2. Collision check (spatial-grid accelerated) ──────────────────────
        // getCandidates returns only boxes sharing a grid cell — far fewer than n.
        const candidates = this._grid.getCandidates(box.position, box.size);
        for (const b of candidates) {
            if (Box.collide(box, b)) return false;
        }

        // ── 3. Weight check ────────────────────────────────────────────────────
        if (this.maxWeight !== Infinity
            && this.currentWeight + (box.weight || 0) > this.maxWeight) {
            return false;
        }

        // ── 4. Fragile-box-below check ─────────────────────────────────────────
        // Use the grid to fetch only boxes in the XZ column at box.position.y level.
        // We need boxes whose top surface is exactly at box.position.y (adjacent).
        // Query a thin slab at Y = box.position.y.
        if (this.boxes.length > 0) {
            const slabPos  = { x: box.position.x, y: box.position.y - TOL, z: box.position.z };
            const slabSize = { x: box.size.x,     y: 2 * TOL,              z: box.size.z     };
            const slabCandidates = this._grid.getCandidates(slabPos, slabSize);
            for (const b of slabCandidates) {
                if (!b.fragile) continue;
                const bTop = b.position.y + b.size.y;
                if (Math.abs(bTop - box.position.y) < TOL) {
                    const xOverlap = box.position.x < b.position.x + b.size.x - TOL
                                  && box.position.x + box.size.x > b.position.x + TOL;
                    const zOverlap = box.position.z < b.position.z + b.size.z - TOL
                                  && box.position.z + box.size.z > b.position.z + TOL;
                    if (xOverlap && zOverlap) return false;
                }
            }
        }

        return true;
    }

    put(box) {
        this.boxes.push(box);
        this.currentWeight += box.weight || 0;
        this._grid.add(box);
    }

    getStats() {
        const totalVolume = this.size.x * this.size.y * this.size.z;
        const usedVolume  = this.boxes.reduce((s, b) => s + b.size.x * b.size.y * b.size.z, 0);
        const totalWeight = this.boxes.reduce((s, b) => s + (b.weight || 0), 0);
        return {
            utilization: (usedVolume / totalVolume * 100).toFixed(1),
            boxCount:    this.boxes.length,
            totalWeight: totalWeight.toFixed(1),
        };
    }
}

export class Pallet extends Container {
    constructor(width, height, depth, deckHeight, maxWeight) {
        super(width, height - deckHeight, depth, { maxWeight, isPallet: true, palletHeight: deckHeight });
        this.deckHeight = deckHeight;
    }
}
