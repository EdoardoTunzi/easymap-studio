// NAME: Bubbling Metaballs
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float count; // @min 2.0 @max 8.0 @default 5.0
uniform float radius; // @min 0.1 @max 0.6 @default 0.3
uniform float hue; // @min 0.0 @max 1.0 @default 0.5

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.4, 0.8)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float t = time * speed;
  float v = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= count) break;
    float fi = float(i);
    vec2 c = 0.7 * vec2(sin(t + fi * 1.7), cos(t * 0.9 + fi * 2.3));
    v += radius / (length(p - c) + 0.001);
  }
  vec3 col = pal(v * 0.2 + hue);
  col *= smoothstep(1.0, 2.5, v);
  return vec4(col, 1.0);
}
