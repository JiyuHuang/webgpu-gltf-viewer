import { Scene, loadScenes } from './scene';
import { Mesh, loadMeshes } from './mesh';

export default class GLTF {
  scenes: Array<Scene>;

  scene: number | undefined;

  meshes: Array<Mesh>;

  constructor(json: any, buffer: ArrayBuffer) {
    this.scenes = loadScenes(json);
    this.scene = json.scene;
    this.meshes = loadMeshes(json, buffer);
  }
}
