import render from './renderer';

const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
const select = document.getElementById('model-select') as HTMLSelectElement;
select.onchange = () => render(canvas, select.value);
render(canvas, select.value);
