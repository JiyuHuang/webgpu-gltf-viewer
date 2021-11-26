import { vec3, mat4 } from 'gl-matrix';

const center = vec3.create();
const up = vec3.fromValues(0, 1, 0);

function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}

export default class Camera {
  protected canvas: HTMLCanvasElement;

  protected radius = 3;

  protected theta = 0;

  protected phi = 0;

  protected proj = mat4.create();

  protected view = mat4.create();

  projView = mat4.create();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(this.proj, Math.PI / 2, aspect, 0.1, Infinity);
    this.update();

    window.addEventListener('resize', () => {
      this.proj[0] =
        1 /
        (Math.tan(Math.PI / 4) * (canvas.clientWidth / canvas.clientHeight));
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
  }

  protected update() {
    const eye = vec3.fromValues(0, 0, this.radius);
    vec3.rotateX(eye, eye, center, this.phi);
    vec3.rotateY(eye, eye, center, this.theta);
    mat4.lookAt(this.view, eye, center, up);
    mat4.mul(this.projView, this.proj, this.view);
  }
}
