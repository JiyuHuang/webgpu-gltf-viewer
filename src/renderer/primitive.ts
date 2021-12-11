import { GLTFPrimitive } from '../loader/gltf';
import { createGPUBuffer } from '../util';

export default class Primitive {
  isTransparent = false;

  vertexCount: number;

  indexFormat: GPUIndexFormat;

  positions: GPUBuffer;

  normals: GPUBuffer;

  indices: GPUBuffer | null;

  uvs: GPUBuffer | null;

  uv1s: GPUBuffer | null;

  tangents: GPUBuffer | null;

  colors: GPUBuffer | null;

  pipeline: GPURenderPipeline | undefined;

  uniformBindGroup: GPUBindGroup | undefined;

  constructor(primitive: GLTFPrimitive, device: GPUDevice) {
    this.vertexCount = primitive.vertexCount;
    this.indexFormat =
      primitive.indices instanceof Uint16Array ? 'uint16' : 'uint32';
    this.positions = createGPUBuffer(
      primitive.positions,
      GPUBufferUsage.VERTEX,
      device
    );
    this.normals = createGPUBuffer(
      primitive.normals,
      GPUBufferUsage.VERTEX,
      device
    );
    this.indices = primitive.indices
      ? createGPUBuffer(primitive.indices, GPUBufferUsage.INDEX, device)
      : null;
    this.uvs = primitive.uvs
      ? createGPUBuffer(primitive.uvs, GPUBufferUsage.VERTEX, device)
      : null;
    this.uv1s = primitive.uv1s
      ? createGPUBuffer(primitive.uv1s, GPUBufferUsage.VERTEX, device)
      : null;
    this.tangents = primitive.tangents
      ? createGPUBuffer(primitive.tangents, GPUBufferUsage.VERTEX, device)
      : null;
    this.colors = primitive.colors
      ? createGPUBuffer(primitive.colors, GPUBufferUsage.VERTEX, device)
      : null;
  }

  draw(passEncoder: GPURenderPassEncoder, instanceCount: number) {
    if (instanceCount) {
      passEncoder.setPipeline(this.pipeline!);
      passEncoder.setVertexBuffer(0, this.positions);
      passEncoder.setVertexBuffer(1, this.normals);
      let location = 2;
      if (this.uvs) {
        passEncoder.setVertexBuffer(location, this.uvs);
        location += 1;
      }
      if (this.uv1s) {
        passEncoder.setVertexBuffer(location, this.uv1s);
        location += 1;
      }
      if (this.tangents) {
        passEncoder.setVertexBuffer(location, this.tangents);
        location += 1;
      }
      if (this.colors) {
        passEncoder.setVertexBuffer(location, this.colors);
        location += 1;
      }
      passEncoder.setBindGroup(1, this.uniformBindGroup!);
      if (this.indices) {
        passEncoder.setIndexBuffer(this.indices, this.indexFormat);
        passEncoder.drawIndexed(this.vertexCount, instanceCount);
      } else {
        passEncoder.draw(this.vertexCount, instanceCount);
      }
    }
  }

  destroy() {
    this.indices?.destroy();
    this.positions.destroy();
    this.normals.destroy();
    this.uvs?.destroy();
    this.uv1s?.destroy();
    this.tangents?.destroy();
  }
}
