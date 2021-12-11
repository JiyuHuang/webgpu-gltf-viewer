import { mat4, vec3 } from 'gl-matrix';
import { GLTF } from '../loader/gltf';
import createPipeline from './pipeline';
import Primitive from './primitive';
import { joinArray, createGPUBuffer } from '../util';
import Camera from './camera';
import Node from './node';

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

  cameras: Array<{ eye: vec3; view: mat4; json: any }> = [];

  aabb: { max: vec3; min: vec3 };

  constructor(
    gltf: GLTF,
    sceneIndex: number,
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    contextFormat: GPUTextureFormat
  ) {
    const root = new Node(gltf.nodes, -1, null);
    root.children = gltf.scenes[sceneIndex].nodes.map(
      (index: number) => new Node(gltf.nodes, index, root)
    );
    this.aabb = root.getAABB(gltf.meshes);

    this.camera = new Camera(canvas, device, this.aabb);

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
        const newCamera = {
          eye: vec3.create(),
          view: matrix,
          json: gltf.cameras![node.camera],
        };
        vec3.transformMat4(newCamera.eye, newCamera.eye, matrix);
        mat4.invert(newCamera.view, newCamera.view);
        this.cameras.push(newCamera);
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
          if (texture && !this.textures[texture.source]) {
            const image = gltf.images[texture.source];
            this.textures[texture.source] = device.createTexture({
              size: [image.width, image.height, 1],
              format: 'rgba8unorm',
              usage:
                GPUTextureUsage.TEXTURE_BINDING | // eslint-disable-line no-bitwise
                GPUTextureUsage.COPY_DST | // eslint-disable-line no-bitwise
                GPUTextureUsage.RENDER_ATTACHMENT,
            });
            device.queue.copyExternalImageToTexture(
              { source: image },
              { texture: this.textures[texture.source] },
              [image.width, image.height]
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
              texture.sampler;
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
              resource: this.textures[texture.source].createView(),
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
