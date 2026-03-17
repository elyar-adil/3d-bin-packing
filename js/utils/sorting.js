/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

const maxVolume = b => b.sizeInAllOrientation.reduce((max, s) => Math.max(max, s.x * s.y * s.z), 0);

/**
 * Sort boxes with group/isolated logic:
 * - Normal boxes (non-isolated) first, sorted by group name then volume desc
 * - Isolated boxes last, sorted by volume desc
 */
export function sortBoxesForPacking(boxes) {
    const normal   = boxes.filter(b => !b.isolated);
    const isolated = boxes.filter(b => b.isolated);

    normal.sort((a, b) => {
        const ga = a.group || '', gb = b.group || '';
        if (ga !== gb) return ga.localeCompare(gb);
        return maxVolume(b) - maxVolume(a);
    });

    isolated.sort((a, b) => maxVolume(b) - maxVolume(a));

    return [...normal, ...isolated];
}
