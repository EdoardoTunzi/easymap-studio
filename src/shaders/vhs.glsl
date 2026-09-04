// NAME: VHS
// Filtro in stile videocassetta: onda del nastro, piega, "switching noise" in cima al fotogramma,
// bloom cromatico orizzontale, sfarfallio di rete. `intensity` miscela con l'immagine pulita del
// layer — a qualunque valore il colore deriva sempre dal contenuto sottostante, mai sostituito.
uniform float speed; // @min 0.0 @max 3.0 @default 1.0
uniform float waveAmount; // @min 0.0 @max 3.0 @default 1.0
uniform float creaseAmount; // @min 0.0 @max 3.0 @default 1.0
uniform float tearAmount; // @min 0.0 @max 3.0 @default 1.0
uniform float bloomAmount; // @min 0.0 @max 3.0 @default 1.0
uniform float beatAmount; // @min 0.0 @max 3.0 @default 1.0
uniform float intensity; // @min 0.0 @max 1.0 @default 1.0

// bordo del nastro: fuori dal centro orizzontale spegne a grigio invece di stirare la texture
vec3 vhsTex(sampler2D t, vec2 p) {
  vec3 col = texture2D(t, p).xyz;
  if (0.5 < abs(p.x - 0.5)) col = vec3(0.1);
  return col;
}

float vhsHash(vec2 v) {
  return fract(sin(dot(v, vec2(89.44, 19.36))) * 22189.22);
}

float vhsIHash(vec2 v, vec2 r) {
  float h00 = vhsHash(floor(v * r + vec2(0.0, 0.0)) / r);
  float h10 = vhsHash(floor(v * r + vec2(1.0, 0.0)) / r);
  float h01 = vhsHash(floor(v * r + vec2(0.0, 1.0)) / r);
  float h11 = vhsHash(floor(v * r + vec2(1.0, 1.0)) / r);
  vec2 ip = smoothstep(vec2(0.0), vec2(1.0), mod(v * r, 1.0));
  return (h00 * (1.0 - ip.x) + h10 * ip.x) * (1.0 - ip.y) + (h01 * (1.0 - ip.x) + h11 * ip.x) * ip.y;
}

float vhsNoise(vec2 v) {
  float sum = 0.0;
  for (int i = 1; i < 9; i++) {
    sum += vhsIHash(v + vec2(float(i)), vec2(2.0 * pow(2.0, float(i)))) / pow(2.0, float(i));
  }
  return sum;
}

vec4 processColor(sampler2D tex, vec2 uv, float rawTime, vec2 resolution) {
  vec4 source = texture2D(tex, uv);
  float time = rawTime * speed;
  vec2 uvn = uv;

  // onda del nastro
  uvn.x += (vhsNoise(vec2(uvn.y, time)) - 0.5) * 0.005 * waveAmount;
  uvn.x += (vhsNoise(vec2(uvn.y * 100.0, time * 10.0)) - 0.5) * 0.01 * waveAmount;

  // piega del nastro
  float tcPhase = clamp((sin(uvn.y * 8.0 - time * 3.14159265 * 1.2) - 0.92) * vhsNoise(vec2(time)), 0.0, 0.01) * 10.0 * creaseAmount;
  float tcNoise = max(vhsNoise(vec2(uvn.y * 100.0, time * 10.0)) - 0.5, 0.0);
  uvn.x = uvn.x - tcNoise * tcPhase;

  // switching noise in cima al fotogramma
  float snPhase = smoothstep(0.03, 0.0, uvn.y) * tearAmount;
  uvn.y += snPhase * 0.3;
  uvn.x += snPhase * ((vhsNoise(vec2(uv.y * 100.0, time * 10.0)) - 0.5) * 0.2);

  vec3 col = vhsTex(tex, uvn);
  col *= 1.0 - tcPhase;
  col = mix(col, col.yzx, snPhase);

  // bloom cromatico orizzontale (RGB sfalsati)
  for (float x = -4.0; x < 2.5; x += 1.0) {
    col.xyz += vec3(
      vhsTex(tex, uvn + vec2(x - 0.0, 0.0) * 7e-3).x,
      vhsTex(tex, uvn + vec2(x - 2.0, 0.0) * 7e-3).y,
      vhsTex(tex, uvn + vec2(x - 4.0, 0.0) * 7e-3).z
    ) * 0.1 * bloomAmount;
  }
  col *= 0.6;

  // sfarfallio di rete (AC beat)
  col *= 1.0 + clamp(vhsNoise(vec2(0.0, uv.y + time * 0.2)) * 0.6 - 0.25, 0.0, 0.1) * beatAmount;

  source.rgb = mix(source.rgb, clamp(col, 0.0, 1.0), intensity);
  return source;
}
