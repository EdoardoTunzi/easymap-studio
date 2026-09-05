// NAME: Sacred Geometry
uniform float speed; // @min 0.0 @max 2.0 @default 0.3
uniform float rings; // @min 1.0 @max 8.0 @default 3.0
uniform float radius; // @min 0.05 @max 0.5 @default 0.16
uniform float lineWidth; // @min 0.002 @max 0.05 @default 0.008
uniform vec3 lineColor; // @default 1.0,0.85,0.3

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  float rot = time * speed;
  float c = cos(rot), s = sin(rot);
  p = mat2(c, -s, s, c) * p;
  float acc = 0.0;
  // fiore della vita: cerchi disposti su anelli esagonali concentrici
  for (int ring = 0; ring < 8; ring++) {
    if (float(ring) >= rings) break;
    float rr = float(ring) * radius;
    for (int i = 0; i < 6; i++) {
      float a = float(i) * 1.0471976;
      vec2 center = ring == 0 ? vec2(0.0) : vec2(cos(a), sin(a)) * rr;
      float d = abs(length(p - center) - radius);
      acc += smoothstep(lineWidth, 0.0, d);
      if (ring == 0) break;
    }
  }
  float glow = clamp(acc, 0.0, 1.0);
  return vec4(lineColor * glow, 1.0);
}
