/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

export class BaseSolver {
    constructor(container, boxes) {
        this.container = container;
        this.boxes = [].concat(boxes);
    }

    /** @returns {Box[]} unpacked boxes */
    solve() {
        return [];
    }

    static getName()        { return 'Base'; }
    static getDescription() { return ''; }
}
