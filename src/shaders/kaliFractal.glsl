// NAME: Kali Fractal
uniform float speed; // @min 0.0 @max 2.0 @default 0.4
uniform float fold; // @min 0.5 @max 1.5 @default 0.9
uniform float hue; // @min 0.0 @max 1.0 @default 0.2
uniform float zoom; // @min 0.5 @max 3.0 @default 1.0

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.1, 0.4, 0.7)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = (uv * 2.0 - 1.0) / zoom;
  p.x *= resolution.x / resolution.y;
  vec2 z = p;
  float m = 1000.0;
  for (int i = 0; i < 12; i++) {
    z = abs(z) / dot(z, z) - fold - vec2(0.0, sin(time * speed) * 0.1);
    m = min(m, length(z));
  }
  vec3 col = pal(m + hue + time * 0.05);
  return vec4(col, 1.0);
}
