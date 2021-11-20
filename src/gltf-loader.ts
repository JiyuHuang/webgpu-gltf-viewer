function loadJson(uri: string, callback: (json: any) => void) {
  const xobj = new XMLHttpRequest();
  xobj.overrideMimeType('application/json');
  xobj.open('GET', uri);
  xobj.onreadystatechange = () => {
    if (xobj.readyState === 4 && xobj.status === 200) {
      callback(JSON.parse(xobj.responseText));
    }
  };
  xobj.send(null);
}

function loadBin(uri: string, callback: (response: any) => void) {
  const xobj = new XMLHttpRequest();
  xobj.responseType = 'arraybuffer';
  xobj.open('GET', uri);
  xobj.onreadystatechange = () => {
    if (xobj.readyState === 4 && xobj.status === 200) {
      callback(xobj.response);
    }
  };
  xobj.send(null);
}

function loadGltfWrapper(uri: string, callback: (data: any) => void) {
  loadJson(uri, (json) => {
    const dir = uri.substring(0, uri.lastIndexOf('/'));
    loadBin(`${dir}/${json.buffers[0].uri}`, async (bin) => {
      const primitive = json.meshes[0].primitives[0];

      const idxBufView =
        json.bufferViews[json.accessors[primitive.indices].bufferView];
      const idxBuf = new Uint16Array(
        bin,
        idxBufView.byteOffset,
        idxBufView.byteLength / Uint16Array.BYTES_PER_ELEMENT
      );

      function getBuffer(idx: number, n: number) {
        const bufView = json.bufferViews[json.accessors[idx].bufferView];
        return new Float32Array(
          bin,
          bufView.byteOffset + (json.accessors[idx].byteOffset || 0),
          json.accessors[idx].count * n
        );
      }
      const posBuf = getBuffer(primitive.attributes.POSITION, 3);
      const norBuf = getBuffer(primitive.attributes.NORMAL, 3);
      const uvBuf = getBuffer(primitive.attributes.TEXCOORD_0, 2);

      const tex = new Image();
      tex.crossOrigin = 'Anonymous';
      tex.src = `${dir}/${json.images[0].uri}`;
      await tex.decode();
      const texBitmap = await createImageBitmap(tex);

      callback({ idxBuf, posBuf, norBuf, uvBuf, texBitmap });
    });
  });
}

function loadGltf(uri: string): Promise<any> {
  return new Promise((resolve) => {
    loadGltfWrapper(uri, (sucess) => {
      resolve(sucess);
    });
  });
}

export default loadGltf;
