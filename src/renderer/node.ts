import { mat4, quat, vec3 } from 'gl-matrix';
import { GLTF, GLTFAnimation, GLTFMesh } from '../loader/gltf';
import { interpQuat, interpVec3 } from '../util';
import PresetCamera from './camera/preset-camera';

export default class Node {
  matrix?: mat4;

  translation = vec3.create();

  rotation = quat.create();

  scale = vec3.fromValues(1, 1, 1);

  globalTransform = mat4.create();

  mesh?: number;

  camera?: PresetCamera;

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
        this.matrix = node.matrix;
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

    if (this.matrix) {
      this.globalTransform = mat4.clone(this.matrix);
    } else {
      mat4.fromRotationTranslationScale(
        this.globalTransform,
        this.rotation,
        this.translation,
        this.scale
      );
    }
    if (parent) {
      mat4.mul(
        this.globalTransform,
        parent.globalTransform,
        this.globalTransform
      );
    }

    if (node) {
      this.mesh = node.mesh;

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

  createCameras(
    cameras: Array<PresetCamera>,
    gltf: GLTF,
    projViewBuffer: GPUBuffer,
    eyeBuffer: GPUBuffer,
    bindGroup: GPUBindGroup,
    canvas: HTMLCanvasElement
  ) {
    if (this.index >= 0) {
      if (gltf.nodes[this.index].camera !== undefined) {
        this.camera = new PresetCamera(
          projViewBuffer,
          eyeBuffer,
          bindGroup,
          canvas,
          this.globalTransform,
          gltf.cameras[gltf.nodes[this.index].camera]
        );
        cameras.push(this.camera);
      }
    }
    this.children.forEach((child) =>
      child.createCameras(
        cameras,
        gltf,
        projViewBuffer,
        eyeBuffer,
        bindGroup,
        canvas
      )
    );
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

  animate(
    animations: Array<GLTFAnimation>,
    time: number,
    parentUpdated = false
  ) {
    let updated = false;
    let translation: vec3 | undefined;
    let rotation: quat | undefined;
    let scale: vec3 | undefined;
    animations.forEach(({ channels, length }) => {
      channels.forEach(({ node, path, input, output, interpolation }) => {
        if (node === this.index) {
          const t = time % length;
          switch (path) {
            case 'translation':
              translation = interpVec3(input, output, t, interpolation);
              break;
            case 'rotation':
              rotation = interpQuat(input, output, t, interpolation);
              break;
            case 'scale':
              scale = interpVec3(input, output, t, interpolation);
              break;
            default:
          }
        }
      });
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
      if (this.camera) {
        this.camera.globalTransform = this.globalTransform;
        this.camera.needUpdate = true;
      }
    }
    this.children.forEach((child) => {
      child.animate(animations, time, updated);
    });
  }
}
