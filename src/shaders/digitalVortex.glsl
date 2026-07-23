// NAME: Digital Vortex
uniform float speed; // @min 0.0 @max 4.0 @default 1.5
uniform float swirl; // @min 0.0 @max 8.0 @default 3.0
uniform float cells; // @min 2.0 @max 20.0 @default 10.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.65

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x) + swirl / (r + 0.3) - time * speed;
  vec2 q = vec2(cos(a), sin(a)) * r;
  float v = fract((q.x + q.y) * cells + time * speed);
  vec3 col = pal(v + hue + r);
  col *= step(0.5, fract(a * cells / 6.28318));
  return vec4(col, 1.0);
}
