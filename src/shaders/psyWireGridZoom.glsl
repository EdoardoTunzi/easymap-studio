// NAME: Wire Grid Zoom
uniform float speed; // @min 0.0 @max 2.0 @default 0.5
uniform float zoomRatio; // @min 1.5 @max 6.0 @default 3.2
uniform float layers; // @min 2.0 @max 6.0 @default 4.0
uniform float pulseSpeed; // @min 0.0 @max 4.0 @default 1.5
uniform float wireWidth; // @min 0.01 @max 0.1 @default 0.04
uniform float vignette; // @min 0.0 @max 1.0 @default 0.6
uniform vec3 colorA; // @default 0.0,0.35,1.0
uniform vec3 colorB; // @default 0.0,1.0,0.8

vec2 wgHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract(vec2((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y));
}

float wgHash11(float n) {
  return fract(sin(n) * 43758.5453123);
}

// distanza dal filo più vicino: ogni cella genera un nodo a caso e un segmento in una delle 4
// direzioni tipiche (griglia/diagonale), sulle 3x3 celle vicine
float wgWireDistance(vec2 uv, float seed) {
  vec2 cell = floor(uv);
  vec2 fraction = fract(uv);
  float minDist = 1e5;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 currentCell = cell + neighbor;
      vec2 randVal = wgHash22(currentCell + vec2(seed, seed * 1.5));
      vec2 pA = neighbor + vec2(0.5) + (randVal - 0.5) * 0.4;
      vec2 dir;
      float dirRand = randVal.x;
      if (dirRand < 0.25) dir = vec2(1.0, 0.0);
      else if (dirRand < 0.50) dir = vec2(0.0, 1.0);
      else if (dirRand < 0.75) dir = vec2(1.0, 1.0);
      else dir = vec2(-1.0, 1.0);

      vec2 pB = pA + normalize(dir) * (0.4 + randVal.y * 0.5);
      vec2 pa = fraction - pA;
      vec2 ba = pB - pA;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      minDist = min(minDist, length(pa - ba * h));
    }
  }
  return minDist;
}

vec3 wgRenderLayer(vec2 uv, float layerSeed, float time) {
  float dLine = wgWireDistance(uv, layerSeed);
  float wire = smoothstep(wireWidth, wireWidth * 0.25, dLine);
  float glow = exp(-dLine / 0.16) * 0.45;

  vec2 cell = floor(uv);
  vec2 fraction = fract(uv);
  vec2 randCircle = wgHash22(cell + vec2(layerSeed * 2.1));
  vec2 circlePos = vec2(0.5) + (randCircle - 0.5) * 0.3;
  float dCircle = length(fraction - circlePos);
  float nodeCircle = smoothstep(0.07, 0.04, dCircle) * step(0.4, randCircle.x);

  // trattini luminosi che corrono lungo il filo, sfasati per strato
  float pulseTime = time * pulseSpeed + wgHash11(layerSeed) * 10.0;
  float pulsePattern = smoothstep(0.05, 0.0, dLine)
    * smoothstep(0.1, 0.0, abs(fract(dLine * 2.0 - pulseTime) - 0.5));
  float pulseGlow = pulsePattern * exp(-dLine / 0.06) * 2.0;

  float colorShift = wgHash11(layerSeed * 5.7);
  vec3 baseColor = mix(colorA, colorB, colorShift);

  return baseColor * (wire * 0.6 + glow + nodeCircle + pulseGlow);
}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec2 p = (uv - 0.5) * resolution / resolution.y;
  float timeProgress = time * speed;
  float cycleTime = fract(timeProgress);
  vec3 finalColor = vec3(0.0);
  int numLayers = int(layers);

  for (int i = 0; i < 6; i++) {
    if (i >= numLayers) break;
    float layerProgress = float(i) - cycleTime;
    float layerScale = pow(zoomRatio, layerProgress);
    vec2 layerUV = p * layerScale;

    float angle = float(i) * 1.15 + floor(timeProgress) * 0.4;
    float s = sin(angle);
    float c = cos(angle);
    layerUV = vec2(layerUV.x * c - layerUV.y * s, layerUV.x * s + layerUV.y * c);

    float layerSeed = floor(timeProgress) + float(i) * 127.42;
    vec3 layerColor = wgRenderLayer(layerUV, layerSeed, time);

    float fade = smoothstep(-0.6, 0.4, layerProgress)
      * smoothstep(float(numLayers), float(numLayers) - 0.8, layerProgress);
    finalColor += layerColor * fade;
  }

  vec2 sc = uv;
  float vig = 0.4 + 0.6 * pow(16.0 * sc.x * sc.y * (1.0 - sc.x) * (1.0 - sc.y), 0.25);
  finalColor *= mix(1.0, vig, vignette);
  return vec4(finalColor, 1.0);
}
