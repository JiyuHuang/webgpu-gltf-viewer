import { GLTFPrimitive } from '../loader/mesh';
import { createGPUBuffer } from '../util';

export default class Primitive {
  isTransparent = false;

  indexCount: number;

  indexFormat: GPUIndexFormat;

  positions: GPUBuffer;

  normals: GPUBuffer;

  indices: GPUBuffer;

  uvs: GPUBuffer | null;

  tangents: GPUBuffer | null;

  colors: GPUBuffer | null;

  pipeline: GPURenderPipeline | undefined;

  uniformBindGroup: GPUBindGroup | undefined;

  constructor(primitive: GLTFPrimitive, device: GPUDevice) {
    this.indexCount = primitive.indexCount;
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
    this.indices = createGPUBuffer(
      primitive.indices,
      GPUBufferUsage.INDEX,
      device
    );
    this.uvs = primitive.uvs
      ? createGPUBuffer(primitive.uvs, GPUBufferUsage.VERTEX, device)
      : null;
    this.tangents = primitive.tangents
      ? createGPUBuffer(primitive.tangents, GPUBufferUsage.VERTEX, device)
      : null;
    this.colors = primitive.colors
      ? createGPUBuffer(primitive.colors, GPUBufferUsage.VERTEX, device)
      : null;
  }

  draw(passEncoder: GPURenderPassEncoder, instanceCount: number) {
    passEncoder.setPipeline(this.pipeline!);
    passEncoder.setVertexBuffer(0, this.positions);
    passEncoder.setVertexBuffer(1, this.normals);
    let location = 2;
    if (this.uvs) {
      passEncoder.setVertexBuffer(location, this.uvs);
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
    passEncoder.setIndexBuffer(this.indices, this.indexFormat);
    passEncoder.setBindGroup(1, this.uniformBindGroup!);
    passEncoder.drawIndexed(this.indexCount, instanceCount);
  }

  destroy() {
    this.indices.destroy();
    this.positions.destroy();
    this.normals.destroy();
    this.uvs?.destroy();
    this.tangents?.destroy();
  }
}
