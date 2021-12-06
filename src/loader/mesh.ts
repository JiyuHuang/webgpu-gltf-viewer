import {
  generateNormals,
  generateTangents,
  newTypedArray,
  toIndexArray,
  TypedArray,
} from '../util';

export class GLTFPrimitive {
  vertexCount: number;

  indices?: Uint16Array | Uint32Array;

  positions: TypedArray;

  normals: TypedArray;

  uvs?: TypedArray;

  uv1s?: TypedArray;

  tangents?: TypedArray;

  colors?: TypedArray;

  material: any;

  constructor(json: any, primitive: any, buffer: ArrayBuffer) {
    if (json.materials && primitive.material !== undefined) {
      this.material = json.materials[primitive.material];
    } else {
      this.material = {};
    }
    if (!this.material.pbrMetallicRoughness) {
      this.material.pbrMetallicRoughness = {};
    }

    function getArray(idx: number, n: number) {
      const accessor = json.accessors[idx];
      const bufferView = json.bufferViews[accessor.bufferView];
      const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
      let stride = bufferView.byteStride / 4;
      stride = stride > n ? stride : n;

      const array = newTypedArray(
        accessor.componentType,
        buffer,
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

    if (primitive.indices !== undefined) {
      this.indices = toIndexArray(getArray(primitive.indices, 1));
      this.vertexCount = json.accessors[primitive.indices].count;
    } else {
      this.vertexCount = json.accessors[primitive.attributes.POSITION].count;
    }

    this.positions = getArray(primitive.attributes.POSITION, 3);

    if (primitive.attributes.NORMAL !== undefined) {
      this.normals = getArray(primitive.attributes.NORMAL, 3);
    } else {
      this.normals = generateNormals(this.indices, this.positions);
    }

    if (primitive.attributes.TEXCOORD_0 !== undefined) {
      this.uvs = getArray(primitive.attributes.TEXCOORD_0, 2);
    }
    if (primitive.attributes.TEXCOORD_1 !== undefined) {
      this.uv1s = getArray(primitive.attributes.TEXCOORD_1, 2);
    }

    if (
      primitive.attributes.TANGENT !== undefined &&
      primitive.attributes.NORMAL !== undefined
    ) {
      this.tangents = getArray(primitive.attributes.TANGENT, 4);
    } else if (this.material.normalTexture) {
      this.tangents = generateTangents(
        this.indices,
        this.positions,
        this.normals,
        this.uvs!
      );
    }

    if (primitive.attributes.COLOR_0 !== undefined) {
      this.colors = getArray(primitive.attributes.COLOR_0, 4);
    }
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
