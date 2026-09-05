// NAME: Hex Pulse
uniform float speed; // @min 0.0 @max 5.0 @default 1.2
uniform float density; // @min 2.0 @max 24.0 @default 8.0
uniform float edge; // @min 0.01 @max 0.4 @default 0.12
uniform float wave; // @min 0.0 @max 2.0 @default 1.0
uniform vec3 hexColor; // @default 0.9,0.2,1.0

// coordinate esagonali: restituisce distanza dal bordo e id della cella
vec4 hexCell(vec2 p) {
  vec2 s = vec2(1.0, 1.7320508);
  vec2 a = mod(p, s) - s * 0.5;
  vec2 b = mod(p - s * 0.5, s) - s * 0.5;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = p - gv;
  vec2 q = abs(gv);
  float d = max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
  return vec4(0.5 - d, 0.0, id);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = (uv - 0.5) * density;
  vec4 h = hexCell(p);
  float dist = length(h.zw) * 0.15;
  // onda radiale che attraversa la griglia
  float pulse = 0.5 + 0.5 * sin(time * speed * 2.0 - dist * wave * 6.0);
  float border = smoothstep(0.0, edge, h.x);
  float glow = (1.0 - border) * (0.35 + pulse);
  return vec4(hexColor * glow, 1.0);
}
