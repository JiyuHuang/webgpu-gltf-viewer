class GLTFPrimitive {
  indexCount: number;

  indices: Uint16Array;

  positions: Float32Array;

  normals: Float32Array;

  uvs?: Float32Array;

  material: number;

  constructor(json: any, primitive: any, buffer: ArrayBuffer) {
    this.indexCount = json.accessors[primitive.indices].count;
    const indexBufferView =
      json.bufferViews[json.accessors[primitive.indices].bufferView];
    this.indices = new Uint16Array(
      buffer,
      indexBufferView.byteOffset,
      indexBufferView.byteLength / Uint16Array.BYTES_PER_ELEMENT
    );

    function getArray(idx: number, n: number) {
      const bufferView = json.bufferViews[json.accessors[idx].bufferView];
      const offset =
        bufferView.byteOffset + (json.accessors[idx].byteOffset || 0);
      const stride = bufferView.byteStride / 4;
      if (stride > n) {
        const interleaved = new Float32Array(
          buffer,
          offset,
          stride * json.accessors[idx].count
        );
        const strided = new Float32Array(json.accessors[idx].count * n);
        for (let i = 0, j = 0; i < strided.length; i += n, j += stride) {
          for (let k = 0; k < n; k += 1) {
            strided[i + k] = interleaved[j + k];
          }
        }
        return strided;
      }
      return new Float32Array(buffer, offset, json.accessors[idx].count * n);
    }
    this.positions = getArray(primitive.attributes.POSITION, 3);
    this.normals = getArray(primitive.attributes.NORMAL, 3);
    if (primitive.attributes.TEXCOORD_0 !== undefined) {
      this.uvs = getArray(primitive.attributes.TEXCOORD_0, 2);
    }

    this.material = primitive.material;
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
