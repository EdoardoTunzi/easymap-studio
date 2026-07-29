// NAME: Psy Strobe Tunnel
uniform float speed; // @min 0.0 @max 8.0 @default 3.0
uniform float slices; // @min 2.0 @max 40.0 @default 12.0
uniform float strobe; // @min 0.0 @max 1.0 @default 0.7
uniform float twist; // @min -6.0 @max 6.0 @default 2.0
uniform vec3 colorA; // @default 1.0,1.0,1.0
uniform vec3 colorB; // @default 1.0,0.0,0.4

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  float r = max(length(p), 1e-4);
  float a = atan(p.y, p.x);
  float z = 1.0 / r + time * speed * 0.5;
  // spicchi alternati che ruotano scendendo nel tunnel
  float wedge = floor(fract((a / 6.28318) + z * twist * 0.02) * slices);
  float ring = floor(z * 2.0);
  float check = mod(wedge + ring, 2.0);
  // lampeggio globale sincronizzato: la stroboscopia da club
  float flash = step(1.0 - strobe, fract(time * speed));
  vec3 col = mix(colorA, colorB, check) * mix(0.25, 1.0, flash);
  col *= smoothstep(0.0, 0.15, r) * exp(-r * 1.2);
  return vec4(col, 1.0);
}
