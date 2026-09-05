// NAME: Concentric Pulse
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float rings; // @min 2.0 @max 40.0 @default 18.0
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float pulse; // @min 0.0 @max 4.0 @default 1.5
uniform float mirror; // @min 0.0 @max 1.0 @default 1.0 @step 1

vec3 palette(float t) {
  return vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.5, 0.5, 0.2) * t + vec3(0.0, 0.5, 0.8)));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time + seed * 21.3;
  vec2 uv_sym = mix(uv, vec2(0.5 + abs(uv.x - 0.5), 0.5 + abs(uv.y - 0.5)), mirror);
  vec4 source = texture2D(tex, uv_sym);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv_sym * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float ring = 0.5 + 0.5 * sin(r * rings - stime * pulse + source.r * colorShift);
  vec3 col = palette(r + source.g * colorShift * 0.2 + stime * 0.05) * pow(ring, 3.0) * 3.0;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
