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
        this.mesh.material.color.setHex(this.isPallet ? 0x777766 : 0x3355aa);

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

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(W, D),
            new THREE.MeshStandardMaterial({
                map: cloneTex(baseTex, W / TILE, D / TILE),
                color: 0x5a8060, roughness: 0.75, metalness: 0.35, side: THREE.FrontSide
            })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(W / 2, yOff, D / 2);
        floor.receiveShadow = true;
        group.add(floor);

        const mkWall = (rx, ry) => new THREE.MeshStandardMaterial({
            map: cloneTex(baseTex, rx, ry),
            color: 0x4a7055, roughness: 0.65, metalness: 0.40,
            transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false
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

        return group;
    }
}
