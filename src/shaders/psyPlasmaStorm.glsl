// NAME: Plasma Storm
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float scale; // @min 1.0 @max 12.0 @default 4.0
uniform float turbulence; // @min 0.0 @max 3.0 @default 1.2
uniform float contrast; // @min 0.5 @max 4.0 @default 1.8
uniform vec3 colorA; // @default 1.0,0.1,0.4
uniform vec3 colorB; // @default 0.1,0.8,1.0

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = (uv - 0.5) * scale;
  float t = time * speed;
  float v = sin(p.x + t);
  v += sin((p.y + t) * 0.7);
  v += sin((p.x + p.y + t) * 0.5);
  // centro mobile: rende il plasma vivo invece che periodico
  vec2 c = p + turbulence * vec2(sin(t * 0.33), cos(t * 0.41));
  v += sin(length(c) * 2.0 + t);
  v = v * 0.25;
  float m = 0.5 + 0.5 * sin(v * 3.14159 * contrast);
  vec3 col = mix(colorA, colorB, m);
  col *= 0.6 + 0.6 * cos(6.28318 * v + vec3(0.0, 0.5, 1.0));
  return vec4(col, 1.0);
}
