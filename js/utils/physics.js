/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/**
 * Drop a box to the highest support surface within its x-z footprint.
 *
 * When the container has a spatial grid (_grid), we use getXZCandidates()
 * to fetch only the boxes that share an XZ column with the new box — typically
 * a small constant rather than the full n. This turns gravityDrop from O(n)
 * to near-O(1) for typical layouts.
 */
export function gravityDrop(box, container) {
    const TOL = 0.001;
    let supportY = 0;

    // Prefer grid-accelerated lookup; fall back to full scan if no grid.
    const candidates = container._grid
        ? container._grid.getXZCandidates(box.position, box.size, container.size.y)
        : container.boxes;

    for (const b of candidates) {
        const xOverlap = box.position.x + TOL < b.position.x + b.size.x
                      && box.position.x + box.size.x - TOL > b.position.x;
        const zOverlap = box.position.z + TOL < b.position.z + b.size.z
                      && box.position.z + box.size.z - TOL > b.position.z;
        if (xOverlap && zOverlap) {
            const top = b.position.y + b.size.y;
            if (top > supportY) supportY = top;
        }
    }

    box.position.y = supportY;
}

/**
 * Check whether a box has sufficient contact area from the surface(s) below.
 *
 * A box resting on the container floor (position.y ≈ 0) is always stable.
 * Otherwise the total XZ overlap between the box's base and all boxes whose
 * top face is exactly at box.position.y must reach at least `minSupportRatio`
 * of the box's own base area.  At 0.5 (50 %) the centre of mass is virtually
 * guaranteed to lie over a supported region for any rectangular support shape,
 * which prevents edge-hanging and transport-instability issues.
 *
 * @param {Object} box             - Box to check (position already settled by gravityDrop).
 * @param {Object} container       - Container holding already-placed boxes.
 * @param {number} [minSupportRatio=0.5] - Minimum supported fraction of base area (0–1).
 * @returns {boolean}
 */
export function isSufficientlySupported(box, container, minSupportRatio = 0.5) {
    const TOL = 0.001;

    // Boxes resting on the floor need no further support check.
    if (box.position.y < TOL) return true;

    const baseArea = box.size.x * box.size.z;
    if (baseArea < TOL) return true;

    const supportY = box.position.y;

    // Retrieve only boxes in the XZ column at or below supportY.
    const candidates = container._grid
        ? container._grid.getXZCandidates(box.position, box.size, supportY)
        : container.boxes;

    let supportedArea = 0;
    for (const b of candidates) {
        // Only count boxes whose top face is flush with the box's bottom face.
        if (Math.abs(b.position.y + b.size.y - supportY) > TOL) continue;

        const ox = Math.min(box.position.x + box.size.x, b.position.x + b.size.x)
                 - Math.max(box.position.x, b.position.x);
        const oz = Math.min(box.position.z + box.size.z, b.position.z + b.size.z)
                 - Math.max(box.position.z, b.position.z);

        if (ox > TOL && oz > TOL) {
            supportedArea += ox * oz;
        }
    }

    return supportedArea / baseArea >= minSupportRatio;
}
