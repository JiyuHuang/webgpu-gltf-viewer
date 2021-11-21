import { mat4 } from 'gl-matrix';

class GLTFNode {
  children: Array<GLTFNode> = [];

  globalTransform = mat4.create();

  mesh: number | undefined;

  constructor(nodes: any, nodeIndex: number, parent: GLTFNode | null = null) {
    const { matrix, translation, rotation, scale, mesh, children } =
      nodes[nodeIndex];

    let localTransform = mat4.create();
    if (matrix) {
      localTransform = matrix;
    } else {
      if (translation) {
        mat4.multiply(localTransform, localTransform, translation);
      }
      if (rotation) {
        mat4.multiply(localTransform, localTransform, rotation);
      }
      if (scale) {
        mat4.multiply(localTransform, localTransform, scale);
      }
    }
    if (parent) {
      mat4.multiply(
        this.globalTransform,
        parent.globalTransform,
        localTransform
      );
    } else {
      this.globalTransform = localTransform;
    }

    this.mesh = mesh;

    if (children) {
      this.children = children.map(
        (childIndex: number) => new GLTFNode(nodes, childIndex, this)
      );
    }
  }
}

export type Scene = { name: string; nodes: Array<GLTFNode> };

export function loadScenes(json: any) {
  return json.scenes.map((scene: any, sceneIndex: number) => ({
    name: scene.name || sceneIndex,
    nodes: scene.nodes.map(
      (nodeIndex: number) => new GLTFNode(json.nodes, nodeIndex)
    ),
  }));
}
