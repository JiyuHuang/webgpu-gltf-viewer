import { mat4, vec3 } from 'gl-matrix';
import { GLTF, GLTFAnimation } from '../loader/gltf';
import createPipeline from './pipeline';
import Primitive from './primitive';
import { joinArray, createGPUBuffer, getTextures } from '../util';
import Camera from './camera';
import Node from './node';

export default class Scene {
  root: Node;

  aabb: { max: vec3; min: vec3 };

  cameras: Array<{ eye: vec3; view: mat4; json: any }> = [];

  camera: Camera;

  meshes: Array<{
    matrices: Array<mat4>;
    matrixBuffer: GPUBuffer | undefined;
    primitives: Array<Primitive>;
  }>;

  textures: Array<GPUTexture>;

  animations: Array<GLTFAnimation>;

  startTime: number;

  constructor(
    gltf: GLTF,
    sceneIndex: number,
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    contextFormat: GPUTextureFormat
  ) {
    this.root = new Node(gltf.nodes, -1, null);
    this.root.children = gltf.scenes[sceneIndex].nodes.map(
      (index: number) => new Node(gltf.nodes, index, this.root)
    );
    this.aabb = this.root.getAABB(gltf.meshes);
    this.root.getCameras(this.cameras, gltf.cameras);
    this.camera = new Camera(canvas, device, this.aabb);

    this.meshes = gltf.meshes.map((mesh) => ({
      matrices: [],
      matrixBuffer: undefined,
      primitives: mesh.map((primitive) => new Primitive(primitive, device)),
    }));
    this.root.passMatrices(this.meshes);

    this.textures = gltf.images.map((image) => {
      const texture = device.createTexture({
        size: [image.width, image.height, 1],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING | // eslint-disable-line no-bitwise
          GPUTextureUsage.COPY_DST | // eslint-disable-line no-bitwise
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
      device.queue.copyExternalImageToTexture({ source: image }, { texture }, [
        image.width,
        image.height,
      ]);
      return texture;
    });

    this.meshes.forEach((mesh, meshIndex) => {
      if (mesh.matrices.length) {
        mesh.matrixBuffer = createGPUBuffer(
          joinArray(mesh.matrices as Array<Float32Array>),
          GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // eslint-disable-line no-bitwise
          device
        );

        mesh.primitives.forEach((primitive, primIndex) => {
          const { material } = gltf.meshes[meshIndex][primIndex];

          primitive.isTransparent = material.alphaMode === 'BLEND';

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
          getTextures(material).forEach((texture, n) => {
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
      }
    });

    this.animations = gltf.animations;
    this.startTime = Date.now() / 1000;
  }

  update(device: GPUDevice, passEncoder: GPURenderPassEncoder) {
    this.camera.bind(device, passEncoder);

    if (this.animations.length) {
      this.root.animate(this.animations, Date.now() / 1000 - this.startTime);
      this.meshes.forEach((mesh) => {
        mesh.matrices = [];
      });
      this.root.passMatrices(this.meshes);
      this.meshes.forEach((mesh) => {
        if (mesh.matrixBuffer) {
          const matrices = joinArray(mesh.matrices as Array<Float32Array>);
          device.queue.writeBuffer(
            mesh.matrixBuffer!,
            0,
            matrices.buffer,
            matrices.byteOffset,
            matrices.byteLength
          );
        }
      });
    }
  }

  destroy() {
    this.camera.destroy();
    this.meshes.forEach((mesh) => {
      mesh.matrixBuffer?.destroy();
      mesh.primitives.forEach((primitive) => {
        primitive.destroy();
      });
    });
    this.textures.forEach((texture) => texture.destroy());
  }
}
