/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/* global THREE */

import { Container } from '../models/Container.js';
import { Vector3D }   from '../models/Vector3D.js';
import { TextureFactory } from './TextureFactory.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function cloneTex(baseTex, rx, ry) {
    const t = baseTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(0.5, rx), Math.max(0.5, ry));
    return t;
}

/**
 * Corrugated PlaneBufferGeometry: sine-wave vertex displacement in local Z.
 * Ridges run along the height axis, spaced across the width axis.
 *
 * @param {number} width   – plane width  (cm)
 * @param {number} height  – plane height (cm)
 * @param {number} ridgeW  – ridge pitch  (cm)
 * @param {number} amp     – ridge amplitude (cm)
 */
function makeCorrugatedGeo(width, height, ridgeW, amp) {
    const numRidges = Math.max(4, Math.round(width / ridgeW));
    const segsX     = numRidges * 8;   // 8 verts per ridge → smooth sine curve
    const segsY     = Math.max(2, Math.round(height / ridgeW));
    const geo       = new THREE.PlaneBufferGeometry(width, height, segsX, segsY);
    const pos       = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const t = (x / width + 0.5) * Math.PI * 2 * numRidges;
        pos.setZ(i, Math.sin(t) * amp);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
}

/** Shared corrugated steel wall material (cloned per mesh). */
function makeWallMat(color = 0xc8d0d8) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness:   0.45,
        metalness:   0.55,
        side:        THREE.FrontSide
    });
}

