// NAME: Silexar Globe
// Originale: Danilo Guanabara (pouet.net/prod.php?which=57245), un classico minimale della demoscene.
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float scale; // @min 0.3 @max 3.0 @default 1.0
uniform float swirl; // @min 0.0 @max 4.0 @default 1.0
uniform float colorSpread; // @min 0.0 @max 0.3 @default 0.07
uniform float brightness; // @min 0.3 @max 3.0 @default 1.0

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec3 c;
  float l = 1.0;
  float z = time * speed;
  for (int i = 0; i < 3; i++) {
    vec2 rawUv = uv;
    vec2 centered = uv - 0.5;
    centered.x *= resolution.x / resolution.y;
    centered /= scale;
    z += colorSpread;
    l = length(centered);
    rawUv += centered / l * (sin(z) + 1.0) * abs(sin(l * 9.0 * swirl - z - z));
    c[i] = 0.01 * brightness / length(mod(rawUv, 1.0) - 0.5);
  }
  return vec4(c / max(l, 0.0001), 1.0);
}
