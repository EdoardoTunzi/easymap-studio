// NAME: Eye
uniform float speed; // @min 0.0 @max 3.0 @default 0.6
uniform float irisDetail; // @min 4.0 @max 60.0 @default 24.0
uniform float pupilSize; // @min 0.02 @max 0.3 @default 0.1
uniform float dilate; // @min 0.0 @max 1.0 @default 0.3
uniform vec3 irisColor; // @default 0.1,0.9,0.6
uniform vec3 glowColor; // @default 1.0,0.3,0.0

float hash1(float x) { return fract(sin(x * 127.1) * 43758.5453); }

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = uv - 0.5;
  float r = length(p);
  float a = atan(p.y, p.x);
  float t = time * speed;
  // la pupilla respira: dilatazione lenta e continua
  float pupil = pupilSize * (1.0 + dilate * sin(t * 1.7));
  // fibre radiali dell'iride, con lunghezza pseudo-casuale
  float fib = floor((a / 6.28318 + 0.5) * irisDetail);
  float fibLen = 0.18 + 0.22 * hash1(fib);
  float fibShape = 0.5 + 0.5 * sin((a + t * 0.2) * irisDetail);
  float iris = smoothstep(pupil, pupil + 0.02, r) * smoothstep(pupil + fibLen, pupil, r);
  vec3 col = irisColor * iris * (0.4 + 0.6 * fibShape);
  // alone esterno e nero della pupilla
  col += glowColor * smoothstep(pupil + fibLen * 1.2, pupil + fibLen * 0.6, r) * 0.35;
  col *= smoothstep(pupil * 0.8, pupil * 1.05, r);
  col *= smoothstep(0.5, 0.32, r);
  return vec4(col, 1.0);
}
