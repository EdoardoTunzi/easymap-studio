// NAME: Voronoi Cells
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float density; // @min 2.0 @max 16.0 @default 6.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.4
uniform float edge; // @min 0.0 @max 1.0 @default 0.3

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

vec3 pal(float t) {
  return 0.5 + 0.5 * cos(6.28318 * (vec3(1.0) * t + vec3(0.0, 0.33, 0.67)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * density;
  vec2 g = floor(p);
  vec2 f = fract(p);
  float md = 8.0;
  vec2 mp = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 r = o + 0.5 + 0.5 * sin(time * speed + 6.28318 * hash2(g + o)) - f;
      float d = dot(r, r);
      if (d < md) { md = d; mp = g + o; }
    }
  }
  vec3 col = pal(hash2(mp).x + hue);
  col *= smoothstep(0.0, edge + 0.01, sqrt(md));
  return vec4(col, 1.0);
}
