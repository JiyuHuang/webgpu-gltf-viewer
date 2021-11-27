import { GLTF, loadGLTF } from '../loader/gltf';
import Resource from './resource';
import Camera from './camera';

export class Renderer {
  canvas: HTMLCanvasElement;

  device: GPUDevice;

  context: GPUCanvasContext;

  contextFormat: GPUTextureFormat;

  depthTexture: GPUTexture;

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

    this.depthTexture = device.createTexture({
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
        view: this.depthTexture.createView(),
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
      this.depthTexture.destroy();
      this.depthTexture = device.createTexture({
        size,
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      this.renderPassDesc.depthStencilAttachment!.view =
        this.depthTexture.createView();
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
        writeBuffer(meshResource.matrices[0] as Float32Array, 0);
        writeBuffer(meshResource.modelInvTrs[0] as Float32Array, 1);
        writeBuffer(this.camera.projView as Float32Array, 2);

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
