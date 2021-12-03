export default function vert(instanceCount: number, hasUV: boolean = true) {
  return /* wgsl */ `

  [[block]] struct Camera
  {
      projView: mat4x4<f32>;
  };
  [[group(0), binding(0)]] var<uniform> camera: Camera;

  struct Model {
      matrix: mat4x4<f32>;
      invTr: mat4x4<f32>;
  };
  [[block]] struct Models
  {
      model: [[stride(128)]] array<Model, ${instanceCount}>;
  };
  [[group(1), binding(0)]] var<uniform> models: Models;

  struct VertexOutput
  {
      [[builtin(position)]] Position: vec4<f32>;
      [[location(0)]] normal: vec3<f32>;
      [[location(1)]] worldPos: vec3<f32>;
      ${hasUV ? '[[location(2)]] uv: vec2<f32>;' : ''}
  };

  [[stage(vertex)]]
  fn main([[builtin(instance_index)]] instanceIndex : u32,
          [[location(0)]] pos: vec3<f32>,
          [[location(1)]] normal: vec3<f32>,
          ${hasUV ? '[[location(2)]] uv: vec2<f32>' : ''}) -> VertexOutput
  {
      var model = models.model[instanceIndex];
      var v: VertexOutput;
      v.Position = camera.projView * model.matrix * vec4<f32>(pos, 1.0);
      v.normal = normalize((model.invTr * vec4<f32>(normal, 0.0)).xyz);
      v.worldPos = (model.matrix * vec4<f32>(pos, 1.0)).xyz;
      ${hasUV ? 'v.uv = uv;' : ''}
      return v;
  }
  `;
}
