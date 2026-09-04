// NAME: Plasma Veins
uniform float speed; // @min -10.0 @max 10.0 @default 2.5
uniform float density; // @min 1.0 @max 20.0 @default 7.0
uniform float veinSharp; // @min 0.5 @max 8.0 @default 3.0
uniform float pulse; // @min 0.0 @max 4.0 @default 1.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 veinColor; // @default 0.3,1.0,0.5
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = (uv - 0.5) * density;
// vene di plasma: interferenza di onde con fase deformata dalla luminanza
float t = time * speed;
float v = sin(p.x + t) + sin(p.y + t * 0.7);
v += sin(p.x + p.y + t * 0.6) + sin(length(p) * 1.5 - t);
v += lum * morphDepth;
// vene sottili: vicino allo zero del campo
float vein = 1.0 - pow(abs(sin(v * 1.5707)), veinSharp);
float beat = 1.0 + sin(t * 2.0) * 0.3 * pulse;
vec3 psyColor = 0.5 + 0.5 * cos(t * 0.8 + v * colorFreq + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= veinColor;
vec3 fx = psyColor * vein * beat + psyColor * 0.15;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
