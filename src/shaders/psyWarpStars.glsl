// NAME: Psy Warp Stars
uniform float speed; // @min 0.0 @max 6.0 @default 2.0
uniform float density; // @min 20.0 @max 400.0 @default 140.0
uniform float streak; // @min 0.0 @max 1.0 @default 0.6
uniform float glow; // @min 0.2 @max 4.0 @default 2.2
uniform vec3 starColor; // @default 0.8,0.9,1.0

float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  float r = max(length(p), 1e-4);
  float a = atan(p.y, p.x);
  // proiezione radiale: le stelle nascono al centro e accelerano verso il bordo
  float z = fract(log(r + 0.05) * 2.0 - time * speed * 0.25);
  float band = floor(log(r + 0.05) * 2.0 - time * speed * 0.25);
  float spokes = floor(a / 6.28318 * density);
  float rnd = hash1(vec2(spokes, band));
  float ang = fract(a / 6.28318 * density);
  float across = pow(1.0 - abs(ang * 2.0 - 1.0), mix(30.0, 4.0, streak));
  float along = pow(1.0 - abs(z * 2.0 - 1.0), mix(8.0, 1.2, streak));
  float star = across * along * step(0.3, rnd);
  // nucleo al centro: rende leggibile il punto di fuga
  float core = exp(-14.0 * r) * 0.8;
  return vec4(starColor * (star * glow * smoothstep(0.0, 0.08, r) + core), 1.0);
}
