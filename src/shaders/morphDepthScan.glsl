// NAME: Morph Depth Scan
uniform float speed; // @min -10.0 @max 10.0 @default 1.5
uniform float scanWidth; // @min 0.01 @max 0.5 @default 0.08
uniform float layers; // @min 1.0 @max 12.0 @default 4.0
uniform float gridFreq; // @min 0.0 @max 60.0 @default 24.0
uniform float colorFreq; // @min 0.1 @max 10.0 @default 2.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 scanColor; // @default 0.2,1.0,0.8
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
vec4 source = texture2D(tex, uv);
if (length(source.rgb) > blackThreshold) {
float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
float t = time * speed * 0.2;
// la luminanza e' letta come quota: il piano di scansione la attraversa e la rivela
float depth = lum * morphDepth * 0.2;
float acc = 0.0;
for (int i = 0; i < 12; i++) {
  if (float(i) >= layers) break;
  float plane = fract(t + float(i) / max(layers, 1.0));
  acc += smoothstep(scanWidth, 0.0, abs(depth - plane));
}
// reticolo che compare solo dove il piano illumina: lettura tipo lidar
float grid = max(abs(sin(uv.x * gridFreq * 3.14159)), abs(sin(uv.y * gridFreq * 3.14159)));
grid = pow(grid, 8.0);
vec3 psyColor = 0.5 + 0.5 * cos(t * 3.0 + depth * colorFreq * 8.0 + vec3(0.0, 0.33, 0.67) * 6.28318);
psyColor *= scanColor;
vec3 fx = psyColor * acc * (0.5 + 0.5 * grid) + psyColor * depth * 0.5;
source.rgb = mix(source.rgb, fx + source.rgb * psyColor, 0.85);
}
return source;
}
