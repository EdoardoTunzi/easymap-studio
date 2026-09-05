// NAME: Morph Ribbons
uniform float speed; // @min -10.0 @max 10.0 @default 3.0
uniform float ribbons; // @min 1.0 @max 30.0 @default 10.0
uniform float flow; // @min 0.0 @max 8.0 @default 3.0
uniform float wobble; // @min 0.0 @max 4.0 @default 1.5
uniform float colorFreq; // @min 0.1 @max 10.0 @default 3.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 ribbonColor; // @default 1.0,1.0,1.0
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
// nastri liquidi: onde sinusoidali deformate dalla luminanza del contenuto
float band = p.y * ribbons + sin(p.x * 6.0 + time * speed) * wobble;
band += sin(p.x * 13.0 - time * speed * 0.7) * wobble * 0.4;
band += lum * morphDepth;
float ribbon = sin(band * 3.14159 + time * speed * flow * 0.2);
vec3 psyColor = 0.5 + 0.5 * cos(time * 1.5 + band * colorFreq + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= ribbonColor;
float glow = smoothstep(0.2, 1.0, abs(ribbon));
vec3 fx = psyColor * (ribbon * 0.5 + 0.5) * (1.0 + glow * 0.8);
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
