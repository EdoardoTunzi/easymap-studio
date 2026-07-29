// NAME: Morph Spiral Galaxy
uniform float speed; // @min -10.0 @max 10.0 @default 1.5
uniform float arms; // @min 1.0 @max 12.0 @default 3.0
uniform float twist; // @min 0.0 @max 20.0 @default 6.0
uniform float coreGlow; // @min 0.0 @max 4.0 @default 1.5
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 galaxyColor; // @default 0.6,0.7,1.0
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
vec2 p = uv - 0.5;
float r = max(length(p), 1e-4);
float a = atan(p.y, p.x);
// bracci logaritmici, con la luminanza che li avvolge piu' o meno stretti
float sp = a * arms + log(r + 0.05) * (twist + lum * morphDepth) - time * speed * 0.5;
float arm = pow(0.5 + 0.5 * sin(sp), 2.0);
float core = exp(-r * 8.0) * coreGlow;
float disc = exp(-r * 2.0);
vec3 psyColor = 0.5 + 0.5 * cos(time * 0.4 + sp * colorFreq * 0.3 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= galaxyColor;
vec3 fx = psyColor * (arm * disc + core);
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
