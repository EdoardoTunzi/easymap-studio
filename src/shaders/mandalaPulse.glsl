// NAME: Mandala Pulse
uniform float speed; // @min 0.0 @max 3.0 @default 0.8
uniform float petals; // @min 3.0 @max 24.0 @default 10.0
uniform float rings; // @min 2.0 @max 20.0 @default 8.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.3

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.1, 0.4, 0.7)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float f = cos(a * petals) * sin(r * rings - time * speed);
  vec3 col = pal(f * 0.5 + hue + r * 0.5);
  col *= 0.5 + 0.5 * cos(r * rings - time * speed);
  return vec4(col, 1.0);
}
