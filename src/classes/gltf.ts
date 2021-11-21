import { Scene, loadScenes } from './scene';
import { Mesh, loadMeshes } from './mesh';

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

export default class GLTF {
  scenes: Array<Scene> = [];

  scene: number | undefined;

  meshes: Array<Mesh> = [];

  images: Array<ImageBitmap> = [];

  async load(url: string) {
    const dir = url.substring(0, url.lastIndexOf('/'));
    const json = await loadJson(url);

    const meshesPromise = Promise.all(
      json.buffers.map((buffer: any) =>
        loadBuffer(`${dir}/${buffer.uri}`)
      ) as Array<Promise<ArrayBuffer>>
    ).then((buffers) => {
      this.meshes = loadMeshes(json, buffers[0]);
    });

    const imagesPromise = json.images.map((image: any, index: number) =>
      loadImage(`${dir}/${image.uri}`).then((bitMap) => {
        this.images[index] = bitMap;
      })
    );

    this.scenes = loadScenes(json);
    this.scene = json.scene;

    return Promise.all([meshesPromise, Promise.all(imagesPromise)]);
  }
}
