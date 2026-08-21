// NAME: Halo Petal Kaleido
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float segments; // @min 3.0 @max 20.0 @default 10.0
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float rings; // @min 2.0 @max 20.0 @default 9.0
uniform float mirror; // @min 0.0 @max 1.0 @default 1.0 @step 1
uniform float speed; // @min 0.0 @max 3.0 @default 1.0

vec3 palette(float t) {
  return vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.6, 0.4, 0.2) * t + vec3(0.2, 0.5, 0.7)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time * speed + seed * 5.5;
  vec2 uv_sym = mix(uv, vec2(0.5 + abs(uv.x - 0.5), uv.y), mirror);
  vec4 source = texture2D(tex, uv_sym);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv_sym * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float seg = 6.28318 / segments;
  a = abs(mod(a, seg) - seg * 0.5);
  float petal = cos(a * segments * 0.5) * sin(r * rings - stime + source.b * colorShift);
  vec3 col = palette(petal * 0.5 + r + source.r * colorShift * 0.2)
           * (0.5 + 0.5 * cos(r * rings - stime)) * 2.0;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
