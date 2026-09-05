// NAME: Starleidoscope
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float foldIterations; // @min 2.0 @max 8.0 @default 5.0
uniform float foldScale; // @min 1.05 @max 2.0 @default 1.25
uniform float starDensity; // @min 0.3 @max 3.0 @default 1.0
uniform float brightness; // @min 0.3 @max 3.0 @default 1.0
uniform float flareIntensity; // @min 0.0 @max 2.0 @default 1.0
uniform float twinkleSpeed; // @min 0.0 @max 5.0 @default 1.0
uniform float colorIntensity; // @min 0.0 @max 2.0 @default 1.0
uniform vec3 tint; // @default 1.0,1.0,1.0

#define NUM_LAYERS 10.0

mat2 slRot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

float slHash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float slStar(vec2 uv, float flare) {
  float d = length(uv);
  float m = 0.02 / max(d, 1e-4);

  float rays = max(0.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare;
  uv *= slRot(3.1415 / 4.0);
  rays = max(0.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare;

  m *= smoothstep(1.0, 0.2, d);
  return m;
}

// piccola deriva procedurale al posto della texture iChannel0 (audio/webcam su Shadertoy, non
// disponibile qui): basta a far variare lentamente la tinta delle stelle nel tempo
vec3 slStarLayer(vec2 uv, float time) {
  vec3 col = vec3(0.0);
  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offs = vec2(float(x), float(y));
      float n = slHash21(id + offs);
      float size = fract(n * 345.32);
      vec2 p = vec2(n, fract(n * 34.0));

      float star = slStar(gv - offs - p + 0.5, smoothstep(0.8, 1.0, size) * 0.6 * flareIntensity);

      vec2 driftSeed = vec2(0.5 + 0.5 * sin(time * 0.7), 0.5 + 0.5 * cos(time * 0.53));
      vec3 hueShift = fract(n * 2345.2 + dot(uv / 420.0, driftSeed)) * vec3(0.2, 0.3, 0.9) * 123.2;
      vec3 color = sin(hueShift) * 0.5 + 0.5;
      color = color * vec3(1.0, 0.25, 1.0 + size);

      star *= sin(time * 3.0 * twinkleSpeed + n * 6.2831) * 0.4 + 1.0;
      col += star * size * color;
    }
  }
  return col;
}

vec2 slN(float angle) {
  return vec2(sin(angle), cos(angle));
}

vec4 processColor(sampler2D tex, vec2 uvIn, float rawTime, vec2 resolution) {
  vec2 uv = (uvIn - 0.5) * resolution / resolution.y;
  float t = rawTime * 0.01 * speed;

  uv.x = abs(uv.x);
  uv.y += tan((5.0 / 6.0) * 3.1415) * 0.5;

  vec2 n = slN((5.0 / 6.0) * 3.1415);
  float d = dot(uv - vec2(0.5, 0.0), n);
  uv -= n * max(0.0, d) * 2.0;

  // fold ricorsivo (mirror + abs) che costruisce il fondale a fiocco di neve
  n = slN((2.0 / 3.0) * 3.1415);
  uv.x += 1.5 / 1.25;
  int foldCount = int(foldIterations);
  for (int i = 0; i < 8; i++) {
    if (i >= foldCount) break;
    uv *= foldScale;
    uv.x -= 1.5;
    uv.x = abs(uv.x);
    uv.x -= 0.5;
    uv -= n * min(0.0, dot(uv, n)) * 2.0;
  }

  uv *= slRot(t);
  vec3 col = vec3(0.0);

  // strati di stelle in parallasse: ciclano in profondità con fract(i+t)
  for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYERS) {
    float depth = fract(i + t);
    float scale = mix(20.0, 0.5, depth) * starDensity;
    float fade = depth * smoothstep(1.0, 0.9, depth);
    col += slStarLayer(uv * scale + i * 453.2, rawTime * speed) * fade;
  }

  col *= brightness * colorIntensity * tint;
  return vec4(col, 1.0);
}
