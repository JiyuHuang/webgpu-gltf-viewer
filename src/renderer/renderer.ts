import { vec3, mat4 } from 'gl-matrix';
import { GLTF, loadGLTF } from '../loader/gltf';
import Resource from './resource';

function getModelMatrix(model: mat4) {
  const mat = mat4.create();
  const now = Date.now() / 1000;
  mat4.rotate(mat, model, 1, vec3.fromValues(Math.sin(now), Math.cos(now), 0));
  return mat;
}

function getViewProjMatrix(width: number, height: number) {
  const aspect = width / height;
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0);
  const viewMatrix = mat4.create();
  mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, 0, -5));
  const viewProj = mat4.create();
  mat4.multiply(viewProj, projectionMatrix, viewMatrix);
  return viewProj;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;

  readonly device: GPUDevice;

  readonly context: GPUCanvasContext;

  readonly contextFormat: GPUTextureFormat;

  contextSize: GPUExtent3D;

  renderPassDesc: GPURenderPassDescriptor;

  gltf?: GLTF;

  resource?: Resource;

  constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    contextFormat: GPUTextureFormat,
    contextSize: GPUExtent3D
  ) {
    this.canvas = canvas;
    this.device = device;
    this.context = context;
    this.contextFormat = contextFormat;
    this.contextSize = contextSize;
    this.renderPassDesc = {
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.device!.createTexture({
          size: this.contextSize!,
          format: 'depth24plus',
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        }).createView(),
        depthLoadValue: 1.0,
        depthStoreOp: 'store',
        stencilLoadValue: 0,
        stencilStoreOp: 'store',
      },
    };
  }

  protected render() {
    const frame = () => {
      const commandEncoder = this.device.createCommandEncoder();
      this.renderPassDesc.colorAttachments = [
        {
          view: this.context.getCurrentTexture().createView(),
          loadValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: 'store',
        },
      ];
      const passEncoder = commandEncoder.beginRenderPass(this.renderPassDesc);

      Object.entries(this.resource!.meshes).forEach(([, meshResource]) => {
        const writeBuffer = (matrix: Float32Array, offset: number) => {
          this.device.queue.writeBuffer(
            meshResource.matrixBuffer,
            offset * 4 * 4 * 4,
            matrix.buffer,
            matrix.byteOffset,
            matrix.byteLength
          );
        };

        const modelMatrix = getModelMatrix(
          meshResource.matrices[0]
        ) as Float32Array;
        writeBuffer(modelMatrix, 0);

        const modelViewProj = mat4.create() as Float32Array;
        const viewProj = getViewProjMatrix(
          this.canvas.width,
          this.canvas.height
        );
        mat4.multiply(modelViewProj, viewProj, modelMatrix);
        writeBuffer(modelViewProj, 1);

        const modelInverseTranspose = mat4.create() as Float32Array;
        mat4.invert(modelInverseTranspose, modelMatrix);
        mat4.transpose(modelInverseTranspose, modelInverseTranspose);
        writeBuffer(modelInverseTranspose, 2);

        meshResource.primitives.forEach((primResource) => {
          passEncoder.setPipeline(primResource.pipeline);
          passEncoder.setVertexBuffer(0, primResource.positions);
          passEncoder.setVertexBuffer(1, primResource.normals);
          if (primResource.uvs) {
            passEncoder.setVertexBuffer(2, primResource.uvs);
          }
          passEncoder.setIndexBuffer(primResource.indices, 'uint16');
          passEncoder.setBindGroup(0, primResource.uniformBindGroup);
          passEncoder.drawIndexed(primResource.indexCount);
        });
      });

      passEncoder.endPass();
      this.device.queue.submit([commandEncoder.finish()]);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  async load(url: string) {
    this.gltf = await loadGLTF(url);
    this.resource?.destroy();
    this.resource = new Resource(
      this.gltf,
      this.gltf.scene,
      this.device,
      this.contextFormat
    );
    this.render();
  }
}

export async function createRenderer(canvas: HTMLCanvasElement) {
  const entry = navigator.gpu;
  if (!entry) throw new Error('WebGPU is not supported on this browser.');
  const adapter = await entry.requestAdapter();
  const device = await adapter!.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = context!.getPreferredFormat(adapter!);
  const size = [
    canvas.clientWidth * devicePixelRatio,
    canvas.clientHeight * devicePixelRatio,
  ];
  context!.configure({ device, format, size });
  return new Renderer(canvas, device, context!, format, size);
}
