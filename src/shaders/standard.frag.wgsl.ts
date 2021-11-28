export default function frag(material: any, hasUV: boolean) {
  function toFloat(num: number | undefined) {
    if (num === undefined) {
      return '1.0';
    }
    if (Number.isInteger(num)) {
      return `${num}.0`;
    }
    return num;
  }

  const { baseColorTexture, metallicFactor, roughnessFactor } =
    material.pbrMetallicRoughness;
  let { baseColorFactor } = material.pbrMetallicRoughness;
  baseColorFactor = baseColorFactor || [1, 1, 1, 1];

  return /* wgsl */ `

  [[block]] struct Camera
  {
      eye: vec3<f32>;
  };
  [[group(0), binding(1)]] var<uniform> camera: Camera;

  ${
    hasUV
      ? `
  [[group(1), binding(1)]] var texSampler: sampler;
  [[group(1), binding(2)]] var tex: texture_2d<f32>;
  /* wgsl */ `
      : ''
  }

  let pi: f32 = 3.141592653589793;

  fn phong(color: vec3<f32>,
           l: vec3<f32>,
           v: vec3<f32>,
           n: vec3<f32>) -> vec3<f32>
  {
      let specExp = 64.0;
      let intensity = 0.5;
      let ambient = 0.5;

      let diffuse = max(dot(n, l), 0.0);
      let specular = pow(max(dot(n, normalize(l + v)), 0.0), specExp);

      return color * ((diffuse + specular) * intensity + ambient);
  }

  fn brdf(color: vec3<f32>,
          metallic: f32,
          roughness: f32,
          l: vec3<f32>,
          v: vec3<f32>,
          n: vec3<f32>) -> vec3<f32>
  {
      let h = normalize(l + v);
      let ndotl = clamp(dot(n, l), 0.0, 1.0);
      let ndotv = abs(dot(n, v));
      let ndoth = clamp(dot(n, h), 0.0, 1.0);
      let vdoth = clamp(dot(v, h), 0.0, 1.0);

      let f0 = vec3<f32>(0.04);
      let diffuseColor = color * (1.0 - f0) * (1.0 - metallic);
      let specularColor = mix(f0, color, metallic);

      let reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);
      let reflectance0 = specularColor;
      let reflectance9 = vec3<f32>(clamp(reflectance * 25.0, 0.0, 1.0));
      let f = reflectance0 + (reflectance9 - reflectance0) * pow(1.0 - vdoth, 5.0);

      let r2 = roughness * roughness;
      let r4 = r2 * r2;
      let attenuationL = 2.0 * ndotl / (ndotl + sqrt(r4 + (1.0 - r4) * ndotl * ndotl));
      let attenuationV = 2.0 * ndotv / (ndotv + sqrt(r4 + (1.0 - r4) * ndotv * ndotv));
      let g = attenuationL * attenuationV;

      let temp = ndoth * ndoth * (r2 - 1.0) + 1.0;
      let d = r2 / (pi * temp * temp);

      let diffuse = (1.0 - f) / pi * diffuseColor;
      let specular = max(f * g * d / (4.0 * ndotl * ndotv), vec3<f32>(0.0));
      let intensity = 2.5;
      let ambient = 0.4;
      return ndotl * (diffuse + specular) * intensity + color * ambient;
  }

  [[stage(fragment)]]
  fn main([[location(0)]] normal: vec3<f32>,
          [[location(1)]] worldPos: vec3<f32>,
          ${
            hasUV ? '[[location(2)]] uv: vec2<f32>' : ''
          }) -> [[location(0)]] vec4<f32>
  {
      let lightPos = vec3<f32>(2.0, 4.0, 3.0);
      var color = vec4<f32>(${toFloat(baseColorFactor[0])},
                            ${toFloat(baseColorFactor[1])},
                            ${toFloat(baseColorFactor[2])},
                            ${toFloat(baseColorFactor[3])});
      ${
        baseColorTexture
          ? 'color = color * textureSample(tex, texSampler, uv);'
          : ''
      }

      // return vec4<f32>(phong(color.rgb,
      //                        normalize(lightPos - worldPos),
      //                        normalize(camera.eye - worldPos),
      //                        normalize(normal)),
      //                  color.a);
      return vec4<f32>(brdf(color.rgb,
                            ${toFloat(metallicFactor)},
                            ${toFloat(roughnessFactor)},
                            normalize(lightPos - worldPos),
                            normalize(camera.eye - worldPos),
                            normalize(normal)),
                       color.a);
  }
  `;
}
