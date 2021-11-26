import { mat4 } from 'gl-matrix';
import { GLTF } from '../loader/gltf';
import createPipeline from './pipeline';

type PerPrimitiveResource = {
  indexCount: number;
  positions: GPUBuffer;
  normals: GPUBuffer;
  indices: GPUBuffer;
  uvs: GPUBuffer | null;
  pipeline: GPURenderPipeline;
  uniformBindGroup: GPUBindGroup;
};

export default class Resource {
  meshes: {
    [key: number]: {
      matrices: Array<mat4>;
      modelInvTrs: Array<mat4>;
      matrixBuffer: GPUBuffer;
      primitives: Array<PerPrimitiveResource>;
    };
  } = {};

  textures: { [key: number]: GPUTexture } = {};

  constructor(
    gltf: GLTF,
    sceneIndex: number,
    device: GPUDevice,
    contextFormat: GPUTextureFormat
  ) {
    const createGPUBuffer = (
      array: Float32Array | Uint16Array,
      isIndex = false
    ) => {
      const buffer = device.createBuffer({
        size: (array.byteLength + 3) & ~3, // eslint-disable-line no-bitwise
        usage: isIndex ? GPUBufferUsage.INDEX : GPUBufferUsage.VERTEX,
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
          mat4.multiply(matrix, matrix, node.translation);
        }
        if (node.rotation) {
          mat4.multiply(matrix, matrix, node.rotation);
        }
        if (node.scale) {
          mat4.multiply(matrix, matrix, node.scale);
        }
      }

      if (node.mesh !== undefined) {
        const modelInverseTranspose = mat4.create();
        mat4.invert(modelInverseTranspose, matrix);
        mat4.transpose(modelInverseTranspose, modelInverseTranspose);

        if (!this.meshes[node.mesh]) {
          const matrixBuffer = device.createBuffer({
            size: 4 * 4 * 4 * 3,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // eslint-disable-line no-bitwise
          });

          this.meshes[node.mesh] = {
            matrices: [matrix],
            modelInvTrs: [modelInverseTranspose],
            matrixBuffer,
            primitives: gltf.meshes[node.mesh].map<PerPrimitiveResource>(
              (primitive) => {
                const { baseColorTexture } =
                  primitive.material.pbrMetallicRoughness;
                if (
                  baseColorTexture &&
                  !this.textures[baseColorTexture.index]
                ) {
                  this.textures[baseColorTexture.index] = device.createTexture({
                    size: [gltf.images[0].width, gltf.images[0].height, 1],
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

                const bindGroupEntries: [GPUBindGroupEntry] = [
                  {
                    binding: 0,
                    resource: {
                      buffer: matrixBuffer,
                    },
                  },
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

                const pipeline = createPipeline(
                  device,
                  contextFormat,
                  primitive.uvs !== undefined
                );

                return {
                  indexCount: primitive.indexCount,
                  positions: createGPUBuffer(primitive.positions),
                  normals: createGPUBuffer(primitive.normals),
                  indices: createGPUBuffer(primitive.indices, true),
                  uvs: primitive.uvs ? createGPUBuffer(primitive.uvs) : null,
                  pipeline,
                  uniformBindGroup: device.createBindGroup({
                    layout: pipeline.getBindGroupLayout(0),
                    entries: bindGroupEntries,
                  }),
                };
              }
            ),
          };
        } else {
          this.meshes[node.mesh].matrices.push(matrix);
          this.meshes[node.mesh].modelInvTrs.push(modelInverseTranspose);
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
      meshResource.matrixBuffer.destroy();
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
