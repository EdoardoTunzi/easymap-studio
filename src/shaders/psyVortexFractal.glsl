// NAME: Psy Vortex Fractal
uniform float speed; // @min 0.0 @max 3.0 @default 0.8
uniform float swirl; // @min 0.0 @max 8.0 @default 3.0
uniform float iterations; // @min 2.0 @max 10.0 @default 6.0
uniform float scale; // @min 0.5 @max 4.0 @default 1.6
uniform vec3 tint; // @default 1.0,0.3,0.9

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = (uv - 0.5) * scale * 2.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  // torsione dipendente dal raggio: il vortice trascina i dettagli interni
  a += swirl / (r + 0.3) + time * speed;
  p = vec2(cos(a), sin(a)) * r;
  float acc = 0.0;
  float amp = 1.0;
  for (int i = 0; i < 10; i++) {
    if (float(i) >= iterations) break;
    p = abs(p * 2.0) - 1.0;
    acc += amp * exp(-2.5 * length(p));
    amp *= 0.75;
  }
  vec3 col = tint * acc;
  col += tint.bgr * 0.4 * exp(-2.0 * r);
  return vec4(col, 1.0);
}
