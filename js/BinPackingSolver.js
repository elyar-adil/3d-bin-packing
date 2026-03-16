/*
    "Commons Clause" License Condition v1.0

    The Software is provided to you by the Licensor under the License,
    as defined below, subject to the following condition.

    Without limiting other conditions in the License, the grant of rights
    under the License will not include, and the License does not grant to
    you, the right to Sell the Software.

    For purposes of the foregoing, "Sell" means practicing any or all of
    the rights granted to you under the License to provide to third
    parties, for a fee or other consideration (including without limitation
    fees for hosting or consulting/ support services related to the
    Software), a product or service whose value derives, entirely or
    substantially, from the functionality of the Software. Any license notice
    or attribution required by the License must also include this Commons
    Clause License Condition notice.

    License: GPL-3.0
    Licensor: Elyar Adil
*/

class Vector3D {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

class Box {
    static ORIENTATION_COUNT = 6;

    constructor(width, height, depth, options = {}) {
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

        // New fields
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
     * UPRIGHT: orientations 0 and 1 (the two that keep original Y-axis up,
     *          which after sorting are the ones with lowest heights)
     * FIXED: orientation 0 only
     */
    getValidOrientations() {
        switch (this.orientationConstraint) {
            case 'FIXED':
                return [0];
            case 'UPRIGHT':
                return [0, 1];
            case 'FREE':
            default:
                return [0, 1, 2, 3, 4, 5];
        }
    }

    static collide(a, b) {
        const TOL = 0.001;
        var aCenterX = a.position.x + a.size.x / 2;
        var bCenterX = b.position.x + b.size.x / 2;
        var xDistance = Math.abs(aCenterX - bCenterX);

        var aCenterY = a.position.y + a.size.y / 2;
        var bCenterY = b.position.y + b.size.y / 2;
        var yDistance = Math.abs(aCenterY - bCenterY);

        var aCenterZ = a.position.z + a.size.z / 2;
        var bCenterZ = b.position.z + b.size.z / 2;
        var zDistance = Math.abs(aCenterZ - bCenterZ);

        if (xDistance < (a.size.x + b.size.x) / 2 - TOL
            && yDistance < (a.size.y + b.size.y) / 2 - TOL
            && zDistance < (a.size.z + b.size.z) / 2 - TOL) {
            return true;
        }
        return false;
    }
}

class Container {
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
        // Check boundary
        if (box.position.x < -0.001
            || box.position.y < -0.001
            || box.position.z < -0.001
            || box.position.x + box.size.x > this.size.x + 0.001
            || box.position.y + box.size.y > this.size.y + 0.001
            || box.position.z + box.size.z > this.size.z + 0.001) {
            return false;
        }

        // Check collision with existing boxes
        if (this.boxes.some(boxInContainer => Box.collide(box, boxInContainer))) {
            return false;
        }

        // Check total weight
        if (this.maxWeight !== Infinity && this.currentWeight + box.weight > this.maxWeight) {
            return false;
        }