/** Ghost glass panel for see-through walls. */
function makeGhostMat() {
    return new THREE.MeshStandardMaterial({
        color:      0xbdd8f0,
        roughness:  0.08,
        metalness:  0.15,
        opacity:    0.18,
        transparent: true,
        side:        THREE.DoubleSide,
        depthWrite:  false
    });
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * A Container with Three.js visualization.
 * Renders either a full 6-sided shipping container (solid back/right/top/floor
 * + ghost front/left walls) or a wooden pallet.
 */
export class RenderableContainer extends Container {
    constructor(viewer, width, height, depth, options = {}) {
        super(width || 1, height || 1, depth || 1, options);

        // Bounding-box wireframe (all 12 edges) – always visible
        this.mesh = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
            new THREE.LineBasicMaterial({ color: 0x6a7480 })
        );

        this.viewer       = viewer;
        this._detailGroup = null;

        viewer.scene.add(this.mesh);
        viewer.container = this;
    }

    /** Resize the container and rebuild its 3-D detail geometry. */
    changeSize(width, height, depth, options = {}) {
        this.size         = new Vector3D(width, height, depth);
        this.isPallet     = options.isPallet     || false;
        this.palletHeight = options.palletHeight || 0;
        this.maxWeight    = options.maxWeight !== undefined ? options.maxWeight : Infinity;

        const yOffset = this.palletHeight;
        this.mesh.scale.set(width, height, depth);
        this.mesh.position.set(width / 2, height / 2 + yOffset, depth / 2);
        this.mesh.material.color.setHex(this.isPallet ? 0x776655 : 0x4a5560);

        this.viewer.controls.target.set(width / 2, (height / 2) + yOffset, depth / 2);
        this._resetCamera(width, height, depth, yOffset);
        this._rebuildDetail();
    }

    /** Position camera to frame the container nicely. */
    _resetCamera(W, H, D, yOffset) {
        const maxDim = Math.max(W, H, D);
        const dist   = maxDim * 1.6 + 300;
        // Offset toward front-right-above for a natural isometric feel
        this.viewer.camera.position.set(
            W * 0.65 + dist * 0.35,
            H * 0.8  + yOffset + dist * 0.25,
            D        + dist * 0.40
        );
    }

    _rebuildDetail() {
        if (this._detailGroup) {
            this.viewer.scene.remove(this._detailGroup);
            this._detailGroup.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
                }
            });
            this._detailGroup = null;
        }

        this._detailGroup = this.isPallet ? this._buildPallet() : this._buildContainer();
        if (this._detailGroup) this.viewer.scene.add(this._detailGroup);
    }

    // ── Wooden pallet ─────────────────────────────────────────────────────────
    _buildPallet() {
        const W = this.size.x, D = this.size.z, H = this.palletHeight;
        if (H <= 0) return null;

        const group   = new THREE.Group();
        const baseTex = TextureFactory.getWoodTexture();
        const TILE    = 50;

        const mkMat = (col, rx, ry) => new THREE.MeshStandardMaterial({
            map: cloneTex(baseTex, rx, ry), color: col, roughness: 0.87, metalness: 0.0
        });

        const topH = H * 0.27, btmH = H * 0.15, strH = H - topH - btmH;

        // Top deck – 5 planks with small gaps
        for (let i = 0; i < 5; i++) {
            const pw = W / 5, gap = pw * 0.10;
            const m = new THREE.Mesh(
                new THREE.BoxGeometry(pw - gap, topH, D),
                mkMat(0xc8a070, (pw - gap) / TILE, D / TILE)
            );
            m.position.set((i + 0.5) * pw, H - topH / 2, D / 2);
            m.castShadow = m.receiveShadow = true;
            group.add(m);
        }

        // 3 longitudinal stringers
        const sW = W * 0.12;
        for (const sx of [W * 0.10, W * 0.50, W * 0.90]) {
            const m = new THREE.Mesh(
                new THREE.BoxGeometry(sW, strH, D),
                mkMat(0x8a5530, sW / TILE, D / TILE)
            );
            m.position.set(sx, btmH + strH / 2, D / 2);
            m.castShadow = m.receiveShadow = true;
            group.add(m);
        }

        // Bottom boards – 3
        for (let i = 0; i < 3; i++) {
            const bw = W / 3, gap = bw * 0.06;
            const m = new THREE.Mesh(
                new THREE.BoxGeometry(bw - gap, btmH, D),
                mkMat(0xb89060, (bw - gap) / TILE, D / TILE)
            );
            m.position.set((i + 0.5) * bw, btmH / 2, D / 2);
            m.castShadow = m.receiveShadow = true;
            group.add(m);
        }

        return group;
    }

    // ── Shipping container ────────────────────────────────────────────────────
    // All 6 sides are rendered:
    //   • Back (z=D), Right (x=W), Top (y=H), Floor (y=0) → solid corrugated steel
    //   • Front (z=0), Left (x=0)                         → ghost glass panels
    // Corner posts and horizontal rails complete the frame.
    _buildContainer() {
        const W = this.size.x, H = this.size.y, D = this.size.z;
        const yOff = this.palletHeight;
        const group = new THREE.Group();

        const ridgeW = Math.max(6, Math.min(18, W * 0.035));
        const amp    = ridgeW * 0.20;
        const TILE   = 110;

        // ── Solid steel material (one per face to allow independent opacity) ──
        const solidMat = () => makeWallMat(0xc8d0d8);

        // Back wall (z = D) — closed end of container, faces −Z
        {
            const geo  = makeCorrugatedGeo(W, H, ridgeW, amp);
            const mesh = new THREE.Mesh(geo, solidMat());
            mesh.rotation.y = Math.PI;
            mesh.position.set(W / 2, H / 2 + yOff, D);
            mesh.castShadow = mesh.receiveShadow = true;
            group.add(mesh);
        }

        // Right wall (x = W) — faces −X from outside
        {
            const geo  = makeCorrugatedGeo(D, H, ridgeW, amp);
            const mesh = new THREE.Mesh(geo, solidMat());
            mesh.rotation.y = -Math.PI / 2;
            mesh.position.set(W, H / 2 + yOff, D / 2);
            mesh.castShadow = mesh.receiveShadow = true;
            group.add(mesh);
        }

        // Top wall (y = H) — corrugated roof, slightly transparent for interior visibility
        {
            const geo  = makeCorrugatedGeo(W, D, ridgeW, amp);
            const mat  = solidMat();
            mat.opacity     = 0.72;
            mat.transparent = true;
            mat.depthWrite  = false;
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(W / 2, H + yOff, D / 2);
            mesh.receiveShadow = true;
            group.add(mesh);
        }

        // Floor (y = 0) — metal checker-plate
        {
            const baseTex = TextureFactory.getMetalTexture();
            const mesh    = new THREE.Mesh(
                new THREE.PlaneGeometry(W, D),
                new THREE.MeshStandardMaterial({
                    map:                  cloneTex(baseTex, W / TILE, D / TILE),
                    color:                0xd0d4d8,
                    roughness:            0.85,
                    metalness:            0.30,
                    polygonOffset:        true,
                    polygonOffsetFactor: -1,
                    polygonOffsetUnits:  -1
                })
            );
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(W / 2, yOff, D / 2);
            mesh.receiveShadow = true;
            group.add(mesh);
        }

        // Ghost front wall (z = 0) — loading-door end, see-through
        {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), makeGhostMat());
            mesh.position.set(W / 2, H / 2 + yOff, 0);
            group.add(mesh);
        }

        // Ghost left wall (x = 0) — see-through side
        {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(D, H), makeGhostMat());
            mesh.rotation.y = Math.PI / 2;
            mesh.position.set(0, H / 2 + yOff, D / 2);
            group.add(mesh);
        }

        // ── Structural frame: corner posts + horizontal rails ─────────────────
        const pw      = Math.max(4, Math.min(W, D) * 0.025);
        const postMat = new THREE.MeshStandardMaterial({ color: 0xdde0e4, roughness: 0.45, metalness: 0.58 });
        const railMat = new THREE.MeshStandardMaterial({ color: 0xd5d8dc, roughness: 0.42, metalness: 0.60 });

        // 4 vertical corner posts
        for (const [cx, cz] of [
            [pw / 2,     pw / 2    ],
            [W - pw / 2, pw / 2    ],
            [pw / 2,     D - pw / 2],
            [W - pw / 2, D - pw / 2]
        ]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(pw, H, pw), postMat);
            post.position.set(cx, yOff + H / 2, cz);
            post.castShadow = post.receiveShadow = true;
            group.add(post);
        }

        // Top & bottom horizontal rails along width and depth
        const rw = pw * 0.80;
        for (const ry of [yOff + rw / 2, yOff + H - rw / 2]) {
            // Along width (X axis)
            for (const rz of [rw / 2, D - rw / 2]) {
                const r = new THREE.Mesh(new THREE.BoxGeometry(W, rw, rw), railMat);
                r.position.set(W / 2, ry, rz);
                r.castShadow = r.receiveShadow = true;
                group.add(r);
            }
            // Along depth (Z axis)
            for (const rx of [rw / 2, W - rw / 2]) {
                const r = new THREE.Mesh(new THREE.BoxGeometry(rw, rw, D), railMat);
                r.position.set(rx, ry, D / 2);
                r.castShadow = r.receiveShadow = true;
                group.add(r);
            }
        }

        // Door seam: vertical dividing line on back wall (centre)
        {
            const seamMat = new THREE.LineBasicMaterial({ color: 0xa0a8b0, linewidth: 1 });
            const pts     = [
                new THREE.Vector3(W / 2, yOff,      D + amp + 1),
                new THREE.Vector3(W / 2, yOff + H,  D + amp + 1)
            ];
            const seam = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), seamMat);
            group.add(seam);
        }

        return group;
    }
}
