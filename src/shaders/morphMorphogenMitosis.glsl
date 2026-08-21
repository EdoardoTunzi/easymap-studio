// NAME: Morph Morphogen Mitosis
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float density; // @min 2.0 @max 24.0 @default 7.0
uniform float divide; // @min 0.0 @max 1.0 @default 0.75
uniform float edgeWidth; // @min 0.01 @max 0.4 @default 0.055
uniform float wobble; // @min 0.0 @max 1.0 @default 0.5
uniform float nucleus; // @min 0.0 @max 1.0 @default 0.5
uniform float sourceInfluence; // @min 0.0 @max 1.0 @default 0.6
uniform float blendAmount; // @min 0.0 @max 1.0 @default 1.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 membraneColor; // @default 0.65,1.0,0.95
uniform vec3 cytoplasmColor; // @default 0.05,0.22,0.5

vec2 mgHash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  float t = time * speed;

  // uQuadAspect (wrapper): tiene le cellule tonde anche su un mapping largo, dove altrimenti
  // sarebbero ellissi schiacciate e la divisione perderebbe leggibilita'.
  float aspect = max(uQuadAspect, 0.05);
  vec2 p = uv - 0.5;
  p.x *= aspect;
  // come negli altri Morph, il rilievo infittisce il tessuto: colonie piu' dense sul chiaro
  vec2 pp = p * density * (1.0 + lum * 1.1 * sourceInfluence);
  vec2 g = floor(pp);
  vec2 f = fract(pp);

  // Due nuclei per cella invece di uno. Quando si separano, il bordo di Voronoi che nasce fra
  // loro attraversa la cella e la taglia in due: e' la strozzatura della mitosi, ottenuta dalla
  // geometria e non da un'animazione disegnata a mano.
  float f1 = 8.0;
  float f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 h = mgHash2(g + o);
      // fase sfasata cella per cella: la colonia non si divide tutta insieme a tempo
      float ph = fract(t * 0.18 + h.x);
      // 0 -> max -> 0: le due meta' si separano e tornano a fondersi, ciclicamente. Senza un
      // buffer di stato le figlie non possono diventare celle autonome, quindi la colonia
      // alterna divisione e fusione invece di raddoppiare all'infinito.
      float sep = divide * 0.30 * (1.0 - cos(ph * 6.28318)) * 0.5;
      float ang = h.y * 6.28318 + t * 0.12;
      vec2 dir = vec2(cos(ang), sin(ang));
      // l'escursione totale (wobble + sep) resta sotto mezza cella: oltre, il nucleo uscirebbe
      // dal vicinato 3x3 esaminato qui e i bordi si spezzerebbero
      vec2 c = o + 0.5 + wobble * 0.18 * sin(t * 0.6 + 6.28318 * h) - f;
      // Il secondo nucleo entra in gioco solo quando la separazione e' iniziata davvero:
      // con i due nuclei coincidenti le due distanze sarebbero uguali, f2 - f1 varrebbe zero
      // su TUTTA la cella e la cella si riempirebbe di membrana invece di restare intera.
      float split = smoothstep(0.015, 0.07, sep);
      float d1 = length(c + dir * sep);
      float d2 = length(c - dir * sep) + (1.0 - split) * 2.0;
      float dmin = min(d1, d2);
      float dmax = max(d1, d2);
      if (dmin < f1) {
        f2 = min(f1, dmax);
        f1 = dmin;
      } else if (dmin < f2) {
        f2 = dmin;
      } else if (dmax < f2) {
        f2 = dmax;
      }
    }
  }

  // la differenza fra il nucleo piu' vicino e il secondo vale zero esattamente a meta' strada
  // fra due nuclei: e' li' che sta la membrana, di spessore uniforme su tutta la colonia
  float border = f2 - f1;
  float mem = 1.0 - smoothstep(0.0, edgeWidth, border);
  // il citoplasma si schiarisce verso il centro della cella: senza, il tessuto e' una tinta
  // piatta interrotta da linee, e le cellule non si leggono come corpi
  float inner = smoothstep(0.0, 0.42, border);
  float nuc = 1.0 - smoothstep(0.0, 0.13, f1);

  vec3 col = cytoplasmColor * (0.22 + 1.05 * inner);
  col += membraneColor * mem * 1.05;
  col += membraneColor * nuc * nucleus * 0.45;
  col *= mix(1.0, 0.35 + lum * 1.5, sourceInfluence);

  float dark = step(length(source.rgb), blackThreshold);
  float cover = blendAmount * (1.0 - dark * sourceInfluence);
  return vec4(mix(source.rgb, col, cover), 1.0);
}
