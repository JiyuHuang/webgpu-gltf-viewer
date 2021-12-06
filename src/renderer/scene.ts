import { mat4 } from 'gl-matrix';
import { GLTF } from '../loader/gltf';
import createPipeline from './pipeline';
import Primitive from './primitive';
import { joinArray, createGPUBuffer } from '../util';
import Camera from './camera';

export default class Scene {
  meshes: {
    [key: number]: {
      matrices: Array<mat4>;
      matrixBuffer: GPUBuffer | undefined;
      primitives: Array<Primitive>;
    };
  } = {};

  textures: { [key: number]: GPUTexture } = {};

  camera: Camera;

  cameras: Array<{ world: mat4; json: any }> = [];

  constructor(
    gltf: GLTF,
    sceneIndex: number,
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    contextFormat: GPUTextureFormat
  ) {
    this.camera = new Camera(canvas, device);

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
            primitives: gltf.meshes[node.mesh].map(
              (primitive) => new Primitive(primitive, device)
            ),
          };
        } else {
          this.meshes[node.mesh].matrices.push(matrix);
          this.meshes[node.mesh].matrices.push(modelInvTr);
        }
      }

      if (node.camera !== undefined) {
        this.cameras.push({ world: matrix, json: gltf.cameras![node.camera] });
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
        GPUBufferUsage.UNIFORM,
        device
      );

      mesh.primitives.forEach((primitive, primIndex) => {
        const { material } = gltf.meshes[Number(meshIndex)][primIndex];
        const { baseColorTexture, metallicRoughnessTexture } =
          material.pbrMetallicRoughness;
        const { normalTexture, occlusionTexture, emissiveTexture } = material;
        const textures = [
          baseColorTexture,
          metallicRoughnessTexture,
          normalTexture,
          occlusionTexture,
          emissiveTexture,
        ];

        primitive.isTransparent = material.alphaMode === 'BLEND';

        textures.forEach((texture) => {
          if (texture && !this.textures[texture.index]) {
            const { width, height } = gltf.textures[texture.index].source;
            this.textures[texture.index] = device.createTexture({
              size: [width, height, 1],
              format: 'rgba8unorm',
              usage:
                GPUTextureUsage.TEXTURE_BINDING | // eslint-disable-line no-bitwise
                GPUTextureUsage.COPY_DST | // eslint-disable-line no-bitwise
                GPUTextureUsage.RENDER_ATTACHMENT,
            });
            device.queue.copyExternalImageToTexture(
              { source: gltf.textures[texture.index].source },
              { texture: this.textures[texture.index] },
              [width, height]
            );
          }
        });

        primitive.pipeline = createPipeline(
          device,
          contextFormat,
          material,
          primitive,
          mesh.matrices.length / 2
        );

        const bindGroupEntries: [GPUBindGroupEntry] = [
          { binding: 0, resource: { buffer: mesh.matrixBuffer! } },
        ];
        textures.forEach((texture, n) => {
          if (texture) {
            const { addressModeU, addressModeV, magFilter, minFilter } =
              gltf.textures[texture.index].sampler;
            bindGroupEntries.push({
              binding: n * 2 + 1,
              resource: device.createSampler({
                addressModeU,
                addressModeV,
                magFilter,
                minFilter,
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
    this.camera.destroy();
    Object.entries(this.meshes).forEach(([, mesh]) => {
      mesh.matrixBuffer!.destroy();
      mesh.primitives.forEach((primitive) => {
        primitive.destroy();
      });
    });
    Object.entries(this.textures).forEach(([, texture]) => texture.destroy());
  }
}
