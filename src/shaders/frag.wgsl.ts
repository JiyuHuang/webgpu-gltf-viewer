import { toFloat } from '../util';

export default function frag(
  material: any,
  hasUV: boolean,
  hasTangent: boolean
) {
  const {
    baseColorTexture,
    metallicRoughnessTexture,
    metallicFactor,
    roughnessFactor,
  } = material.pbrMetallicRoughness;
  let { baseColorFactor } = material.pbrMetallicRoughness;
  baseColorFactor = baseColorFactor || [1, 1, 1, 1];
  const { normalTexture, occlusionTexture, emissiveTexture } = material;
  let { emissiveFactor } = material;
  emissiveFactor = emissiveFactor || [0, 0, 0];

  let { alphaCutoff } = material;
  alphaCutoff = alphaCutoff !== undefined ? alphaCutoff : 0.5;

  let location = 1;

  /* eslint-disable no-return-assign */

  return /* wgsl */ `

  [[block]] struct Camera
  {
      eye: vec3<f32>;
  };
  [[group(0), binding(1)]] var<uniform> camera: Camera;

  ${
    baseColorTexture
      ? `
  [[group(1), binding(1)]] var texSampler: sampler;
  [[group(1), binding(2)]] var tex: texture_2d<f32>; /* wgsl */ `
      : ''
  }
  ${
    metallicRoughnessTexture
      ? `
  [[group(1), binding(3)]] var metalRoughSampler: sampler;
  [[group(1), binding(4)]] var metalRoughTex: texture_2d<f32>; /* wgsl */ `
      : ''
  }
  ${
    normalTexture
      ? `
  [[group(1), binding(5)]] var normalSampler: sampler;
  [[group(1), binding(6)]] var normalTex: texture_2d<f32>; /* wgsl */ `
      : ''
  }
  ${
    occlusionTexture
      ? `
  [[group(1), binding(7)]] var occlusionSampler: sampler;
  [[group(1), binding(8)]] var occlusionTex: texture_2d<f32>; /* wgsl */ `
      : ''
  }
  ${
    emissiveTexture
      ? `
  [[group(1), binding(9)]] var emissiveSampler: sampler;
  [[group(1), binding(10)]] var emissiveTex: texture_2d<f32>; /* wgsl */ `
      : ''
  }

  let pi: f32 = 3.141592653589793;

  fn blinnPhong(color: vec3<f32>,
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
  fn main([[location(0)]] vNormal: vec3<f32>,
          [[location(1)]] worldPos: vec3<f32>,
          ${
            hasUV
              ? `
          [[location(${(location += 1)})]] uv: vec2<f32>, /* wgsl */ `
              : ''
          }
          ${
            hasTangent
              ? `
          [[location(${(location += 1)})]] tangent: vec3<f32>,
          [[location(${(location += 1)})]] bitangent: vec3<f32>, /* wgsl */ `
              : ''
          }) -> [[location(0)]] vec4<f32>
  {
      let lightPos = vec3<f32>(200.0, 400.0, 300.0);

      var color = vec4<f32>(${toFloat(baseColorFactor[0])},
                            ${toFloat(baseColorFactor[1])},
                            ${toFloat(baseColorFactor[2])},
                            ${toFloat(baseColorFactor[3])});
      ${
        baseColorTexture
          ? 'color = color * textureSample(tex, texSampler, uv);'
          : ''
      }
      ${
        material.alphaMode === 'MASK'
          ? `
      if (color.a < ${toFloat(alphaCutoff)})
      {
        discard;
      } /* wgsl */ `
          : ''
      }

      var metallic: f32 = ${toFloat(metallicFactor)};
      var roughness: f32 = ${toFloat(roughnessFactor)};
      ${
        metallicRoughnessTexture
          ? `
      let metalRough = textureSample(metalRoughTex, metalRoughSampler, uv);
      metallic = metallic * metalRough.b;
      roughness = roughness * metalRough.g; /* wgsl */ `
          : ''
      }
      roughness = clamp(roughness, 0.04, 1.0);

      let lightDir = normalize(lightPos - worldPos);
      let viewDir = normalize(camera.eye - worldPos);

      ${
        normalTexture && hasTangent
          ? `
      var normal = textureSample(normalTex, normalSampler, uv).rgb;
      normal = normal * 2.0 - 1.0;
      normal = normal.x * tangent + normal.y * bitangent + normal.z * vNormal;
      normal = normalize(normal); /* wgsl */ `
          : `
      var normal = normalize(vNormal); /* wgsl */ `
      }
      ${
        material.doubleSided
          ? `
      if (dot(normal, viewDir) < 0.0) {
        normal = -normal;
      } /* wgsl */ `
          : ''
      }

      ${
        occlusionTexture
          ? 'let ao = textureSample(occlusionTex, occlusionSampler, uv).r;'
          : 'let ao = 1.0;'
      }
      var emissive = vec3<f32>(${toFloat(emissiveFactor[0])},
                               ${toFloat(emissiveFactor[1])},
                               ${toFloat(emissiveFactor[2])});
      ${
        emissiveTexture
          ? 'emissive = emissive * textureSample(emissiveTex, emissiveSampler, uv).rgb;'
          : ''
      }

      return vec4<f32>(brdf(color.rgb, metallic, roughness, lightDir, viewDir, normal) * ao + emissive, color.a);
  }
  `;
}
