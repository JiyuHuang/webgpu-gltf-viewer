import Renderer from './renderer';

const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
const select = document.getElementById('model-select') as HTMLSelectElement;
const renderer = new Renderer(canvas);
select.onchange = () => renderer.render(select.value);
fetch(
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/model-index.json'
)
  .then((response) => response.json())
  .then((modelIndex) => {
    modelIndex.forEach(async (model: any) => {
      const option = document.createElement('option');
      option.innerHTML = model.name;
      option.value = `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/${model.name}/glTF/${model.name}.gltf`;
      select.add(option);
      if (model.name === 'Duck') {
        select.value = option.value;
        await renderer.init();
        renderer.render(select.value);
      }
    });
  });
