// NAME: Interference Moire
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float freq; // @min 5.0 @max 60.0 @default 25.0
uniform float offset; // @min 0.0 @max 2.0 @default 0.5
uniform float hue; // @min 0.0 @max 1.0 @default 0.2

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float t = time * speed;
  vec2 c1 = vec2(-offset + 0.2 * sin(t), 0.0);
  vec2 c2 = vec2(offset - 0.2 * sin(t), 0.0);
  float w1 = sin(length(p - c1) * freq - t);
  float w2 = sin(length(p - c2) * freq - t);
  float v = w1 * w2;
  vec3 col = pal(v * 0.5 + hue);
  return vec4(col, 1.0);
}
