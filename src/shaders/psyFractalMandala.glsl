// NAME: Fractal Mandala
uniform float speed; // @min 0.0 @max 2.0 @default 0.4
uniform float segments; // @min 3.0 @max 24.0 @default 8.0
uniform float zoom; // @min 0.5 @max 6.0 @default 2.0
uniform float detail; // @min 1.0 @max 6.0 @default 3.0
uniform vec3 tint; // @default 1.0,0.5,0.1

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = (uv - 0.5) * zoom;
  float a = atan(p.y, p.x);
  float r = length(p);
  // piegatura radiale: genera la simmetria a raggiera del mandala
  float seg = 6.28318 / segments;
  a = abs(mod(a + seg * 0.5, seg) - seg * 0.5);
  p = vec2(cos(a), sin(a)) * r;
  float acc = 0.0;
  vec2 q = p;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= detail) break;
    q = abs(q) / dot(q, q) - vec2(0.6 + 0.15 * sin(time * speed), 0.5);
    acc += exp(-4.0 * length(q));
  }
  vec3 col = tint * acc;
  col += 0.35 * tint.bgr * exp(-6.0 * r);
  return vec4(col, 1.0);
}
