// NAME: Neon Rings
uniform float speed; // @min 0.0 @max 4.0 @default 1.5
uniform float count; // @min 2.0 @max 30.0 @default 14.0
uniform float thickness; // @min 0.01 @max 0.3 @default 0.08
uniform float hue; // @min 0.0 @max 1.0 @default 0.7

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.4, 0.8)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float rr = fract(r * count - time * speed);
  float ring = smoothstep(thickness, 0.0, abs(rr - 0.5));
  vec3 col = pal(r + hue + time * 0.05) * ring * 2.0;
  return vec4(col, 1.0);
}
