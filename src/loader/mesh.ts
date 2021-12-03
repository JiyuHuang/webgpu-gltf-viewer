import { TypedArray } from '../util';

class GLTFPrimitive {
  indexCount: number;

  indices: TypedArray;

  positions: TypedArray;

  normals: TypedArray;

  uvs?: TypedArray;

  material: any;

  constructor(json: any, primitive: any, buffer: ArrayBuffer) {
    function getArray(idx: number, n: number) {
      const accessor = json.accessors[idx];
      const bufferView = json.bufferViews[accessor.bufferView];
      const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
      let stride = bufferView.byteStride / 4;
      stride = stride > n ? stride : n;

      let array;
      switch (accessor.componentType) {
        case 5120:
        case 'BYTE':
          array = new Int8Array(buffer, offset, accessor.count * stride);
          break;
        case 5121:
        case 'UNSIGNED_BYTE':
          array = new Uint8Array(buffer, offset, accessor.count * stride);
          break;
        case 5122:
        case 'SHORT':
          array = new Int16Array(buffer, offset, accessor.count * stride);
          break;
        case 5123:
        case 'UNSIGNED_SHORT':
          array = new Uint16Array(buffer, offset, accessor.count * stride);
          break;
        case 5125:
        case 'UNSIGNED_INT':
          array = new Uint32Array(buffer, offset, accessor.count * stride);
          break;
        case 5126:
        case 'FLOAT':
          array = new Float32Array(buffer, offset, accessor.count * stride);
          break;
        default:
          throw new Error('invalid component type');
      }

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

    this.indexCount = json.accessors[primitive.indices].count;
    this.indices = getArray(primitive.indices, 1);
    this.positions = getArray(primitive.attributes.POSITION, 3);
    this.normals = getArray(primitive.attributes.NORMAL, 3);
    if (primitive.attributes.TEXCOORD_0 !== undefined) {
      this.uvs = getArray(primitive.attributes.TEXCOORD_0, 2);
    }

    this.material = json.materials[primitive.material];
  }
}

export type GLTFMesh = Array<GLTFPrimitive>;

export function loadMeshes(json: any, buffer: ArrayBuffer) {
  return json.meshes.map((mesh: any) =>
    mesh.primitives.map(
      (primitive: any) => new GLTFPrimitive(json, primitive, buffer)
    )
  );
}
