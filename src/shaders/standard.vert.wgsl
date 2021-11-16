[[block]] struct Uniforms {
    modelViewProj : mat4x4<f32>;
};
[[group(0), binding(0)]] var<uniform> uniforms : Uniforms;

struct VertexOutput {
    [[builtin(position)]] Position : vec4<f32>;
    [[location(0)]] color : vec4<f32>;
    [[location(1)]] uv : vec2<f32>;
};

[[stage(vertex)]]
fn main([[location(0)]] position : vec3<f32>,
        [[location(1)]] color : vec4<f32>,
        [[location(2)]] uv : vec2<f32>)-> VertexOutput {
    var output: VertexOutput;
    output.Position = uniforms.modelViewProj * vec4<f32>(position, 1.0);
    output.color = color;
    output.uv = uv;
    return output;
}
