// NAME: Liquid Silk Waves
uniform float speed; // @min -10.0 @max 10.0 @default 2.0
uniform float layers; // @min 1.0 @max 8.0 @default 4.0
uniform float stretch; // @min 0.5 @max 10.0 @default 4.0
uniform float shimmer; // @min 0.0 @max 4.0 @default 1.2
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 2.5
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 silkColor; // @default 0.9,0.8,1.0
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
// seta liquida: strati di onde sovrapposte che scorrono a velocità diverse
float wave = 0.0;
for (int i = 0; i < 8; i++) {
if (float(i) >= layers) break;
float fi = float(i) + 1.0;
wave += sin(p.x * stretch * fi + p.y * (3.0 + fi) + time * speed * (0.4 + fi * 0.15)) / fi;
}
wave += lum * morphDepth * 0.5;
float sheen = sin(wave * 3.14159 * 2.0 + p.y * 6.0);
vec3 psyColor = 0.5 + 0.5 * cos(time + wave * colorFreq + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= silkColor;
float gloss = pow(abs(sheen), 3.0) * shimmer;
vec3 fx = psyColor * (sheen * 0.5 + 0.5) + vec3(gloss * 0.4);
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
