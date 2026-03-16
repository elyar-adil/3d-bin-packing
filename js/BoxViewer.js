import { Box, Container, Vector3D } from './BinPackingSolver.js'

// Group color palette - different hues for different groups
const GROUP_COLORS = [
    0x4e79a7, 0xf28e2b, 0xe15759, 0x76b7b2, 0x59a14f,
    0xedc948, 0xb07aa1, 0xff9da7, 0x9c755f, 0xbab0ac
];

let _groupColorMap = {};
let _groupColorIndex = 0;

function getGroupColor(group) {
    if (group == null) return null;
    if (_groupColorMap[group] === undefined) {
        _groupColorMap[group] = GROUP_COLORS[_groupColorIndex % GROUP_COLORS.length];
        _groupColorIndex++;
    }
    return _groupColorMap[group];
}

function resetGroupColors() {
    _groupColorMap = {};
    _groupColorIndex = 0;
}

class RenderableBox extends Box {
    constructor(color, viewer, width, height, depth, options = {}) {
        super(width, height, depth, options);
        this.color = color;
        this.viewer = viewer;

        // Determine final color: group color takes priority if set
        let finalColor = color;
        if (options.group) {
            const gc = getGroupColor(options.group);
            if (gc !== null) finalColor = gc;
        }

        var material = new THREE.MeshStandardMaterial({
            color: finalColor,
            opacity: options.fragile ? 0.75 : 0.9,
            metalness: 0.2,
            roughness: 1,
            transparent: true,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });
        var geometry = new THREE.BoxGeometry(1, 1, 1);
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.visible = false;

        // Add edge lines
        var edgeMaterial = new THREE.LineBasicMaterial({ color: 0x333333, opacity: 0.5, transparent: true });
        var edgeGeometry = new THREE.EdgesGeometry(geometry);
        this.edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        this.mesh.add(this.edges);

        // Fragile: add a red wireframe indicator on top face
        if (options.fragile) {
            this._addFragileIndicator();
        }

        viewer.scene.add(this.mesh);
        viewer.boxes.push(this);
    }

    _addFragileIndicator() {
        // Add a red cross/lines on top to indicate fragile
        var lineMat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
        // Top face cross: from (-0.5,-0.5) to (0.5,0.5) at y=0.5
        var pts1 = [
            new THREE.Vector3(-0.5, 0.5, -0.5),
            new THREE.Vector3(0.5, 0.5, 0.5)
        ];
        var pts2 = [
            new THREE.Vector3(0.5, 0.5, -0.5),
            new THREE.Vector3(-0.5, 0.5, 0.5)
        ];
        var geo1 = new THREE.BufferGeometry().setFromPoints(pts1);
        var geo2 = new THREE.BufferGeometry().setFromPoints(pts2);
        this.mesh.add(new THREE.Line(geo1, lineMat));
        this.mesh.add(new THREE.Line(geo2, lineMat));
    }

    set visible(v) {
        this.mesh.visible = !!v;
    }

    get visible() {
        return this.mesh.visible;
    }

    updateMesh(palletHeight) {
        const yOffset = palletHeight || 0;
        this.mesh.scale.x = this.size.x;
        this.mesh.scale.y = this.size.y;
        this.mesh.scale.z = this.size.z;
        this.mesh.position.x = this.position.x + this.size.x / 2;
        this.mesh.position.y = this.position.y + this.size.y / 2 + yOffset;
        this.mesh.position.z = this.position.z + this.size.z / 2;
    }

    removeFromScene() {
        if (this.viewer && this.mesh) {
            this.viewer.scene.remove(this.mesh);
        }
    }
}

class RenderableContainer extends Container {
    constructor(viewer, width, height, depth, options = {}) {
        super(width || 1, height || 1, depth || 1, options);

        var material = new THREE.LineBasicMaterial({ color: 0x888888 });
        var geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));

        this.mesh = new THREE.LineSegments(geometry, material);

        this.viewer = viewer;
        this._palletMesh = null;

        viewer.scene.add(this.mesh);
        viewer.container = this;
    }

    changeSize(width, height, depth, options = {}) {
        this.size = new Vector3D(width, height, depth);
        this.isPallet = options.isPallet || false;
        this.palletHeight = options.palletHeight || 0;
        this.maxWeight = options.maxWeight !== undefined ? options.maxWeight : Infinity;

        const yOffset = this.palletHeight;

        this.mesh.scale.x = this.size.x;
        this.mesh.scale.y = this.size.y;
        this.mesh.scale.z = this.size.z;
        this.mesh.position.x = this.size.x / 2;
        this.mesh.position.y = this.size.y / 2 + yOffset;
        this.mesh.position.z = this.size.z / 2;

        this.viewer.controls.target.set(
            this.size.x / 2,
            (this.size.y + yOffset) / 2,
            this.size.z / 2
        );

        this._updatePalletDeck();
    }

    _updatePalletDeck() {
        // Remove old pallet deck
        if (this._palletMesh) {
            this.viewer.scene.remove(this._palletMesh);
            this._palletMesh = null;
        }

        if (this.isPallet && this.palletHeight > 0) {
            var palletMaterial = new THREE.MeshStandardMaterial({
                color: 0x8B5E3C,
                roughness: 0.9,
                metalness: 0.0
            });
            var palletGeo = new THREE.BoxGeometry(1, 1, 1);
            this._palletMesh = new THREE.Mesh(palletGeo, palletMaterial);
            this._palletMesh.scale.x = this.size.x;
            this._palletMesh.scale.y = this.palletHeight;
            this._palletMesh.scale.z = this.size.z;
            this._palletMesh.position.x = this.size.x / 2;
            this._palletMesh.position.y = this.palletHeight / 2;
            this._palletMesh.position.z = this.size.z / 2;
            this.viewer.scene.add(this._palletMesh);
        }
    }
}

class BoxViewer {
    _setupLight(scene) {
        var ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        var directionalLight1 = new THREE.DirectionalLight(0xFFFFFF, 0.6);
        var directionalLight2 = new THREE.DirectionalLight(0xFFFFFF, 0.8);
        var directionalLight3 = new THREE.DirectionalLight(0xFFFFFF, 0.9);

        directionalLight1.position.set(3, 4, 5);
        directionalLight2.position.set(-3, 4, -5);
        directionalLight3.position.set(2, 5, 4);

        var origin = new THREE.Object3D();
        directionalLight1.target = origin;
        directionalLight2.target = origin;
        directionalLight3.target = origin;

        scene.add(ambientLight);
        scene.add(directionalLight1);
        scene.add(directionalLight2);
        scene.add(directionalLight3);
    }

    constructor(canvas) {
        this.canvas = canvas;

        this.renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.setClearColor(0xf8f9fa);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);

        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(
            50,
            canvas.clientWidth / canvas.clientHeight
        );
        this.camera.position.x = 200;
        this.camera.position.z = 300;
        this.camera.position.y = 200;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.5;
        this.controls.enableZoom = true;

        this._setupLight(this.scene);

        this.boxes = [];
        this.container = null;
    }

    resize() {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    clearBoxes() {
        for (const b of this.boxes) {
            b.removeFromScene();
        }
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

export { BoxViewer, RenderableBox, RenderableContainer, resetGroupColors }
