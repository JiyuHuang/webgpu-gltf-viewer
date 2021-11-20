import render from './renderer';

const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
const select = document.getElementById('model-select') as HTMLSelectElement;
select.onchange = () => render(canvas, select.value);
fetch(
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/model-index.json'
)
  .then((response) => response.json())
  .then((modelIndex) => {
    modelIndex.forEach((model: any) => {
      const option = document.createElement('option');
      option.innerHTML = model.name;
      option.value = `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/${model.name}/glTF/${model.name}.gltf`;
      select.add(option);
      if (model.name === 'Duck') {
        select.value = option.value;
        render(canvas, select.value);
      }
    });
  });
