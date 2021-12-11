import {
  generateNormals,
  generateTangents,
  getTextures,
  gltfEnum,
  loadBuffer,
  loadJson,
  newTypedArray,
  toIndexArray,
  TypedArray,
} from '../util';

export class GLTF {
  scenes: Array<any>;

  defaultScene: number;

  nodes: Array<any>;

  cameras: Array<any>;

  meshes: Array<
    Array<{
      vertexCount: number;
      indices: Uint16Array | Uint32Array | null;
      positions: TypedArray;
      normals: TypedArray;
      uvs: TypedArray | null;
      uv1s: TypedArray | null;
      tangents: TypedArray | null;
      colors: TypedArray | null;
      material: any;
      boundingBox: {
        max: [number];
        min: [number];
      };
    }>
  >;

  images: Array<ImageBitmap>;

  constructor(
    json: any,
    buffers: Array<ArrayBuffer>,
    images: Array<ImageBitmap>,
    glbOffset = 0
  ) {
    this.scenes = json.scenes;
    this.defaultScene = json.scene || 0;
    this.nodes = json.nodes;
    this.cameras = json.cameras || [];
    this.images = images;

    function getSampler(samplerJson: any) {
      return {
        magFilter: gltfEnum[samplerJson.magFilter || 9729] as GPUFilterMode,
        minFilter: gltfEnum[samplerJson.minFilter || 9729] as GPUFilterMode,
        addressModeU: gltfEnum[samplerJson.wrapS || 10497] as GPUAddressMode,
        addressModeV: gltfEnum[samplerJson.wrapT || 10497] as GPUAddressMode,
      };
    }
    const samplers = json.samplers
      ? (json.samplers as Array<any>).map((sampler) => getSampler(sampler))
      : [];
    const defaultSampler = getSampler({});

    const textures = json.textures
      ? (json.textures as Array<any>).map((texture) => {
          texture.sampler =
            texture.sampler !== undefined
              ? samplers[texture.sampler]
              : defaultSampler;
          return texture;
        })
      : [];

    const materials = json.materials
      ? (json.materials as Array<any>).map((material) => {
          if (!material.pbrMetallicRoughness) {
            material.pbrMetallicRoughness = {};
          }
          getTextures(material).forEach((texture) => {
            if (texture) {
              texture.source = textures[texture.index].source;
              texture.sampler = textures[texture.index].sampler;
            }
          });
          return material;
        })
      : [];
    const defaultMaterial = { pbrMetallicRoughness: {} };

    const accessors = (json.accessors as Array<any>).map((accessor) => {
      const n = gltfEnum[accessor.type] as number;
      const bufferView = json.bufferViews[accessor.bufferView];
      const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
      let stride = bufferView.byteStride / 4;
      stride = stride > n ? stride : n;

      const array = newTypedArray(
        accessor.componentType,
        buffers[bufferView.buffer],
        bufferView.buffer === 0 ? offset + glbOffset : offset,
        (accessor.count - 1) * stride + n
      );

      if (stride > n) {
        const TypedArrayConstructor = array.constructor as {
          new (...args: any): TypedArray;
        };
        const strided = new TypedArrayConstructor(accessor.count * n);
        for (let i = 0, j = 0; i < strided.length; i += n, j += stride) {
          for (let k = 0; k < n; k += 1) {
            strided[i + k] = array[j + k];
          }
        }
        return strided;
      }
      return array;
    });

    this.meshes = (json.meshes as Array<any>).map((mesh) =>
      (mesh.primitives as Array<any>).map((primitive) => {
        const material =
          primitive.material !== undefined
            ? materials[primitive.material]
            : defaultMaterial;

        let indices = null;
        let vertexCount;
        if (primitive.indices !== undefined) {
          indices = toIndexArray(accessors[primitive.indices]);
          vertexCount = json.accessors[primitive.indices].count;
        } else {
          vertexCount = json.accessors[primitive.attributes.POSITION].count;
        }

        const positions = accessors[primitive.attributes.POSITION];
        const { max, min } = json.accessors[primitive.attributes.POSITION];
        const boundingBox = { max, min };

        let normals;
        if (primitive.attributes.NORMAL !== undefined) {
          normals = accessors[primitive.attributes.NORMAL];
        } else {
          normals = generateNormals(indices, positions);
        }

        let uvs = null;
        if (primitive.attributes.TEXCOORD_0 !== undefined) {
          uvs = accessors[primitive.attributes.TEXCOORD_0];
        }
        let uv1s = null;
        if (primitive.attributes.TEXCOORD_1 !== undefined) {
          uv1s = accessors[primitive.attributes.TEXCOORD_1];
        }

        let tangents = null;
        if (
          primitive.attributes.TANGENT !== undefined &&
          primitive.attributes.NORMAL !== undefined
        ) {
          tangents = accessors[primitive.attributes.TANGENT];
        } else if (material.normalTexture) {
          tangents = generateTangents(indices, positions, normals, uvs!);
        }

        let colors = null;
        if (primitive.attributes.COLOR_0 !== undefined) {
          colors = accessors[primitive.attributes.COLOR_0];
        }

        return {
          vertexCount,
          indices,
          positions,
          normals,
          uvs,
          uv1s,
          tangents,
          colors,
          material,
          boundingBox,
        };
      })
    );
  }
}

