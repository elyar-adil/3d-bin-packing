/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil
*/

/**
 * WebGPU-accelerated dominance check for MaximalSpacesSolver.
 *
 * The dominance check (is space A fully contained by space B?) is O(m²) on
 * CPU and is the main bottleneck of MaximalSpacesSolver. On GPU all m spaces
 * are checked simultaneously: each compute thread handles one space and scans
 * all others, reducing wall time from O(m²) to O(m) (one parallel pass).
 *
 * When WebGPU is unavailable the class falls back gracefully to CPU.
 * GPU also allows raising MAX_SPACES from 200 → 2000, giving significantly
 * better packing quality on complex layouts.
 *
 * Usage:
 *   const checker = await GPUDominanceChecker.create();
 *   const dominated = await checker.check(spacesArray);  // bool[]
 *   checker.destroy();
 */
export class GPUDominanceChecker {
    constructor(device) {
        this._device = device;
        this._pipeline = null;
        this._bindGroupLayout = null;
    }

    // ── Factory ───────────────────────────────────────────────────────────────

    /**
     * Attempt to initialise WebGPU and compile the compute shader.
     * Returns null if WebGPU is unavailable (CPU fallback should be used).
     */
    static async create() {
        if (!navigator.gpu) return null;
        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) return null;
            const device = await adapter.requestDevice();
            const checker = new GPUDominanceChecker(device);
            await checker._initPipeline();
            return checker;
        } catch {
            return null;
        }
    }

    // ── Shader ────────────────────────────────────────────────────────────────

    static get _WGSL() {
        return /* wgsl */`
struct Space {
    x : f32, y : f32, z : f32,
    w : f32, h : f32, d : f32,
    _pad0 : f32, _pad1 : f32,   // align to 32 bytes
}

@group(0) @binding(0) var<storage, read>       spaces    : array<Space>;
@group(0) @binding(1) var<storage, read_write> dominated : array<u32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    let i = gid.x;
    let n = arrayLength(&spaces);
    if (i >= n) { return; }

    let sp  = spaces[i];
    let TOL = 0.001;

    for (var j = 0u; j < n; j++) {
        if (j == i) { continue; }
        let o = spaces[j];
        // o dominates sp iff o fully contains sp (with tolerance)
        if (  o.x       <= sp.x            + TOL
           && o.y       <= sp.y            + TOL
           && o.z       <= sp.z            + TOL
           && o.x + o.w >= sp.x + sp.w    - TOL
           && o.y + o.h >= sp.y + sp.h    - TOL
           && o.z + o.d >= sp.z + sp.d    - TOL ) {
            dominated[i] = 1u;
            return;
        }
    }
    dominated[i] = 0u;
}`;
    }

    async _initPipeline() {
        const device = this._device;

        this._bindGroupLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE,
                  buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE,
                  buffer: { type: 'storage' } },
            ]
        });

        const shaderModule = device.createShaderModule({ code: GPUDominanceChecker._WGSL });

        this._pipeline = device.createComputePipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [this._bindGroupLayout]
            }),
            compute: { module: shaderModule, entryPoint: 'main' }
        });
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * For each space in `spaces`, return whether it is dominated by any other.
     * @param {Array<{x,y,z,w,h,d}>} spaces
     * @returns {Promise<boolean[]>}
     */
    async check(spaces) {
        const device = this._device;
        const n = spaces.length;
        if (n === 0) return [];

        // Pack spaces into Float32Array (8 floats per space = 32 bytes)
        const FLOATS_PER = 8;
        const spaceData = new Float32Array(n * FLOATS_PER);
        for (let i = 0; i < n; i++) {
            const s = spaces[i];
            const base = i * FLOATS_PER;
            spaceData[base]     = s.x;
            spaceData[base + 1] = s.y;
            spaceData[base + 2] = s.z;
            spaceData[base + 3] = s.w;
            spaceData[base + 4] = s.h;
            spaceData[base + 5] = s.d;
            // _pad0, _pad1 = 0 (already 0)
        }

        // Create GPU buffers
        const spaceBuf = device.createBuffer({
            size: spaceData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(spaceBuf, 0, spaceData);

        const resultBuf = device.createBuffer({
            size: n * 4,   // u32 per space
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        });

        const readBuf = device.createBuffer({
            size: n * 4,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // Bind group
        const bindGroup = device.createBindGroup({
            layout: this._bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: spaceBuf } },
                { binding: 1, resource: { buffer: resultBuf } },
            ]
        });

        // Encode and submit
        const enc = device.createCommandEncoder();
        const pass = enc.beginComputePass();
        pass.setPipeline(this._pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(n / 64));
        pass.end();
        enc.copyBufferToBuffer(resultBuf, 0, readBuf, 0, n * 4);
        device.queue.submit([enc.finish()]);

        // Read back results
        await readBuf.mapAsync(GPUMapMode.READ);
        const raw = new Uint32Array(readBuf.getMappedRange());
        const result = Array.from(raw, v => v !== 0);
        readBuf.unmap();

        // Cleanup
        spaceBuf.destroy();
        resultBuf.destroy();
        readBuf.destroy();

        return result;
    }

    /** Free the WebGPU device. */
    destroy() {
        if (this._device) this._device.destroy();
    }
}
