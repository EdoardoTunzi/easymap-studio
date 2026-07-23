// NAME: Psy Flower
uniform float speed; // @min 0.0 @max 3.0 @default 0.9
uniform float petals; // @min 3.0 @max 20.0 @default 8.0
uniform float layers; // @min 1.0 @max 6.0 @default 3.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.85

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.1, 0.4, 0.7)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float acc = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= layers) break;
    float fi = float(i);
    acc += abs(sin(a * petals + fi + time * speed)) * exp(-r * 2.0 * (fi + 1.0));
  }
  vec3 col = pal(acc + hue + r);
  return vec4(col * 1.5, 1.0);
}
