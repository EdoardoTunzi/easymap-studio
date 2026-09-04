// NAME: Concentric Waves
uniform float speed; // @min -10.0 @max 10.0 @default 2.0
uniform float rings; // @min 1.0 @max 40.0 @default 12.0
uniform float sharpness; // @min 0.5 @max 8.0 @default 2.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 waveColor; // @default 0.2,0.9,1.0
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
// il raggio viene spinto in fuori dalle zone chiare: l'asset diventa un rilievo
float r = length(p) + lum * morphDepth * 0.1;
float w = fract(r * rings - time * speed * 0.2);
float ring = pow(1.0 - abs(w * 2.0 - 1.0), sharpness);
vec3 psyColor = 0.5 + 0.5 * cos(time * 0.8 + r * colorFreq * 6.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= waveColor;
vec3 fx = psyColor * ring + psyColor * 0.12;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
