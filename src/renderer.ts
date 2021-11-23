import { vec3, mat4 } from 'gl-matrix';
import vert from './shaders/standard.vert.wgsl';
import frag from './shaders/standard.frag.wgsl';
import GLTF from './classes/gltf';

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

export default class Renderer {
  canvas: HTMLCanvasElement;

  device: GPUDevice | undefined;

  contextFormat: GPUTextureFormat | undefined;

  contextSize: GPUExtent3D | undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init() {
    const entry = navigator.gpu;
    if (!entry) throw new Error('WebGPU is not supported on this browser.');
    const adapter = await entry.requestAdapter();
    this.device = await adapter?.requestDevice();
    const context = this.canvas.getContext('webgpu');
    this.contextFormat = context!.getPreferredFormat(adapter!);
    this.contextSize = [
      this.canvas.clientWidth * devicePixelRatio,
      this.canvas.clientHeight * devicePixelRatio,
    ];
    context!.configure({
      device: this.device!,
      format: this.contextFormat,
      size: this.contextSize,
    });
  }

  async render(url: string) {
    const gltf = new GLTF();
    await gltf.load(url);
    const viewProj = getViewProjMatrix(this.canvas.width, this.canvas.height);
    const device = this.device!;
    const context = this.canvas.getContext('webgpu');

    function createBuffer(array: Float32Array | Uint16Array, usage: number) {
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
    }
    const posBuf = createBuffer(
      gltf.meshes[0][0].positions,
      GPUBufferUsage.VERTEX
    );
    const norBuf = createBuffer(
      gltf.meshes[0][0].normals,
      GPUBufferUsage.VERTEX
    );
    let uvBuf: GPUBuffer | undefined;
    if (gltf.meshes[0][0].uvs) {
      uvBuf = createBuffer(gltf.meshes[0][0].uvs, GPUBufferUsage.VERTEX);
    }
    const idxBuf = createBuffer(
      gltf.meshes[0][0].indices,
      GPUBufferUsage.INDEX
    );

    const bindGroupLayoutEntries: [GPUBindGroupLayoutEntry] = [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      },
    ];
    if (uvBuf) {
      bindGroupLayoutEntries.push({
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      });
      bindGroupLayoutEntries.push({
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      });
    }
    const bindGroupLayout = device.createBindGroupLayout({
      entries: bindGroupLayoutEntries,
    });

    function getVertexBufferLayout(
      shaderLocation: number,
      n: number
    ): GPUVertexBufferLayout {
      return {
        attributes: [
          {
            shaderLocation,
            offset: 0,
            format: `float32x${n}` as GPUVertexFormat,
          },
        ],
        arrayStride: 4 * n,
      };
    }
    const vertexBufferLayout = [
      getVertexBufferLayout(0, 3),
      getVertexBufferLayout(1, 3),
    ];
    if (uvBuf) {
      vertexBufferLayout.push(getVertexBufferLayout(2, 2));
    }

    const pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: device.createShaderModule({ code: vert(uvBuf !== undefined) }),
        entryPoint: 'main',
        buffers: vertexBufferLayout,
      },
      fragment: {
        module: device.createShaderModule({ code: frag(uvBuf !== undefined) }),
        entryPoint: 'main',
        targets: [{ format: this.contextFormat! }],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
    });

    const renderPassDesc: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: context!.getCurrentTexture().createView(),
          loadValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: device
          .createTexture({
            size: this.contextSize!,
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
          })
          .createView(),

        depthLoadValue: 1.0,
        depthStoreOp: 'store',
        stencilLoadValue: 0,
        stencilStoreOp: 'store',
      },
    };

    let modelTex: GPUTexture | undefined;
    if (uvBuf) {
      modelTex = device.createTexture({
        size: [gltf.images[0].width, gltf.images[0].height, 1],
        format: 'rgba8unorm',
        usage:
          GPUTextureUsage.TEXTURE_BINDING | // eslint-disable-line no-bitwise
          GPUTextureUsage.COPY_DST | // eslint-disable-line no-bitwise
          GPUTextureUsage.RENDER_ATTACHMENT,
      });
      device.queue.copyExternalImageToTexture(
        { source: gltf.images[0] },
        { texture: modelTex },
        [gltf.images[0].width, gltf.images[0].height]
      );
    }

    const transformBuffer = device.createBuffer({
      size: 4 * 4 * 4 * 3,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // eslint-disable-line no-bitwise
    });

    const bindGroupEntries: [GPUBindGroupEntry] = [
      {
        binding: 0,
        resource: {
          buffer: transformBuffer,
        },
      },
    ];
    if (modelTex) {
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
        resource: modelTex.createView(),
      });
    }
    const uniformBindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: bindGroupEntries,
    });

    function frame() {
      function writeBuffer(matrix: Float32Array, offset: number) {
        device.queue.writeBuffer(
          transformBuffer,
          offset * 4 * 4 * 4,
          matrix.buffer,
          matrix.byteOffset,
          matrix.byteLength
        );
      }

      const modelMatrix = getModelMatrix(
        gltf.scenes[gltf.scene || 0].nodes[0].globalTransform
      ) as Float32Array;
      writeBuffer(modelMatrix, 0);

      const modelViewProj = mat4.create() as Float32Array;
      mat4.multiply(modelViewProj, viewProj, modelMatrix);
      writeBuffer(modelViewProj, 1);

      const modelInverseTranspose = mat4.create() as Float32Array;
      mat4.invert(modelInverseTranspose, modelMatrix);
      mat4.transpose(modelInverseTranspose, modelInverseTranspose);
      writeBuffer(modelInverseTranspose, 2);

      const commandEncoder = device!.createCommandEncoder();
      renderPassDesc.colorAttachments = [
        {
          view: context!.getCurrentTexture().createView(),
          loadValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: 'store',
        },
      ];
      const passEncoder = commandEncoder.beginRenderPass(renderPassDesc);
      passEncoder.setPipeline(pipeline);
      passEncoder.setVertexBuffer(0, posBuf);
      passEncoder.setVertexBuffer(1, norBuf);
      if (uvBuf) {
        passEncoder.setVertexBuffer(2, uvBuf);
      }
      passEncoder.setIndexBuffer(idxBuf, 'uint16');
      passEncoder.setBindGroup(0, uniformBindGroup);
      passEncoder.drawIndexed(
        gltf.meshes[0][0].indices.byteLength / Uint16Array.BYTES_PER_ELEMENT
      );
      passEncoder.endPass();
      device.queue.submit([commandEncoder.finish()]);

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }
}
