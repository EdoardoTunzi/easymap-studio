// NAME: Electric Contours
uniform float speed; // @min -10.0 @max 10.0 @default 1.5
uniform float levels; // @min 2.0 @max 40.0 @default 14.0
uniform float lineWidth; // @min 0.5 @max 8.0 @default 3.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 3.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 lineColor; // @default 0.3,1.0,0.4
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
// isoipse della luminanza: le curve di livello seguono le forme dell'asset
float h = lum * morphDepth + time * speed * 0.1;
float band = fract(h * levels);
float contour = pow(1.0 - abs(band * 2.0 - 1.0), lineWidth);
vec3 psyColor = 0.5 + 0.5 * cos(time * 0.6 + h * colorFreq * 3.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= lineColor;
vec3 fx = psyColor * contour * 1.4 + psyColor * 0.1;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
