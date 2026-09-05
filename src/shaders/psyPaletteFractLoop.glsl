// NAME: Palette Fract Loop
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float zoomFactor; // @min 1.05 @max 3.0 @default 1.5
uniform float iterations; // @min 2.0 @max 8.0 @default 4.0
uniform float ringFreq; // @min 2.0 @max 20.0 @default 8.0
uniform float glowPow; // @min 0.5 @max 3.0 @default 1.2
uniform vec3 colorFreq; // @default 1.0,1.0,1.0
uniform vec3 colorPhase; // @default 0.263,0.416,0.557

// palette coseno di Iñigo Quílez (iquilezles.org/articles/palettes)
vec3 pflPalette(float t) {
  vec3 a = vec3(0.5);
  vec3 b = vec3(0.5);
  return a + b * cos(6.28318 * (colorFreq * t + colorPhase));
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;
  vec2 p0 = p;
  vec3 finalColor = vec3(0.0);
  float t = time * speed;

  for (int i = 0; i < 8; i++) {
    if (float(i) >= iterations) break;
    p = fract(p * zoomFactor) - 0.5;
    float d = length(p) * exp(-length(p0));
    vec3 col = pflPalette(length(p0) + float(i) * 0.4 + t * 0.4);
    d = sin(d * ringFreq + t) / ringFreq;
    d = abs(d);
    d = pow(0.01 / d, glowPow);
    finalColor += col * d;
  }
  return vec4(finalColor, 1.0);
}
