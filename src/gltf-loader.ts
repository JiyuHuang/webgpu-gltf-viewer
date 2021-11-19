function loadJson(uri: string) {
  let jsonStr = '';
  const xobj = new XMLHttpRequest();
  xobj.overrideMimeType('application/json');
  xobj.open('GET', uri, false);
  xobj.onreadystatechange = () => {
    if (xobj.readyState === 4 && xobj.status === 200) {
      jsonStr = xobj.responseText;
    }
  };
  xobj.send(null);
  return JSON.parse(jsonStr);
}

function loadBinWrapper(uri: string, callback: (response: any) => void) {
  const xobj = new XMLHttpRequest();
  xobj.responseType = 'arraybuffer';
  xobj.open('GET', uri, true);
  xobj.onreadystatechange = () => {
    if (xobj.readyState === 4 && xobj.status === 200) {
      callback(xobj.response);
    }
  };
  xobj.send(null);
}

function loadBin(uri: string): Promise<ArrayBuffer> {
  return new Promise((resolve) => {
    loadBinWrapper(uri, (success) => {
      resolve(success);
    });
  });
}

async function loadGltf(uri: string) {
  const json = loadJson(uri);
  const dir = uri.substring(0, uri.lastIndexOf('/'));
  const buf = await loadBin(`${dir}/${json.buffers[0].uri}`);
  const primitive = json.meshes[0].primitives[0];

  const idxBufView =
    json.bufferViews[json.accessors[primitive.indices].bufferView];
  const idxBuf = new Uint16Array(
    buf,
    idxBufView.byteOffset,
    idxBufView.byteLength / Uint16Array.BYTES_PER_ELEMENT
  );

  function getBuffer(idx: number, n: number) {
    const bufView = json.bufferViews[json.accessors[idx].bufferView];
    return new Float32Array(
      buf,
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

  return { idxBuf, posBuf, norBuf, uvBuf, texBitmap };
}

export default loadGltf;
