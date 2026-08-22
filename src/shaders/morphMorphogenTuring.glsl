// NAME: Morph Morphogen Turing
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float scale; // @min 2.0 @max 40.0 @default 9.0
uniform float pattern; // @min 0.0 @max 1.0 @default 0.5
uniform float sharpness; // @min 0.0 @max 1.0 @default 0.7
uniform float organic; // @min 0.0 @max 2.0 @default 0.8
uniform float membrane; // @min 0.0 @max 1.0 @default 0.5
uniform float sourceInfluence; // @min 0.0 @max 1.0 @default 0.6
uniform float blendAmount; // @min 0.0 @max 1.0 @default 1.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 pigment; // @default 0.15,1.0,0.75
uniform vec3 substrate; // @default 0.22,0.0,0.42

float mgHash(vec2 p) {
  p = fract(p * vec2(127.61, 311.19));
  p += dot(p, p + 47.31);
  return fract(p.x * p.y);
}

float mgNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = mgHash(i);
  float b = mgHash(i + vec2(1.0, 0.0));
  float c = mgHash(i + vec2(0.0, 1.0));
  float d = mgHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/**
 * Campo a banda stretta: dodici onde piane con la STESSA lunghezza d'onda, direzioni distribuite
 * sull'angolo aureo e fasi che scorrono a velocita' diverse.
 *
 * E' il modello matematico del pattern di Turing: la reazione-diffusione seleziona una sola
 * lunghezza d'onda e ne lascia libere direzione e fase, quindi il campo risultante ha macchie e
 * bande tutte della stessa taglia. Un fbm, che somma frequenze su piu' ottave, darebbe invece
 * chiazze di ogni dimensione — una nuvola, non un tessuto.
 *
 * Le fasi che derivano a velocita' diverse sono cio' che fa dividere e fondere le macchie nel
 * tempo, senza bisogno di iterare la simulazione su un buffer di stato (qui impossibile: la
 * pipeline e' single-pass).
 */
float mgBandField(vec2 p, float t) {
  float s = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float a = fi * 2.39996; // angolo aureo: 12 direzioni ben spaziate senza tabelle
    vec2 d = vec2(cos(a), sin(a));
    float ph = fi * 1.7 + t * (0.7 + 0.4 * sin(fi * 2.1));
    s += cos(dot(d, p) * 6.28318 + ph);
  }
  return s / 12.0;
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));
  float t = time * speed;

  // uQuadAspect (wrapper): senza correzione le macchie si stirerebbero in ellissi su un
  // mapping largo, e il pattern smetterebbe di sembrare cresciuto sull'oggetto.
  float aspect = max(uQuadAspect, 0.05);
  vec2 p = uv - 0.5;
  p.x *= aspect;
  // il rilievo infittisce la reazione: dove l'oggetto prende luce le celle sono piu' piccole
  p *= scale * (1.0 + lum * 1.2 * sourceInfluence);

  // Domain warp lento: dodici onde piane pure darebbero una trama quasi cristallina, con
  // allineamenti visibili. Il warp la piega e le toglie ogni regolarita' residua.
  vec2 w = vec2(
    mgNoise(p * 0.35 + vec2(t * 0.11, 0.0)),
    mgNoise(p * 0.35 + vec2(17.3, 4.1) - vec2(0.0, t * 0.09))
  ) - 0.5;
  p += w * organic * 1.3;

  float field = mgBandField(p, t * 0.35);

  // La soglia decide la frazione di superficie coperta, ed e' la frazione a scegliere la forma:
  // poca -> isole separate (macchie), meta' esatta -> bande connesse (labirinti).
  float level = mix(0.20, 0.0, pattern) - lum * 0.06 * sourceInfluence;
  float shape = field - level;

  float edgeW = mix(0.10, 0.006, sharpness);
  float body = smoothstep(-edgeW, edgeW, shape);
  float rim = 1.0 - smoothstep(0.0, edgeW * 2.6, abs(shape));
  // interno piu' acceso del bordo: da' volume alla macchia invece di lasciarla piatta
  float core = smoothstep(0.0, 0.14, shape);

  vec3 col = mix(substrate, pigment, body);
  col *= 0.72 + 0.5 * core;
  col += pigment * rim * membrane * 1.7;

  // A sourceInfluence 0 il pattern copre tutta la sagoma; salendo, le zone sotto soglia
  // dell'immagine restano scoperte come negli altri effetti source-driven.
  float dark = step(length(source.rgb), blackThreshold);
  float cover = blendAmount * (1.0 - dark * sourceInfluence);
  return vec4(mix(source.rgb, col, cover), 1.0);
}
