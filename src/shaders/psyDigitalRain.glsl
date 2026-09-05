// NAME: Digital Rain
uniform float speed; // @min 0.0 @max 6.0 @default 2.0
uniform float columns; // @min 8.0 @max 120.0 @default 40.0
uniform float trail; // @min 1.0 @max 20.0 @default 6.0
uniform float flicker; // @min 0.0 @max 1.0 @default 0.5
uniform vec3 rainColor; // @default 0.2,1.0,0.35

float hash1(float x) { return fract(sin(x * 127.1) * 43758.5453); }

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float col = floor(uv.x * columns);
  float rnd = hash1(col);
  // ogni colonna cade con velocita' e fase proprie
  float y = fract(uv.y + time * speed * (0.4 + rnd * 0.8) + rnd);
  float head = pow(1.0 - y, trail);
  // celle quantizzate: simulano i glifi senza texture
  float cell = floor(uv.y * columns * 0.6);
  float glyph = step(0.35, hash1(cell + floor(time * 12.0) * rnd));
  float noiseFlicker = mix(1.0, hash1(cell * 3.7 + col), flicker);
  vec3 c = rainColor * head * glyph * noiseFlicker;
  c += vec3(0.7, 1.0, 0.8) * pow(head, 12.0);
  return vec4(c, 1.0);
}
