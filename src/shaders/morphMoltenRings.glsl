// NAME: Morph Molten Rings
uniform float speed; // @min -10.0 @max 10.0 @default 1.5
uniform float rings; // @min 1.0 @max 30.0 @default 8.0
uniform float wobble; // @min 0.0 @max 4.0 @default 1.5
uniform float heat; // @min 0.5 @max 6.0 @default 2.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 moltenColor; // @default 1.0,0.4,0.05
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
float a = atan(p.y, p.x);
float t = time * speed * 0.4;
// anelli deformati da un'ondulazione angolare e sollevati dalla luminanza
float r = length(p) * (1.0 + sin(a * 5.0 + t) * 0.08 * wobble) + lum * morphDepth * 0.08;
float band = fract(r * rings - t * 0.5);
float ring = pow(1.0 - abs(band * 2.0 - 1.0), 1.5);
// bordo incandescente
float glowEdge = pow(ring, heat * 2.0);
vec3 psyColor = 0.5 + 0.5 * cos(t + r * colorFreq * 8.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= moltenColor;
vec3 fx = psyColor * ring * 0.8 + vec3(1.0, 0.85, 0.5) * glowEdge * 0.5;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
