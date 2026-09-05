// NAME: Torus Field
uniform float speed; // @min -10.0 @max 10.0 @default 2.0
uniform float radius; // @min 0.05 @max 0.6 @default 0.25
uniform float tube; // @min 2.0 @max 40.0 @default 14.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.5
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 torusColor; // @default 0.4,1.0,0.9
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
float r = length(p);
float a = atan(p.y, p.x);
// distanza dall'anello: il raggio del toro respira con la luminanza
float rr = radius * (1.0 + lum * morphDepth * 0.15);
float d = abs(r - rr);
float ring = fract(d * tube - time * speed * 0.2 + a * 0.5);
float shape = pow(1.0 - abs(ring * 2.0 - 1.0), 3.0);
float body = exp(-d * 8.0);
vec3 psyColor = 0.5 + 0.5 * cos(time * 0.6 + d * colorFreq * 10.0 + a * 2.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= torusColor;
vec3 fx = psyColor * shape * (0.3 + body) + psyColor * 0.12;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
