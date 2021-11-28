import { mat4 } from 'gl-matrix';
import { GLTF } from '../loader/gltf';
import createPipeline from './pipeline';
import * as util from '../util';

type PerPrimitiveResource = {
  indexCount: number;
  positions: GPUBuffer;
  normals: GPUBuffer;
  indices: GPUBuffer;
  uvs: GPUBuffer | null;
  pipeline: number;
  uniformBindGroup: GPUBindGroup;
};

export default class Resource {
  meshes: {
    [key: number]: {
      matrixBuffers: Array<GPUBuffer>;
      primitives: Array<PerPrimitiveResource>;
    };
  } = {};

  textures: { [key: number]: GPUTexture } = {};

  pipelines: Array<GPURenderPipeline>;

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

    this.pipelines = gltf.materials.map((material) => {
      const { baseColorTexture } = material.pbrMetallicRoughness;
      if (baseColorTexture && !this.textures[baseColorTexture.index]) {
        this.textures[baseColorTexture.index] = device.createTexture({
          size: [
            gltf.images[baseColorTexture.index].width,
            gltf.images[baseColorTexture.index].height,
            1,
          ],
          format: 'rgba8unorm',
          usage:
            GPUTextureUsage.TEXTURE_BINDING | // eslint-disable-line no-bitwise
            GPUTextureUsage.COPY_DST | // eslint-disable-line no-bitwise
            GPUTextureUsage.RENDER_ATTACHMENT,
        });
        device.queue.copyExternalImageToTexture(
          { source: gltf.images[baseColorTexture.index] },
          { texture: this.textures[baseColorTexture.index] },
          [
            gltf.images[baseColorTexture.index].width,
            gltf.images[baseColorTexture.index].height,
          ]
        );
      }

      return createPipeline(
        device,
        contextFormat,
        material,
        cameraBindGroupLayout
      );
    });

    const createGPUBuffer = (
      array: Float32Array | Uint16Array,
      usage: number
    ) => {
      const buffer = device.createBuffer({
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
        const matrixBuffer = createGPUBuffer(
          util.concatArray(matrix as Float32Array, modelInvTr as Float32Array),
          GPUBufferUsage.UNIFORM
        );

        if (!this.meshes[node.mesh]) {
          this.meshes[node.mesh] = {
            matrixBuffers: [matrixBuffer],

            primitives: gltf.meshes[node.mesh].map<PerPrimitiveResource>(
              (primitive) => {
                const { baseColorTexture } =
                  gltf.materials[primitive.material].pbrMetallicRoughness;
                const bindGroupEntries: [GPUBindGroupEntry] = [
                  { binding: 0, resource: { buffer: matrixBuffer } },
                ];
                if (baseColorTexture) {
                  bindGroupEntries.push({
                    binding: 1,
                    resource: device.createSampler({
                      addressModeU: 'repeat',
                      addressModeV: 'repeat',
                      magFilter: 'linear',
                      minFilter: 'linear',
                    }),
                  });
                  bindGroupEntries.push({
                    binding: 2,
                    resource:
                      this.textures[baseColorTexture.index].createView(),
                  });
                }

                const pipeline = primitive.material;

                return {
                  indexCount: primitive.indexCount,
                  positions: createGPUBuffer(
                    primitive.positions,
                    GPUBufferUsage.VERTEX
                  ),
                  normals: createGPUBuffer(
                    primitive.normals,
                    GPUBufferUsage.VERTEX
                  ),
                  indices: createGPUBuffer(
                    primitive.indices,
                    GPUBufferUsage.INDEX
                  ),
                  uvs: primitive.uvs
                    ? createGPUBuffer(primitive.uvs, GPUBufferUsage.VERTEX)
                    : null,
                  pipeline,
                  uniformBindGroup: device.createBindGroup({
                    layout: this.pipelines[pipeline].getBindGroupLayout(1),
                    entries: bindGroupEntries,
                  }),
                };
              }
            ),
          };
        } else {
          this.meshes[node.mesh].matrixBuffers.push(matrixBuffer);
        }
      }

      node.children?.forEach((childIndex: any) =>
        createResource(gltf.nodes[childIndex], matrix)
      );
    };

    gltf.scenes[sceneIndex].nodes.forEach((nodeIndex: number) => {
      createResource(gltf.nodes[nodeIndex]);
    });
  }

  destroy() {
    Object.entries(this.meshes).forEach(([, meshResource]) => {
      meshResource.matrixBuffers.forEach((matrixBuffer) => {
        matrixBuffer.destroy();
      });
      meshResource.primitives.forEach((primResource) => {
        primResource.indices.destroy();
        primResource.positions.destroy();
        primResource.normals.destroy();
        primResource.uvs?.destroy();
      });
    });
    Object.entries(this.textures).forEach(([, texture]) => texture.destroy());
  }
}
