// NAME: Trippy Spiral
uniform float speed; // @min 0.0 @max 5.0 @default 1.0
uniform float arms; // @min 1.0 @max 20.0 @default 5.0
uniform float twist; // @min 0.0 @max 20.0 @default 6.0
uniform float sharpness; // @min 1.0 @max 20.0 @default 4.0
uniform vec3 colorA; // @default 1.0,0.9,0.1
uniform vec3 colorB; // @default 0.6,0.0,1.0

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  float r = length(p);
  float a = atan(p.y, p.x);
  // il logaritmo del raggio rende la spirale autosimile a ogni zoom
  float sp = a * arms + log(r + 0.02) * twist - time * speed * 2.0;
  float band = 0.5 + 0.5 * sin(sp);
  float shape = pow(band, sharpness);
  vec3 col = mix(colorA, colorB, band) * shape;
  col *= smoothstep(0.75, 0.1, r);
  return vec4(col, 1.0);
}
