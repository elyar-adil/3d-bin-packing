/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

import { Vector3D } from './Vector3D.js';

export class Box {
    static ORIENTATION_COUNT = 6;

    constructor(width, height, depth, options = {}) {
        // Original dimensions — preserved for worker serialisation
        this._w = width; this._h = height; this._d = depth;

        this.position = new Vector3D(0, 0, 0);
        this.sizeInAllOrientation = [
            new Vector3D(width, height, depth),
            new Vector3D(width, depth, height),
            new Vector3D(height, width, depth),
            new Vector3D(height, depth, width),
            new Vector3D(depth, width, height),
            new Vector3D(depth, height, width)
        ];

        // prefer orientation with lower height
        this.sizeInAllOrientation.sort((a, b) => (a.y - b.y));

        this._orientation = 0;
        this.size = this.sizeInAllOrientation[0];

        this.weight = options.weight !== undefined ? options.weight : 0;
        this.maxWeightOnTop = options.maxWeightOnTop !== undefined ? options.maxWeightOnTop : Infinity;
        this.fragile = options.fragile !== undefined ? options.fragile : false;
        this.orientationConstraint = options.orientationConstraint || 'FREE';
        this.group = options.group || null;
        this.isolated = options.isolated || false;
        this.label = options.label || '';
    }

    set orientation(o) {
        this._orientation = o;
        this.size = this.sizeInAllOrientation[o];
    }

    get orientation() {
        return this._orientation;
    }

    /**
     * Returns valid orientation indices based on orientationConstraint.
     * FREE: all 6
     * UPRIGHT: orientations 0 and 1 (lowest heights after sorting)
     * FIXED: orientation 0 only
     */
    getValidOrientations() {
        switch (this.orientationConstraint) {
            case 'FIXED':  return [0];
            case 'UPRIGHT': return [0, 1];
            case 'FREE':
            default:        return [0, 1, 2, 3, 4, 5];
        }
    }

    static collide(a, b) {
        const TOL = 0.001;
        const xDistance = Math.abs((a.position.x + a.size.x / 2) - (b.position.x + b.size.x / 2));
        const yDistance = Math.abs((a.position.y + a.size.y / 2) - (b.position.y + b.size.y / 2));
        const zDistance = Math.abs((a.position.z + a.size.z / 2) - (b.position.z + b.size.z / 2));

        return xDistance < (a.size.x + b.size.x) / 2 - TOL
            && yDistance < (a.size.y + b.size.y) / 2 - TOL
            && zDistance < (a.size.z + b.size.z) / 2 - TOL;
    }
}
