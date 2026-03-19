/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/* global THREE */

import { Box }          from '../models/Box.js';
import { TextureFactory } from './TextureFactory.js';
import { getGroupColor }  from './groupColors.js';

function cloneTex(baseTex, rx, ry) {
    const t = baseTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(0.5, rx), Math.max(0.5, ry));
    return t;
}

/**
 * A Box with a Three.js mesh.
 *
 * Each box type (distinguished by `color` or `group`) renders with its own
 * distinct colour applied directly to the material. The cardboard texture's
 * near-white base lets the colour come through at full saturation, so boxes
 * are easily told apart at a glance.
 */
export class RenderableBox extends Box {
    constructor(color, viewer, width, height, depth, options = {}) {
        super(width, height, depth, options);
        this.color  = color;
        this.viewer = viewer;

        // Group color overrides individual color when a group is set
        const faceColor = options.group ? (getGroupColor(options.group) ?? color) : color;

        const TILE      = 40; // cm per texture tile
        const texScale  = Math.max(1, (width + depth) * 0.5 / TILE);
        const texScaleH = Math.max(1, height / TILE);
        const baseTex   = TextureFactory.getCardboardTexture();

        const material = new THREE.MeshStandardMaterial({
            // Apply the assigned colour directly — the near-white cardboard
            // texture modulates it, giving a naturally-tinted cardboard look.
            color:               new THREE.Color(faceColor),
            map:                 cloneTex(baseTex, texScale, texScaleH),
            normalMap:           cloneTex(TextureFactory.getCardboardNormalMap(), texScale, texScaleH),
            normalScale:         new THREE.Vector2(0.5, 0.5),
            emissive:            new THREE.Color(0x000000),
            opacity:             options.fragile ? 0.75 : 1.0,
            metalness:           0.0,
            roughness:           0.82,
            transparent:         !!options.fragile,
            polygonOffset:       true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits:  1
        });

        const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow    = true;
        this.mesh.receiveShadow = true;
        this.mesh.visible       = false;

        // Dark edge lines — sharply visible against any box colour
        const edgeMat = new THREE.LineBasicMaterial({
            color:       0x000000,
            opacity:     0.45,
            transparent: true
        });
        this.edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMat);
        this.mesh.add(this.edges);

        if (options.fragile) this._addFragileIndicator();

        viewer.scene.add(this.mesh);
        viewer.boxes.push(this);
    }

    _addFragileIndicator() {
        const mat  = new THREE.LineBasicMaterial({ color: 0xff2200, linewidth: 2 });
        const pts1 = [new THREE.Vector3(-0.5, 0.5, -0.5), new THREE.Vector3( 0.5, 0.5,  0.5)];
        const pts2 = [new THREE.Vector3( 0.5, 0.5, -0.5), new THREE.Vector3(-0.5, 0.5,  0.5)];
        this.mesh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts1), mat));
        this.mesh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), mat));
    }

    set visible(v) { this.mesh.visible = !!v; }
    get visible()  { return this.mesh.visible; }

    updateMesh(palletHeight = 0) {
        this.mesh.scale.set(this.size.x, this.size.y, this.size.z);
        this.mesh.position.set(
            this.position.x + this.size.x / 2,
            this.position.y + this.size.y / 2 + palletHeight,
            this.position.z + this.size.z / 2
        );
    }

    removeFromScene() {
        if (!this.viewer || !this.mesh) return;
        this.viewer.scene.remove(this.mesh);
        const m = this.mesh.material;
        if (m && m.map) m.map.dispose();
        if (m) m.dispose();
    }
}
