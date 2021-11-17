import { vec3, mat4 } from 'gl-matrix';
import loadGltf from './gltf-loader';
import vert from './shaders/standard.vert.wgsl';
import frag from './shaders/standard.frag.wgsl';

function getTransformationMatrix(width: number, height: number) {
  const modelMatrix = mat4.create();
  mat4.scale(modelMatrix, mat4.create(), vec3.fromValues(0.03, 0.03, 0.03));

  const aspect = width / height;
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0);

  const viewMatrix = mat4.create();
  mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, -1, -7));
  const now = Date.now() / 1000;
  mat4.rotate(
    viewMatrix,
    viewMatrix,
    1,
    vec3.fromValues(Math.sin(now), Math.cos(now), 0)
  );

  const modelView = mat4.create();
  mat4.multiply(modelView, viewMatrix, modelMatrix);

  const modelViewProjectionMatrix = mat4.create();
  mat4.multiply(modelViewProjectionMatrix, projectionMatrix, modelView);

  return modelViewProjectionMatrix as Float32Array;
}

async function render(canvas: HTMLCanvasElement) {
  const model = await loadGltf('models/Duck/Duck.gltf');

  const entry = navigator.gpu;
  if (!entry) {
    const errorMsg = document.createElement('p');
    errorMsg.innerHTML = 'WebGPU is not supported on this browser.';
    document.body.appendChild(errorMsg);
    return;
  }
  const adapter = await entry.requestAdapter();
  const device = await adapter?.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!device || !context) {
    throw new Error('Failed to initialize WebGPU API.');
  }
  const contextFormat = context.getPreferredFormat(adapter!);
  const presentationSize = [
    canvas.clientWidth * devicePixelRatio,
    canvas.clientHeight * devicePixelRatio,
  ];
  context.configure({
    device,
    format: contextFormat,
    size: presentationSize,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
    ],
  });

  function vertBufLayout(
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

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: {
      module: device.createShaderModule({ code: vert }),
      entryPoint: 'main',
      buffers: [vertBufLayout(0, 3), vertBufLayout(1, 3), vertBufLayout(2, 2)],
    },
    fragment: {
      module: device.createShaderModule({ code: frag }),
      entryPoint: 'main',
      targets: [{ format: contextFormat }],
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
          size: presentationSize,
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

  function createBuffer(array: Float32Array | Uint16Array, usage: number) {
    const buffer = device!.createBuffer({
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
  const posBuf = createBuffer(model.posBuf, GPUBufferUsage.VERTEX);
  const norBuf = createBuffer(model.norBuf, GPUBufferUsage.VERTEX);
  const uvBuf = createBuffer(model.uvBuf, GPUBufferUsage.VERTEX);
  const idxBuf = createBuffer(model.idxBuf, GPUBufferUsage.INDEX);

  const modelTex = device.createTexture({
    size: [model.texBitmap.width, model.texBitmap.height, 1],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING | // eslint-disable-line no-bitwise
      GPUTextureUsage.COPY_DST | // eslint-disable-line no-bitwise
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: model.texBitmap },
    { texture: modelTex },
    [model.texBitmap.width, model.texBitmap.height]
  );

  let modelViewProj: Float32Array;
  const modelViewProjBuf = device.createBuffer({
    size: 4 * 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // eslint-disable-line no-bitwise
  });

  const uniformBindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: modelViewProjBuf,
        },
      },
      {
        binding: 1,
        resource: device.createSampler({
          addressModeU: 'repeat',
          addressModeV: 'repeat',
          magFilter: 'linear',
          minFilter: 'linear',
        }),
      },
      {
        binding: 2,
        resource: modelTex.createView(),
      },
    ],
  });

  function frame() {
    modelViewProj = getTransformationMatrix(canvas.width, canvas.height);
    device!.queue.writeBuffer(
      modelViewProjBuf,
      0,
      modelViewProj.buffer,
      modelViewProj.byteOffset,
      modelViewProj.byteLength
    );

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
    passEncoder.setVertexBuffer(2, uvBuf);
    passEncoder.setIndexBuffer(idxBuf, 'uint16');
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.drawIndexed(
      model.idxBuf.byteLength / Uint16Array.BYTES_PER_ELEMENT
    );
    passEncoder.endPass();
    device!.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

export default render;
