export default function frag(hasUV: boolean, baseColorFactor = [1, 1, 1, 1]) {
  const baseColor = baseColorFactor.map((num) => {
    if (Number.isInteger(num)) {
      return `${num}.0`;
    }
    return num;
  });

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
      var lightPos: vec3<f32> = vec3<f32>(0.0, 0.0, -3.0);
      var color: vec4<f32> = vec4<f32>(${baseColor[0]},
                                       ${baseColor[1]},
                                       ${baseColor[2]},
                                       ${baseColor[3]});
      ${hasUV ? 'color = color * textureSample(tex, texSampler, uv);' : ''}
      var lambertian: f32 = dot(normal, normalize(worldPos - lightPos));
      lambertian = clamp(lambertian * 0.67, 0.0, 1.0) + 0.33;
      color = vec4<f32>(color.rgb * lambertian, color.a);
      return color;
  }
  `;
}
