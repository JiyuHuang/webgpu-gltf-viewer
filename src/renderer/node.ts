import { mat4, quat, vec3 } from 'gl-matrix';

export default class Node {
  translation = vec3.create();

  rotation = quat.create();

  scale = vec3.fromValues(1, 1, 1);

  globalTransform = mat4.create();

  mesh?: number;

  camera?: number;

  parent: Node;

  children: Array<Node> = [];

  constructor(nodes: Array<any>, index: number, parent: Node) {
    this.parent = parent;

    const node = nodes[index];
    if (node.matrix) {
      mat4.getTranslation(this.translation, node.matrix);
      mat4.getRotation(this.rotation, node.matrix);
      mat4.getScaling(this.scale, node.matrix);
    }
    if (node.translation) {
      this.translation = node.translation;
    }
    if (node.rotation) {
      this.rotation = node.rotation;
    }
    if (node.scale) {
      this.scale = node.scale;
    }
    this.updateTransform();

    if (node.children) {
      this.children = (node.children as Array<number>).map(
        (child) => new Node(nodes, child, this)
      );
    }
  }

  updateTransform() {
    mat4.mul(
      this.globalTransform,
      this.parent.globalTransform,
      mat4.fromRotationTranslationScale(
        this.globalTransform,
        this.rotation,
        this.translation,
        this.scale
      )
    );
  }
}
