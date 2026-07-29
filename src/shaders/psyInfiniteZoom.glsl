// NAME: Psy Infinite Zoom
uniform float speed; // @min 0.0 @max 3.0 @default 0.8
uniform float layers; // @min 2.0 @max 12.0 @default 6.0
uniform float sides; // @min 3.0 @max 12.0 @default 4.0
uniform float lineWidth; // @min 0.005 @max 0.15 @default 0.03
uniform vec3 tint; // @default 0.9,0.2,1.0

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  float acc = 0.0;
  // ogni strato e' lo stesso poligono a scala doppia, sfasato nel tempo:
  // riciclandosi con fract lo zoom non finisce mai
  for (int i = 0; i < 12; i++) {
    if (float(i) >= layers) break;
    float f = fract(time * speed * 0.2 + float(i) / layers);
    float s = pow(2.0, f * 3.0) * 0.12;
    vec2 q = p / s;
    float a = atan(q.y, q.x);
    float r = length(q);
    float seg = 6.28318 / sides;
    float poly = r * cos(mod(a, seg) - seg * 0.5);
    float edge = smoothstep(lineWidth / s, 0.0, abs(poly - 1.0));
    acc += edge * (1.0 - f);
  }
  return vec4(tint * acc, 1.0);
}
