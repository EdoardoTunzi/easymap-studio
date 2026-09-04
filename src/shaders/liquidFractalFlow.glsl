// NAME: Fractal Flow
uniform float speed; // @min -10.0 @max 10.0 @default 2.0
uniform float iterations; // @min 1.0 @max 6.0 @default 4.0
uniform float foldScale; // @min 1.1 @max 3.0 @default 1.7
uniform float flowAmount; // @min 0.0 @max 3.0 @default 1.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 flowColor; // @default 0.5,0.7,1.0
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = (uv - 0.5) * 2.0;
float t = time * speed * 0.3;
// fold frattale kali-style con deriva liquida a ogni iterazione
float acc = 0.0;
float amp = 1.0;
for (int i = 0; i < 6; i++) {
if (float(i) >= iterations) break;
p = abs(p) / dot(p, p) - foldScale * 0.5;
p += vec2(sin(t + float(i)), cos(t * 0.8 - float(i))) * 0.1 * flowAmount;
acc += length(p) * amp;
amp *= 0.6;
}
acc += lum * morphDepth * 0.4;
float field = sin(acc * 3.0 - time * speed);
vec3 psyColor = 0.5 + 0.5 * cos(acc * colorFreq + t + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= flowColor;
vec3 fx = psyColor * (field * 0.5 + 0.5) * (0.6 + acc * 0.25);
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
