// NAME: Acid Waves
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float freq; // @min 1.0 @max 20.0 @default 8.0
uniform float amp; // @min 0.0 @max 1.0 @default 0.5
uniform float hue; // @min 0.0 @max 1.0 @default 0.15

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv;
  float t = time * speed;
  for (int i = 0; i < 4; i++) {
    float fi = float(i) + 1.0;
    p.x += amp / fi * sin(fi * freq * p.y + t);
    p.y += amp / fi * cos(fi * freq * p.x + t);
  }
  float v = sin(p.x * freq) + sin(p.y * freq);
  vec3 col = pal(v * 0.25 + hue + t * 0.05);
  return vec4(col, 1.0);
}
