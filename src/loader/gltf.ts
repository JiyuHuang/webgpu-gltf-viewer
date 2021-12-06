import { gltfEnum } from '../util';
import { GLTFMesh, loadMeshes } from './mesh';

function loadJson(url: string) {
  return new Promise<any>((resolve) => {
    const xobj = new XMLHttpRequest();
    xobj.overrideMimeType('application/json');
    xobj.open('GET', url);
    xobj.onreadystatechange = () => {
      if (xobj.readyState === 4 && xobj.status === 200) {
        resolve(JSON.parse(xobj.responseText));
      }
    };
    xobj.send(null);
  });
}

function loadBuffer(url: string) {
  return new Promise<ArrayBuffer>((resolve) => {
    const xobj = new XMLHttpRequest();
    xobj.responseType = 'arraybuffer';
    xobj.open('GET', url);
    xobj.onreadystatechange = () => {
      if (xobj.readyState === 4 && xobj.status === 200) {
        resolve(xobj.response);
      }
    };
    xobj.send(null);
  });
}

async function loadImage(url: string) {
  const image = new Image();
  image.crossOrigin = 'Anonymous';
  image.src = url;
  await image.decode();
  return createImageBitmap(image);
}

export class GLTF {
  scenes: Array<any>;

  scene: number;

  nodes: Array<any>;

  cameras: Array<any> | undefined;

  meshes: Array<GLTFMesh>;

  textures: Array<{
    source: ImageBitmap;
    sampler: {
      magFilter: GPUFilterMode;
      minFilter: GPUFilterMode;
      addressModeU: GPUAddressMode;
      addressModeV: GPUAddressMode;
    };
  }>;

  constructor(json: any, meshes: Array<GLTFMesh>, images: Array<ImageBitmap>) {
    this.scenes = json.scenes;
    this.scene = json.scene;
    this.nodes = json.nodes;
    this.cameras = json.cameras;
    this.meshes = meshes;
    this.textures = json.textures
      ? (json.textures as Array<any>).map((texture: any) => {
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

  let meshes: Array<GLTFMesh>;
  const meshesLoaded = Promise.all(
    json.buffers.map((buffer: any) =>
      loadBuffer(`${dir}/${buffer.uri}`)
    ) as Array<Promise<ArrayBuffer>>
  ).then((buffers) => {
    meshes = loadMeshes(json, buffers[0]);
  });

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

  return Promise.all([meshesLoaded, imagesLoaded]).then(
    () => new GLTF(json, meshes, images)
  );
}
