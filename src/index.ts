import render from './renderer';

render(document.getElementById('webgpu-canvas') as HTMLCanvasElement);
const element = document.createElement('div');
element.innerHTML = 'Hello world';
document.body.appendChild(element);
