import { createRenderer } from './renderer/renderer';

const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement;
const gui = document.getElementById('gui');
const models = document.getElementById('model-select') as HTMLSelectElement;
const upload = document.getElementById('glb-upload') as HTMLInputElement;
const cameras = document.getElementById('camera-select') as HTMLSelectElement;
const userCamera = document.createElement('option');
userCamera.innerHTML = 'User Camera';
userCamera.value = 'User Camera';

fetch(
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/model-index.json'
)
  .then((response) => response.json())
  .then((modelList) => {
    modelList.forEach(async (model: any) => {
      const option = document.createElement('option');
      option.innerHTML = model.name;
      option.value = `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/${model.name}/glTF/${model.name}.gltf`;
      models.add(option);
      if (model.name === 'DamagedHelmet') {
        models.value = option.value;
        createRenderer(canvas)
          .then((renderer) => {
            const loadScene = async (url: string) => {
              await renderer.load(url);
              cameras.innerHTML = '';
              cameras.add(userCamera);
              for (let i = 0; i < renderer.getCameraCount(); i += 1) {
                const camera = document.createElement('option');
                camera.innerHTML = String(i);
                camera.value = String(i);
                cameras.add(camera);
              }
            };
            loadScene(models.value);
            models.onchange = () => loadScene(models.value);
            cameras.onchange = () => {
              renderer.setCamera(
                cameras.value !== 'User Camera'
                  ? Number(cameras.value)
                  : undefined
              );
            };
            upload.onchange = () => {
              loadScene(URL.createObjectURL(upload.files![0]));
            };
          })
          .catch((error) => {
            const msg = document.createElement('p');
            msg.innerHTML = error;
            msg.style.fontSize = '2em';
            msg.style.color = 'red';
            gui!.appendChild(msg);
          });
      }
    });
  });
