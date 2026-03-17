/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/* global THREE */

/** Singleton factory that generates and caches procedural Three.js textures. */
export class TextureFactory {
    static _cardboardTex = null;
    static _woodTex      = null;
    static _metalTex     = null;

    static getCardboardTexture() {
        if (!TextureFactory._cardboardTex)
            TextureFactory._cardboardTex = TextureFactory._makeCardboard();
        return TextureFactory._cardboardTex;
    }

    static getWoodTexture() {
        if (!TextureFactory._woodTex)
            TextureFactory._woodTex = TextureFactory._makeWood();
        return TextureFactory._woodTex;
    }

    static getMetalTexture() {
        if (!TextureFactory._metalTex)
            TextureFactory._metalTex = TextureFactory._makeMetal();
        return TextureFactory._metalTex;
    }

    // ── Corrugated cardboard — warm brown with horizontal flute lines ─────────
    static _makeCardboard() {
        const S = 512, cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');

        ctx.fillStyle = '#c4986a';
        ctx.fillRect(0, 0, S, S);

        for (let y = 0; y < S; y += 5) {
            ctx.fillStyle = `rgba(0,0,0,${(0.05 + Math.random() * 0.04).toFixed(3)})`;
            ctx.fillRect(0, y, S, 1);
            ctx.fillStyle = `rgba(255,220,160,${(0.04 + Math.random() * 0.03).toFixed(3)})`;
            ctx.fillRect(0, y + 2, S, 1);
        }
        for (let x = 60; x < S; x += 60) {
            ctx.strokeStyle = `rgba(0,0,0,${(0.06 + Math.random() * 0.04).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
        }

        const id = ctx.getImageData(0, 0, S, S), d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 22;
            d[i]   = Math.max(0, Math.min(255, d[i]   + n));
            d[i+1] = Math.max(0, Math.min(255, d[i+1] + n * 0.8));
            d[i+2] = Math.max(0, Math.min(255, d[i+2] + n * 0.4));
        }
        ctx.putImageData(id, 0, 0);

        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    // ── Wood grain — pine pallet planks ───────────────────────────────────────
    static _makeWood() {
        const S = 512, cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');

        ctx.fillStyle = '#9a6b32';
        ctx.fillRect(0, 0, S, S);

        for (let x = 0; x < S; x += 48) {
            const l = 130 + Math.floor(Math.random() * 35);
            ctx.fillStyle = `rgba(${l},${Math.floor(l * 0.62)},${Math.floor(l * 0.3)},0.18)`;
            ctx.fillRect(x, 0, 48, S);
        }
        for (let i = 0; i < 160; i++) {
            const y0 = Math.random() * S;
            ctx.strokeStyle = `rgba(0,0,0,${(0.03 + Math.random() * 0.09).toFixed(3)})`;
            ctx.lineWidth = 0.5 + Math.random() * 1.5;
            ctx.beginPath(); ctx.moveTo(0, y0);
            let py = y0;
            for (let x = 0; x <= S; x += 40) { py += (Math.random() - 0.5) * 5; ctx.lineTo(x, py); }
            ctx.stroke();
        }
        for (let k = 0; k < 4; k++) {
            const kx = Math.random() * S, ky = Math.random() * S, kr = 8 + Math.random() * 16;
            for (let r = kr; r > 1; r -= 2) {
                ctx.strokeStyle = `rgba(0,0,0,${(0.04 + (kr - r) / kr * 0.12).toFixed(3)})`;
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.ellipse(kx, ky, r, r * 0.55, Math.PI / 5, 0, Math.PI * 2); ctx.stroke();
            }
        }
        for (let y = 55; y < S; y += 55 + Math.floor(Math.random() * 8)) {
            ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,210,120,0.09)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, y + 2); ctx.lineTo(S, y + 2); ctx.stroke();
        }

        const id = ctx.getImageData(0, 0, S, S), d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 16;
            d[i]   = Math.max(0, Math.min(255, d[i]   + n));
            d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
            d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
        }
        ctx.putImageData(id, 0, 0);

        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    // ── Corrugated steel — shipping container walls ────────────────────────────
    static _makeMetal() {
        const S = 512, cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');

        ctx.fillStyle = '#3d6b4a';
        ctx.fillRect(0, 0, S, S);

        for (let x = 0; x < S; x += 28) {
            const g = ctx.createLinearGradient(x, 0, x + 28, 0);
            g.addColorStop(0,    'rgba(0,0,0,0.0)');
            g.addColorStop(0.10, 'rgba(255,255,255,0.24)');
            g.addColorStop(0.35, 'rgba(255,255,255,0.07)');
            g.addColorStop(0.65, 'rgba(0,0,0,0.16)');
            g.addColorStop(1,    'rgba(0,0,0,0.0)');
            ctx.fillStyle = g;
            ctx.fillRect(x, 0, 28, S);
        }
        for (let y = 0; y < S; y += 90) {
            ctx.strokeStyle = 'rgba(0,0,0,0.42)'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, y + 5); ctx.lineTo(S, y + 5); ctx.stroke();
        }
        for (let y = 45; y < S; y += 90) {
            for (let x = 14; x < S; x += 28) {
                ctx.fillStyle = 'rgba(0,0,0,0.32)';
                ctx.beginPath(); ctx.arc(x, y, 2.8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.beginPath(); ctx.arc(x - 0.6, y - 0.6, 1.4, 0, Math.PI * 2); ctx.fill();
            }
        }
        for (let s = 0; s < 18; s++) {
            const sx = Math.random() * S;
            ctx.strokeStyle = `rgba(255,255,255,${(0.03 + Math.random() * 0.05).toFixed(3)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + (Math.random()-0.5) * 8, S); ctx.stroke();
        }

        const id = ctx.getImageData(0, 0, S, S), d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 14;
            d[i]   = Math.max(0, Math.min(255, d[i]   + n));
            d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
            d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
        }
        ctx.putImageData(id, 0, 0);

        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }
}
