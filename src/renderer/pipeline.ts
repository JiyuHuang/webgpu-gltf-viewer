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
  const hasUV = primitive.uvs !== null;
  const hasTangent = primitive.tangents !== null;
  const hasVertexColor = primitive.colors !== null;

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
  if (hasUV) {
    vertexBufferLayout.push(getVertexBufferLayout(2));
  }
  if (hasTangent) {
    vertexBufferLayout.push(getVertexBufferLayout(4));
  }
  if (hasVertexColor) {
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
        code: vert(instanceCount, hasUV, hasTangent, hasVertexColor),
      }),
      entryPoint: 'main',
      buffers: vertexBufferLayout,
    },
    fragment: {
      module: device.createShaderModule({
        code: frag(material, hasUV, hasTangent, hasVertexColor),
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
            alpha:
              material.alphaMode !== 'BLEND'
                ? { operation: 'add', srcFactor: 'zero', dstFactor: 'one' }
                : {
                    operation: 'add',
                    srcFactor: 'src-alpha',
                    dstFactor: 'one-minus-src-alpha',
                  },
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
