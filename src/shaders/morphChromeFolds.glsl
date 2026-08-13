// NAME: Morph Chrome Folds
uniform float speed; // @min -10.0 @max 10.0 @default 1.0
uniform float folds; // @min 1.0 @max 20.0 @default 6.0
uniform float shine; // @min 0.5 @max 10.0 @default 4.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 1.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 chromeColor; // @default 0.7,0.8,1.0
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = (uv - 0.5) * 2.0;
float t = time * speed * 0.4;
// campo di altezza piegato: la luminanza alza le pieghe
float h = sin(p.x * folds + t) * cos(p.y * folds - t * 0.7) + lum * morphDepth * 0.5;
// derivate del campo -> normale -> riflesso metallico
float e = 0.02;
float hx = sin((p.x + e) * folds + t) * cos(p.y * folds - t * 0.7) - h + lum * morphDepth * 0.5;
float hy = sin(p.x * folds + t) * cos((p.y + e) * folds - t * 0.7) - h + lum * morphDepth * 0.5;
vec3 n = normalize(vec3(-hx, -hy, 0.15));
vec3 l = normalize(vec3(sin(t), cos(t * 0.8), 0.9));
float spec = pow(max(dot(n, l), 0.0), shine * 6.0);
float diff = 0.35 + 0.65 * max(dot(n, l), 0.0);
vec3 psyColor = 0.5 + 0.5 * cos(t + h * colorFreq * 3.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= chromeColor;
vec3 fx = psyColor * diff + vec3(spec);
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
