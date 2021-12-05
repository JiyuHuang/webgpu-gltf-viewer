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
  }

  draw(passEncoder: GPURenderPassEncoder, instanceCount: number) {
    passEncoder.setPipeline(this.pipeline!);
    passEncoder.setVertexBuffer(0, this.positions);
    passEncoder.setVertexBuffer(1, this.normals);
    if (this.uvs) {
      passEncoder.setVertexBuffer(2, this.uvs);
    }
    if (this.tangents) {
      passEncoder.setVertexBuffer(3, this.tangents);
    }
    passEncoder.setIndexBuffer(this.indices, this.indexFormat);
    passEncoder.setBindGroup(1, this.uniformBindGroup!);
    passEncoder.drawIndexed(this.indexCount, instanceCount);
  }
}
