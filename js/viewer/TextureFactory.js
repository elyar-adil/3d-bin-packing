/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/* global THREE */

/** Singleton factory that generates and caches procedural Three.js textures. */
export class TextureFactory {
    static _cardboardTex    = null;
    static _cardboardNormal = null;
    static _woodTex         = null;
    static _metalTex        = null;

    static getCardboardTexture() {
        if (!TextureFactory._cardboardTex)
            TextureFactory._cardboardTex = TextureFactory._makeCardboard();
        return TextureFactory._cardboardTex;
    }

    static getCardboardNormalMap() {
        if (!TextureFactory._cardboardNormal)
            TextureFactory._cardboardNormal = TextureFactory._makeCardboardNormal();
        return TextureFactory._cardboardNormal;
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

    // ── Corrugated steel — white shipping container panels ────────────────────
    static _makeMetal() {
        const S = 512, cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');

        // Near-white base (standard white-painted shipping container)
        ctx.fillStyle = '#eceef0';
        ctx.fillRect(0, 0, S, S);

        // Strong vertical corrugation ridges (sine-wave profile: dark valley → bright peak)
        // ridgeWidth = 60px → ~8.5 ridges per 512 texture
        // With TILE=110 on a W=300 container: ~23 ridges total (realistic for a 20ft container)
        const rw = 60;
        for (let x = 0; x < S; x += rw) {
            // Corrugation profile: valley(dark) → face → peak(bright) → face → valley(dark)
            const g = ctx.createLinearGradient(x, 0, x + rw, 0);
            g.addColorStop(0,    'rgba(0,0,0,0.32)');   // deep valley shadow
            g.addColorStop(0.12, 'rgba(0,0,0,0.10)');
            g.addColorStop(0.28, 'rgba(255,255,255,0.28)'); // ascending face
            g.addColorStop(0.45, 'rgba(255,255,255,0.42)'); // ridge peak highlight
            g.addColorStop(0.60, 'rgba(255,255,255,0.18)'); // descending face
            g.addColorStop(0.80, 'rgba(0,0,0,0.08)');
            g.addColorStop(1,    'rgba(0,0,0,0.30)');   // next valley shadow
            ctx.fillStyle = g;
            ctx.fillRect(x, 0, rw, S);
        }

        // Fine noise for slight surface texture variation
        const id = ctx.getImageData(0, 0, S, S), d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 7;
            d[i]   = Math.max(0, Math.min(255, d[i]   + n));
            d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
            d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
        }
        ctx.putImageData(id, 0, 0);

        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    // ── Cardboard normal map — horizontal flute ridges for PBR depth ──────────
    static _makeCardboardNormal() {
        const S = 512, cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');

        // Base normal pointing straight out: RGB(128, 128, 255)
        ctx.fillStyle = '#8080ff';
        ctx.fillRect(0, 0, S, S);

        const id = ctx.getImageData(0, 0, S, S), d = id.data;
        // Corrugated flute period: ~10 pixels → ~50 ridges per tile
        const period = 10;
        for (let i = 0; i < d.length; i += 4) {
            const py = Math.floor(i / 4 / S); // pixel row
            const t  = (py / period) * Math.PI * 2;
            // Ny encodes vertical slope of the sine ridge profile
            const slope = Math.cos(t);  // derivative of sin
            // Normal: Nx=0 (128), Ny=slope*60, Nz=high (215-255)
            const ny = Math.max(0, Math.min(255, 128 + slope * 55));
            const nz = Math.max(180, Math.min(255, 220 - Math.abs(slope) * 30));
            d[i]     = 128; // R = Nx (neutral)
            d[i + 1] = ny;  // G = Ny (tilt up/down)
            d[i + 2] = nz;  // B = Nz
            d[i + 3] = 255;
        }
        ctx.putImageData(id, 0, 0);

        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }
}
