// NAME: Kaleido Prism
uniform float speed; // @min 0.0 @max 3.0 @default 0.6
uniform float segments; // @min 3.0 @max 16.0 @default 6.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.5
uniform float zoom; // @min 0.5 @max 4.0 @default 1.5

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.4, 0.7)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float a = atan(p.y, p.x);
  float r = length(p);
  float seg = 6.28318 / segments;
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  vec2 q = vec2(cos(a), sin(a)) * r * zoom;
  float pattern = sin(q.x * 6.0 + time * speed) * cos(q.y * 6.0 - time * speed);
  vec3 col = pal(pattern * 0.5 + hue + r);
  return vec4(col, 1.0);
}
