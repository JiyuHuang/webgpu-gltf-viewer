import { vec3, mat4 } from 'gl-matrix';
import { clamp } from '../util';

const center = vec3.create();
const up = vec3.fromValues(0, 1, 0);

export default class Camera {
  protected canvas: HTMLCanvasElement;

  protected radius = 3;

  protected theta = 0;

  protected phi = 0;

  protected proj = mat4.create();

  protected view = mat4.create();

  eye = vec3.fromValues(0, 0, 3);

  projView = mat4.create();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(this.proj, Math.PI / 3, aspect, 0.001, Infinity);
    this.update();

    window.addEventListener('resize', () => {
      this.proj[0] =
        1 /
        (Math.tan(Math.PI / 6) * (canvas.clientWidth / canvas.clientHeight));
      mat4.mul(this.projView, this.proj, this.view);
    });

    let mousePressed = false;
    this.canvas.onmousedown = () => {
      mousePressed = true;
    };
    this.canvas.onmouseup = () => {
      mousePressed = false;
    };
    this.canvas.onmousemove = (event) => {
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

    this.canvas.onwheel = (event) => {
      this.radius = clamp(this.radius + event.deltaY * 0.002, 0.01, Infinity);
      this.update();
    };
  }

  protected update() {
    this.eye = vec3.fromValues(0, 0, this.radius);
    vec3.rotateX(this.eye, this.eye, center, this.phi);
    vec3.rotateY(this.eye, this.eye, center, this.theta);
    mat4.lookAt(this.view, this.eye, center, up);
    mat4.mul(this.projView, this.proj, this.view);
  }

  reset() {
    this.radius = 3;
    this.theta = 0;
    this.phi = 0;
    this.update();
  }
}
