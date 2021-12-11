import { vec3, mat4 } from 'gl-matrix';
import { clamp } from '../util';

const temp = vec3.create();
const up = vec3.fromValues(0, 1, 0);

export default class Camera {
  radius?: number;

  theta?: number;

  phi?: number;

  eye = vec3.create();

  center?: vec3;

  view = mat4.create();

  yfov?: number;

  ymag?: number;

  proj = mat4.create();

  projView = mat4.create();

  projViewBuffer: GPUBuffer;

  eyeBuffer: GPUBuffer;

  bindGroup: GPUBindGroup;

  constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    aabb: { max: vec3; min: vec3 },
    camera?: any
  ) {
    const aspect = canvas.clientWidth / canvas.clientHeight;
    if (!camera) {
      this.center = vec3.create();
      vec3.scale(this.center, vec3.add(this.center, aabb.max, aabb.min), 0.5);
      const radius = vec3.len(vec3.sub(temp, aabb.max, aabb.min));
      this.radius = radius;
      this.theta = 0;
      this.phi = 0;
      this.yfov = Math.PI / 3;
      mat4.perspective(this.proj, this.yfov, aspect, radius / 100, Infinity);
      this.update();

      let mousePressed = false;
      canvas.onmousedown = (event) => {
        event.preventDefault();
        mousePressed = true;
      };
      canvas.onmouseup = (event) => {
        event.preventDefault();
        mousePressed = false;
      };
      canvas.onmousemove = (event) => {
        event.preventDefault();
        if (mousePressed) {
          this.theta! -= (event.movementX / window.innerWidth) * Math.PI * 2;
          this.phi = clamp(
            this.phi! - (event.movementY / window.innerHeight) * Math.PI,
            -Math.PI / 2 + 0.1,
            Math.PI / 2 - 0.1
          );
          this.update();
        }
      };
      canvas.onwheel = (event) => {
        event.preventDefault();
        this.radius = clamp(
          this.radius! + event.deltaY * 0.001 * radius,
          radius / 16,
          Infinity
        );
        this.update();
      };
    } else {
      this.eye = camera.eye;
      this.view = camera.view;
      if (camera.json.type === 'perspective') {
        const { yfov, zfar, znear } = camera.json.perspective;
        this.yfov = yfov;
        mat4.perspective(this.proj, yfov, aspect, znear, zfar || Infinity);
      } else {
        const { ymag, zfar, znear } = camera.json.orthographic;
        this.ymag = ymag;
        this.proj[0] = 1 / (ymag * aspect);
        this.proj[5] = 1 / ymag;
        this.proj[10] = 1 / (znear - zfar);
        this.proj[14] = znear / (znear - zfar);
      }
      mat4.mul(this.projView, this.proj, this.view);
    }

    this.projViewBuffer = device.createBuffer({
      size: 4 * 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // eslint-disable-line no-bitwise
    });
    this.eyeBuffer = device.createBuffer({
      size: 4 * 3,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, // eslint-disable-line no-bitwise
    });
    this.bindGroup = device.createBindGroup({
      layout: device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
        ],
      }),
      entries: [
        { binding: 0, resource: { buffer: this.projViewBuffer } },
        { binding: 1, resource: { buffer: this.eyeBuffer } },
      ],
    });

    window.addEventListener('resize', () => {
      const newAspect = canvas.clientWidth / canvas.clientHeight;
      if (this.ymag === undefined) {
        this.proj[0] = 1 / (Math.tan(this.yfov! / 2) * newAspect);
      } else {
        this.proj[0] = 1 / (this.ymag * newAspect);
      }
      mat4.mul(this.projView, this.proj, this.view);
    });
  }

  update() {
    this.eye = vec3.fromValues(
      this.center![0],
      this.center![1],
      this.center![2] + this.radius!
    );
    vec3.rotateX(this.eye, this.eye, this.center!, this.phi!);
    vec3.rotateY(this.eye, this.eye, this.center!, this.theta!);
    mat4.lookAt(this.view, this.eye, this.center!, up);
    mat4.mul(this.projView, this.proj, this.view);
  }

  bind(device: GPUDevice, passEncoder: GPURenderPassEncoder) {
    const projView = this.projView as Float32Array;
    device.queue.writeBuffer(
      this.projViewBuffer,
      0,
      projView.buffer,
      projView.byteOffset,
      projView.byteLength
    );
    const eye = this.eye as Float32Array;
    device.queue.writeBuffer(
      this.eyeBuffer,
      0,
      eye.buffer,
      eye.byteOffset,
      eye.byteLength
    );
    passEncoder.setBindGroup(0, this.bindGroup);
  }

  destroy() {
    this.projViewBuffer.destroy();
    this.eyeBuffer.destroy();
  }
}
