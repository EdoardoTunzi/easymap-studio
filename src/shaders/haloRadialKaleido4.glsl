// NAME: Radial Kaleido 4
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float segments; // @min 2.0 @max 16.0 @default 6.0
uniform float swirlAmount; // @min 0.0 @max 2.0 @default 0.6
uniform float rings; // @min 1.0 @max 20.0 @default 8.0
uniform float chroma; // @min 0.0 @max 1.0 @default 0.25
uniform float dispersion; // @min 0.0 @max 0.5 @default 0.12
uniform float sharpness; // @min 0.5 @max 6.0 @default 2.0
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float boost; // @min 0.5 @max 3.0 @default 1.8
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float speed; // @min 0.0 @max 3.0 @default 1.0

// un canale del pattern: l'offset angolare e radiale separa RGB come un prisma
float channel(vec2 p, float off, float stime, float mod0) {
  float r = length(p) * (1.0 + off * dispersion);
  float a = atan(p.y, p.x) + off * chroma;
  float seg = 6.28318 / segments;
  a = abs(mod(a, seg) - seg * 0.5);
  a += swirlAmount * r * sin(stime * 0.5 + r * 3.0 + mod0);
  return 0.5 + 0.5 * sin(a * 6.0 + r * rings - stime * 1.5);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time * speed + seed * 11.1;
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float m = source.r * colorShift;
  vec3 col = vec3(channel(p, -1.0, stime, m), channel(p, 0.0, stime, m), channel(p, 1.0, stime, m));
  col = pow(col, vec3(sharpness)) * boost;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
