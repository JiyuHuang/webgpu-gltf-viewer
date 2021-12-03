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
        this.scene!.camera.projViewBuffer,
        0,
        projView.buffer,
        projView.byteOffset,
        projView.byteLength
      );
      const eye = this.camera.eye as Float32Array;
      this.device.queue.writeBuffer(
        this.scene!.camera.eyeBuffer,
        0,
        eye.buffer,
        eye.byteOffset,
        eye.byteLength
      );
      passEncoder.setBindGroup(0, this.scene!.camera.bindGroup);

      Object.entries(this.scene!.meshes).forEach(([, mesh]) => {
        for (let i = 0; i < mesh.matrixBuffers.length; i += 1) {
          mesh.primitives.forEach((primitive) => {
            passEncoder.setPipeline(this.scene!.pipelines[primitive.pipeline]);
            passEncoder.setVertexBuffer(0, primitive.positions);
            passEncoder.setVertexBuffer(1, primitive.normals);
            if (primitive.uvs) {
              passEncoder.setVertexBuffer(2, primitive.uvs);
            }
            passEncoder.setIndexBuffer(primitive.indices, 'uint16');
            passEncoder.setBindGroup(1, primitive.uniformBindGroup!);
            passEncoder.drawIndexed(primitive.indexCount);
          });
        }
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
