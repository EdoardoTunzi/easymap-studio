// NAME: Trippy Checker
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float cells; // @min 2.0 @max 20.0 @default 8.0
uniform float warp; // @min 0.0 @max 2.0 @default 0.8
uniform float hue; // @min 0.0 @max 1.0 @default 0.0

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  vec2 q = vec2(a * cells / 3.14159, 1.0 / (r + 0.1) * warp + time * speed);
  float c = mod(floor(q.x) + floor(q.y), 2.0);
  vec3 col = pal(c * 0.5 + hue + r);
  return vec4(col, 1.0);
}
