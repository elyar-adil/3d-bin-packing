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

    // ── Shipping container: white corrugated steel, ISO structure ─────────────
    _buildContainer() {
        const W = this.size.x, H = this.size.y, D = this.size.z;
        const yOff = this.palletHeight;
        const group = new THREE.Group();
        const baseTex = TextureFactory.getMetalTexture();

        // TILE controls texture repeat:  W/TILE ≈ 2.7 repeats on a W=300 container
        // ridgeWidth=60 in the texture → ~8.5 ridges/repeat → ~23 ridges total (realistic)
        const TILE = 110;

        // ── Semi-transparent corrugated walls ─────────────────────────────────
        const mkWallMat = (rx, ry) => new THREE.MeshStandardMaterial({
            map:         cloneTex(baseTex, rx, ry),
            color:       0xf8f8fa,
            roughness:   0.52, metalness: 0.42,
            transparent: true, opacity: 0.16,
            side:        THREE.DoubleSide, depthWrite: false
        });

        const addWall = (geo, mat, pos, rotY = 0) => {
            const m = new THREE.Mesh(geo, mat);
            m.rotation.y = rotY;
            m.position.copy(pos);
            group.add(m);
        };

        // Long walls (front z=0 / back z=D)
        const wGeo = new THREE.PlaneGeometry(W, H);
        addWall(wGeo,        mkWallMat(W/TILE, H/TILE), new THREE.Vector3(W/2, H/2+yOff, 0));
        addWall(wGeo.clone(), mkWallMat(W/TILE, H/TILE), new THREE.Vector3(W/2, H/2+yOff, D), Math.PI);

        // Short side walls (x=0 / x=W)
        const sGeo = new THREE.PlaneGeometry(D, H);
        addWall(sGeo,        mkWallMat(D/TILE, H/TILE), new THREE.Vector3(0, H/2+yOff, D/2),  Math.PI/2);
        addWall(sGeo.clone(), mkWallMat(D/TILE, H/TILE), new THREE.Vector3(W, H/2+yOff, D/2), -Math.PI/2);

        // ── Floor (solid light-gray steel checker-plate) ──────────────────────
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(W, D),
            new THREE.MeshStandardMaterial({
                map: cloneTex(baseTex, W/TILE, D/TILE),
                color: 0xd4d6d8, roughness: 0.88, metalness: 0.28
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(W/2, yOff, D/2);
        floor.receiveShadow = true;
        group.add(floor);

        // ── Ceiling (semi-transparent) ────────────────────────────────────────
        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(W, D),
            mkWallMat(W/TILE, D/TILE)
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(W/2, yOff + H, D/2);
        group.add(ceiling);

        // ── Structural steel: shared materials ────────────────────────────────
        const postMat  = new THREE.MeshStandardMaterial({ color: 0xe8eaec, roughness: 0.48, metalness: 0.52 });
        const railMat  = new THREE.MeshStandardMaterial({ color: 0xe2e4e6, roughness: 0.44, metalness: 0.56 });
        const castMat  = new THREE.MeshStandardMaterial({ color: 0xd6d8dc, roughness: 0.38, metalness: 0.68 });

        // Corner post thickness scales with container size
        const pw = Math.max(4, Math.min(W, D) * 0.030);

        // ── 4 Vertical corner posts ───────────────────────────────────────────
        for (const [cx, cz] of [[pw/2,pw/2],[W-pw/2,pw/2],[pw/2,D-pw/2],[W-pw/2,D-pw/2]]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(pw, H, pw), postMat);
            post.position.set(cx, yOff + H/2, cz);
            post.castShadow = true;
            group.add(post);
        }

        // ── Top & bottom horizontal rails (4 edges each level) ───────────────
        const rw = pw * 0.78;
        for (const ry of [yOff + rw/2, yOff + H - rw/2]) {
            // Rails along X (front + back)
            for (const rz of [rw/2, D - rw/2]) {
                const r = new THREE.Mesh(new THREE.BoxGeometry(W, rw, rw), railMat);
                r.position.set(W/2, ry, rz);
                group.add(r);
            }
            // Rails along Z (left + right)
            for (const rx of [rw/2, W - rw/2]) {
                const r = new THREE.Mesh(new THREE.BoxGeometry(rw, rw, D), railMat);
                r.position.set(rx, ry, D/2);
                group.add(r);
            }
        }

        // ── ISO corner castings at all 8 corners ──────────────────────────────
        // Proportionally sized box fittings — slightly larger than post cross-section
        const cfw = pw * 1.90, cfh = pw * 1.30;
        for (const [cx, cy, cz] of [
            [0, yOff,   0], [W, yOff,   0], [0, yOff,   D], [W, yOff,   D],
            [0, yOff+H, 0], [W, yOff+H, 0], [0, yOff+H, D], [W, yOff+H, D]
        ]) {
            const casting = new THREE.Mesh(new THREE.BoxGeometry(cfw, cfh, cfw), castMat);
            casting.position.set(cx, cy, cz);
            group.add(casting);
        }

        return group;
    }
}
