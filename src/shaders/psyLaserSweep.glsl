// NAME: Laser Sweep
uniform float speed; // @min 0.0 @max 5.0 @default 1.0
uniform float beams; // @min 2.0 @max 32.0 @default 10.0
uniform float sharpness; // @min 2.0 @max 60.0 @default 8.0
uniform float spread; // @min 0.0 @max 2.0 @default 0.6
uniform vec3 beamColor; // @default 0.2,1.0,0.3

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  // origine dei raggi in alto al centro, come una testa mobile puntata sul pubblico
  vec2 p = uv - vec2(0.5, 1.05);
  float a = atan(p.x, -p.y);
  float r = length(p);
  float sweep = sin(time * speed) * spread;
  float f = fract((a + sweep) * beams / 6.28318);
  float beam = pow(1.0 - abs(f * 2.0 - 1.0), sharpness);
  float haze = exp(-0.9 * r);
  return vec4(beamColor * beam * haze * 2.4, 1.0);
}
