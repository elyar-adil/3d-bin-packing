/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

// Standard ISO shipping container interior dimensions (cm)
export const BOX_PRESETS = [
    { label: '快递小箱',   width: 22, height:  9, depth: 17, weight: 0.5, maxWeightOnTop:  20 },
    { label: '快递中箱',   width: 31, height: 12, depth: 24, weight: 1,   maxWeightOnTop:  30 },
    { label: '快递大箱',   width: 39, height: 18, depth: 29, weight: 2,   maxWeightOnTop:  50 },
    { label: '电商小箱',   width: 20, height: 10, depth: 15, weight: 0.3, maxWeightOnTop:  15 },
    { label: '电商中箱',   width: 35, height: 15, depth: 25, weight: 1.5, maxWeightOnTop:  25 },
    { label: '电商大箱',   width: 50, height: 30, depth: 40, weight: 3,   maxWeightOnTop:  40 },
    { label: '仓储标准箱', width: 40, height: 30, depth: 30, weight: 2,   maxWeightOnTop:  60 },
    { label: '仓储大箱',   width: 60, height: 40, depth: 40, weight: 5,   maxWeightOnTop: 100 }
];

// Interior usable dimensions of standard ISO dry-cargo containers
export const CONTAINER_PRESETS = [
    { label: '20尺集装箱 (20ft)',    width: 589,  height: 239, depth: 235, maxWeight: 28200 },
    { label: '40尺集装箱 (40ft)',    width: 1202, height: 239, depth: 235, maxWeight: 26750 },
    { label: '40尺高柜 (40ft HC)',   width: 1202, height: 269, depth: 235, maxWeight: 26380 },
    { label: '货架格位',             width: 120,  height: 100, depth:  80, maxWeight:   500 }
];

export const PALLET_PRESETS = {
    'EUR':   { width: 120,   height: 180, depth:  80,   deckHeight: 14.4, maxWeight: 1500, label: 'EUR托盘 (120×80cm)'     },
    'US':    { width: 121.9, height: 180, depth: 101.6, deckHeight: 14,   maxWeight: 1500, label: '美标托盘 (48×40in)'     },
    'CN_T1': { width: 120,   height: 180, depth: 100,   deckHeight: 15,   maxWeight: 1200, label: '国标T1托盘 (120×100cm)' },
    'CN_T2': { width: 100,   height: 160, depth:  80,   deckHeight: 12,   maxWeight: 1000, label: '国标T2托盘 (100×80cm)'  }
};
