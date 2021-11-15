import vert from './shaders/triangle.vert.wgsl';
import frag from './shaders/triangle.frag.wgsl';

const positions = new Float32Array([
  1.0, -1.0, 0.0, -1.0, -1.0, 0.0, 0.0, 1.0, 0.0,
]);
const colors = new Float32Array([1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]);
const indices = new Uint16Array([0, 1, 2]);

async function render(canvas: HTMLCanvasElement) {
  const entry = navigator.gpu;
  if (!entry) {
    throw new Error('WebGPU is not supported on this browser.');
  }
  const adapter = await entry.requestAdapter();
  const device = await adapter?.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!device || !context) {
    throw new Error('Failed to initialize WebGPU API.');
  }
  const contextFormat = context.getPreferredFormat(adapter!);
  context.configure({
    device,
    format: contextFormat,
  });

  function createBuffer(array: Float32Array | Uint16Array, usage: number) {
    const buffer = device!.createBuffer({
      size: (array.byteLength + 3) & ~3, // eslint-disable-line no-bitwise
      usage,
      mappedAtCreation: true,
    });
    const writeArary =
      array instanceof Uint16Array
        ? new Uint16Array(buffer.getMappedRange())
        : new Float32Array(buffer.getMappedRange());
    writeArary.set(array);
    buffer.unmap();
    return buffer;
  }
  const posBuf = createBuffer(positions, GPUBufferUsage.VERTEX);
  const colBuf = createBuffer(colors, GPUBufferUsage.VERTEX);
  const idxBuf = createBuffer(indices, GPUBufferUsage.INDEX);

  function vertBufLayout(shaderLocation: number): GPUVertexBufferLayout {
    return {
      attributes: [
        {
          shaderLocation,
          offset: 0,
          format: 'float32x3',
        },
      ],
      arrayStride: 4 * 3,
    };
  }

  const pipeline = device.createRenderPipeline({
    vertex: {
      module: device.createShaderModule({ code: vert }),
      entryPoint: 'main',
      buffers: [vertBufLayout(0), vertBufLayout(1)],
    },
    fragment: {
      module: device.createShaderModule({ code: frag }),
      entryPoint: 'main',
      targets: [{ format: contextFormat }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  function frame() {
    const commandEncoder = device!.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context!.getCurrentTexture().createView(),
          loadValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: 'store',
        },
      ],
    });
    passEncoder.setPipeline(pipeline);
    passEncoder.setVertexBuffer(0, posBuf);
    passEncoder.setVertexBuffer(1, colBuf);
    passEncoder.setIndexBuffer(idxBuf, 'uint16');
    passEncoder.drawIndexed(3);
    passEncoder.endPass();
    device!.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export default render;
