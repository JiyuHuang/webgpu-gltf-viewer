import { GLTF, loadGLTF } from '../loader/gltf';
import Resource from './resource';
import Camera from './camera';

export class Renderer {
  canvas: HTMLCanvasElement;

  device: GPUDevice;

  context: GPUCanvasContext;

  contextFormat: GPUTextureFormat;

  renderPassDesc: GPURenderPassDescriptor;

  gltf?: GLTF;

  resource?: Resource;

  camera: Camera;

  constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    contextFormat: GPUTextureFormat
  ) {
    this.canvas = canvas;
    this.device = device;
    this.context = context;
    this.contextFormat = contextFormat;

    let depthTexture = device.createTexture({
      size: [
        canvas.clientWidth * devicePixelRatio,
        canvas.clientHeight * devicePixelRatio,
      ],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.renderPassDesc = {
      colorAttachments: [],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthLoadValue: 1.0,
        depthStoreOp: 'store',
        stencilLoadValue: 0,
        stencilStoreOp: 'store',
      },
    };

    window.addEventListener('resize', () => {
      const size = [
        canvas.clientWidth * devicePixelRatio,
        canvas.clientHeight * devicePixelRatio,
      ];
      context.configure({ device, format: contextFormat, size });
      depthTexture.destroy();
      depthTexture = device.createTexture({
        size,
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.renderPassDesc.depthStencilAttachment!.view =
        depthTexture.createView();
    });

    this.camera = new Camera(canvas);
  }

  protected render() {
    const frame = () => {
      const commandEncoder = this.device.createCommandEncoder();
      this.renderPassDesc.colorAttachments = [
        {
          view: this.context.getCurrentTexture().createView(),
          loadValue: { r: 0.3, g: 0.5, b: 0.7, a: 1 },
          storeOp: 'store',
        },
      ];
      const passEncoder = commandEncoder.beginRenderPass(this.renderPassDesc);

      const projView = this.camera.projView as Float32Array;
      this.device.queue.writeBuffer(
        this.resource!.camera.projViewBuffer,
        0,
        projView.buffer,
        projView.byteOffset,
        projView.byteLength
      );
      const eye = this.camera.eye as Float32Array;
      this.device.queue.writeBuffer(
        this.resource!.camera.eyeBuffer,
        0,
        eye.buffer,
        eye.byteOffset,
        eye.byteLength
      );
      passEncoder.setBindGroup(0, this.resource!.camera.bindGroup);

      Object.entries(this.resource!.meshes).forEach(([, meshResource]) => {
        for (let i = 0; i < meshResource.matrices.length; i += 1) {
          const writeBuffer = (matrix: Float32Array, offset: number) => {
            this.device.queue.writeBuffer(
              meshResource.matrixBuffer,
              offset * 4 * 4 * 4,
              matrix.buffer,
              matrix.byteOffset,
              matrix.byteLength
            );
          };
          writeBuffer(meshResource.matrices[i] as Float32Array, 0);
          writeBuffer(meshResource.modelInvTrs[i] as Float32Array, 1);
        }

        meshResource.primitives.forEach((primResource) => {
          passEncoder.setPipeline(
            this.resource!.pipelines[primResource.pipeline]
          );
          passEncoder.setVertexBuffer(0, primResource.positions);
          passEncoder.setVertexBuffer(1, primResource.normals);
          if (primResource.uvs) {
            passEncoder.setVertexBuffer(2, primResource.uvs);
          }
          passEncoder.setIndexBuffer(primResource.indices, 'uint16');
          passEncoder.setBindGroup(1, primResource.uniformBindGroup);
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
    this.camera.reset();
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
  context!.configure({
    device,
    format,
    size: [
      canvas.clientWidth * devicePixelRatio,
      canvas.clientHeight * devicePixelRatio,
    ],
  });
  return new Renderer(canvas, device, context!, format);
}
