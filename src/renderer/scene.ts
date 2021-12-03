import { mat4 } from 'gl-matrix';
import { GLTF } from '../loader/gltf';
import createPipeline from './pipeline';
import { joinArray, TypedArray } from '../util';

type Primitive = {
  indexCount: number;
  indexFormat: GPUIndexFormat;
  positions: GPUBuffer;
  normals: GPUBuffer;
  indices: GPUBuffer;
  uvs: GPUBuffer | null;
  tangents: GPUBuffer | null;
  pipeline: GPURenderPipeline | undefined;
  uniformBindGroup: GPUBindGroup | undefined;
};

export default class Scene {
  meshes: {
    [key: number]: {
      matrices: Array<mat4>;
      matrixBuffer: GPUBuffer | undefined;
      primitives: Array<Primitive>;
    };
  } = {};

  textures: { [key: number]: GPUTexture } = {};

  camera: {
    projViewBuffer: GPUBuffer;
    eyeBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
  };

  constructor(
    gltf: GLTF,
    sceneIndex: number,
    device: GPUDevice,
    contextFormat: GPUTextureFormat
  ) {
    const cameraBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
      ],
    });
    const projViewBuffer = device.createBuffer({
      size: 4 * 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // eslint-disable-line no-bitwise
    });
    const eyeBuffer = device.createBuffer({
      size: 4 * 3,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // eslint-disable-line no-bitwise
    });
    this.camera = {
      projViewBuffer,
      eyeBuffer,
      bindGroup: device.createBindGroup({
        layout: cameraBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: projViewBuffer } },
          { binding: 1, resource: { buffer: eyeBuffer } },
        ],
      }),
    };

    const createGPUBuffer = (array: TypedArray, usage: number) => {
      const buffer = device.createBuffer({
        size: (array.byteLength + 3) & ~3, // eslint-disable-line no-bitwise
        usage,
        mappedAtCreation: true,
      });
      let writeArary;
      if (array instanceof Int8Array) {
        writeArary = new Int8Array(buffer.getMappedRange());
      } else if (array instanceof Uint8Array) {
        writeArary = new Uint8Array(buffer.getMappedRange());
      } else if (array instanceof Int16Array) {
        writeArary = new Int16Array(buffer.getMappedRange());
      } else if (array instanceof Uint16Array) {
        writeArary = new Uint16Array(buffer.getMappedRange());
      } else if (array instanceof Uint32Array) {
        writeArary = new Uint32Array(buffer.getMappedRange());
      } else {
        writeArary = new Float32Array(buffer.getMappedRange());
      }
      writeArary.set(array);
      buffer.unmap();
      return buffer;
    };

    const createResource = (node: any, parentMatrix = mat4.create()) => {
      const matrix = mat4.clone(parentMatrix);
      if (node.matrix) {
        mat4.multiply(matrix, matrix, node.matrix);
      } else {
        if (node.translation) {
          mat4.translate(matrix, matrix, node.translation);
        }
        if (node.rotation) {
          const rotation = mat4.create();
          mat4.fromQuat(rotation, node.rotation);
          mat4.multiply(matrix, matrix, rotation);
        }
        if (node.scale) {
          mat4.scale(matrix, matrix, node.scale);
        }
      }

      if (node.mesh !== undefined) {
        const modelInvTr = mat4.create();
        mat4.invert(modelInvTr, matrix);
        mat4.transpose(modelInvTr, modelInvTr);

        if (!this.meshes[node.mesh]) {
          this.meshes[node.mesh] = {
            matrices: [matrix, modelInvTr],
            matrixBuffer: undefined,
            primitives: gltf.meshes[node.mesh].map<Primitive>((primitive) => ({
              indexCount: primitive.indexCount,
              indexFormat:
                primitive.indices instanceof Uint16Array ? 'uint16' : 'uint32',
              positions: createGPUBuffer(
                primitive.positions,
                GPUBufferUsage.VERTEX
              ),
              normals: createGPUBuffer(
                primitive.normals,
                GPUBufferUsage.VERTEX
              ),
              indices: createGPUBuffer(primitive.indices, GPUBufferUsage.INDEX),
              uvs: primitive.uvs
                ? createGPUBuffer(primitive.uvs, GPUBufferUsage.VERTEX)
                : null,
              tangents: primitive.tangents
                ? createGPUBuffer(primitive.tangents, GPUBufferUsage.VERTEX)
                : null,
              pipeline: undefined,
              uniformBindGroup: undefined,
            })),
          };
        } else {
          this.meshes[node.mesh].matrices.push(matrix);
          this.meshes[node.mesh].matrices.push(modelInvTr);
        }
      }

      node.children?.forEach((childIndex: any) =>
        createResource(gltf.nodes[childIndex], matrix)
      );
    };

    gltf.scenes[sceneIndex].nodes.forEach((nodeIndex: number) => {
      createResource(gltf.nodes[nodeIndex]);
    });

    Object.entries(this.meshes).forEach(([meshIndex, mesh]) => {
      mesh.matrixBuffer = createGPUBuffer(
        joinArray(mesh.matrices as Array<Float32Array>),
        GPUBufferUsage.UNIFORM
      );

      mesh.primitives.forEach((primitive, primIndex) => {
        const { material } = gltf.meshes[Number(meshIndex)][primIndex];
        const { baseColorTexture, metallicRoughnessTexture } =
          material.pbrMetallicRoughness;
        const { normalTexture } = material;
        const textures = [
          baseColorTexture,
          metallicRoughnessTexture,
          normalTexture,
        ];

        textures.forEach((texture) => {
          if (texture && !this.textures[texture.index]) {
            this.textures[texture.index] = device.createTexture({
              size: [
                gltf.images[texture.index].width,
                gltf.images[texture.index].height,
                1,
              ],
              format: 'rgba8unorm',
              usage:
                GPUTextureUsage.TEXTURE_BINDING | // eslint-disable-line no-bitwise
                GPUTextureUsage.COPY_DST | // eslint-disable-line no-bitwise
                GPUTextureUsage.RENDER_ATTACHMENT,
            });
            device.queue.copyExternalImageToTexture(
              { source: gltf.images[texture.index] },
              { texture: this.textures[texture.index] },
              [
                gltf.images[texture.index].width,
                gltf.images[texture.index].height,
              ]
            );
          }
        });

        primitive.pipeline = createPipeline(
          device,
          contextFormat,
          material,
          primitive.uvs !== null,
          primitive.tangents !== null,
          mesh.matrices.length / 2,
          cameraBindGroupLayout
        );

        const bindGroupEntries: [GPUBindGroupEntry] = [
          { binding: 0, resource: { buffer: mesh.matrixBuffer! } },
        ];
        textures.forEach((texture, n) => {
          if (texture) {
            bindGroupEntries.push({
              binding: n * 2 + 1,
              resource: device.createSampler({
                addressModeU: 'repeat',
                addressModeV: 'repeat',
                magFilter: 'linear',
                minFilter: 'linear',
              }),
            });
            bindGroupEntries.push({
              binding: n * 2 + 2,
              resource: this.textures[texture.index].createView(),
            });
          }
        });
        primitive.uniformBindGroup = device.createBindGroup({
          layout: primitive.pipeline!.getBindGroupLayout(1),
          entries: bindGroupEntries,
        });
      });
    });
  }

  destroy() {
    Object.entries(this.meshes).forEach(([, mesh]) => {
      mesh.matrixBuffer!.destroy();
      mesh.primitives.forEach((primitive) => {
        primitive.indices.destroy();
        primitive.positions.destroy();
        primitive.normals.destroy();
        primitive.uvs?.destroy();
      });
    });
    Object.entries(this.textures).forEach(([, texture]) => texture.destroy());
  }
}
