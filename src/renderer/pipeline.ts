import vert from '../shaders/vert.wgsl';
import frag from '../shaders/frag.wgsl';

export default function createPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  material: any,
  hasUV: boolean,
  hasTangent: boolean,
  instanceCount: number,
  cameraBindGroupLayout: GPUBindGroupLayout
) {
  const { baseColorTexture, metallicRoughnessTexture } =
    material.pbrMetallicRoughness;
  const { normalTexture } = material;
  const textures = [baseColorTexture, metallicRoughnessTexture, normalTexture];

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
  if (hasUV) {
    vertexBufferLayout.push(getVertexBufferLayout(2, 2));
  }
  if (hasTangent) {
    vertexBufferLayout.push(getVertexBufferLayout(3, 4));
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
        code: vert(instanceCount, hasUV, hasTangent),
      }),
      entryPoint: 'main',
      buffers: vertexBufferLayout,
    },
    fragment: {
      module: device.createShaderModule({
        code: frag(material, hasUV, hasTangent),
      }),
      entryPoint: 'main',
      targets: [{ format }],
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
