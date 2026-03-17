/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

import { Vector3D } from './Vector3D.js';
import { Box } from './Box.js';

export class Container {
    constructor(width, height, depth, options = {}) {
        this.size = new Vector3D(width, height, depth);
        this.boxes = [];
        this.maxWeight = options.maxWeight !== undefined ? options.maxWeight : Infinity;
        this.currentWeight = 0;
        this.isPallet = options.isPallet || false;
        this.palletHeight = options.palletHeight || 0;
    }

    makeEmpty() {
        this.boxes = [];
        this.currentWeight = 0;
    }

    canHold(box) {
        // Boundary check
        if (box.position.x < -0.001
            || box.position.y < -0.001
            || box.position.z < -0.001
            || box.position.x + box.size.x > this.size.x + 0.001
            || box.position.y + box.size.y > this.size.y + 0.001
            || box.position.z + box.size.z > this.size.z + 0.001) {
            return false;
        }

        // Collision check
        if (this.boxes.some(b => Box.collide(box, b))) return false;

        // Weight check
        if (this.maxWeight !== Infinity && this.currentWeight + box.weight > this.maxWeight) {
            return false;
        }

        // Fragile boxes below check
        const TOL = 0.001;
        for (const b of this.boxes) {
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

        return true;
    }

    put(box) {
        this.boxes.push(box);
        this.currentWeight += box.weight || 0;
    }

    getStats() {
        const totalVolume = this.size.x * this.size.y * this.size.z;
        const usedVolume = this.boxes.reduce((sum, b) => sum + b.size.x * b.size.y * b.size.z, 0);
        const totalWeight = this.boxes.reduce((sum, b) => sum + (b.weight || 0), 0);
        return {
            utilization: (usedVolume / totalVolume * 100).toFixed(1),
            boxCount: this.boxes.length,
            totalWeight: totalWeight.toFixed(1)
        };
    }
}

export class Pallet extends Container {
    constructor(width, height, depth, deckHeight, maxWeight) {
        super(width, height - deckHeight, depth, { maxWeight, isPallet: true, palletHeight: deckHeight });
        this.deckHeight = deckHeight;
    }
}
