/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/* global THREE */

/**
 * Singleton factory: generates and caches procedural Three.js textures.
 * The cardboard texture uses a near-white base so that the MeshStandardMaterial
 * `color` property (set per-box) renders with full saturation.
 */
export class TextureFactory {
    static _cardboardTex    = null;
    static _cardboardNormal = null;
    static _woodTex         = null;
    static _metalTex        = null;

    static getCardboardTexture()  { return TextureFactory._cardboardTex    ??= TextureFactory._makeCardboard(); }
    static getCardboardNormalMap(){ return TextureFactory._cardboardNormal ??= TextureFactory._makeCardboardNormal(); }
    static getWoodTexture()       { return TextureFactory._woodTex         ??= TextureFactory._makeWood(); }
    static getMetalTexture()      { return TextureFactory._metalTex        ??= TextureFactory._makeMetal(); }

    // ── Near-white corrugated cardboard ───────────────────────────────────────
    // Base is very light warm-white so the material `color` tints it vividly.
    static _makeCardboard() {
        const S = 512;
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');

        // Near-white warm base
        ctx.fillStyle = '#f2ede6';
        ctx.fillRect(0, 0, S, S);

        // Horizontal flute lines (corrugated cardboard profile)
        for (let y = 0; y < S; y += 6) {
            ctx.fillStyle = `rgba(0,0,0,${(0.06 + Math.random() * 0.04).toFixed(3)})`;
            ctx.fillRect(0, y, S, 1);
            ctx.fillStyle = `rgba(255,255,255,${(0.08 + Math.random() * 0.05).toFixed(3)})`;
            ctx.fillRect(0, y + 3, S, 1);
        }

        // Subtle vertical panel-edge lines
        for (let x = 80; x < S; x += 80) {
            ctx.strokeStyle = `rgba(0,0,0,${(0.05 + Math.random() * 0.03).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
        }

        // Fine noise for surface variation
        const id = ctx.getImageData(0, 0, S, S), d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 14;
            d[i]     = Math.max(0, Math.min(255, d[i]     + n));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.8));
        }
        ctx.putImageData(id, 0, 0);

        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    // ── Wood grain — pine pallet planks ───────────────────────────────────────
    static _makeWood() {
        const S = 512;
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');

        ctx.fillStyle = '#9a6b32';
        ctx.fillRect(0, 0, S, S);

        // Plank colour bands
        for (let x = 0; x < S; x += 48) {
            const l = 130 + Math.floor(Math.random() * 35);
            ctx.fillStyle = `rgba(${l},${Math.floor(l * 0.62)},${Math.floor(l * 0.3)},0.18)`;
            ctx.fillRect(x, 0, 48, S);
        }

        // Wood grain lines
        for (let i = 0; i < 160; i++) {
            const y0 = Math.random() * S;
            ctx.strokeStyle = `rgba(0,0,0,${(0.03 + Math.random() * 0.09).toFixed(3)})`;
            ctx.lineWidth = 0.5 + Math.random() * 1.5;
            ctx.beginPath(); ctx.moveTo(0, y0);
            let py = y0;
            for (let x = 0; x <= S; x += 40) { py += (Math.random() - 0.5) * 5; ctx.lineTo(x, py); }
            ctx.stroke();
        }

        // Knots
        for (let k = 0; k < 4; k++) {
            const kx = Math.random() * S, ky = Math.random() * S, kr = 8 + Math.random() * 16;
            for (let r = kr; r > 1; r -= 2) {
                ctx.strokeStyle = `rgba(0,0,0,${(0.04 + (kr - r) / kr * 0.12).toFixed(3)})`;
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.ellipse(kx, ky, r, r * 0.55, Math.PI / 5, 0, Math.PI * 2); ctx.stroke();
            }
        }

        // Cross-grain plank joints
        for (let y = 55; y < S; y += 55 + Math.floor(Math.random() * 8)) {
            ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,210,120,0.09)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, y + 2); ctx.lineTo(S, y + 2); ctx.stroke();
        }

        const id = ctx.getImageData(0, 0, S, S), d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 16;
            d[i]     = Math.max(0, Math.min(255, d[i]     + n));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
        }
        ctx.putImageData(id, 0, 0);

        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    // ── Corrugated steel — white-painted shipping container panels ────────────
    static _makeMetal() {
        const S = 512;
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');

        ctx.fillStyle = '#eceef0';
        ctx.fillRect(0, 0, S, S);

        // Corrugation ridges (vertical strips, ~8 ridges per tile)
        const rw = 60;
        for (let x = 0; x < S; x += rw) {
            const g = ctx.createLinearGradient(x, 0, x + rw, 0);
            g.addColorStop(0,    'rgba(0,0,0,0.30)');
            g.addColorStop(0.12, 'rgba(0,0,0,0.08)');
            g.addColorStop(0.28, 'rgba(255,255,255,0.26)');
            g.addColorStop(0.45, 'rgba(255,255,255,0.40)');
            g.addColorStop(0.60, 'rgba(255,255,255,0.16)');
            g.addColorStop(0.80, 'rgba(0,0,0,0.06)');
            g.addColorStop(1,    'rgba(0,0,0,0.28)');
            ctx.fillStyle = g;
            ctx.fillRect(x, 0, rw, S);
        }

        const id = ctx.getImageData(0, 0, S, S), d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 6;
            d[i]     = Math.max(0, Math.min(255, d[i]     + n));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
        }
        ctx.putImageData(id, 0, 0);

        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    // ── Cardboard normal map — horizontal flute ridges for PBR depth ──────────
    static _makeCardboardNormal() {
        const S = 512;
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');

        ctx.fillStyle = '#8080ff'; // flat normal (0,0,1)
        ctx.fillRect(0, 0, S, S);

        const id = ctx.getImageData(0, 0, S, S), d = id.data;
        const period = 10; // flute period in pixels
        for (let i = 0; i < d.length; i += 4) {
            const py    = Math.floor(i / 4 / S);
            const slope = Math.cos((py / period) * Math.PI * 2);
            d[i]     = 128;
            d[i + 1] = Math.max(0, Math.min(255, 128 + slope * 55));
            d[i + 2] = Math.max(180, Math.min(255, 220 - Math.abs(slope) * 30));
            d[i + 3] = 255;
        }
        ctx.putImageData(id, 0, 0);

        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }
}
