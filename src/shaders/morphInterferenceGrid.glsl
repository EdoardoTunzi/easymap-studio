// NAME: Interference Grid
uniform float speed; // @min -10.0 @max 10.0 @default 2.0
uniform float frequency; // @min 2.0 @max 60.0 @default 20.0
uniform float angle; // @min 0.0 @max 3.14 @default 0.6
uniform float contrast; // @min 0.5 @max 8.0 @default 2.5
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 moireColor; // @default 1.0,0.4,0.9
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
float t = time * speed * 0.3;
// due reticoli ruotati che si sovrappongono: il moire nasce dalla differenza,
// e la luminanza sfasa il secondo reticolo creando il rilievo
float g1 = sin(p.x * frequency + t);
float c = cos(angle), s = sin(angle);
vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
float g2 = sin(q.x * frequency + lum * morphDepth * 3.0 - t);
float moire = pow(abs(g1 * g2), 1.0 / contrast);
vec3 psyColor = 0.5 + 0.5 * cos(t + moire * colorFreq * 4.0 + lum * 3.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= moireColor;
vec3 fx = psyColor * moire + psyColor * 0.12;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
