import { vec3, mat4 } from 'gl-matrix';

import vert from './shaders/standard.vert.wgsl';
import frag from './shaders/standard.frag.wgsl';

import * as cube from './meshes/cube';
import tex from './textures/duck.png';

function getTransformationMatrix(width: number, height: number) {
  const aspect = width / height;
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, (2 * Math.PI) / 5, aspect, 1, 100.0);

  const viewMatrix = mat4.create();
  mat4.translate(viewMatrix, viewMatrix, vec3.fromValues(0, 0, -4));
  const now = Date.now() / 1000;
  mat4.rotate(
    viewMatrix,
    viewMatrix,
    1,
    vec3.fromValues(Math.sin(now), Math.cos(now), 0)
  );

  const modelViewProjectionMatrix = mat4.create();
  mat4.multiply(modelViewProjectionMatrix, projectionMatrix, viewMatrix);

  return modelViewProjectionMatrix as Float32Array;
}

async function render(canvas: HTMLCanvasElement) {
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
  context.configure({
    device,
    format: contextFormat,
    size: [
      canvas.clientWidth * devicePixelRatio,
      canvas.clientHeight * devicePixelRatio,
    ],
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' },
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

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: {
      module: device.createShaderModule({ code: vert }),
      entryPoint: 'main',
      buffers: [
        {
          attributes: [
            {
              shaderLocation: 0,
              offset: cube.cubePosOffset,
              format: 'float32x4',
            },
            {
              shaderLocation: 1,
              offset: cube.cubeColOffset,
              format: 'float32x4',
            },
            {
              shaderLocation: 2,
              offset: cube.cubeUVOffset,
              format: 'float32x2',
            },
          ],
          arrayStride: cube.cubeVertSize,
        },
      ],
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
  });

  const vertBuf = device.createBuffer({
    size: cube.cubeVerts.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertBuf.getMappedRange()).set(cube.cubeVerts);
  vertBuf.unmap();

  const texImg = document.createElement('img');
  texImg.src = tex;
  await texImg.decode();
  const texImgBitmap = await createImageBitmap(texImg);
  const cubeTex = device.createTexture({
    size: [texImgBitmap.width, texImgBitmap.height, 1],
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: texImgBitmap },
    { texture: cubeTex },
    [texImgBitmap.width, texImgBitmap.height]
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
          magFilter: 'linear',
          minFilter: 'linear',
        }),
      },
      {
        binding: 2,
        resource: cubeTex.createView(),
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
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context!.getCurrentTexture().createView(),
          loadValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: 'store',
        },
      ],
    });
    passEncoder.setPipeline(pipeline);
    passEncoder.setVertexBuffer(0, vertBuf);
    passEncoder.setBindGroup(0, uniformBindGroup);
    passEncoder.draw(cube.cubeVertCount);
    passEncoder.endPass();
    device!.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

export default render;
