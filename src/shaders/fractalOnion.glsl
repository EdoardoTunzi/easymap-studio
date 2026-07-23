// NAME: Fractal Onion
uniform float speed; // @min 0.0 @max 2.0 @default 0.5
uniform float fold; // @min 0.5 @max 2.0 @default 1.0
uniform float zoom; // @min 0.5 @max 3.0 @default 1.2
uniform float hue; // @min 0.0 @max 1.0 @default 0.4

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.1, 0.4, 0.7)));
}

mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = (uv * 2.0 - 1.0) / zoom;
  p.x *= resolution.x / resolution.y;
  float t = time * speed;
  float d = 0.0;
  for (int i = 0; i < 8; i++) {
    p = abs(p) - fold * 0.5;
    p *= rot(t * 0.2 + 0.3);
    d += length(p);
  }
  vec3 col = pal(d * 0.05 + hue + t * 0.05);
  return vec4(col, 1.0);
}
