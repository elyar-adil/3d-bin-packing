/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

const GROUP_COLORS = [
    0x4e79a7, 0xf28e2b, 0xe15759, 0x76b7b2, 0x59a14f,
    0xedc948, 0xb07aa1, 0xff9da7, 0x9c755f, 0xbab0ac
];

let _map = {};
let _idx = 0;

export function getGroupColor(group) {
    if (group == null) return null;
    if (_map[group] === undefined) {
        _map[group] = GROUP_COLORS[_idx % GROUP_COLORS.length];
        _idx++;
    }
    return _map[group];
}

export function resetGroupColors() {
    _map = {};
    _idx = 0;
}
