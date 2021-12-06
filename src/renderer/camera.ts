import { vec3, mat4 } from 'gl-matrix';
import { clamp } from '../util';

const center = vec3.create();
const up = vec3.fromValues(0, 1, 0);

export default class Camera {
  radius = 3;

  theta = 0;

  phi = 0;

  eye = vec3.fromValues(0, 0, 3);

  view = mat4.create();

  yfov = Math.PI / 3;

  proj = mat4.create();

  projView = mat4.create();

  projViewBuffer: GPUBuffer;

  eyeBuffer: GPUBuffer;

  bindGroup: GPUBindGroup;

  constructor(canvas: HTMLCanvasElement, device: GPUDevice, camera?: any) {
    const aspect = canvas.clientWidth / canvas.clientHeight;
    if (!camera) {
      mat4.perspective(this.proj, this.yfov, aspect, 0.01, Infinity);
      this.update();

      let mousePressed = false;
      canvas.onmousedown = () => {
        mousePressed = true;
      };
      canvas.onmouseup = () => {
        mousePressed = false;
      };
      canvas.onmousemove = (event) => {
        if (mousePressed) {
          this.theta -= (event.movementX / window.innerWidth) * Math.PI * 2;
          this.phi = clamp(
            this.phi - (event.movementY / window.innerHeight) * Math.PI,
            -Math.PI / 2 + 0.1,
            Math.PI / 2 - 0.1
          );
          this.update();
        }
      };

      canvas.onwheel = (event) => {
        this.radius = clamp(this.radius + event.deltaY * 0.002, 0.01, Infinity);
        this.update();
      };
    } else {
      mat4.invert(this.view, camera.world);
      if (camera.json.type === 'perspective') {
        const { yfov, zfar, znear } = camera.json.perspective;
        this.yfov = yfov;
        mat4.perspective(this.proj, yfov, aspect, znear, zfar || Infinity);
      } else {
        mat4.perspective(this.proj, this.yfov, aspect, 0.001, Infinity);
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
      this.proj[0] =
        1 /
        (Math.tan(this.yfov / 2) * (canvas.clientWidth / canvas.clientHeight));
      mat4.mul(this.projView, this.proj, this.view);
    });
  }

  update() {
    this.eye = vec3.fromValues(0, 0, this.radius);
    vec3.rotateX(this.eye, this.eye, center, this.phi);
    vec3.rotateY(this.eye, this.eye, center, this.theta);
    mat4.lookAt(this.view, this.eye, center, up);
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
