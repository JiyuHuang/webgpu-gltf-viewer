import {
  generateNormals,
  generateTangents,
  gltfEnum,
  loadBuffer,
  loadImage,
  loadJson,
  newTypedArray,
  toIndexArray,
  TypedArray,
} from '../util';

export class GLTF {
  scenes: Array<any>;

  defaultScene: number;

  nodes: Array<any>;

  cameras: Array<any> | null;

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
    }>
  >;

  textures: Array<{
    source: ImageBitmap;
    sampler: {
      magFilter: GPUFilterMode;
      minFilter: GPUFilterMode;
      addressModeU: GPUAddressMode;
      addressModeV: GPUAddressMode;
    };
  }>;

  constructor(
    json: any,
    buffers: Array<ArrayBuffer>,
    images: Array<ImageBitmap>
  ) {
    this.scenes = json.scenes;
    this.defaultScene = json.scene || 0;
    this.nodes = json.nodes;
    this.cameras = json.cameras || null;

    function getArray(idx: number, n: number) {
      const accessor = json.accessors[idx];
      const bufferView = json.bufferViews[accessor.bufferView];
      const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
      let stride = bufferView.byteStride / 4;
      stride = stride > n ? stride : n;

      const array = newTypedArray(
        accessor.componentType,
        buffers[bufferView.buffer],
        offset,
        accessor.count * stride
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
    }

    this.meshes = (json.meshes as Array<any>).map((mesh) =>
      (mesh.primitives as Array<any>).map((primitive) => {
        let material;
        if (json.materials && primitive.material !== undefined) {
          material = json.materials[primitive.material];
        } else {
          material = {};
        }
        if (!material.pbrMetallicRoughness) {
          material.pbrMetallicRoughness = {};
        }

        let indices = null;
        let vertexCount;
        if (primitive.indices !== undefined) {
          indices = toIndexArray(getArray(primitive.indices, 1));
          vertexCount = json.accessors[primitive.indices].count;
        } else {
          vertexCount = json.accessors[primitive.attributes.POSITION].count;
        }

        const positions = getArray(primitive.attributes.POSITION, 3);

        let normals;
        if (primitive.attributes.NORMAL !== undefined) {
          normals = getArray(primitive.attributes.NORMAL, 3);
        } else {
          normals = generateNormals(indices, positions);
        }

        let uvs = null;
        if (primitive.attributes.TEXCOORD_0 !== undefined) {
          uvs = getArray(primitive.attributes.TEXCOORD_0, 2);
        }
        let uv1s = null;
        if (primitive.attributes.TEXCOORD_1 !== undefined) {
          uv1s = getArray(primitive.attributes.TEXCOORD_1, 2);
        }

        let tangents = null;
        if (
          primitive.attributes.TANGENT !== undefined &&
          primitive.attributes.NORMAL !== undefined
        ) {
          tangents = getArray(primitive.attributes.TANGENT, 4);
        } else if (material.normalTexture) {
          tangents = generateTangents(indices, positions, normals, uvs!);
        }

        let colors = null;
        if (primitive.attributes.COLOR_0 !== undefined) {
          colors = getArray(primitive.attributes.COLOR_0, 4);
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
        };
      })
    );

    this.textures = json.textures
      ? (json.textures as Array<any>).map((texture) => {
          let sampler;
          if (texture.sampler !== undefined) {
            sampler = json.samplers[texture.sampler];
          } else {
            sampler = {};
          }
          return {
            source: images[texture.source],
            sampler: {
              magFilter: gltfEnum[sampler.magFilter || 9729] as GPUFilterMode,
              minFilter: gltfEnum[sampler.minFilter || 9729] as GPUFilterMode,
              addressModeU: gltfEnum[sampler.wrapS || 10497] as GPUAddressMode,
              addressModeV: gltfEnum[sampler.wrapT || 10497] as GPUAddressMode,
            },
          };
        })
      : [];
  }
}

export async function loadGLTF(url: string) {
  const dir = url.substring(0, url.lastIndexOf('/'));
  const json = await loadJson(url);

  const buffers: Array<ArrayBuffer> = [];
  const buffersLoaded = Promise.all(
    json.buffers.map((buffer: any, index: number) =>
      loadBuffer(`${dir}/${buffer.uri}`).then((arrayBuffer: ArrayBuffer) => {
        buffers[index] = arrayBuffer;
      })
    )
  );

  const images: Array<ImageBitmap> = [];
  let imagesLoaded: Promise<any> = Promise.resolve();
  if (json.images) {
    imagesLoaded = Promise.all(
      json.images.map((image: any, index: number) =>
        loadImage(`${dir}/${image.uri}`).then((bitMap) => {
          images[index] = bitMap;
        })
      )
    );
  }

  return Promise.all([buffersLoaded, imagesLoaded]).then(
    () => new GLTF(json, buffers, images)
  );
}
