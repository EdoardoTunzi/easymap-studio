// NAME: Tunnel Rush
uniform float speed; // @min 0.0 @max 5.0 @default 1.5
uniform float rings; // @min 2.0 @max 30.0 @default 10.0
uniform float twist; // @min -4.0 @max 4.0 @default 1.0
uniform float fade; // @min 0.2 @max 3.0 @default 1.2
uniform vec3 nearColor; // @default 1.0,0.2,0.8
uniform vec3 farColor; // @default 0.05,0.0,0.3

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  float r = max(length(p), 1e-4);
  float a = atan(p.y, p.x);
  // z cresce verso il centro: la profondita' del tunnel
  float z = 1.0 / r + time * speed;
  float band = fract(z * rings * 0.1);
  float spokes = 0.5 + 0.5 * sin(a * 8.0 + z * twist);
  float shape = smoothstep(0.5, 0.15, abs(band - 0.5)) * (0.35 + 0.65 * spokes);
  float depth = pow(clamp(r * 2.0, 0.0, 1.0), fade);
  vec3 col = mix(nearColor, farColor, depth) * shape;
  // bagliore verso il punto di fuga
  col += nearColor * exp(-8.0 * r) * 0.6;
  return vec4(col, 1.0);
}
