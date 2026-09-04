// NAME: Strobe Grid
uniform float speed; // @min 0.0 @max 8.0 @default 3.0
uniform float density; // @min 2.0 @max 30.0 @default 10.0
uniform float strobe; // @min 0.0 @max 1.0 @default 0.6
uniform float thickness; // @min 0.01 @max 0.5 @default 0.08
uniform float warp; // @min 0.0 @max 2.0 @default 0.4
uniform vec3 gridColor; // @default 0.1,1.0,0.6

float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  p += warp * 0.1 * vec2(sin(p.y * 6.0 + time * speed), cos(p.x * 6.0 + time * speed));
  vec2 g = p * density;
  vec2 cell = floor(g);
  vec2 f = abs(fract(g) - 0.5);
  float line = 1.0 - smoothstep(0.5 - thickness, 0.5, max(f.x, f.y));
  // ogni cella lampeggia con una fase propria: effetto strobo da stage
  float blink = step(1.0 - strobe, fract(hash1(cell) + time * speed * 0.35));
  float glow = line * mix(0.25, 1.0, blink);
  return vec4(gridColor * glow, 1.0);
}
