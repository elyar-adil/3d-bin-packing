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

/**
 * Build a corrugated PlaneGeometry where vertices are displaced in Z
 * to form actual sine-wave ridges (not just a texture effect).
 *
 * @param {number} width   - total width of the plane
 * @param {number} height  - total height of the plane
 * @param {number} ridgeW  - approximate ridge pitch (cm)
 * @param {number} amp     - ridge amplitude (depth of corrugation)
 */
function makeCorrugatedGeo(width, height, ridgeW, amp) {
    const numRidges  = Math.max(4, Math.round(width / ridgeW));
    const segsX      = numRidges * 8;   // 8 verts per ridge → smooth sine
    const segsY      = Math.max(2, Math.round(height / ridgeW));
    // Must use PlaneBufferGeometry (not PlaneGeometry) in r81 to get BufferAttribute API
    const geo        = new THREE.PlaneBufferGeometry(width, height, segsX, segsY);
    const pos        = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);           // local plane x ∈ [-w/2, w/2]
        // Sine wave across width: one full period = ridgeW
        const t = (x / width + 0.5) * Math.PI * 2 * numRidges;
        pos.setZ(i, Math.sin(t) * amp);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
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

    // ── Shipping container: cutaway cross-section view ────────────────────────
    // Front (z=0) and left (x=0) walls are omitted so the interior is visible.
    // Back and right walls are solid corrugated steel.
    _buildContainer() {
        const W = this.size.x, H = this.size.y, D = this.size.z;
        const yOff = this.palletHeight;
        const group = new THREE.Group();

        // Corrugation geometry parameters
        const ridgeW = Math.max(8, Math.min(20, W * 0.04));
        const amp    = ridgeW * 0.18;

        // ── Solid corrugated steel wall material ──────────────────────────────
        const wallMat = new THREE.MeshStandardMaterial({
            color:       0xd8dde3,
            roughness:   0.50,
            metalness:   0.50,
            side:        THREE.FrontSide
        });

        // Back wall (z=D) — visible from front
        const backGeo = makeCorrugatedGeo(W, H, ridgeW, amp);
        const back = new THREE.Mesh(backGeo, wallMat.clone());
        back.rotation.y = Math.PI;
        back.position.set(W/2, H/2 + yOff, D);
        back.castShadow = back.receiveShadow = true;
        group.add(back);

        // Right wall (x=W) — visible from left
        const rightGeo = makeCorrugatedGeo(D, H, ridgeW, amp);
        const right = new THREE.Mesh(rightGeo, wallMat.clone());
        right.rotation.y = -Math.PI / 2;
        right.position.set(W, H/2 + yOff, D/2);
        right.castShadow = right.receiveShadow = true;
        group.add(right);

        // ── Floor (solid light-gray steel checker-plate) ──────────────────────
        const baseTex = TextureFactory.getMetalTexture();
        const TILE = 110;
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(W, D),
            new THREE.MeshStandardMaterial({
                map:            cloneTex(baseTex, W/TILE, D/TILE),
                color:          0xd4d6d8,
                roughness:      0.88,
                metalness:      0.28,
                polygonOffset:      true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits:  -1
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(W/2, yOff, D/2);
        floor.receiveShadow = true;
        group.add(floor);

        // ── Structural steel: shared materials ────────────────────────────────
        const postMat = new THREE.MeshStandardMaterial({ color: 0xe0e2e5, roughness: 0.48, metalness: 0.52 });
        const railMat = new THREE.MeshStandardMaterial({ color: 0xd8dadd, roughness: 0.44, metalness: 0.56 });

        // Corner post thickness scales with container size
        const pw = Math.max(4, Math.min(W, D) * 0.030);

        // ── 4 Vertical corner posts ───────────────────────────────────────────
        for (const [cx, cz] of [[pw/2,pw/2],[W-pw/2,pw/2],[pw/2,D-pw/2],[W-pw/2,D-pw/2]]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(pw, H, pw), postMat);
            post.position.set(cx, yOff + H/2, cz);
            post.castShadow = post.receiveShadow = true;
            group.add(post);
        }

        // ── Top & bottom horizontal rails ─────────────────────────────────────
        const rw = pw * 0.78;
        for (const ry of [yOff + rw/2, yOff + H - rw/2]) {
            for (const rz of [rw/2, D - rw/2]) {
                const r = new THREE.Mesh(new THREE.BoxGeometry(W, rw, rw), railMat);
                r.position.set(W/2, ry, rz);
                r.castShadow = r.receiveShadow = true;
                group.add(r);
            }
            for (const rx of [rw/2, W - rw/2]) {
                const r = new THREE.Mesh(new THREE.BoxGeometry(rw, rw, D), railMat);
                r.position.set(rx, ry, D/2);
                r.castShadow = r.receiveShadow = true;
                group.add(r);
            }
        }

        return group;
    }
}
