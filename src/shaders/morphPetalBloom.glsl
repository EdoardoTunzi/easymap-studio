// NAME: Petal Bloom
uniform float speed; // @min -10.0 @max 10.0 @default 1.0
uniform float petals; // @min 3.0 @max 24.0 @default 8.0
uniform float bloom; // @min 0.1 @max 1.5 @default 0.6
uniform float softness; // @min 0.5 @max 8.0 @default 2.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 petalColor; // @default 1.0,0.3,0.7
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
float r = length(p);
float a = atan(p.y, p.x) + time * speed * 0.1;
// rosa polare: l'apertura dei petali cresce col rilievo dell'asset
float open = bloom * (1.0 + lum * morphDepth * 0.15);
float petal = abs(cos(a * petals * 0.5)) * open * 0.5;
float shape = pow(smoothstep(petal, petal * 0.2, r), softness);
float rim = pow(1.0 - abs(r - petal) * 8.0, 4.0);
vec3 psyColor = 0.5 + 0.5 * cos(time * 0.5 + r * colorFreq * 8.0 + a * 2.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= petalColor;
vec3 fx = psyColor * shape + psyColor * max(rim, 0.0) * 0.8;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
