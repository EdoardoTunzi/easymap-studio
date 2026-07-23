// NAME: Hypno Tunnel
uniform float speed; // @min 0.0 @max 4.0 @default 1.5
uniform float rings; // @min 2.0 @max 30.0 @default 12.0
uniform float twist; // @min 0.0 @max 6.0 @default 2.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.0

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float u = 1.0 / (r + 0.2) + time * speed;
  float v = a + twist * r;
  float pattern = sin(u * rings) * sin(v * 3.0);
  vec3 col = pal(pattern * 0.5 + hue + u * 0.1);
  col *= smoothstep(0.0, 0.3, r);
  return vec4(col, 1.0);
}
