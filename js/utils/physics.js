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
