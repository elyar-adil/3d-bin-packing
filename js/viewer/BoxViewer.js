/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/* global THREE, OrbitControls */

import { resetGroupColors } from './groupColors.js';

/** Three.js WebGL renderer + scene + camera + OrbitControls wrapper. */
export class BoxViewer {
    constructor(canvas) {
        this.canvas = canvas;

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setClearColor(0xdde2e8);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        // physicallyCorrectLights / outputEncoding omitted: incompatible with Three.js r81

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xdde2e8);
        // Subtle exponential fog gives depth without obscuring boxes
        this.scene.fog = new THREE.FogExp2(0xdde2e8, 0.0006);

        this.camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight);
        this.camera.position.set(200, 200, 300);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.5;
        this.controls.enableZoom   = true;

        this._setupLights();
        this._addGroundPlane();

        this.boxes     = [];
        this.container = null;
    }

    /** Large white infinite-ish ground plane that receives shadows. */
    _addGroundPlane() {
        const geo = new THREE.PlaneGeometry(8000, 8000);
        const mat = new THREE.MeshStandardMaterial({
            color:     0xffffff,
            roughness: 0.92,
            metalness: 0.0
        });
        const plane = new THREE.Mesh(geo, mat);
        plane.rotation.x    = -Math.PI / 2;
        plane.position.y    = 0;
        plane.receiveShadow = true;
        this.scene.add(plane);
    }

    _setupLights() {
        this.scene.add(new THREE.AmbientLight(0xfff4e0, 0.75));

        const key = new THREE.DirectionalLight(0xfffaf0, 1.10);
        key.position.set(400, 600, 500);
        key.castShadow = true;
        key.shadow.mapSize.width  = 2048;
        key.shadow.mapSize.height = 2048;
        key.shadow.camera.near    = 1;
        key.shadow.camera.far     = 4000;
        key.shadow.camera.left    = -1200;
        key.shadow.camera.right   =  1200;
        key.shadow.camera.top     =  1200;
        key.shadow.camera.bottom  = -1200;
        key.shadow.bias           = -0.001;
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0xd0e8ff, 0.55);
        fill.position.set(-400, 350, -400);
        this.scene.add(fill);

        const rim = new THREE.DirectionalLight(0xffe8c0, 0.30);
        rim.position.set(100, -200, -300);
        this.scene.add(rim);
    }

    resize() {
        const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    clearBoxes() {
        for (const b of this.boxes) b.removeFromScene();
        this.boxes = [];
        resetGroupColors();
    }

    update() {
        const palletHeight = this.container ? this.container.palletHeight : 0;
        this.boxes.forEach(b => b.updateMesh(palletHeight));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
