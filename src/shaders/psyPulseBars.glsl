// NAME: Pulse Bars
uniform float speed; // @min 0.0 @max 8.0 @default 3.0
uniform float bars; // @min 4.0 @max 64.0 @default 20.0
uniform float gap; // @min 0.0 @max 0.6 @default 0.15
uniform float decay; // @min 0.5 @max 8.0 @default 2.5
uniform vec3 lowColor; // @default 0.1,0.4,1.0
uniform vec3 highColor; // @default 1.0,0.2,0.1

float hash1(float x) { return fract(sin(x * 127.1) * 43758.5453); }

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float idx = floor(uv.x * bars);
  float f = fract(uv.x * bars);
  if (f < gap * 0.5 || f > 1.0 - gap * 0.5) return vec4(0.0, 0.0, 0.0, 1.0);
  // altezza pseudo-spettro: ogni barra ha il suo ritmo, le basse piu' lente
  float rnd = hash1(idx);
  float band = idx / bars;
  float rate = mix(1.0, 3.0, band);
  float env = pow(1.0 - fract(time * speed * 0.25 * rate + rnd), decay);
  float h = mix(0.15, 1.0, env * (0.4 + 0.6 * rnd));
  float on = step(uv.y, h);
  vec3 col = mix(lowColor, highColor, uv.y / max(h, 1e-3));
  // testa della barra piu' luminosa
  float head = smoothstep(0.03, 0.0, abs(uv.y - h));
  return vec4(col * on + vec3(head) * 0.8, 1.0);
}
