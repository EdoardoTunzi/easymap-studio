// NAME: Alien Organism
uniform float speed; // @min 0.0 @max 2.0 @default 0.5
uniform float cells; // @min 2.0 @max 20.0 @default 7.0
uniform float membrane; // @min 0.01 @max 0.4 @default 0.12
uniform float pulse; // @min 0.0 @max 2.0 @default 1.0
uniform vec3 coreColor; // @default 0.9,0.1,0.5
uniform vec3 edgeColor; // @default 0.2,1.0,0.4

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * cells;
  vec2 g = floor(p), f = fract(p);
  float t = time * speed;
  float f1 = 8.0, f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 h = hash2(g + o);
      // ogni nucleo respira attorno alla propria posizione
      vec2 c = o + 0.5 + 0.4 * sin(t + 6.28318 * h) - f;
      float d = length(c);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  float wall = smoothstep(0.0, membrane, f2 - f1);
  float core = 1.0 - smoothstep(0.0, 0.45, f1);
  float breathe = 0.6 + 0.4 * sin(t * 2.0 * pulse);
  vec3 col = mix(edgeColor, coreColor, core) * (1.0 - wall) * breathe;
  col += edgeColor * (1.0 - wall) * 0.4;
  return vec4(col, 1.0);
}
