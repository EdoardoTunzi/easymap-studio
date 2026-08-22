// NAME: Symmetrical Halo Swirl
uniform float seed; // @min 0.0 @max 100.0 @default 0.0
uniform float colorShift; // @min 0.0 @max 10.0 @default 3.0
uniform float intensity; // @min 0.0 @max 1.0 @default 0.8
uniform float shine; // @min 0.0 @max 5.0 @default 1.5
uniform float haloSize; // @min 0.0 @max 0.05 @default 0.01
uniform float haloIntensity; // @min 0.0 @max 2.0 @default 0.6
uniform float mirror; // @min 0.0 @max 1.0 @default 1.0 @step 1
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float swirlAmount; // @min 0.0 @max 0.5 @default 0.12
uniform float petals; // @min 2.0 @max 20.0 @default 8.0

vec3 palette(float t) {
  return vec3(0.5) + vec3(0.5) * cos(6.28318 * (vec3(0.18, 0.40, 0.07) * t + vec3(0.28, 0.68, 0.30)));
}

vec2 swirl(vec2 p, float strength, float freq, float speed, float time) {
  float r = length(p);
  float a = atan(p.y, p.x) + strength * r * sin(speed * time + freq * r);
  return (r + 0.03 * sin(speed * time + freq * r)) * vec2(cos(a), sin(a));
}

vec3 makeFlower(vec2 p, float level, float time) {
  float d = length(p);
  float a = atan(p.y, p.x) / 6.28318 + 0.5;
  float m = smoothstep(0.8, 0.7, d);
  float stripe = 0.5 + 0.5 * sin(6.28318 * (a * petals + time));
  vec3 col = vec3(pow(stripe, 3.0) * 5.0) * palette(d * sin(time * 0.2) * 2.0 + level);
  return col * (smoothstep(1.0, 0.3, d / 0.75) * smoothstep(0.0, 0.4, d / 0.75)) * m;
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float stime = time * speed + seed * 23.45;
  vec2 uv_sym = mix(uv, vec2(0.5 + abs(uv.x - 0.5), uv.y), mirror);
  vec4 source = texture2D(tex, uv_sym);
  vec2 p = (uv_sym * 2.0 - 1.0);
  p.x *= resolution.x / resolution.y;
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  float t_r = stime + source.r * colorShift;
  p = swirl(p * (sin(stime * 0.4) * 0.1 + 1.1), swirlAmount, 0.2, 0.2 + source.b * 0.3, t_r);
  vec3 finalCol = makeFlower(p, 4.0 + source.g * colorShift, stime + source.g * colorShift);
  vec2 p_iter = p * 0.25;
  for (int i = 0; i < 2; i++) {
    p_iter = abs(fract(p_iter * 2.1) - 0.5) * 2.0;
  }
  float halo = smoothstep(haloSize, 0.0, abs(length(p) - 0.75)) * haloIntensity;
  finalCol += halo * palette(stime * 0.1);
  finalCol *= intensity;
  finalCol += pow(max(lum - 0.8, 0.0), 2.0) * shine;
  return vec4(finalCol, source.a);
}
