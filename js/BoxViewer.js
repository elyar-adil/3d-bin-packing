import { Box, Container, Vector3D } from './BinPackingSolver.js'

// Group color palette
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

// ─── Procedural texture factory ───────────────────────────────────────────────
class TextureFactory {
    static _cardboardTex = null;
    static _woodTex      = null;
    static _metalTex     = null;

    static getCardboardTexture() {
        if (!TextureFactory._cardboardTex)
            TextureFactory._cardboardTex = TextureFactory._makeCardboard();
        return TextureFactory._cardboardTex;
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

    // Corrugated cardboard — warm brown with horizontal flute lines
    static _makeCardboard() {
        const S = 512, cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');

        ctx.fillStyle = '#c4986a';
        ctx.fillRect(0, 0, S, S);

        // Corrugation flute lines
        for (let y = 0; y < S; y += 5) {
            ctx.fillStyle = `rgba(0,0,0,${(0.05 + Math.random() * 0.04).toFixed(3)})`;
            ctx.fillRect(0, y, S, 1);
            ctx.fillStyle = `rgba(255,220,160,${(0.04 + Math.random() * 0.03).toFixed(3)})`;
            ctx.fillRect(0, y + 2, S, 1);
        }
        // Edge fold lines (vertical crease marks)
        for (let x = 60; x < S; x += 60) {
            ctx.strokeStyle = `rgba(0,0,0,${(0.06 + Math.random() * 0.04).toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
        }

        // Fiber noise
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

    // Wood grain — pine pallet planks
    static _makeWood() {
        const S = 512, cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');

        ctx.fillStyle = '#9a6b32';
        ctx.fillRect(0, 0, S, S);

        // Alternating plank tones
        for (let x = 0; x < S; x += 48) {
            const l = 130 + Math.floor(Math.random() * 35);
            ctx.fillStyle = `rgba(${l},${Math.floor(l * 0.62)},${Math.floor(l * 0.3)},0.18)`;
            ctx.fillRect(x, 0, 48, S);
        }

        // Wood grain lines
        for (let i = 0; i < 160; i++) {
            const y0 = Math.random() * S;
            ctx.strokeStyle = `rgba(0,0,0,${(0.03 + Math.random() * 0.09).toFixed(3)})`;
            ctx.lineWidth = 0.5 + Math.random() * 1.5;
            ctx.beginPath();
            ctx.moveTo(0, y0);
            let py = y0;
            for (let x = 0; x <= S; x += 40) {
                py += (Math.random() - 0.5) * 5;
                ctx.lineTo(x, py);
            }
            ctx.stroke();
        }

        // Knot rings
        for (let k = 0; k < 4; k++) {
            const kx = Math.random() * S, ky = Math.random() * S, kr = 8 + Math.random() * 16;
            for (let r = kr; r > 1; r -= 2) {
                ctx.strokeStyle = `rgba(0,0,0,${(0.04 + (kr - r) / kr * 0.12).toFixed(3)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(kx, ky, r, r * 0.55, Math.PI / 5, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Plank seam lines
        for (let y = 55; y < S; y += 55 + Math.floor(Math.random() * 8)) {
            ctx.strokeStyle = 'rgba(0,0,0,0.30)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,210,120,0.09)';
            ctx.lineWidth = 1;
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

    // Corrugated steel — shipping container walls
    static _makeMetal() {
        const S = 512, cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');

        // Container forest-green steel
        ctx.fillStyle = '#3d6b4a';
        ctx.fillRect(0, 0, S, S);

        // Vertical corrugation ribs
        for (let x = 0; x < S; x += 28) {
            const g = ctx.createLinearGradient(x, 0, x + 28, 0);
            g.addColorStop(0,    'rgba(0,0,0,0.0)');
            g.addColorStop(0.10, 'rgba(255,255,255,0.24)');
            g.addColorStop(0.35, 'rgba(255,255,255,0.07)');
            g.addColorStop(0.65, 'rgba(0,0,0,0.16)');
            g.addColorStop(1,    'rgba(0,0,0,0.0)');
            ctx.fillStyle = g;
            ctx.fillRect(x, 0, 28, S);
        }

        // Horizontal panel seams
        for (let y = 0; y < S; y += 90) {
            ctx.strokeStyle = 'rgba(0,0,0,0.42)';
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, y + 5); ctx.lineTo(S, y + 5); ctx.stroke();
        }

        // Rivet details along seams
        for (let y = 45; y < S; y += 90) {
            for (let x = 14; x < S; x += 28) {
                ctx.fillStyle = 'rgba(0,0,0,0.32)';
                ctx.beginPath(); ctx.arc(x, y, 2.8, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.beginPath(); ctx.arc(x - 0.6, y - 0.6, 1.4, 0, Math.PI * 2); ctx.fill();
            }
        }

        // Vertical scratch/wear lines
        for (let s = 0; s < 18; s++) {
            const sx = Math.random() * S;
            ctx.strokeStyle = `rgba(255,255,255,${(0.03 + Math.random() * 0.05).toFixed(3)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + (Math.random()-0.5) * 8, S); ctx.stroke();
        }

        const id = ctx.getImageData(0, 0, S, S), d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 14;
            d[i]   = Math.max(0, Math.min(255, d[i]   + n));
            d[i+1] = Math.max(0, Math.min(255, d[i+1] + n));
            d[i+2] = Math.max(0, Math.min(255, d[i+2] + n));
        }
        ctx.putImageData(id, 0, 0);

        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }
}

// Helper: create a CanvasTexture cloned from the shared base, with given repeat
function cloneTex(baseTex, repeatX, repeatY) {
    const t = baseTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(0.5, repeatX), Math.max(0.5, repeatY));
    return t;
}

// ─── RenderableBox — corrugated cardboard crate ───────────────────────────────
class RenderableBox extends Box {
    constructor(color, viewer, width, height, depth, options = {}) {
        super(width, height, depth, options);
        this.color  = color;
        this.viewer = viewer;

        let finalColor = color;
        if (options.group) {
            const gc = getGroupColor(options.group);
            if (gc !== null) finalColor = gc;
        }

        const TILE = 40; // cm per texture tile
        const baseTex = TextureFactory.getCardboardTexture();

        // Per-face materials for correct UV tiling:
        // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
        //   right/left  → (depth × height)
        //   top/bottom  → (width × depth)
        //   front/back  → (width × height)
        const mkMat = (rx, ry) => new THREE.MeshStandardMaterial({
            map:         cloneTex(baseTex, rx, ry),
            color:       finalColor,
            opacity:     options.fragile ? 0.80 : 1.0,
            metalness:   0.0,
            roughness:   0.82,
            transparent: !!options.fragile,
            polygonOffset:       true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits:  1
        });

        const rW = width  / TILE, rH = height / TILE, rD = depth / TILE;
        const materials = [
            mkMat(rD, rH),  // +X right
            mkMat(rD, rH),  // -X left
            mkMat(rW, rD),  // +Y top
            mkMat(rW, rD),  // -Y bottom
            mkMat(rW, rH),  // +Z front
            mkMat(rW, rH),  // -Z back
        ];

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        this.mesh = new THREE.Mesh(geometry, materials);
        this.mesh.castShadow    = true;
        this.mesh.receiveShadow = true;
        this.mesh.visible = false;

        // Dark edge lines
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x2a1a0a, opacity: 0.55, transparent: true });
        const edgeGeometry = new THREE.EdgesGeometry(geometry);
        this.edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        this.mesh.add(this.edges);

        if (options.fragile) this._addFragileIndicator();

        viewer.scene.add(this.mesh);
        viewer.boxes.push(this);
    }

    _addFragileIndicator() {
        var lineMat = new THREE.LineBasicMaterial({ color: 0xff2200, linewidth: 2 });
        var pts1 = [new THREE.Vector3(-0.5,0.5,-0.5), new THREE.Vector3(0.5,0.5,0.5)];
        var pts2 = [new THREE.Vector3(0.5,0.5,-0.5),  new THREE.Vector3(-0.5,0.5,0.5)];
        this.mesh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts1), lineMat));
        this.mesh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), lineMat));
    }

    set visible(v) { this.mesh.visible = !!v; }
    get visible()  { return this.mesh.visible; }

    updateMesh(palletHeight) {
        const yOffset = palletHeight || 0;
        this.mesh.scale.set(this.size.x, this.size.y, this.size.z);
        this.mesh.position.set(
            this.position.x + this.size.x / 2,
            this.position.y + this.size.y / 2 + yOffset,
            this.position.z + this.size.z / 2
        );
    }

    removeFromScene() {
        if (this.viewer && this.mesh) {
            this.viewer.scene.remove(this.mesh);
            const mats = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];
            mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
        }
    }
}

// ─── RenderableContainer — shipping container or wooden pallet ────────────────
class RenderableContainer extends Container {
    constructor(viewer, width, height, depth, options = {}) {
        super(width || 1, height || 1, depth || 1, options);

        // Wireframe boundary outline (always shown)
        this.mesh = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
            new THREE.LineBasicMaterial({ color: 0x888888 })
        );

        this.viewer    = viewer;
        this._detailGroup = null;   // pallet planks or container walls

        viewer.scene.add(this.mesh);
        viewer.container = this;
    }

    changeSize(width, height, depth, options = {}) {
        this.size        = new Vector3D(width, height, depth);
        this.isPallet    = options.isPallet    || false;
        this.palletHeight = options.palletHeight || 0;
        this.maxWeight   = options.maxWeight !== undefined ? options.maxWeight : Infinity;

        const yOffset = this.palletHeight;
        this.mesh.scale.set(this.size.x, this.size.y, this.size.z);
        this.mesh.position.set(this.size.x / 2, this.size.y / 2 + yOffset, this.size.z / 2);
        this.mesh.material.color.setHex(this.isPallet ? 0x777766 : 0x3355aa);

        this.viewer.controls.target.set(
            this.size.x / 2,
            (this.size.y + yOffset) / 2,
            this.size.z / 2
        );

        this._rebuildDetail();
    }

    _rebuildDetail() {
        if (this._detailGroup) {
            this.viewer.scene.remove(this._detailGroup);
            this._detailGroup.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) {
                    const ms = Array.isArray(c.material) ? c.material : [c.material];
                    ms.forEach(m => { m.map = null; m.dispose(); });
                }
            });
            this._detailGroup = null;
        }

        if (this.isPallet) {
            this._detailGroup = this._buildPallet();
        } else {
            this._detailGroup = this._buildContainer();
        }
        if (this._detailGroup) this.viewer.scene.add(this._detailGroup);
    }

    // ── Wooden pallet: top planks + 3 stringers + bottom boards ─────────────
    _buildPallet() {
        const W = this.size.x, D = this.size.z, H = this.palletHeight;
        if (H <= 0) return null;

        const group = new THREE.Group();
        const baseTex = TextureFactory.getWoodTexture();
        const TILE = 50;

        const mkWoodMat = (col, rx, ry) => new THREE.MeshStandardMaterial({
            map:       cloneTex(baseTex, rx, ry),
            color:     col,
            roughness: 0.87,
            metalness: 0.0
        });

        const topDeckH   = H * 0.27;
        const btmDeckH   = H * 0.15;
        const stringerH  = H - topDeckH - btmDeckH;
        const stringerY  = btmDeckH + stringerH / 2;

        // Top deck — 5 planks with small gaps
        const nPlanks = 5;
        const plankW  = W / nPlanks;
        const gap     = plankW * 0.10;
        for (let i = 0; i < nPlanks; i++) {
            const px = (i + 0.5) * plankW;
            const geo = new THREE.BoxGeometry(plankW - gap, topDeckH, D);
            const mat = mkWoodMat(0xc8a070, (plankW - gap) / TILE, D / TILE);
            const m = new THREE.Mesh(geo, mat);
            m.position.set(px, H - topDeckH / 2, D / 2);
            m.castShadow = m.receiveShadow = true;
            group.add(m);
        }

        // 3 stringers (support beams)
        const sxPositions = [W * 0.10, W * 0.50, W * 0.90];
        const sW = W * 0.12;
        for (const sx of sxPositions) {
            const geo = new THREE.BoxGeometry(sW, stringerH, D);
            const mat = mkWoodMat(0x8a5530, sW / TILE, D / TILE);
            const m = new THREE.Mesh(geo, mat);
            m.position.set(sx, stringerY, D / 2);
            m.castShadow = m.receiveShadow = true;
            group.add(m);
        }

        // Bottom boards — 3 boards
        const nBtm = 3;
        const btmW = W / nBtm;
        const btmGap = btmW * 0.06;
        for (let i = 0; i < nBtm; i++) {
            const bx = (i + 0.5) * btmW;
            const geo = new THREE.BoxGeometry(btmW - btmGap, btmDeckH, D);
            const mat = mkWoodMat(0xb89060, (btmW - btmGap) / TILE, D / TILE);
            const m = new THREE.Mesh(geo, mat);
            m.position.set(bx, btmDeckH / 2, D / 2);
            m.castShadow = m.receiveShadow = true;
            group.add(m);
        }

        return group;
    }

    // ── Shipping container: corrugated steel floor + semi-transparent walls ──
    _buildContainer() {
        const W = this.size.x, H = this.size.y, D = this.size.z;
        const yOff = this.palletHeight;
        const group = new THREE.Group();
        const baseTex = TextureFactory.getMetalTexture();
        const TILE = 90;

        // Floor — full opacity
        const floorMat = new THREE.MeshStandardMaterial({
            map:       cloneTex(baseTex, W / TILE, D / TILE),
            color:     0x5a8060,
            roughness: 0.75,
            metalness: 0.35,
            side:      THREE.FrontSide
        });
        const floorGeo = new THREE.PlaneGeometry(W, D);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(W / 2, yOff, D / 2);
        floor.receiveShadow = true;
        group.add(floor);

        // Shared wall material factory
        const mkWall = (rx, ry) => new THREE.MeshStandardMaterial({
            map:         cloneTex(baseTex, rx, ry),
            color:       0x4a7055,
            roughness:   0.65,
            metalness:   0.40,
            transparent: true,
            opacity:     0.38,
            side:        THREE.DoubleSide,
            depthWrite:  false
        });

        // Back wall (z = 0)
        const bwGeo = new THREE.PlaneGeometry(W, H);
        const bw = new THREE.Mesh(bwGeo, mkWall(W / TILE, H / TILE));
        bw.position.set(W / 2, H / 2 + yOff, 0);
        group.add(bw);

        // Front wall (z = D)
        const fw = new THREE.Mesh(bwGeo.clone(), mkWall(W / TILE, H / TILE));
        fw.rotation.y = Math.PI;
        fw.position.set(W / 2, H / 2 + yOff, D);
        group.add(fw);

        // Left wall (x = 0)
        const lwGeo = new THREE.PlaneGeometry(D, H);
        const lw = new THREE.Mesh(lwGeo, mkWall(D / TILE, H / TILE));
        lw.rotation.y = Math.PI / 2;
        lw.position.set(0, H / 2 + yOff, D / 2);
        group.add(lw);

        // Right wall (x = W)
        const rw = new THREE.Mesh(lwGeo.clone(), mkWall(D / TILE, H / TILE));
        rw.rotation.y = -Math.PI / 2;
        rw.position.set(W, H / 2 + yOff, D / 2);
        group.add(rw);

        return group;
    }
}

// ─── BoxViewer ────────────────────────────────────────────────────────────────
class BoxViewer {
    _setupLight(scene) {
        // Soft ambient
        scene.add(new THREE.AmbientLight(0xfff4e0, 0.55));

        // Key light (upper-right-front) — casts shadows
        const key = new THREE.DirectionalLight(0xfffaf0, 0.90);
        key.position.set(400, 600, 500);
        key.castShadow = true;
        key.shadow.mapSize.width  = 2048;
        key.shadow.mapSize.height = 2048;
        key.shadow.camera.near    = 1;
        key.shadow.camera.far     = 3000;
        key.shadow.camera.left    = -800;
        key.shadow.camera.right   =  800;
        key.shadow.camera.top     =  800;
        key.shadow.camera.bottom  = -800;
        key.shadow.bias           = -0.001;
        scene.add(key);

        // Fill light (left-back)
        const fill = new THREE.DirectionalLight(0xd0e8ff, 0.55);
        fill.position.set(-400, 350, -400);
        scene.add(fill);

        // Rim light (underneath-back — brightens bottom edges)
        const rim = new THREE.DirectionalLight(0xffe8c0, 0.30);
        rim.position.set(100, -200, -300);
        scene.add(rim);
    }

    constructor(canvas) {
        this.canvas = canvas;

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setClearColor(0xf0f2f5);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f2f5);

        this.camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight);
        this.camera.position.set(200, 200, 300);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.5;
        this.controls.enableZoom   = true;

        this._setupLight(this.scene);

        this.boxes     = [];
        this.container = null;
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

export { BoxViewer, RenderableBox, RenderableContainer, resetGroupColors }
