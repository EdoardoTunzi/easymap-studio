// NAME: Morph Morphogen Growth
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float scale; // @min 0.3 @max 3.0 @default 1.0
uniform float pattern; // @min 0.0 @max 1.0 @default 0.5
uniform float growTime; // @min 2.0 @max 90.0 @default 32.0
uniform float seeds; // @min 1.0 @max 5.0 @default 1.0 @step 1 @options 1|2|3|4|5
uniform float posX; // @min -0.5 @max 0.5 @default 0.0
uniform float posY; // @min -0.5 @max 0.5 @default 0.0
uniform float lifecycle; // @min 0.0 @max 2.0 @default 0.0 @step 1 @options Matura|Ciclo|Manuale
uniform float cycleTime; // @min 5.0 @max 120.0 @default 30.0
uniform float restart; // @min 0.0 @max 1.0 @default 0.0 @step 1
uniform float symmetry; // @min 0.0 @max 1.0 @default 1.0 @step 1
uniform float sharpness; // @min 0.0 @max 1.0 @default 0.7
uniform float glow; // @min 0.0 @max 1.0 @default 0.5
uniform float sourceInfluence; // @min 0.0 @max 1.0 @default 0.5
uniform float blendAmount; // @min 0.0 @max 1.0 @default 1.0
uniform float blackThreshold; // @min 0.0 @max 1.73 @default 0.05
uniform vec3 pigment; // @default 0.72,0.94,1.0
uniform vec3 substrate; // @default 0.02,0.04,0.09

/** Raggio del seme sulla griglia: piu' piccolo e la reazione si spegne prima di attecchire. */
const float SEED_RADIUS = 0.035;
/** Soglia con cui la concentrazione del secondo morfogeno diventa "materia" da disegnare. */
const float LEVEL = 0.15;

//! SIMULATION

/**
 * Un passo di Gray-Scott.
 *
 *   dA = Da*lap(A) - A*B^2 + F*(1-A)
 *   dB = Db*lap(B) + A*B^2 - (F+k)*B
 *
 * A si consuma dove B e' presente e viene rifornito a tasso F; B si autocatalizza mangiando A e
 * decade a tasso F+k. Da questa sola coppia di equazioni nascono tutti i pattern: e' la coppia
 * (F, k) a decidere quale, e cambiandola nel tempo si passa da un regime all'altro senza tagli.
 *
 * I coefficienti di diffusione (1.0 e 0.5) e il passo dt = 1 sono la taratura classica per il
 * laplaciano 3x3 con pesi 0.05/0.2: B diffonde a meta' velocita' di A, ed e' proprio questa
 * differenza che rompe l'uniformita' e fa comparire la struttura.
 */
vec4 simulate(sampler2D state, vec2 uv, vec2 texel, float phase) {
  if (uInit > 0.5) {
    // condizione iniziale: substrato pieno ovunque, reagente solo nei semi
    return vec4(1.0, easyvj_seedMask(uv, SEED_RADIUS), 0.0, 1.0);
  }

  vec4 s = texture2D(state, uv);
  float a = s.r;
  float b = s.g;
  vec4 lap = easyvj_lap(state, uv, texel);

  // I tre regimi, in coordinate (feed, kill). Sono punti noti della mappa di Gray-Scott:
  //  - coral: il fronte avanza dal seme e riempie lo spazio di rami, senza mai richiudersi
  //  - mitosis: ogni macchia cresce, si strozza e si divide in due, all'infinito
  //  - maze: il labirinto di Turing, che si assesta e resta
  // I due estremi maturi sono scelti apposta diversi FRA LORO: due regimi a macchie darebbero
  // lo stesso quadro a ogni posizione dello slider.
  vec2 coral = vec2(0.0545, 0.0620);
  vec2 mitosis = vec2(0.0367, 0.0649);
  vec2 maze = vec2(0.0290, 0.0570);
  // la transizione e' larga apposta: cambiare (F,k) di colpo fa collassare le strutture gia'
  // formate invece di lasciarle evolvere nel nuovo regime
  float mature = smoothstep(growTime * 0.75, growTime * 1.3, phase);
  vec2 fk = mix(coral, mix(mitosis, maze, pattern), mature);
  float f = fk.x;
  float k = fk.y;

  if (sourceInfluence > 0.001) {
    vec2 src = easyvj_sourceUv(uv, scale);
    // fuori dall'immagine i parametri restano quelli di base: la griglia e' toroidale e sborda
    // dal media, e li' un regime diverso si vedrebbe come una cucitura netta
    float inside = step(0.0, src.x) * step(src.x, 1.0) * step(0.0, src.y) * step(src.y, 1.0);
    vec4 media = texture2D(uTexture, clamp(src, 0.0, 1.0));
    float lum = dot(media.rgb, vec3(0.299, 0.587, 0.114)) * media.a * inside;
    // scostamenti minuscoli: la mappa di Gray-Scott e' ripidissima, un millesimo su k basta a
    // spostare il regime. Sulle zone illuminate la reazione e' piu' viva e le strutture piu' fitte.
    k += (lum - 0.35) * 0.0075 * sourceInfluence;
    f += (lum - 0.35) * 0.0030 * sourceInfluence;
  }

  float reaction = a * b * b;
  float na = a + (lap.r - reaction + f * (1.0 - a));
  float nb = b + (0.5 * lap.g + reaction - (k + f) * b);
  return vec4(clamp(na, 0.0, 1.0), clamp(nb, 0.0, 1.0), 0.0, 1.0);
}

//! DISPLAY

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  float lum = dot(source.rgb, vec3(0.299, 0.587, 0.114));

  vec2 suv = easyvj_simUv(uv, scale);
  if (symmetry > 0.5) {
    // specchio attorno al PRIMO seme, non al centro del quad: spostando il seme l'asse lo segue,
    // altrimenti la colonia crescerebbe storta rispetto alla propria simmetria
    float axis = posX * max(uQuadAspect, 0.05) / max(scale, 0.01) + 0.5;
    suv.x = axis + abs(suv.x - axis);
  }
  float b = texture2D(uSimState, suv).g;

  float w = mix(0.10, 0.008, sharpness);
  float body = smoothstep(LEVEL - w, LEVEL + w, b);
  float rim = 1.0 - smoothstep(0.0, w * 2.5, abs(b - LEVEL));
  // alone: la coda di concentrazione attorno alla struttura, che nella reazione vera c'e' davvero
  float halo = smoothstep(0.015, LEVEL, b);

  vec3 col = mix(substrate, pigment, body);
  col += pigment * rim * 0.55;
  col += pigment * halo * glow * 0.30;
  col *= mix(1.0, 0.4 + lum * 1.4, sourceInfluence);

  float dark = step(length(source.rgb), blackThreshold);
  float cover = blendAmount * (1.0 - dark * sourceInfluence);
  return vec4(mix(source.rgb, col, cover), 1.0);
}
