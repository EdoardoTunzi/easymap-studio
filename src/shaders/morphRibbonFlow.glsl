// NAME: Morph Ribbon Flow
uniform float speed; // @min -10.0 @max 10.0 @default 2.0
uniform float ribbons; // @min 1.0 @max 20.0 @default 6.0
uniform float waviness; // @min 0.0 @max 4.0 @default 1.5
uniform float thickness; // @min 0.5 @max 8.0 @default 3.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 ribbonColor; // @default 1.0,0.6,0.1
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
float t = time * speed;
// i nastri scorrono in orizzontale e vengono deviati dal rilievo dell'asset
float y = uv.y + sin(uv.x * 6.28318 * waviness + t * 0.5) * 0.08 + lum * morphDepth * 0.05;
float band = fract(y * ribbons - t * 0.1);
float ribbon = pow(1.0 - abs(band * 2.0 - 1.0), thickness);
vec3 psyColor = 0.5 + 0.5 * cos(t * 0.5 + y * colorFreq * 6.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= ribbonColor;
vec3 fx = psyColor * ribbon + psyColor * 0.12;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
