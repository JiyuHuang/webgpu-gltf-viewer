import { GLTF, loadGLTF } from '../loader/gltf';
import Scene from './scene';
import Camera from './camera';

export class Renderer {
  canvas: HTMLCanvasElement;

  device: GPUDevice;

  context: GPUCanvasContext;

  contextFormat: GPUTextureFormat;

  renderPassDesc: GPURenderPassDescriptor;

  gltf?: GLTF;

  scene?: Scene;

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
  }

  render() {
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

      this.scene!.camera.bind(this.device, passEncoder);

      Object.entries(this.scene!.meshes).forEach(([, mesh]) => {
        mesh.primitives.forEach((primitive) => {
          if (!primitive.isTransparent) {
            primitive.draw(passEncoder, mesh.matrices.length / 2);
          }
        });
      });
      Object.entries(this.scene!.meshes).forEach(([, mesh]) => {
        mesh.primitives.forEach((primitive) => {
          if (primitive.isTransparent) {
            primitive.draw(passEncoder, mesh.matrices.length / 2);
          }
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
    this.scene?.destroy();
    this.scene = new Scene(
      this.gltf,
      this.gltf.defaultScene,
      this.canvas,
      this.device,
      this.contextFormat
    );
    this.render();
  }

  getCameraCount() {
    return this.scene ? this.scene.cameras.length : 0;
  }

  setCamera(index?: number) {
    this.scene?.camera.destroy();
    if (this.scene) {
      this.scene.camera = new Camera(
        this.canvas,
        this.device,
        index !== undefined ? this.scene.cameras[index] : undefined
      );
    }
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
