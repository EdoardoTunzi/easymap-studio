// NAME: Edge Pulse
// Bordi illuminati che seguono la forma dello stage, con respiro pulsante.
// Due sorgenti di contorno, dosabili separatamente:
//   - SAGOMA: ricavata dal canale alpha del PNG scontornato (il profilo esterno dell'oggetto).
//   - DETTAGLI: gradiente di luminanza dentro l'immagine (pieghe, lineamenti, volumi).
// A differenza degli altri effetti campiona su vUv (la uv ORIGINALE del layer, dichiarata dal
// wrapper) e non sulla uv trasformata: il contorno deve restare incollato alla sagoma, quindi
// Size/pan/kaleido non lo spostano. È voluto — un bordo che scivola via dalla forma non serve.
// Nota: niente uniform "speed" come negli altri shader — qui il ritmo è pulseRate, e la velocità
// globale del layer (uFxSpeed) lo scala già a monte.
uniform float edgeWidth; // @min 1.0 @max 40.0 @default 10.0
uniform float edgeGain; // @min 0.0 @max 4.0 @default 1.6
uniform float edgeSharp; // @min 0.5 @max 6.0 @default 2.0
uniform float glow; // @min 0.0 @max 3.0 @default 0.8
uniform float detailAmount; // @min 0.0 @max 3.0 @default 0.9
uniform float detailRadius; // @min 0.5 @max 8.0 @default 2.0
uniform float pulseRate; // @min 0.0 @max 12.0 @default 2.0
uniform float pulseDepth; // @min 0.0 @max 1.0 @default 0.7
uniform float pulseSharp; // @min 1.0 @max 8.0 @default 2.0
uniform float pulsePhase; // @min 0.0 @max 6.28 @default 0.0
uniform float sourceAmount; // @min 0.0 @max 1.0 @default 0.0
uniform float shapeKey; // @min 0.0 @max 0.5 @default 0.05
uniform vec3 edgeColor; // @default 0.35,0.85,1.0
uniform vec3 detailColor; // @default 1.0,0.45,0.15

float sdLum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

/**
 * Sagoma dell'oggetto: alpha del PNG scontornato, e in più — se `shapeKey` > 0 — le zone scure
 * trattate come vuoto. Serve perché molti asset (compreso il default-stage) sono RGB **senza
 * canale alpha**, con lo sfondo semplicemente nero: lì l'alpha vale 1 ovunque e senza soglia non
 * esisterebbe alcun profilo da illuminare. Se il layer ha già il Luma key attivo (uLumaKey, il
 * controllo globale) si usa il più permissivo dei due, per non contraddire la maschera del layer.
 */
float sdShape(sampler2D tex, vec2 uv) {
  vec4 s = texture2D(tex, uv);
  float key = max(shapeKey, uLumaKey);
  if (key <= 0.0) return s.a;
  return s.a * smoothstep(0.0, key, sdLum(s.rgb));
}

/**
 * Quanto "vuoto" c'è attorno al pixel: 0 nel cuore della sagoma, →1 sul profilo.
 * 16 campioni distribuiti sul disco con l'angolo aureo (r = sqrt(i) per una densità uniforme):
 * i campioni vicini pesano di più, così la banda sfuma verso l'interno invece di terminare di
 * netto. È una stima di distanza dal bordo a raggio limitato — il surrogato economico di un
 * distance field vero, che richiederebbe un precalcolo sull'immagine.
 */
float sdRim(sampler2D tex, vec2 uv, vec2 texel, float radius) {
  float acc = 0.0;
  float wsum = 0.0;
  for (int i = 0; i < 16; i++) {
    float fi = (float(i) + 0.5) / 16.0;
    float ang = float(i) * 2.39996323;
    float r = sqrt(fi);
    vec2 o = vec2(cos(ang), sin(ang)) * r * radius * texel;
    float w = 1.0 - r * 0.75;
    acc += sdShape(tex, uv + o) * w;
    wsum += w;
  }
  return clamp(1.0 - acc / max(wsum, 1e-4), 0.0, 1.0);
}

/** Pendenza della luminanza: accende i contorni INTERNI, che l'alpha da sola non vede. */
vec2 sdSlope(sampler2D tex, vec2 uv, vec2 texel) {
  float l = sdLum(texture2D(tex, uv - vec2(texel.x, 0.0)).rgb);
  float r = sdLum(texture2D(tex, uv + vec2(texel.x, 0.0)).rgb);
  float d = sdLum(texture2D(tex, uv - vec2(0.0, texel.y)).rgb);
  float u = sdLum(texture2D(tex, uv + vec2(0.0, texel.y)).rgb);
  return vec2(r - l, u - d);
}

/** Respiro: 1 = pieno, pulseDepth decide quanto scende nel ventre del battito. */
float sdBreath(float time, float phase) {
  float s = 0.5 + 0.5 * sin(time * pulseRate + phase);
  return mix(1.0, pow(s, pulseSharp), pulseDepth);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 texel = 1.0 / resolution;
  vec4 source = texture2D(tex, vUv);

  // --- profilo della sagoma ---
  // il pixel deve stare DENTRO la forma: senza questo, con un asset a fondo nero (alpha pieno,
  // che il wrapper non scarta) si accenderebbe anche il vuoto attorno all'oggetto
  float inside = sdShape(tex, vUv);
  float rim = sdRim(tex, vUv, texel, edgeWidth) * inside;
  float band = pow(rim, edgeSharp) * edgeGain;
  // alone più largo e tenue: stessa distanza, esponente più basso → entra di più nella superficie
  float halo = pow(rim, edgeSharp * 0.35) * glow * 0.5;

  // --- contorni interni ---
  vec2 slope = sdSlope(tex, vUv, texel * detailRadius);
  float detail = clamp(length(slope) * 6.0, 0.0, 1.0);
  // il salto di luminanza sul profilo esterno è già coperto dalla banda: senza questo, sagoma e
  // dettagli si sommerebbero sullo stesso pixel e il bordo brucerebbe
  detail *= clamp(1.0 - rim * 1.2, 0.0, 1.0) * inside;

  vec3 col = edgeColor * (band + halo) * sdBreath(time, 0.0);
  col += detailColor * detail * detailAmount * sdBreath(time, pulsePhase);
  col += source.rgb * sourceAmount;

  // alpha = quanto il pixel è acceso: dove non c'è bordo il layer resta trasparente, così lo si
  // può sovrapporre in Add/Screen allo stage senza coprirlo con un rettangolo nero
  float peak = max(max(col.r, col.g), col.b);
  float outA = clamp(max(sqrt(clamp(peak, 0.0, 1.0)), sourceAmount), 0.0, 1.0);
  return vec4(col, outA);
}
