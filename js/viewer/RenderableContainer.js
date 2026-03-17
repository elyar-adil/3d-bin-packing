/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/* global THREE */

import { Container } from '../models/Container.js';
import { Vector3D } from '../models/Vector3D.js';
import { TextureFactory } from './TextureFactory.js';

function cloneTex(baseTex, rx, ry) {
    const t = baseTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(0.5, rx), Math.max(0.5, ry));
    return t;
}

/** A Container with Three.js visualization (wireframe + pallet or shipping-container detail). */
export class RenderableContainer extends Container {
    constructor(viewer, width, height, depth, options = {}) {
        super(width || 1, height || 1, depth || 1, options);

        this.mesh = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
            new THREE.LineBasicMaterial({ color: 0x888888 })
        );

        this.viewer       = viewer;
        this._detailGroup = null;

        viewer.scene.add(this.mesh);
        viewer.container = this;
    }

    changeSize(width, height, depth, options = {}) {
        this.size        = new Vector3D(width, height, depth);
        this.isPallet    = options.isPallet    || false;
        this.palletHeight = options.palletHeight || 0;
        this.maxWeight   = options.maxWeight !== undefined ? options.maxWeight : Infinity;

        const yOffset = this.palletHeight;
        this.mesh.scale.set(width, height, depth);
        this.mesh.position.set(width / 2, height / 2 + yOffset, depth / 2);
        this.mesh.material.color.setHex(this.isPallet ? 0x777766 : 0x555a60);

        this.viewer.controls.target.set(width / 2, (height + yOffset) / 2, depth / 2);
        this._rebuildDetail();
    }

    _rebuildDetail() {
        if (this._detailGroup) {
            this.viewer.scene.remove(this._detailGroup);
            this._detailGroup.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) {
                    (Array.isArray(c.material) ? c.material : [c.material])
                        .forEach(m => { m.map = null; m.dispose(); });
                }
            });
            this._detailGroup = null;
        }

        this._detailGroup = this.isPallet ? this._buildPallet() : this._buildContainer();
        if (this._detailGroup) this.viewer.scene.add(this._detailGroup);
    }

    // ── Wooden pallet: top planks + 3 stringers + bottom boards ──────────────
    _buildPallet() {
        const W = this.size.x, D = this.size.z, H = this.palletHeight;
        if (H <= 0) return null;

        const group    = new THREE.Group();
        const baseTex  = TextureFactory.getWoodTexture();
        const TILE     = 50;

        const mkMat = (col, rx, ry) => new THREE.MeshStandardMaterial({
            map: cloneTex(baseTex, rx, ry), color: col, roughness: 0.87, metalness: 0.0
        });

        const topH = H * 0.27, btmH = H * 0.15, strH = H - topH - btmH;

        // Top deck — 5 planks
        for (let i = 0; i < 5; i++) {
            const pw = W / 5, gap = pw * 0.10;
            const geo = new THREE.BoxGeometry(pw - gap, topH, D);
            const m = new THREE.Mesh(geo, mkMat(0xc8a070, (pw - gap) / TILE, D / TILE));
            m.position.set((i + 0.5) * pw, H - topH / 2, D / 2);
            m.castShadow = m.receiveShadow = true;
            group.add(m);
        }

        // 3 stringers
        const sW = W * 0.12;
        for (const sx of [W * 0.10, W * 0.50, W * 0.90]) {
            const geo = new THREE.BoxGeometry(sW, strH, D);
            const m = new THREE.Mesh(geo, mkMat(0x8a5530, sW / TILE, D / TILE));
            m.position.set(sx, btmH + strH / 2, D / 2);
            m.castShadow = m.receiveShadow = true;
            group.add(m);
        }

        // Bottom boards — 3
        for (let i = 0; i < 3; i++) {
            const bw = W / 3, gap = bw * 0.06;
            const geo = new THREE.BoxGeometry(bw - gap, btmH, D);
            const m = new THREE.Mesh(geo, mkMat(0xb89060, (bw - gap) / TILE, D / TILE));
            m.position.set((i + 0.5) * bw, btmH / 2, D / 2);
            m.castShadow = m.receiveShadow = true;
            group.add(m);
        }

        return group;
    }

    // ── Shipping container: corrugated steel floor + semi-transparent walls ───
    _buildContainer() {
        const W = this.size.x, H = this.size.y, D = this.size.z;
        const yOff = this.palletHeight;
        const group = new THREE.Group();
        const baseTex = TextureFactory.getMetalTexture();
        const TILE = 90;

        // ── Floor (checker-plate steel, neutral gray) ─────────────────────────
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(W, D),
            new THREE.MeshStandardMaterial({
                map: cloneTex(baseTex, W / TILE, D / TILE),
                color: 0xa0a6ac, roughness: 0.80, metalness: 0.40, side: THREE.FrontSide
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(W / 2, yOff, D / 2);
        floor.receiveShadow = true;
        group.add(floor);

        // ── Ceiling (semi-transparent, white corrugated steel) ────────────────
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(W, D),
            new THREE.MeshStandardMaterial({
                map: cloneTex(baseTex, W / TILE, D / TILE),
                color: 0xf2f4f6, roughness: 0.60, metalness: 0.35,
                transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false
            })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(W / 2, yOff + H, D / 2);
        group.add(ceiling);

        // ── Walls (semi-transparent white corrugated steel) ───────────────────
        const mkWall = (rx, ry) => new THREE.MeshStandardMaterial({
            map: cloneTex(baseTex, rx, ry),
            color: 0xf0f2f5, roughness: 0.55, metalness: 0.45,
            transparent: true, opacity: 0.20, side: THREE.DoubleSide, depthWrite: false
        });

        const addWall = (geo, mat, pos, rotY = 0) => {
            const m = new THREE.Mesh(geo, mat);
            m.rotation.y = rotY;
            m.position.copy(pos);
            group.add(m);
        };

        const wGeo = new THREE.PlaneGeometry(W, H);
        addWall(wGeo,        mkWall(W / TILE, H / TILE), new THREE.Vector3(W/2, H/2+yOff, 0));
        addWall(wGeo.clone(), mkWall(W / TILE, H / TILE), new THREE.Vector3(W/2, H/2+yOff, D), Math.PI);

        const sGeo = new THREE.PlaneGeometry(D, H);
        addWall(sGeo,        mkWall(D / TILE, H / TILE), new THREE.Vector3(0,   H/2+yOff, D/2), Math.PI / 2);
        addWall(sGeo.clone(), mkWall(D / TILE, H / TILE), new THREE.Vector3(W,   H/2+yOff, D/2), -Math.PI / 2);

        // ── Corner posts (steel columns at 4 vertical edges) ─────────────────
        const pt = Math.max(3, Math.min(W, D) * 0.028);
        const postMat = new THREE.MeshStandardMaterial({ color: 0xc4c9d0, roughness: 0.45, metalness: 0.65 });
        for (const [cx, cz] of [[pt/2,pt/2],[W-pt/2,pt/2],[pt/2,D-pt/2],[W-pt/2,D-pt/2]]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(pt, H, pt), postMat);
            post.position.set(cx, yOff + H/2, cz);
            post.castShadow = true;
            group.add(post);
        }

        // ── Horizontal top & bottom rails (4 edges each) ─────────────────────
        const rt = pt * 0.75;
        const railMat = new THREE.MeshStandardMaterial({ color: 0xb5bcc5, roughness: 0.40, metalness: 0.70 });
        for (const ry of [yOff + rt / 2, yOff + H - rt / 2]) {
            for (const rz of [rt / 2, D - rt / 2]) {
                const r = new THREE.Mesh(new THREE.BoxGeometry(W, rt, rt), railMat);
                r.position.set(W / 2, ry, rz);
                group.add(r);
            }
            for (const rx of [rt / 2, W - rt / 2]) {
                const r = new THREE.Mesh(new THREE.BoxGeometry(rt, rt, D), railMat);
                r.position.set(rx, ry, D / 2);
                group.add(r);
            }
        }

        return group;
    }
}
