/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/**
 * Drop a box to the highest support surface within its x-z footprint.
 */
export function gravityDrop(box, container) {
    const TOL = 0.001;
    let supportY = 0;
    for (const b of container.boxes) {
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
