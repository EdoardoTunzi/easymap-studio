// NAME: Kaleido Fractal
uniform float speed; // @min 0.0 @max 2.0 @default 0.5
uniform float segments; // @min 3.0 @max 20.0 @default 6.0
uniform float iterations; // @min 2.0 @max 12.0 @default 7.0
uniform float fold; // @min 0.5 @max 2.0 @default 1.05
uniform vec3 tint; // @default 0.2,1.0,0.8

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = (uv - 0.5) * 2.0;
  float a = atan(p.y, p.x);
  float r = length(p);
  float seg = 6.28318 / segments;
  a = abs(mod(a + seg * 0.5, seg) - seg * 0.5);
  p = vec2(cos(a), sin(a)) * r;
  // kaleidoscopic IFS: ripiegature successive attorno a un punto mobile
  float t = time * speed;
  vec2 c = vec2(0.5 + 0.25 * sin(t), 0.5 + 0.25 * cos(t * 0.7));
  float acc = 0.0;
  for (int i = 0; i < 12; i++) {
    if (float(i) >= iterations) break;
    p = abs(p) - c;
    p *= fold;
    p = mat2(0.8, -0.6, 0.6, 0.8) * p;
    acc += exp(-7.0 * abs(p.x * p.y));
  }
  vec3 col = tint * acc * 0.18;
  col += tint.gbr * exp(-3.0 * r) * 0.25;
  return vec4(col, 1.0);
}
