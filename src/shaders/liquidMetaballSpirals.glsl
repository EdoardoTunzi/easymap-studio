// NAME: Liquid Metaball Spirals
uniform float speed; // @min -10.0 @max 10.0 @default 3.0
uniform float balls; // @min 1.0 @max 6.0 @default 4.0
uniform float radius; // @min 0.05 @max 0.6 @default 0.25
uniform float spiralTwist; // @min 0.0 @max 30.0 @default 10.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 3.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 blobColor; // @default 1.0,0.4,0.9
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
// metaball orbitanti: campo di potenziale sommato
float field = 0.0;
for (int i = 0; i < 6; i++) {
if (float(i) >= balls) break;
float fi = float(i);
float ang = time * speed * (0.3 + fi * 0.1) + fi * 2.399;
vec2 c = vec2(cos(ang), sin(ang * 1.3)) * 0.28;
field += radius * radius / (dot(p - c, p - c) + 0.001);
}
field += lum * morphDepth * 0.4;
// spirale liquida dentro il campo
float a = atan(p.y, p.x);
float r = length(p);
float spiral = sin(a * 3.0 + field * spiralTwist - time * speed);
vec3 psyColor = 0.5 + 0.5 * cos(time * 1.8 + field * colorFreq + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= blobColor;
float edge = smoothstep(0.8, 1.6, field);
vec3 fx = psyColor * (spiral * 0.5 + 0.5) * edge * (1.0 + exp(-r * 3.0));
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
