async function render(canvas: HTMLCanvasElement) {
  const entry = navigator.gpu;
  if (!entry) {
    throw new Error('WebGPU is not supported on this browser.');
  }
  const adapter = await entry.requestAdapter();
  const device = await adapter?.requestDevice();
  const context = canvas.getContext('webgpu');
  if (!device || !context) {
    throw new Error('Failed to initialize WebGPU API.');
  }
  context?.configure({
    device: device!,
    format: context.getPreferredFormat(adapter!),
  });
}

export default render;
