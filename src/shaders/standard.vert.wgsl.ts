export default function vert(hasUV: boolean = true) {
  return /* wgsl */ `

  [[block]] struct Mat4
  {
      model: mat4x4<f32>;
      modelInvTr: mat4x4<f32>;
      projView: mat4x4<f32>;
  };
  [[group(0), binding(0)]] var<uniform> mat4: Mat4;

  struct VertOut
  {
      [[builtin(position)]] Position: vec4<f32>;
      [[location(0)]] normal: vec3<f32>;
      [[location(1)]] worldPos: vec3<f32>;
      ${hasUV ? '[[location(2)]] uv: vec2<f32>;' : ''}
  };

  [[stage(vertex)]]
  fn main([[location(0)]] pos: vec3<f32>,
          [[location(1)]] normal: vec3<f32>,
          ${hasUV ? '[[location(2)]] uv: vec2<f32>' : ''}) -> VertOut
  {
      var v: VertOut;
      v.Position = mat4.projView * mat4.model * vec4<f32>(pos, 1.0);
      v.normal = normalize((mat4.modelInvTr * vec4<f32>(normal, 0.0)).xyz);
      v.worldPos = (mat4.model * vec4<f32>(pos, 1.0)).xyz;
      ${hasUV ? 'v.uv = uv;' : ''}
      return v;
  }
  `;
}
