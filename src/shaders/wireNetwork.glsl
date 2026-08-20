// NAME: Wire Network
// Rete di nodi collegati da segmenti, con scaglie poligonali scure che scoprono il soggetto:
// l'estetica "data sculpture" delle proiezioni su statua.
//
// La rete nasce da una griglia di celle con il nodo spostato a caso e animato (jitter): ogni
// cella collega il proprio nodo a quelli delle vicine, e questo basta a produrre la maglia
// irregolare — una vera triangolazione di Delaunay in un fragment shader costerebbe molto di più
// per una differenza che a schermo non si distingue.
//
// Costo: 3×3 celle per pixel, ciascuna con i suoi collegamenti. `diagonals` a 0 quasi dimezza
// il lavoro (e dà una maglia più rettangolare), `density` invece non cambia il costo per pixel.
uniform float density; // @min 3.0 @max 40.0 @default 22.0
uniform float speed; // @min 0.0 @max 3.0 @default 0.5
uniform float jitter; // @min 0.0 @max 1.0 @default 1.0
uniform float linkChance; // @min 0.0 @max 1.0 @default 0.72
uniform float lineWidth; // @min 0.2 @max 4.0 @default 0.7
uniform float nodeSize; // @min 0.0 @max 3.0 @default 0.9
uniform float dash; // @min 0.0 @max 1.0 @default 0.55
uniform float dashScale; // @min 4.0 @max 80.0 @default 34.0
uniform float diagonals; // @min 0.0 @max 1.0 @default 1.0
uniform float shards; // @min 0.0 @max 1.0 @default 0.45
uniform float shardDark; // @min 0.0 @max 1.0 @default 0.85
uniform float sourceAmount; // @min 0.0 @max 1.0 @default 0.6
uniform float glow; // @min 0.0 @max 2.0 @default 0.6
uniform vec3 wireColor; // @default 0.25,1.00,0.90
uniform vec3 nodeColor; // @default 0.80,1.00,1.00

vec2 wnHash2(vec2 c) {
  float a = sin(dot(c, vec2(127.1, 311.7))) * 43758.5453;
  float b = sin(dot(c, vec2(269.5, 183.3))) * 43758.5453;
  return fract(vec2(a, b));
}

float wnHash1(vec2 c) {
  return fract(sin(dot(c, vec2(41.3, 289.1))) * 24634.6345);
}

/** Nodo di una cella: posizione a caso dentro la cella, con un lento moto proprio. */
vec2 wnNode(vec2 cell, float t) {
  vec2 h = wnHash2(cell);
  float phase = 6.2831853 * (h.x + h.y);
  vec2 wobble = vec2(sin(t + phase), cos(t * 1.31 + phase)) * 0.17;
  return cell + 0.5 + ((h - 0.5) + wobble) * jitter;
}

float wnSegDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

/**
 * Contributo di un collegamento: distanza dal segmento, con il tratteggio ricavato dalla
 * posizione LUNGO il segmento (non dalle coordinate schermo, che lo farebbero scorrere via).
 */
/**
 * Un collegamento esiste solo per una parte delle coppie di nodi: senza questo ogni nodo
 * sarebbe unito a tutti i vicini e la griglia di partenza tornerebbe visibile come trama
 * regolare. L'hash è simmetrico nelle due celle, così il filo non appare e sparisce a seconda
 * di quale cella lo sta disegnando.
 */
float wnLinkOn(vec2 cellA, vec2 cellB) {
  return step(wnHash1((cellA + cellB) * 3.17 + abs(cellA - cellB) * 11.7), linkChance);
}

float wnLink(vec2 p, vec2 a, vec2 b, float w, float t) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float len = max(length(ba), 1e-5);
  float h = clamp(dot(pa, ba) / (len * len), 0.0, 1.0);
  float d = length(pa - ba * h);
  float line = smoothstep(w, w * 0.3, d);
  if (dash > 0.001) {
    // trattini che scorrono lentamente lungo il filo, come i pacchetti su una rete
    float marks = fract(h * len * dashScale - t * 0.6);
    float duty = mix(1.0, 0.45, dash);
    line *= mix(1.0, smoothstep(duty, duty * 0.6, marks), dash);
  }
  return line;
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  float aspect = max(uQuadAspect, 0.05);
  float cells = max(density, 1.0);
  // celle quadrate qualunque sia la forma del quad: senza l'aspect la maglia si stirerebbe
  vec2 gp = vec2(uv.x * aspect, uv.y) * cells;
  vec2 base = floor(gp);
  float t = time * speed;

  float w = lineWidth * 0.035;
  float wire = 0.0;
  float node = 0.0;
  float nearest = 1e6;
  vec2 nearestCell = base;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = base + vec2(float(i), float(j));
      vec2 a = wnNode(cell, t);

      // nodo: punto luminoso, e cella di appartenenza (serve alle scaglie scure)
      float dn = length(gp - a);
      if (dn < nearest) {
        nearest = dn;
        nearestCell = cell;
      }
      node = max(node, smoothstep(nodeSize * 0.06, 0.0, dn));

      // collegamenti verso destra e verso l'alto: percorrendo tutte le celle ogni coppia
      // adiacente viene toccata una volta sola. Il test sul collegamento viene PRIMA di
      // calcolare il nodo vicino, così le coppie scartate non costano nulla.
      vec2 nb = cell + vec2(1.0, 0.0);
      if (wnLinkOn(cell, nb) > 0.5) wire = max(wire, wnLink(gp, a, wnNode(nb, t), w, time));
      nb = cell + vec2(0.0, 1.0);
      if (wnLinkOn(cell, nb) > 0.5) wire = max(wire, wnLink(gp, a, wnNode(nb, t), w, time));
      if (diagonals > 0.5) {
        nb = cell + vec2(1.0, 1.0);
        if (wnLinkOn(cell, nb) > 0.5) wire = max(wire, wnLink(gp, a, wnNode(nb, t), w, time));
        nb = cell + vec2(1.0, -1.0);
        if (wnLinkOn(cell, nb) > 0.5) wire = max(wire, wnLink(gp, a, wnNode(nb, t), w, time));
      }
    }
  }

  // Scaglie: celle spente a caso, che formano macchie poligonali frastagliate unendosi fra loro.
  // La soglia si muove nel tempo, così la crosta si apre e si richiude invece di restare fissa.
  float shardNoise = wnHash1(nearestCell) + 0.12 * sin(t * 0.7 + wnHash1(nearestCell) * 6.28);
  float shard = step(shardNoise, shards);

  // il soggetto sotto la rete (uv originale: la maglia si muove, l'immagine no)
  vec3 src = texture2D(tex, vUv).rgb;
  vec3 col = src * sourceAmount;
  col *= 1.0 - shard * shardDark;
  col += wireColor * wire * (1.0 + glow) + nodeColor * node * (0.8 + glow);

  // dove non c'è né rete né soggetto il layer resta trasparente: così si sovrappone a ciò che
  // sta sotto senza coprirlo di nero
  float a = clamp(max(max(wire, node), sourceAmount * (1.0 - shard * shardDark)), 0.0, 1.0);
  return vec4(col, a);
}
