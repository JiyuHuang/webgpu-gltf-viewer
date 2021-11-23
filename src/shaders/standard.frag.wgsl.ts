export default function frag(hasUV: boolean = true) {
  return /* wgsl */ `

  ${
    hasUV
      ? `
  [[group(0), binding(1)]] var texSampler: sampler;
  [[group(0), binding(2)]] var tex: texture_2d<f32>;
  /* wgsl */ `
      : ''
  }

  [[stage(fragment)]]
  fn main([[location(0)]] normal: vec3<f32>,
          [[location(1)]] worldPos: vec3<f32>,
          ${
            hasUV ? '[[location(2)]] uv: vec2<f32>' : ''
          }) -> [[location(0)]] vec4<f32>
  {
      var lightPos: vec3<f32> = vec3<f32>(0.0, 0.0, -5.0);
      var color: vec4<f32> = vec4<f32>(1.0);
      ${hasUV ? 'color = color * textureSample(tex, texSampler, uv);' : ''}
      var lambertian: f32 = dot(normal, normalize(worldPos - lightPos));
      lambertian = clamp(lambertian, 0.0, 1.0) + 0.1;
      color = vec4<f32>(color.rgb * lambertian, color.a);
      return color;
  }
  `;
}
