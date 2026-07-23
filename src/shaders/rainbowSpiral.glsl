// NAME: Rainbow Spiral
uniform float speed; // @min 0.0 @max 4.0 @default 1.0
uniform float arms; // @min 1.0 @max 12.0 @default 5.0
uniform float twist; // @min 0.0 @max 10.0 @default 4.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.0

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float s = sin(arms * a + twist * log(r + 0.1) - time * speed);
  vec3 col = pal(s * 0.5 + hue + a / 6.28318);
  return vec4(col, 1.0);
}
