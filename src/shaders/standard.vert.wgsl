[[block]] struct ModelViewProjMatrix {
    value: mat4x4<f32>;
};
[[group(0), binding(0)]] var<uniform> modelViewProjMatrix: ModelViewProjMatrix;

[[block]] struct ModelMatrix {
    value: mat4x4<f32>;
};
[[group(0), binding(1)]] var<uniform> modelMatrix: ModelMatrix;

struct VertexOutput {
    [[builtin(position)]] Position: vec4<f32>;
    [[location(0)]] normal: vec3<f32>;
    [[location(1)]] uv: vec2<f32>;
    [[location(2)]] worldPos: vec3<f32>;
};

[[stage(vertex)]]
fn main([[location(0)]] position: vec3<f32>,
        [[location(1)]] normal: vec3<f32>,
        [[location(2)]] uv: vec2<f32>)-> VertexOutput {
    var output: VertexOutput;
    output.worldPos = (modelMatrix.value * vec4<f32>(position, 1.0)).xyz;
    output.Position = modelViewProjMatrix.value * vec4<f32>(position, 1.0);
    output.normal = normal;
    output.uv = uv;
    return output;
}
