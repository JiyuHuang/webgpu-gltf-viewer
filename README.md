# WebGPU Based glTF 2.0 Viewer

**University of Pennsylvania, CIS 565: GPU Programming and Architecture, Final Project**

by [Jiyu Huang](https://jiyuhuang.github.io/)

---

This is a physically-based rendering engine for loading and displaying glTF 2.0 files, using the emerging WebGPU API.

## Live Demo

[Live Demo](https://jiyuhuang.github.io/webgpu-gltf-viewer/) (Requires Google Chrome Canary, Chrome Dev or Microsoft Edge Canary with `enable-unsafe-webgpu` flag on)

## Screenshots

<p float="left">
  <img src="imgs/DamagedHelmet.png" width="40%" />
  <img src="imgs/Sponza.png" width="40%" />
  <img src="imgs/VC.png" width="40%" />
  <img src="imgs/Buggy.png" width="40%" />
</p>

## Features

### Formats

- [x] glTF
- [ ] glTF-Embedded
- [x] glTF-Binary

### glTF 2.0 Core Features

- [x] Accessors
  - [ ] Sparse Accessors
- [x] Buffers and Buffer Views
- [x] Cameras
  - [x] Perspective
  - [x] Orthographic
- [x] Images
- [x] Materials
  - [x] Metallic-Roughness Material
  - [x] Additional Textures
  - [x] Alpha Coverage
  - [x] Double Sided
- [x] Meshes (topology type: triangles only)
- [x] Nodes
- [x] Samplers
- [x] Scenes
- [x] Textures
- [x] Animations
  - [ ] Camera Animation
  - [ ] Cubic Spline Interpolation
- [ ] Skins

### Extensions

- [x] EXT_mesh_gpu_instancing

## Local Installation

For local usage, follow these instructions:

1. Download the repository and make sure npm package manager is installed
2. Run `npm install`
3. Run `npm start`
4. Go to `http://localhost:8080/` using a browser that has WebGPU enabled

## References

- [WebGPU Samples](https://github.com/austinEng/webgpu-samples)
- [Khronos glTF 2.0 Sample Viewer](https://github.com/KhronosGroup/glTF-Sample-Viewer) and [minimal-gltf-loader](https://github.com/shrekshao/minimal-gltf-loader) for metallic-roughness shading implementation details
