// NAME: Bass Rings
uniform float speed; // @min 0.0 @max 6.0 @default 2.0
uniform float count; // @min 1.0 @max 20.0 @default 7.0
uniform float sharpness; // @min 1.0 @max 20.0 @default 2.5
uniform float pulse; // @min 0.0 @max 1.0 @default 0.5
uniform vec3 ringColor; // @default 0.2,0.9,1.0

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  float r = length(p);
  // il kick: un inviluppo che riparte a ogni battuta e allarga gli anelli
  float beat = pow(1.0 - fract(time * speed * 0.5), 3.0);
  float rr = r * (1.0 + pulse * beat);
  float w = fract(rr * count - time * speed);
  float ring = pow(1.0 - abs(w * 2.0 - 1.0), sharpness);
  float falloff = 1.0 - smoothstep(0.1, 0.85, r);
  vec3 col = ringColor * ring * falloff * (0.8 + beat);
  col += ringColor * exp(-10.0 * r) * (0.4 + beat * 0.6);
  return vec4(col * 1.5, 1.0);
}
