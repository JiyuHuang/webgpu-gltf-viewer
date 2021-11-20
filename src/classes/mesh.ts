class Primitive {
  indices: Uint16Array;

  positions: Float32Array;

  normals: Float32Array;

  uvs: Float32Array;

  constructor(json: any, primitive: any, buffer: ArrayBuffer) {
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
    this.uvs = getArray(primitive.attributes.TEXCOORD_0, 2);
  }
}

export type Mesh = Array<Primitive>;

export function loadMeshes(json: any, buffer: ArrayBuffer) {
  const meshes: Array<Mesh> = [];
  json.meshes.forEach((meshInfo: any) => {
    const mesh: Mesh = [];
    meshInfo.primitives.forEach((primitive: any) => {
      mesh.push(new Primitive(json, primitive, buffer));
    });
    meshes.push(mesh);
  });
  return meshes;
}
