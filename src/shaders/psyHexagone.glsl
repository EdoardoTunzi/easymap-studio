// NAME: Hexagone
// Martijn Steinrucken (BigWings), 2019, licenza CC BY-NC-SA 3.0: uso non commerciale,
// attribuzione richiesta. iMouse (pan orizzontale della camera) rimosso: non disponibile nel
// motore.
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float camBob; // @min 5.0 @max 40.0 @default 20.0
uniform float pulseZoom; // @min 1.0 @max 10.0 @default 5.0
uniform float sizeSpeed; // @min 0.0 @max 3.0 @default 1.0
uniform float edgeWidth; // @min 0.02 @max 0.2 @default 0.06
uniform float borderPulseAmt; // @min 0.0 @max 2.0 @default 1.0
uniform float fadeDistance; // @min 6.0 @max 30.0 @default 18.0
uniform float brightness; // @min 0.5 @max 4.0 @default 2.0
uniform float colorShift; // @min 0.0 @max 6.28 @default 0.0
uniform vec3 tint; // @default 1.0,1.0,1.0

#define R3 1.732051

float hxTime;

vec4 hxHexCoords(vec2 uv) {
  vec2 s = vec2(1.0, R3);
  vec2 h = 0.5 * s;
  vec2 gv = s * uv;
  vec2 a = mod(gv, s) - h;
  vec2 b = mod(gv + h, s) - h;
  vec2 ab = dot(a, a) < dot(b, b) ? a : b;
  vec2 st = ab;
  vec2 id = gv - ab;
  return vec4(st, id);
}

float hxGetSize(vec2 id, float seed) {
  float d = length(id);
  float t2 = hxTime * 0.5 * sizeSpeed;
  float a = sin(d * seed + t2) + sin(d * seed * seed * 10.0 + t2 * 2.0);
  return a / 2.0 + 0.5;
}

mat2 hxRot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float hxHexagon(vec2 uv, float r, vec2 offs) {
  uv *= hxRot(mix(0.0, 3.1415, r));
  r /= 1.0 / sqrt(2.0);
  uv = vec2(-uv.y, uv.x);
  uv.x *= R3;
  uv = abs(uv);
  vec2 n = normalize(vec2(1.0, 1.0));
  float d = dot(uv, n) - r;
  d = max(d, uv.y - r * 0.707);
  d = smoothstep(edgeWidth, edgeWidth * 0.333, abs(d));
  d += smoothstep(0.1, 0.09, abs(r - 0.5)) * sin(hxTime) * borderPulseAmt;
  return d;
}

// fiore di 7 esagoni (centrale + 6 vicini su 3 coppie di offset specchiate)
float hxLayer(vec2 uv, float s) {
  vec4 hu = hxHexCoords(uv * 2.0);
  float d = hxHexagon(hu.xy, hxGetSize(hu.zw, s), vec2(0.0));
  vec2 offs = vec2(1.0, 0.0);
  d += hxHexagon(hu.xy - offs, hxGetSize(hu.zw + offs, s), offs);
  d += hxHexagon(hu.xy + offs, hxGetSize(hu.zw - offs, s), -offs);
  offs = vec2(0.5, 0.8725);
  d += hxHexagon(hu.xy - offs, hxGetSize(hu.zw + offs, s), offs);
  d += hxHexagon(hu.xy + offs, hxGetSize(hu.zw - offs, s), -offs);
  offs = vec2(-0.5, 0.8725);
  d += hxHexagon(hu.xy - offs, hxGetSize(hu.zw + offs, s), offs);
  d += hxHexagon(hu.xy + offs, hxGetSize(hu.zw - offs, s), -offs);
  return d;
}

float hxN(float p) {
  return fract(sin(p * 123.34) * 345.456);
}

vec3 hxCol(float p, float offs) {
  float n = hxN(p) * 1234.34;
  return sin(n * vec3(12.23, 45.23, 56.2) + offs * 3.0 + colorShift) * 0.5 + 0.5;
}

vec3 hxRayDir(vec2 uv, vec3 p, vec3 lookat, float zoom) {
  vec3 f = normalize(lookat - p);
  vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
  vec3 u = cross(f, r);
  vec3 c = p + f * zoom;
  vec3 i = c + uv.x * r + uv.y * u;
  return normalize(i - p);
}

vec4 processColor(sampler2D tex, vec2 uv0, float rawTime, vec2 resolution) {
  hxTime = rawTime * speed;

  vec2 uv = (uv0 - 0.5) * resolution / resolution.y;
  vec2 UV = uv0 - 0.5;
  float duv = dot(UV, UV);

  float t = hxTime * 0.2 + 5.0;

  float y = sin(t * 0.5);
  vec3 ro = vec3(0.0, camBob * y, -5.0);
  vec3 lookat = vec3(0.0, 0.0, -10.0);
  vec3 rd = hxRayDir(uv, ro, lookat, 1.0);

  vec3 col = vec3(0.0);
  vec3 p = ro + rd * (ro.y / rd.y);
  float dp = length(p.xz);

  if ((ro.y / rd.y) <= 0.0) {
    vec2 guv = p.xz * 0.1;
    guv *= mix(1.0, pulseZoom, sin(t * 0.5) * 0.5 + 0.5);
    guv *= hxRot(t);
    guv.x *= R3;

    for (float i = 0.0; i < 1.0; i += 1.0 / 3.0) {
      float id = floor(i + t);
      float tt = fract(i + t);
      float z = mix(5.0, 0.1, tt);
      float fade = smoothstep(0.0, 0.3, tt) * smoothstep(1.0, 0.7, tt);
      col += fade * tt * hxLayer(guv * z, hxN(i + id)) * hxCol(id, duv);
    }
  }
  col *= brightness;

  if (ro.y < 0.0) col = 1.0 - col;

  col *= smoothstep(fadeDistance, fadeDistance * 0.28, dp);
  col *= 1.0 - duv * 2.0;
  col *= tint;

  return vec4(clamp(col, 0.0, 1.0), 1.0);
}
