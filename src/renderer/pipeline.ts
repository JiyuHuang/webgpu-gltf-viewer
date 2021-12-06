import vert from '../shaders/vert.wgsl';
import frag from '../shaders/frag.wgsl';
import Primitive from './primitive';

export default function createPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  material: any,
  primitive: Primitive,
  instanceCount: number,
  cameraBindGroupLayout: GPUBindGroupLayout
) {
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

  let slotIndex = -1;
  function getVertexBufferLayout(n: number): GPUVertexBufferLayout {
    slotIndex += 1;
    return {
      attributes: [
        {
          shaderLocation: slotIndex,
          offset: 0,
          format: `float32x${n}` as GPUVertexFormat,
        },
      ],
      arrayStride: 4 * n,
    };
  }
  const vertexBufferLayout = [
    getVertexBufferLayout(3),
    getVertexBufferLayout(3),
  ];
  if (primitive.uvs !== null) {
    vertexBufferLayout.push(getVertexBufferLayout(2));
  }
  if (primitive.uv1s !== null) {
    vertexBufferLayout.push(getVertexBufferLayout(2));
  }
  if (primitive.tangents !== null) {
    vertexBufferLayout.push(getVertexBufferLayout(4));
  }
  if (primitive.colors !== null) {
    vertexBufferLayout.push(getVertexBufferLayout(4));
  }

  const bindGroupLayoutEntries: [GPUBindGroupLayoutEntry] = [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: {},
    },
  ];
  textures.forEach((texture, index) => {
    if (texture) {
      bindGroupLayoutEntries.push({
        binding: 2 * index + 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      });
      bindGroupLayoutEntries.push({
        binding: 2 * index + 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      });
    }
  });

  return device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [
        cameraBindGroupLayout,
        device.createBindGroupLayout({
          entries: bindGroupLayoutEntries,
        }),
      ],
    }),
    vertex: {
      module: device.createShaderModule({
        code: vert(primitive, instanceCount),
      }),
      entryPoint: 'main',
      buffers: vertexBufferLayout,
    },
    fragment: {
      module: device.createShaderModule({
        code: frag(primitive, material),
      }),
      entryPoint: 'main',
      targets: [
        {
          format,
          blend: {
            color:
              material.alphaMode !== 'BLEND'
                ? { operation: 'add', srcFactor: 'one', dstFactor: 'zero' }
                : {
                    operation: 'add',
                    srcFactor: 'src-alpha',
                    dstFactor: 'one-minus-src-alpha',
                  },
            alpha: { operation: 'add', srcFactor: 'zero', dstFactor: 'one' },
          },
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: material.doubleSided ? 'none' : 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  });
}
