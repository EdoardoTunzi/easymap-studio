// NAME: Warp Grid
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float cells; // @min 2.0 @max 20.0 @default 8.0
uniform float warp; // @min 0.0 @max 2.0 @default 0.6
uniform float hue; // @min 0.0 @max 1.0 @default 0.5

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float t = time * speed;
  p += warp * vec2(sin(p.y * 3.0 + t), cos(p.x * 3.0 + t));
  vec2 g = abs(fract(p * cells) - 0.5);
  float line = smoothstep(0.05, 0.0, min(g.x, g.y));
  vec3 col = pal(length(p) * 0.3 + hue + t * 0.05);
  col = mix(col * 0.2, col, line);
  return vec4(col, 1.0);
}
