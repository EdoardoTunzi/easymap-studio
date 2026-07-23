// NAME: Electric Web
uniform float speed; // @min 0.0 @max 3.0 @default 1.2
uniform float density; // @min 2.0 @max 12.0 @default 5.0
uniform float glow; // @min 0.5 @max 4.0 @default 2.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.6

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.4, 0.8)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = (uv * 2.0 - 1.0) * density;
  float t = time * speed;
  float v = 0.0;
  for (int i = 0; i < 4; i++) {
    p = abs(p) / dot(p, p) - 0.8;
    v += exp(-abs(p.x + p.y) * 3.0);
  }
  vec3 col = pal(v * 0.3 + hue + t * 0.05) * v * glow;
  return vec4(col, 1.0);
}
