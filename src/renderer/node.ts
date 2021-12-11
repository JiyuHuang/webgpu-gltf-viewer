import { mat4, quat, vec3 } from 'gl-matrix';
import { GLTFAnimation, GLTFMesh } from '../loader/gltf';
import { interpQuat, interpVec3 } from '../util';

export default class Node {
  translation = vec3.create();

  rotation = quat.create();

  scale = vec3.fromValues(1, 1, 1);

  globalTransform = mat4.create();

  mesh?: number;

  camera?: number;

  index: number;

  parent: Node | null;

  children: Array<Node> = [];

  constructor(nodes: Array<any>, index: number, parent: Node | null) {
    this.parent = parent;
    this.index = index;

    const node = nodes[index];

    if (node) {
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
    }

    mat4.fromRotationTranslationScale(
      this.globalTransform,
      this.rotation,
      this.translation,
      this.scale
    );
    if (parent) {
      mat4.mul(
        this.globalTransform,
        parent.globalTransform,
        this.globalTransform
      );
    }

    if (node) {
      this.mesh = node.mesh;
      this.camera = node.camera;

      if (node.children) {
        this.children = (node.children as Array<number>).map(
          (child) => new Node(nodes, child, this)
        );
      }
    }
  }

  getAABB(meshes: Array<GLTFMesh>) {
    const aabb = {
      max: vec3.fromValues(-Infinity, -Infinity, -Infinity),
      min: vec3.fromValues(Infinity, Infinity, Infinity),
    };
    this.children.forEach((child) => {
      const childAABB = child.getAABB(meshes);
      vec3.max(aabb.max, aabb.max, childAABB.max);
      vec3.min(aabb.min, aabb.min, childAABB.min);
    });
    if (this.mesh !== undefined) {
      const obb = {
        max: vec3.fromValues(-Infinity, -Infinity, -Infinity),
        min: vec3.fromValues(Infinity, Infinity, Infinity),
      };
      meshes[this.mesh].forEach((primitive) => {
        vec3.max(obb.max, obb.max, primitive.boundingBox.max);
        vec3.min(obb.min, obb.min, primitive.boundingBox.min);
      });
      for (let i = 0; i < 8; i += 1) {
        const vertex = vec3.fromValues(
          i % 8 < 4 ? obb.min[0] : obb.max[0],
          i % 4 < 2 ? obb.min[1] : obb.max[1],
          i % 2 < 1 ? obb.min[2] : obb.max[2]
        );
        vec3.transformMat4(vertex, vertex, this.globalTransform);
        vec3.max(aabb.max, aabb.max, vertex);
        vec3.min(aabb.min, aabb.min, vertex);
      }
    }
    return aabb;
  }

  getCameras(out: Array<any>, cameras: Array<any>) {
    if (this.camera !== undefined) {
      const newCamera = {
        eye: vec3.create(),
        view: mat4.create(),
        json: cameras[this.camera],
      };
      vec3.transformMat4(newCamera.eye, newCamera.eye, this.globalTransform);
      mat4.invert(newCamera.view, this.globalTransform);
      out.push(newCamera);
    }
    this.children.forEach((child) => {
      child.getCameras(out, cameras);
    });
  }

  passMatrices(meshes: Array<any>) {
    if (this.mesh !== undefined) {
      const modelInvTr = mat4.create();
      mat4.invert(modelInvTr, this.globalTransform);
      mat4.transpose(modelInvTr, modelInvTr);
      meshes[this.mesh].matrices.push(this.globalTransform);
      meshes[this.mesh].matrices.push(modelInvTr);
    }
    this.children.forEach((child) => {
      child.passMatrices(meshes);
    });
  }

  animate(animation: GLTFAnimation, t: number, parentUpdated = false) {
    let updated = false;
    let translation;
    let rotation;
    let scale;
    const { channels, length } = animation;
    channels.forEach(({ node, path, input, output, interpolation }) => {
      if (node === this.index) {
        switch (path) {
          case 'translation':
            translation = interpVec3(input, output, t % length, interpolation);
            break;
          case 'rotation':
            rotation = interpQuat(input, output, t % length, interpolation);
            break;
          case 'scale':
            scale = interpVec3(input, output, t % length, interpolation);
            break;
          default:
        }
      }
    });
    if (parentUpdated || translation || rotation || scale) {
      mat4.mul(
        this.globalTransform,
        this.parent!.globalTransform,
        mat4.fromRotationTranslationScale(
          this.globalTransform,
          rotation || this.rotation,
          translation || this.translation,
          scale || this.scale
        )
      );
      updated = true;
    }
    this.children.forEach((child) => {
      child.animate(animation, t, updated);
    });
  }
}
