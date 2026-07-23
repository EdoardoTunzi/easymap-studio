// NAME: Star Nest
uniform float speed; // @min 0.0 @max 2.0 @default 0.4
uniform float zoom; // @min 0.5 @max 3.0 @default 1.0
uniform float density; // @min 0.3 @max 1.2 @default 0.7
uniform float hue; // @min 0.0 @max 1.0 @default 0.6

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.4, 0.8)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = (uv * 2.0 - 1.0) / zoom;
  p.x *= resolution.x / resolution.y;
  vec3 s = vec3(p, 1.0);
  float v = 0.0;
  for (int i = 0; i < 12; i++) {
    s = abs(s) / dot(s, s) - density;
    v += length(s) * 0.02;
    s.xy += 0.1 * vec2(sin(time * speed), cos(time * speed));
  }
  vec3 col = pal(v + hue) * v;
  return vec4(col, 1.0);
}
