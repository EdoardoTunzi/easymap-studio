// NAME: 3D Surface Morph Spirals
uniform float twists; // @min 1.0 @max 50.0 @default 15.0
uniform float speed; // @min -10.0 @max 10.0 @default 5.0
uniform float arms; // @min 1.0 @max 10.0 @default 4.0
uniform float posX; // @min -0.5 @max 0.5 @default 0.0
uniform float posY; // @min -0.5 @max 0.5 @default 0.0
uniform float spiralDist; // @min 0.0 @max 1.0 @default 0.25
uniform float colorShift; // @min 0.0 @max 6.28 @default 0.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 3.0
uniform vec3 spiralColor; // @default 1.0,1.0,1.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
float mirrorX = abs(uv.x - 0.5 - posX) - spiralDist;
vec2 delta = vec2(mirrorX, uv.y - 0.5 - posY);
float r = length(delta);
float a = atan(delta.y, delta.x);
float z = 0.2 / (r + 0.02) + lum * morphDepth;
float spiral = sin(a * arms + z * twists - time * speed);
vec3 psyColor = 0.5 + 0.5 * cos(time * 2.0 + z * colorFreq - a * 2.0 + vec3(0.0, 0.33, 0.67) * 6.28318 + colorShift);
psyColor *= spiralColor;
float glow = exp(-r * 4.0) * 2.0;
vec3 fx = psyColor * (spiral * 0.5 + 0.5) * (1.0 + glow);
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}