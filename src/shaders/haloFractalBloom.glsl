// NAME: Halo Fractal Bloom
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float fold; // @min 1.0 @max 3.0 @default 2.0
uniform float glow; // @min 0.0 @max 3.0 @default 1.5
uniform float mirror; // @min 0.0 @max 1.0 @default 1.0 @step 1
uniform float speed; // @min 0.0 @max 3.0 @default 1.0

vec3 palette(float t) {
  return vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.3, 0.5, 0.4) * t + vec3(0.2, 0.4, 0.7)));
}

mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time * speed + seed * 8.8;
  vec2 uv_sym = mix(uv, vec2(0.5 + abs(uv.x - 0.5), uv.y), mirror);
  vec4 source = texture2D(tex, uv_sym);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv_sym * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float acc = 0.0;
  for (int i = 0; i < 4; i++) {
    p = abs(p) / dot(p, p) - fold * 0.7;
    p *= rot(stime * 0.2);
    acc += exp(-abs(p.x + p.y) * 2.0);
  }
  vec3 col = palette(acc * 0.4 + source.r * colorShift * 0.2 + stime * 0.05) * acc * glow;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
