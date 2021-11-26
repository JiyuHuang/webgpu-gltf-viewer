class Primitive {
  indexCount: number;

  indices: Uint16Array;

  positions: Float32Array;

  normals: Float32Array;

  uvs?: Float32Array;

  material: any;

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
      return new Float32Array(
        buffer,
        bufferView.byteOffset + (json.accessors[idx].byteOffset || 0),
        json.accessors[idx].count * n
      );
    }
    this.positions = getArray(primitive.attributes.POSITION, 3);
    this.normals = getArray(primitive.attributes.NORMAL, 3);
    if (primitive.attributes.TEXCOORD_0) {
      this.uvs = getArray(primitive.attributes.TEXCOORD_0, 2);
    }

    this.material = json.materials[primitive.material];
  }
}

export type Mesh = Array<Primitive>;

export function loadMeshes(json: any, buffer: ArrayBuffer) {
  return json.meshes.map((mesh: any) =>
    mesh.primitives.map(
      (primitive: any) => new Primitive(json, primitive, buffer)
    )
  );
}
