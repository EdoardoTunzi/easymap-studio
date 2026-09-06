// NAME: Radial Kaleido 10
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float segments; // @min 2.0 @max 16.0 @default 6.0
uniform float rings; // @min 1.0 @max 24.0 @default 9.0
uniform float detune; // @min 0.0 @max 4.0 @default 1.3
uniform float beat; // @min 0.0 @max 6.0 @default 2.0
uniform float contrast; // @min 0.5 @max 6.0 @default 2.5
uniform float strobe; // @min 0.0 @max 1.0 @default 0.0
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float hue; // @min 0.0 @max 1.0 @default 0.9
uniform float sat; // @min 0.0 @max 2.0 @default 1.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.85
uniform float speed; // @min 0.0 @max 3.0 @default 1.0

vec3 palette(float t) {
  vec3 base = vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.5, 0.2, 0.5) * t + vec3(0.3, 0.45, 0.6) + hue));
  return mix(vec3(dot(base, vec3(0.299, 0.587, 0.114))), base, sat);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time * speed + seed * 15.4;
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  float r = length(p);
  float a = atan(p.y, p.x);
  float sg = 6.28318 / segments;
  a = abs(mod(a, sg) - sg * 0.5);
  // due griglie quasi identiche: la piccola differenza di frequenza genera le frange di moire'
  float w1 = 0.5 + 0.5 * sin(a * 6.0 + r * rings - stime * beat + source.r * colorShift);
  float w2 = 0.5 + 0.5 * sin(a * 6.0 + r * (rings + detune) - stime * beat * 1.07);
  float pattern = pow(clamp(w1 * w2 * 2.0, 0.0, 1.0), contrast);
  // lo strobo taglia il pattern a intervalli: a 0 e' spento, non c'e' lampeggio involontario
  float gate = mix(1.0, step(0.5, fract(stime * beat * 0.25)), strobe);
  vec3 col = palette(pattern + r * 0.5 + source.g * colorShift * 0.2) * pattern * 2.2 * gate;
  vec3 blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum));
  return vec4(blended, source.a);
}
