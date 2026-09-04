// NAME: Glitch Blocks
uniform float speed; // @min 0.0 @max 12.0 @default 5.0
uniform float blocks; // @min 4.0 @max 64.0 @default 18.0
uniform float displace; // @min 0.0 @max 1.0 @default 0.4
uniform float chroma; // @min 0.0 @max 1.0 @default 0.5
uniform vec3 baseColor; // @default 0.1,1.0,0.9

float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  // il tempo avanza a scatti: il glitch cambia solo a ogni "frame" digitale
  float frame = floor(time * speed);
  vec2 id = floor(uv * blocks);
  float rnd = hash1(id + frame);
  vec2 q = uv;
  q.x += (hash1(id.yy + frame) - 0.5) * displace * step(0.7, rnd);
  vec2 bid = floor(q * blocks);
  float v = hash1(bid + frame * 1.7);
  float on = step(0.45, v);
  // separazione dei canali: aberrazione cromatica da segnale corrotto
  float rC = step(0.45, hash1(bid + vec2(chroma, 0.0) + frame * 1.7));
  float gC = step(0.45, hash1(bid + frame * 1.7));
  float bC = step(0.45, hash1(bid - vec2(chroma, 0.0) + frame * 1.7));
  vec3 col = baseColor * vec3(rC, gC, bC) * on;
  col += vec3(1.0) * step(0.97, v);
  return vec4(col, 1.0);
}
