/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/** Manages the stats bar display (utilization, box count, total weight). */
export class StatsDisplay {
    constructor() {
        this._util    = document.getElementById('stat-util');
        this._boxes   = document.getElementById('stat-boxes');
        this._bTotal  = document.getElementById('stat-boxes-total');
        this._weight  = document.getElementById('stat-weight');
    }

    /** @param {object|null} stats - Result of container.getStats(), or null to reset. */
    update(stats, totalBoxes = 0) {
        if (!stats) {
            this._util.textContent   = '—';
            this._boxes.textContent  = '0';
            this._bTotal.textContent = '';
            this._weight.textContent = '0';
            return;
        }
        this._util.textContent   = stats.utilization;
        this._boxes.textContent  = stats.boxCount;
        this._bTotal.textContent = totalBoxes ? `/ ${totalBoxes}` : '';
        this._weight.textContent = stats.totalWeight;
    }
}
