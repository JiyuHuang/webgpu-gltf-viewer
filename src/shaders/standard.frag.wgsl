[[group(0), binding(1)]] var texSampler: sampler;
[[group(0), binding(2)]] var tex: texture_2d<f32>;

[[stage(fragment)]]
fn main([[location(0)]] normal: vec3<f32>,
        [[location(1)]] uv: vec2<f32>,
        [[location(2)]] worldPos: vec3<f32>) -> [[location(0)]] vec4<f32> {
    var lightPos: vec3<f32> = vec3<f32>(0.0, -1.0, -7.0);
    var color: vec4<f32> = textureSample(tex, texSampler, uv);
    var lambertian: f32 = dot(normal, normalize(worldPos - lightPos));
    lambertian = clamp(lambertian, 0.0, 1.0) + 0.1;
    color = vec4<f32>(color.rgb * lambertian, color.a);
    return color;
}
