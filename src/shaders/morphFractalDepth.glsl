// NAME: Morph Fractal Depth
uniform float speed; // @min -10.0 @max 10.0 @default 1.0
uniform float iterations; // @min 2.0 @max 12.0 @default 7.0
uniform float fold; // @min 0.5 @max 2.0 @default 1.1
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 fractalColor; // @default 0.3,1.0,0.7
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = (uv - 0.5) * 2.5;
float t = time * speed * 0.3;
// il punto di ripiegatura si sposta con la luminanza: il frattale segue l'asset
vec2 c = vec2(0.6 + 0.2 * sin(t), 0.5 + 0.2 * cos(t * 0.8)) + lum * morphDepth * 0.05;
float acc = 0.0;
float amp = 1.0;
for (int i = 0; i < 12; i++) {
  if (float(i) >= iterations) break;
  p = abs(p) - c;
  p *= fold;
  p = mat2(0.8, -0.6, 0.6, 0.8) * p;
  acc += amp * exp(-14.0 * abs(p.x * p.y));
  amp *= 0.7;
}
vec3 psyColor = 0.5 + 0.5 * cos(t + acc * colorFreq * 2.0 + lum * 3.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= fractalColor;
vec3 fx = psyColor * clamp(acc, 0.0, 1.2) * 0.55 + psyColor * 0.1;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