        // Check fragile boxes below
        // A box is "below" if its top face (y + size.y) equals this box's bottom (box.position.y)
        // and it overlaps in X/Z
        const TOL = 0.001;
        for (const b of this.boxes) {
            if (b.fragile) {
                const bTop = b.position.y + b.size.y;
                if (Math.abs(bTop - box.position.y) < TOL) {
                    // Check X/Z overlap
                    const xOverlap = box.position.x < b.position.x + b.size.x - TOL
                        && box.position.x + box.size.x > b.position.x + TOL;
                    const zOverlap = box.position.z < b.position.z + b.size.z - TOL
                        && box.position.z + box.size.z > b.position.z + TOL;
                    if (xOverlap && zOverlap) {
                        return false;
                    }
                }
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

class Pallet extends Container {
    constructor(width, height, depth, deckHeight, maxWeight) {
        super(width, height - deckHeight, depth, { maxWeight, isPallet: true, palletHeight: deckHeight });
        this.deckHeight = deckHeight;
    }
}

// ─────────────────────────────────────────────
// Shared utility: sort boxes with group/isolated logic
// ─────────────────────────────────────────────
function sortBoxesForPacking(boxes) {
    const volumeOf = b => {
        const s = b.sizeInAllOrientation[0];
        // Use base dimensions (before sorting by height)
        return b.sizeInAllOrientation.reduce((max, sz) => Math.max(max, sz.x * sz.y * sz.z), 0);
    };
    // Group normal boxes first, isolated last
    const normal = boxes.filter(b => !b.isolated);
    const isolated = boxes.filter(b => b.isolated);

    // Sort normal by group (same group together), then by volume desc within group
    normal.sort((a, b) => {
        const ga = a.group || '';
        const gb = b.group || '';
        if (ga !== gb) return ga.localeCompare(gb);
        return volumeOf(b) - volumeOf(a);
    });

    // Sort isolated by volume desc
    isolated.sort((a, b) => volumeOf(b) - volumeOf(a));

    return [...normal, ...isolated];
}

// ─────────────────────────────────────────────
// BaseSolver
// ─────────────────────────────────────────────
class BaseSolver {
    constructor(container, boxes) {
        this.container = container;
        this.boxes = [].concat(boxes);
    }

    solve() {
        return [];
    }

    static getName() { return 'Base'; }
    static getDescription() { return ''; }
}

// ─────────────────────────────────────────────
// HeuristicSolver (refactored from original BinPackingSolver)
// ─────────────────────────────────────────────
class HeuristicSolver extends BaseSolver {
    constructor(container, boxes) {
        super(container, boxes);
    }

    static getName() { return '启发式贪心'; }
    static getDescription() { return '快速启发式算法，适合大多数场景'; }

    _removeByIndex(array, index) {
        array.splice(index, 1);
    }

    _orientBoxToFit(box, xLimit, yLimit) {
        const validOrientations = box.getValidOrientations();
        for (const i of validOrientations) {
            box.orientation = i;
            if (this.container.canHold(box)
                && (xLimit == null || box.size.x + box.position.x <= xLimit + 0.001)
                && (yLimit == null || box.size.y + box.position.y <= yLimit + 0.001)) {
                return true;
            }
        }
        return false;
    }

    _updateCandidatePositions(candidatePosition, box, oldPositionIndex) {
        if (oldPositionIndex != null)
            this._removeByIndex(candidatePosition, oldPositionIndex);
        candidatePosition.push(new Vector3D(box.position.x + box.size.x, box.position.y, box.position.z));
        candidatePosition.push(new Vector3D(box.position.x, box.position.y + box.size.y, box.position.z));
        candidatePosition.push(new Vector3D(box.position.x, box.position.y, box.position.z + box.size.z));
    }

    _moveBoxToShrink(box) {
        var anyMovement = false;
        var boxMoved = false;
        do {
            var moveCount = 0;
            while (this.container.canHold(box)) {
                box.position.y -= 0.01;
                moveCount++;
            }
            box.position.y += 0.01;
            moveCount--;
            while (this.container.canHold(box)) {
                box.position.x -= 0.01;
                moveCount++;
            }
            box.position.x += 0.01;
            moveCount--;
            while (this.container.canHold(box)) {
                box.position.z -= 0.01;
                moveCount++;
            }
            box.position.z += 0.01;
            moveCount--;
            boxMoved = (moveCount !== 0);
            if (boxMoved) anyMovement = true;
        } while (boxMoved);
        return anyMovement;
    }

    solve() {
        var unPackedBoxes = this.boxes.slice();

        // Sort by volume descending (largest first) with group logic
        unPackedBoxes = sortBoxesForPacking(unPackedBoxes);
        // Further sort by volume descending overall (within group constraints already applied)
        // We reverse since we'll pop() from the end
        unPackedBoxes.reverse();

        var candidatePosition = [new Vector3D(0, 0, 0)];
        var unPackableBoxes = [];

        var xLimit = 0, yLimit = 0;
        while (unPackedBoxes.length !== 0) {
            var box = unPackedBoxes.pop();
            var boxPlaced = false;
            var positionIndex = 0;

            candidatePosition.sort((a, b) => {
                if (a.y !== b.y) return a.y - b.y;
                if (a.z !== b.z) return a.z - b.z;
                return a.x - b.x;
            });

            for (positionIndex = 0; positionIndex < candidatePosition.length; positionIndex++) {
                box.position = new Vector3D(
                    candidatePosition[positionIndex].x,
                    candidatePosition[positionIndex].y,
                    candidatePosition[positionIndex].z
                );
                boxPlaced = this._orientBoxToFit(box, xLimit, yLimit);
                if (boxPlaced) break;
            }

            if (!boxPlaced) {
                positionIndex = null;
                if (xLimit === 0 || xLimit >= this.container.size.x - 0.001) {
                    box.position = new Vector3D(0, yLimit, 0);
                    boxPlaced = this._orientBoxToFit(box);
                    if (boxPlaced) {
                        yLimit = yLimit + box.size.y;
                        xLimit = box.size.x;
                    } else if (yLimit < this.container.size.y) {
                        xLimit = this.container.size.x;
                        yLimit = this.container.size.y;
                        unPackedBoxes.push(box);
                    }
                } else {
                    for (positionIndex = 0; positionIndex < candidatePosition.length; positionIndex++) {
                        var p = candidatePosition[positionIndex];
                        if (Math.abs(p.x - xLimit) < 0.001 && p.z < 0.001) {
                            box.position = new Vector3D(p.x, p.y, p.z);
                            boxPlaced = this._orientBoxToFit(box, null, yLimit);
                            if (boxPlaced) {
                                xLimit = Math.min(xLimit + box.size.x, this.container.size.x);
                            }
                        }
                    }
                    if (!boxPlaced) {
                        xLimit = this.container.size.x;
                        unPackedBoxes.push(box);
                    }
                }
            }

            if (xLimit >= this.container.size.x - 0.001
                && yLimit >= this.container.size.y - 0.001
                && !boxPlaced) {
                unPackableBoxes.push(box);
                continue;
            }

            if (boxPlaced) {
                var boxMoved = this._moveBoxToShrink(box);
                if (!boxMoved) {
                    positionIndex = null;
                }
                this.container.put(box);
                this._updateCandidatePositions(candidatePosition, box, positionIndex);
            }
        }
        return unPackableBoxes;
    }
}

// ─────────────────────────────────────────────
// GuillotineSolver
// ─────────────────────────────────────────────
class GuillotineSolver extends BaseSolver {
    constructor(container, boxes) {
        super(container, boxes);
    }

    static getName() { return '断切算法'; }
    static getDescription() { return '基于空间切割的算法，空间利用率较高'; }

    solve() {
        const container = this.container;
        const TOL = 0.001;

        // Free spaces: { x, y, z, w, h, d }
        let freeSpaces = [{
            x: 0, y: 0, z: 0,
            w: container.size.x,
            h: container.size.y,
            d: container.size.z
        }];

        let sortedBoxes = sortBoxesForPacking(this.boxes.slice());
        // Sort by volume descending
        sortedBoxes.sort((a, b) => {
            const volA = a.sizeInAllOrientation.reduce((max, s) => Math.max(max, s.x * s.y * s.z), 0);
            const volB = b.sizeInAllOrientation.reduce((max, s) => Math.max(max, s.x * s.y * s.z), 0);
            return volB - volA;
        });

        const unPackableBoxes = [];

        for (const box of sortedBoxes) {
            let bestScore = Infinity;
            let bestSpaceIdx = -1;
            let bestOrientation = -1;

            const validOrientations = box.getValidOrientations();

            for (let spaceIdx = 0; spaceIdx < freeSpaces.length; spaceIdx++) {
                const sp = freeSpaces[spaceIdx];
                for (const ori of validOrientations) {
                    box.orientation = ori;
                    const bw = box.size.x, bh = box.size.y, bd = box.size.z;
                    if (bw <= sp.w + TOL && bh <= sp.h + TOL && bd <= sp.d + TOL) {
                        // Best Short Side Fit: minimize wasted space on shortest sides
                        const score = Math.min(sp.w - bw, sp.d - bd);
                        if (score < bestScore) {
                            bestScore = score;
                            bestSpaceIdx = spaceIdx;
                            bestOrientation = ori;
                        }
                    }
                }
            }

            if (bestSpaceIdx === -1) {
                unPackableBoxes.push(box);
                continue;
            }

            // Place box at bottom-left-front corner of the space
            const sp = freeSpaces[bestSpaceIdx];
            box.orientation = bestOrientation;
            box.position = new Vector3D(sp.x, sp.y, sp.z);

            // Check constraints (weight, fragile)
            if (!container.canHold(box)) {
                unPackableBoxes.push(box);
                continue;
            }

            container.put(box);

            const bw = box.size.x, bh = box.size.y, bd = box.size.z;

            // Remove used space
            freeSpaces.splice(bestSpaceIdx, 1);

            // Generate 3 new spaces
            // Space 1 (right of box)
            if (sp.w - bw > TOL) {
                freeSpaces.push({ x: sp.x + bw, y: sp.y, z: sp.z, w: sp.w - bw, h: sp.h, d: sp.d });
            }
            // Space 2 (above box)
            if (sp.h - bh > TOL) {
                freeSpaces.push({ x: sp.x, y: sp.y + bh, z: sp.z, w: bw, h: sp.h - bh, d: sp.d });
            }
            // Space 3 (behind box)
            if (sp.d - bd > TOL) {
                freeSpaces.push({ x: sp.x, y: sp.y, z: sp.z + bd, w: bw, h: bh, d: sp.d - bd });
            }
        }

        return unPackableBoxes;
    }
}

// ─────────────────────────────────────────────
// MaximalSpacesSolver
// ─────────────────────────────────────────────
class MaximalSpacesSolver extends BaseSolver {
    constructor(container, boxes) {
        super(container, boxes);
    }

    static getName() { return '极大空间算法'; }
    static getDescription() { return '维护最大自由空间集合，装箱率最优'; }

    _spacesIntersect(box, sp) {
        // Check if placed box intersects with free space sp
        const TOL = 0.001;
        const bx = box.position.x, by = box.position.y, bz = box.position.z;
        const bw = box.size.x, bh = box.size.y, bd = box.size.z;
        return bx < sp.x + sp.w - TOL && bx + bw > sp.x + TOL
            && by < sp.y + sp.h - TOL && by + bh > sp.y + TOL
            && bz < sp.z + sp.d - TOL && bz + bd > sp.z + TOL;
    }

    _splitSpace(sp, box) {
        const TOL = 0.001;
        const bx = box.position.x, by = box.position.y, bz = box.position.z;
        const bw = box.size.x, bh = box.size.y, bd = box.size.z;
        const sx = sp.x, sy = sp.y, sz = sp.z;
        const sw = sp.w, sh = sp.h, sd = sp.d;

        const candidates = [
            // Left of box
            { x: sx, y: sy, z: sz, w: bx - sx, h: sh, d: sd },
            // Right of box
            { x: bx + bw, y: sy, z: sz, w: sx + sw - (bx + bw), h: sh, d: sd },
            // Below box
            { x: sx, y: sy, z: sz, w: sw, h: by - sy, d: sd },
            // Above box
            { x: sx, y: by + bh, z: sz, w: sw, h: sy + sh - (by + bh), d: sd },
            // Front of box
            { x: sx, y: sy, z: sz, w: sw, h: sh, d: bz - sz },
            // Behind box
            { x: sx, y: sy, z: bz + bd, w: sw, h: sh, d: sz + sd - (bz + bd) }
        ];

        return candidates.filter(c => c.w > TOL && c.h > TOL && c.d > TOL);
    }

    _isDominated(sp, others) {
        // sp is dominated if another space fully contains it
        const TOL = 0.001;
        for (const other of others) {
            if (other === sp) continue;
            if (other.x <= sp.x + TOL
                && other.y <= sp.y + TOL
                && other.z <= sp.z + TOL
                && other.x + other.w >= sp.x + sp.w - TOL
                && other.y + other.h >= sp.y + sp.h - TOL
                && other.z + other.d >= sp.z + sp.d - TOL) {
                return true;
            }
        }
        return false;
    }

    _removeDominated(spaces) {
        return spaces.filter((sp, i) => !this._isDominated(sp, spaces));
    }

    solve() {
        const container = this.container;
        const MAX_SPACES = 200;
        const TOL = 0.001;

        let freeSpaces = [{
            x: 0, y: 0, z: 0,
            w: container.size.x,
            h: container.size.y,
            d: container.size.z
        }];

        let sortedBoxes = sortBoxesForPacking(this.boxes.slice());
        sortedBoxes.sort((a, b) => {
            const volA = a.sizeInAllOrientation.reduce((max, s) => Math.max(max, s.x * s.y * s.z), 0);
            const volB = b.sizeInAllOrientation.reduce((max, s) => Math.max(max, s.x * s.y * s.z), 0);
            return volB - volA;
        });

        const unPackableBoxes = [];

        for (const box of sortedBoxes) {
            let bestVol = Infinity;
            let bestSpaceIdx = -1;
            let bestOrientation = -1;

            const validOrientations = box.getValidOrientations();

            for (let spaceIdx = 0; spaceIdx < freeSpaces.length; spaceIdx++) {
                const sp = freeSpaces[spaceIdx];
                for (const ori of validOrientations) {
                    box.orientation = ori;
                    const bw = box.size.x, bh = box.size.y, bd = box.size.z;
                    if (bw <= sp.w + TOL && bh <= sp.h + TOL && bd <= sp.d + TOL) {
                        const spVol = sp.w * sp.h * sp.d;
                        if (spVol < bestVol) {
                            bestVol = spVol;
                            bestSpaceIdx = spaceIdx;
                            bestOrientation = ori;
                        }
                    }
                }
            }

            if (bestSpaceIdx === -1) {
                unPackableBoxes.push(box);
                continue;
            }

            const sp = freeSpaces[bestSpaceIdx];
            box.orientation = bestOrientation;
            box.position = new Vector3D(sp.x, sp.y, sp.z);

            if (!container.canHold(box)) {
                unPackableBoxes.push(box);
                continue;
            }

            container.put(box);

            // Update free spaces: split all intersecting spaces
            const newSpaces = [];
            for (const s of freeSpaces) {
                if (this._spacesIntersect(box, s)) {
                    const sub = this._splitSpace(s, box);
                    newSpaces.push(...sub);
                } else {
                    newSpaces.push(s);
                }
            }

            // Remove dominated spaces
            let cleaned = this._removeDominated(newSpaces);

            // Prune if too many spaces
            if (cleaned.length > MAX_SPACES) {
                cleaned.sort((a, b) => (b.w * b.h * b.d) - (a.w * a.h * a.d));
                cleaned = cleaned.slice(0, MAX_SPACES);
            }

            freeSpaces = cleaned;
        }

        return unPackableBoxes;
    }
}

// ─────────────────────────────────────────────
// SimulatedAnnealingSolver
// ─────────────────────────────────────────────
class SimulatedAnnealingSolver extends BaseSolver {
    constructor(container, boxes) {
        super(container, boxes);
    }

    static getName() { return '模拟退火'; }
    static getDescription() { return '全局优化算法，装箱率最高但速度较慢'; }

    _evaluate(ordering, container) {
        // Run heuristic on given ordering, return { unpacked count, usedVolume }
        container.makeEmpty();
        const tempSolver = new HeuristicSolver(container, ordering);
        // Override the sorted boxes with our ordering (reversed for pop)
        tempSolver.boxes = ordering.slice();
        const unpacked = tempSolver.solve();
        const usedVolume = container.boxes.reduce((sum, b) => sum + b.size.x * b.size.y * b.size.z, 0);
        return { unpackedCount: unpacked.length, usedVolume };
    }

    _scoreIsBetter(a, b, totalVolume) {
        // Lower unpacked count is better; on tie, higher usedVolume is better
        if (a.unpackedCount !== b.unpackedCount) return a.unpackedCount < b.unpackedCount;
        return a.usedVolume > b.usedVolume;
    }

    solve() {
        const container = this.container;
        const totalVolume = container.size.x * container.size.y * container.size.z;

        // Initial solution using HeuristicSolver
        let currentOrdering = sortBoxesForPacking(this.boxes.slice());

        // We need a fresh container clone approach - but we share one container.
        // Strategy: use the container directly, making it empty between evaluations.
        let currentResult = this._evaluate(currentOrdering, container);

        let bestOrdering = currentOrdering.slice();
        let bestResult = { ...currentResult };

        const T_start = 1.0;
        const T_end = 0.01;
        const cooling = 0.995;
        const MAX_ITER = 300;

        let T = T_start;
        for (let iter = 0; iter < MAX_ITER; iter++) {
            // Random swap of two boxes
            const newOrdering = currentOrdering.slice();
            const i = Math.floor(Math.random() * newOrdering.length);
            const j = Math.floor(Math.random() * newOrdering.length);
            [newOrdering[i], newOrdering[j]] = [newOrdering[j], newOrdering[i]];

            const newResult = this._evaluate(newOrdering, container);
            const delta = (newResult.unpackedCount - currentResult.unpackedCount) * 1000
                + (currentResult.usedVolume - newResult.usedVolume) / totalVolume;

            if (delta <= 0 || Math.random() < Math.exp(-delta / T)) {
                currentOrdering = newOrdering;
                currentResult = newResult;
                if (this._scoreIsBetter(currentResult, bestResult, totalVolume)) {
                    bestOrdering = currentOrdering.slice();
                    bestResult = { ...currentResult };
                }
            }

            T = Math.max(T * cooling, T_end);
        }

        // Final solve with best ordering
        container.makeEmpty();
        const finalSolver = new HeuristicSolver(container, bestOrdering);
        finalSolver.boxes = bestOrdering.slice();
        return finalSolver.solve();
    }
}

// ─────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────
const BOX_PRESETS = [
    { label: '快递小箱', width: 22, height: 9, depth: 17, weight: 0.5, maxWeightOnTop: 20 },
    { label: '快递中箱', width: 31, height: 12, depth: 24, weight: 1, maxWeightOnTop: 30 },
    { label: '快递大箱', width: 39, height: 18, depth: 29, weight: 2, maxWeightOnTop: 50 },
    { label: '电商小箱', width: 20, height: 10, depth: 15, weight: 0.3, maxWeightOnTop: 15 },
    { label: '电商中箱', width: 35, height: 15, depth: 25, weight: 1.5, maxWeightOnTop: 25 },
    { label: '电商大箱', width: 50, height: 30, depth: 40, weight: 3, maxWeightOnTop: 40 },
    { label: '仓储标准箱', width: 40, height: 30, depth: 30, weight: 2, maxWeightOnTop: 60 },
    { label: '仓储大箱', width: 60, height: 40, depth: 40, weight: 5, maxWeightOnTop: 100 }
];

const CONTAINER_PRESETS = [
    { label: '小型集装箱', width: 200, height: 220, depth: 200, maxWeight: 20000 },
    { label: '标准容器', width: 300, height: 250, depth: 250, maxWeight: 30000 },
    { label: '货架格位', width: 120, height: 100, depth: 80, maxWeight: 500 }
];

const PALLET_PRESETS = {
    'EUR': { width: 120, height: 180, depth: 80, deckHeight: 14.4, maxWeight: 1500, label: 'EUR托盘 (120×80cm)' },
    'US': { width: 121.9, height: 180, depth: 101.6, deckHeight: 14, maxWeight: 1500, label: '美标托盘 (48×40in)' },
    'CN_T1': { width: 120, height: 180, depth: 100, deckHeight: 15, maxWeight: 1200, label: '国标T1托盘 (120×100cm)' },
    'CN_T2': { width: 100, height: 160, depth: 80, deckHeight: 12, maxWeight: 1000, label: '国标T2托盘 (100×80cm)' }
};

// Backward compat alias
const BinPackingSolver = HeuristicSolver;

export {
    BinPackingSolver,
    HeuristicSolver,
    GuillotineSolver,
    MaximalSpacesSolver,
    SimulatedAnnealingSolver,
    Vector3D,
    Box,
    Container,
    Pallet,
    BOX_PRESETS,
    CONTAINER_PRESETS,
    PALLET_PRESETS
};
