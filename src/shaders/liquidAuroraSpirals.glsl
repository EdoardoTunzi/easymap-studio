// NAME: Liquid Aurora Spirals
uniform float speed; // @min -10.0 @max 10.0 @default 2.5
uniform float bands; // @min 1.0 @max 20.0 @default 7.0
uniform float curl; // @min 0.0 @max 20.0 @default 8.0
uniform float drift; // @min 0.0 @max 4.0 @default 1.2
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 auroraColor; // @default 0.3,1.0,0.7
uniform vec3 skyColor; // @default 0.2,0.3,0.9
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
float t = time * speed;
float r = length(p);
float a = atan(p.y, p.x);
// aurora a spirale: bande ondulate che si avvolgono e derivano lentamente
float s = a + r * curl * 0.5 + sin(r * 6.0 - t * 0.7) * drift;
float band = sin(s * bands * 0.5 + t) * 0.5 + 0.5;
band = pow(band, 2.0);
float wave = sin(s * 2.0 - t * 0.5 + lum * morphDepth);
vec3 psyColor = mix(skyColor, auroraColor, band);
psyColor *= 0.6 + 0.4 * cos(t * 0.6 + s * colorFreq + vec3(0.0, 0.33, 0.67) * 6.28318);
float veil = smoothstep(0.6, 0.0, r) + 0.3;
vec3 fx = psyColor * (band + wave * 0.2) * veil * 1.4;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