async function loadGLTFObject(
  json: any,
  url: string,
  bin?: ArrayBuffer,
  glbOffset = 0
) {
  const dir = url.substring(0, url.lastIndexOf('/'));

  const images: Array<ImageBitmap> = [];
  let loadExternalImages: Promise<any> = Promise.resolve();
  if (json.images) {
    loadExternalImages = Promise.all(
      json.images.map(async (image: any, index: number) => {
        if (image.uri) {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.src = `${dir}/${image.uri}`;
          await img.decode();
          images[index] = await createImageBitmap(img, {
            colorSpaceConversion: 'none',
          });
        }
      })
    );
  }

  const buffers: Array<ArrayBuffer> = [];
  await Promise.all(
    json.buffers.map((buffer: any, index: number) => {
      if (!buffer.uri) {
        if (index !== 0) {
          throw new Error('buffer uri undefined');
        }
        buffers[index] = bin!;
        return Promise.resolve();
      }
      return loadBuffer(`${dir}/${buffer.uri}`).then(
        (arrayBuffer: ArrayBuffer) => {
          buffers[index] = arrayBuffer;
        }
      );
    })
  );

  let loadInternalImages: Promise<any> = Promise.resolve();
  if (json.images) {
    loadInternalImages = Promise.all(
      json.images.map(async (image: any, index: number) => {
        if (image.bufferView !== undefined) {
          const { buffer, byteOffset, byteLength } =
            json.bufferViews[image.bufferView];
          const array = new Uint8Array(
            buffers[buffer],
            buffer === 0 ? byteOffset + glbOffset : byteOffset,
            byteLength
          );
          let type;
          if (image.mimeType) {
            type = image.mimeType;
          } else {
            type = array[0] === 0xff ? 'image/jpeg' : 'image/png';
          }
          const blob = new Blob([array], { type });
          images[index] = await createImageBitmap(blob, {
            colorSpaceConversion: 'none',
          });
        }
      })
    );
  }

  await Promise.all([loadExternalImages, loadInternalImages]);
  return new GLTF(json, buffers, images, glbOffset);
}

export async function loadGLTF(url: string) {
  const ext = url.split('.').pop();
  if (ext === 'gltf') {
    const json = await loadJson(url);
    return loadGLTFObject(json, url);
  }
  const glb = await loadBuffer(url);
  const jsonLength = new Uint32Array(glb, 12, 1)[0];
  const jsonChunk = new Uint8Array(glb, 20, jsonLength);
  const json = JSON.parse(new TextDecoder('utf-8').decode(jsonChunk));
  return loadGLTFObject(json, url, glb, 28 + jsonLength);
}
