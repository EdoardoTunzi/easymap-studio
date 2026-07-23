// NAME: Halo Prismatic Swirl
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float swirlAmount; // @min 0.0 @max 3.0 @default 1.2
uniform float bands; // @min 2.0 @max 20.0 @default 9.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float chroma; // @min 0.0 @max 1.0 @default 0.4

vec2 swirl(vec2 p, float amt, float t) {
  float r = length(p);
  float a = atan(p.y, p.x) + amt * r * sin(t * 0.4 + r * 2.5);
  return r * vec2(cos(a), sin(a));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time + seed * 3.9;
  vec2 uv_sym = vec2(0.5 + abs(uv.x - 0.5), uv.y);
  vec4 source = texture2D(tex, uv_sym);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv_sym * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  p = swirl(p, swirlAmount, stime);
  float d = length(p) * bands;
  vec3 col;
  col.r = 0.5 + 0.5 * sin(d - stime * 1.5);
  col.g = 0.5 + 0.5 * sin(d - stime * 1.5 + chroma * 6.28318);
  col.b = 0.5 + 0.5 * sin(d - stime * 1.5 + chroma * 12.56636);
  col *= 1.5;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
