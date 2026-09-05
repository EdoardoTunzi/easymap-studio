// NAME: Ribbon Assault
// David Hoskins (Shadertoy MdBGDK), licenza CC BY-NC-SA 3.0: uso non commerciale, attribuzione
// richiesta. iMouse non disponibile nel motore: usato sempre il moto Lissajous sintetico che
// l'originale già prevedeva per quando il mouse non è premuto.
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float morphDepth; // @min 0.0 @max 10.0 @default 3.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform float iterations; // @min 4.0 @max 30.0 @default 20.0
uniform float ribbonScale; // @min 1.0 @max 8.0 @default 3.5
uniform float veilScale; // @min 2.0 @max 16.0 @default 8.0
uniform float zoom; // @min 0.3 @max 3.0 @default 1.0
uniform vec3 tint; // @default 1.0,1.0,1.0

vec4 processColor(sampler2D tex, vec2 uv, float rawTime, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  if (length(source.rgb) > blackThreshold) {
    float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
    float t = rawTime * speed;

    vec2 u = (uv - 0.5) * 2.0;
    u.x *= resolution.x / resolution.y;
    u /= zoom;

    // moto sintetico dell'attrattore (equivalente del ramo "mouse non premuto" dell'originale)
    vec2 lissajous = vec2(
      sin(t * 0.3) * sin(t * 0.17) + sin(t * 0.3),
      (1.0 - cos(t * 0.632)) * sin(t * 0.131) + cos(t * 0.3)
    );
    vec2 p = lissajous * vec2(resolution.x / resolution.y, 1.0);
    // la luminanza della sorgente sposta l'attrattore: il pattern si deforma seguendo l'immagine
    p += (lum - 0.5) * morphDepth * 0.03;

    float f = 3.0;
    float g = 3.0;
    int iters = int(iterations);
    for (int i = 0; i < 30; i++) {
      if (i >= iters) break;
      float d = dot(u, u);
      u = vec2(u.x, -u.y) / max(d, 1e-6) + p;
      u.x = abs(u.x);
      f = max(f, dot(u - p, u - p));
      g = min(g, sin(dot(u + p, u + p)) + 1.0);
    }
    f = abs(-log(max(f, 1e-6)) / ribbonScale);
    g = abs(-log(max(g, 1e-6)) / veilScale);

    vec3 fx = min(vec3(g, g * f, f), 1.0) * tint;
    source.rgb = mix(source.rgb, fx + source.rgb * fx, 0.85);
  }
  return source;
}
