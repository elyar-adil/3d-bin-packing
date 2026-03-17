/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/* global THREE */

import { Box } from '../models/Box.js';
import { TextureFactory } from './TextureFactory.js';
import { getGroupColor } from './groupColors.js';

function cloneTex(baseTex, rx, ry) {
    const t = baseTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(0.5, rx), Math.max(0.5, ry));
    return t;
}

/** A Box with a Three.js mesh representing corrugated cardboard. */
export class RenderableBox extends Box {
    constructor(color, viewer, width, height, depth, options = {}) {
        super(width, height, depth, options);
        this.color  = color;
        this.viewer = viewer;

        const finalColor = options.group ? (getGroupColor(options.group) ?? color) : color;
        const TILE = 40; // cm per texture tile
        const baseTex = TextureFactory.getCardboardTexture();

        // Use white color so the cardboard texture shows its natural warm brown.
        // Group identity is conveyed via a subtle emissive tint + colored edge lines.
        // (Multiplying the group color directly onto the texture would produce near-black.)
        const emissiveColor = new THREE.Color(finalColor).multiplyScalar(0.22);
        const tex = cloneTex(baseTex,
            Math.max(1, (width + depth) * 0.5 / TILE),
            Math.max(1, height / TILE));
        const material = new THREE.MeshStandardMaterial({
            map:                 tex,
            color:               0xffffff,      // white → texture shows naturally
            emissive:            emissiveColor, // soft group-color glow
            opacity:             options.fragile ? 0.78 : 1.0,
            metalness:           0.0,
            roughness:           0.82,
            transparent:         !!options.fragile,
            polygonOffset:       true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits:  1
        });

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow    = true;
        this.mesh.receiveShadow = true;
        this.mesh.visible       = false;

        // Edge lines use group color — primary visual identifier for each box group
        const edgeMat = new THREE.LineBasicMaterial({ color: finalColor, opacity: 0.85, transparent: true });
        this.edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMat);
        this.mesh.add(this.edges);

        if (options.fragile) this._addFragileIndicator();

        viewer.scene.add(this.mesh);
        viewer.boxes.push(this);
    }

    _addFragileIndicator() {
        const mat = new THREE.LineBasicMaterial({ color: 0xff2200, linewidth: 2 });
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
