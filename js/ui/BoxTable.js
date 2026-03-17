/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/** Manages the box list table UI. */
export class BoxTable {
    constructor(tbody, badge) {
        this._tbody = tbody;
        this._badge = badge;
        this._rowId = 0;
    }

    /** Add a row to the table and return the row id. */
    addRow(color, w, h, d, qty, weight, constraints, onDelete) {
        const id = `box-row-${this._rowId++}`;

        let badges = '';
        if (constraints.fragile)
            badges += `<span class="badge-constraint badge-fragile">&#x26A0; 易碎</span>`;
        if (constraints.orientationConstraint && constraints.orientationConstraint !== 'FREE') {
            const lbl = constraints.orientationConstraint === 'UPRIGHT' ? '直立' : '固定';
            badges += `<span class="badge-constraint badge-orientation">${lbl}</span>`;
        }
        if (constraints.group)
            badges += `<span class="badge-constraint badge-group">&#x1F4CC; ${constraints.group}</span>`;
        if (constraints.isolated)
            badges += `<span class="badge-constraint badge-isolated">隔离</span>`;

        const qtyText    = qty > 1 ? ` &times;${qty}` : '';
        const labelText  = constraints.label || `${w}&times;${h}&times;${d}`;

        const tr = document.createElement('tr');
        tr.id = id;
        tr.innerHTML = `
            <td><span class="color-dot" style="background:${color};"></span></td>
            <td>${labelText}${qtyText}</td>
            <td>${w}&times;${h}&times;${d}</td>
            <td>${weight}kg</td>
            <td>${badges || '<span style="color:#aaa;">—</span>'}</td>
            <td><button class="btn btn-sm btn-outline-danger btn-delete-box"
                    data-row-id="${id}" data-qty="${qty}">&#x2715;</button></td>
        `;
        tr.querySelector('button').addEventListener('click', () => {
            tr.remove();
            this.updateBadge();
            onDelete(qty);
        });
        this._tbody.appendChild(tr);
        this.updateBadge();
        return id;
    }

    clearAll() {
        this._tbody.innerHTML = '';
        this.updateBadge();
    }

    /** Call this whenever the external box count changes. */
    updateBadge(count) {
        if (count !== undefined) {
            this._badge.textContent = count;
        } else {
            this._badge.textContent = this._tbody.querySelectorAll('tr').length;
        }
    }
}
