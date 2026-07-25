// NAME: Liquid Orbit Petals
uniform float speed; // @min -10.0 @max 10.0 @default 3.0
uniform float petals; // @min 2.0 @max 16.0 @default 6.0
uniform float orbit; // @min 0.0 @max 2.0 @default 0.6
uniform float softness; // @min 0.5 @max 6.0 @default 2.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 3.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 petalColor; // @default 1.0,0.5,0.7
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
float t = time * speed;
float r = length(p);
float a = atan(p.y, p.x);
// petali liquidi che orbitano: raggio modulato dall'angolo, deformato dal contenuto
float petal = cos(a * petals + sin(t * 0.7) * 2.0 + r * 8.0 * orbit - t);
float bloom = r - 0.25 - petal * 0.1 - lum * morphDepth * 0.05;
float shape = 1.0 - smoothstep(0.0, 0.15 * softness, abs(bloom));
vec3 psyColor = 0.5 + 0.5 * cos(t * 1.2 + a * 2.0 + r * colorFreq * 4.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= petalColor;
float core = exp(-r * 5.0) * 1.5;
vec3 fx = psyColor * (shape + core) * (petal * 0.3 + 0.7);
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
