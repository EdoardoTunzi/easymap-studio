# MEMORY — Registro modifiche EasyMap Studio

Ogni modifica al progetto va registrata qui con data, descrizione e motivazione. Le voci più recenti in alto dentro ogni giornata.

## 2026-09-04 — Rimosso il prefisso di categoria ripetuto dai nomi degli shader (86 file)

Segnalato che molti nomi ripetevano la categoria di appartenenza ("Psy Chrome Ripple" mentre il
filtro è già su "Psy"). Passata su tutta la libreria: per ogni famiglia con prefisso di file
riconosciuto (`halo*`, `liquid*`, `morph*`, `psy*`, `sd*`) rimossa la parola iniziale del `// NAME:`
quando coincide **esattamente** con l'etichetta della categoria seguita da uno spazio — quindi
"Halo Mandala" → "Mandala", "SD Ridge Flow" → "Ridge Flow", ecc. Rimosso anche "Audio " da
`audioOscilloscope.glsl` (categoria dedotta dal contenuto, non dal prefisso file, ma stesso
principio). 90 file toccati su 123 (tutti pre-esistenti: i 16 file aggiunti in questa sessione
erano già senza prefisso ripetuto).

Il match richiede lo spazio subito dopo la parola: questo esclude correttamente i casi dove il
prefisso non è una ripetizione ma parte del nome stesso — "Morphing Abstract" (categoria morph, ma
comincia per "Morphing" non "Morph ") e "3D Surface Morph Spirals"/"Symmetrical Halo Swirl"
(categoria morph/halo via eccezione in `shaderCategories.ts`, ma "Morph"/"Halo" non è la prima
parola del nome) restano invariati. Verificato nessun nome duplicato dopo la rimozione.

## 2026-09-04 — Correzione: "Lotka-Volterra" e "Smooth Life" cancellati dall'utente

L'utente ha cancellato `src/shaders/morphLotkaVolterra.glsl` e `src/shaders/morphSmoothLife.glsl`
(mai committati, quindi spariti senza lasciare traccia in git) — presumibilmente per il costo
prestazionale segnalato per entrambi al momento dell'implementazione (convoluzione a 441 texel/
cella per Smooth Life; simulazione a 3 canali per Lotka-Volterra). Le voci di log precedenti su
questi due effetti restano come cronologia di ciò che è stato fatto, ma **i file non esistono
più**: non ripartire da lì assumendo che siano ancora nella libreria. Il conteggio in `README.md`
era già stato calcolato sullo stato **dopo** la cancellazione (123 file, morph=31), quindi i
numeri risultavano già corretti; corretta invece la menzione testuale di "Lotka-Volterra" e
"Smooth Life" come esempi di Morph con stato (riga sui Morph e riga nelle Funzionalità principali),
rimasta per errore — ora cita solo i tre Morphogen (Growth/Mitosis/Turing), gli unici automi con
stato rimasti in libreria. Restano invece confermati e presenti: Fractal Pyramid, Wire Grid Zoom,
Silexar Globe, Palette Fract Loop, Kaleido Cloud Tunnel, Starleidoscope, Disco Sun Vortex,
Morphing Abstract, Noise Animation - Electric, Botanical Fireworks, Ribbon Assault, Synthetic
Aperture Sun, Bumped Sinusoidal Warp, Noise Animation - Lava, Hexagone, VHS (16 file, tutti ancora
da committare — `git status` li mostra come `??`).

## 2026-09-04 — README aggiornato con il conteggio reale della libreria (123 shader)

Fine sessione di import: contati i file `.glsl` effettivi e ricalcolate le famiglie con la stessa
logica di `shaderCategoryOf` (prefisso file + regex `usesAudio`) invece di fidarsi del numero
scritto a mano nel README, ormai disallineato (106, risalente a prima di questa sessione).

Conteggio finale: **123 shader** — Halo 12, Liquid 12, Psy 40, Morph 31 (di cui 3 con stato:
Morphogen, Lotka-Volterra, Smooth Life), SD 12, Altri 15, Audio 1. Aggiornati tutti i riferimenti
numerici in `README.md` (righe con "106 shader", i conteggi per famiglia Psy/Morph/SD, il numero
di shader che campionano davvero la sorgente per l'uso con la camera live — ricalcolato a ~66
contando solo i file che chiamano `texture2D(tex...)`, non l'intera famiglia per assunzione).

17 shader aggiunti in questa sessione (9 dai 27 link Shadertoy forniti + 8 extra fuori lista
richiesti a parte): Fractal Pyramid, Wire Grid Zoom, Silexar Globe, Palette Fract Loop, Kaleido
Cloud Tunnel, Starleidoscope, Disco Sun Vortex, Morphing Abstract, Lotka-Volterra, Noise Animation
- Electric, Botanical Fireworks, Ribbon Assault, Synthetic Aperture Sun, Bumped Sinusoidal Warp,
Noise Animation - Lava, Hexagone, Smooth Life, VHS.

**Restano in sospeso**: il 15° link (`wlGXRD`, mai affrontato) e i link dal 23° al 27° della lista
originale — vedi `TODO.md` per l'elenco completo con gli URL.

## 2026-09-04 — Shader extra fuori lista: "VHS" (categoria Altri)

Richiesto dall'utente per l'uso su clip (video), con l'esigenza esplicita che "si veda lo sfondo".
Chiarito che il modo corretto per un layer VHS trasparente sopra una clip sottostante è già
disponibile negli strumenti esistenti (blend mode + opacità per-layer), indipendenti dal singolo
file .glsl — nessuno shader individuale riceve "cosa c'è sotto" a parte i pochi blend mode
avanzati (`uBackdrop`, meccanismo separato). Aggiunto invece uno slider `intensity` che miscela
l'immagine pulita del layer con la versione distorta: a qualunque valore il colore deriva sempre
dal contenuto reale (onda del nastro, piega, bloom cromatico, switching noise), mai sostituito da
un pattern estraneo — è quello che garantisce "si vede lo sfondo/il contenuto" nel senso pratico
di un filtro applicato direttamente sulla clip.

→ `src/shaders/vhs.glsl`, categoria **Altri** su richiesta esplicita (nome file senza prefisso di
famiglia riconosciuto, cade automaticamente in 'other' via `shaderCategoryOf`). Nessuna
dipendenza da texture/canali esterni: tutto procedurale (hash + noise a 8 ottave), quindi porting
1:1 senza semplificazioni.

## 2026-09-04 — Shader extra fuori lista: "Smooth Life" (con stato, famiglia Morphogen)

Richiesto esplicitamente dall'utente "insieme ai morphogen tipo growth, mitosis, turing" →
`src/shaders/morphSmoothLife.glsl`, categoria Morph, terzo effetto della libreria a usare il
meccanismo `//! SIMULATION` (ping-pong 320×320) dopo Morphogen Growth e Lotka-Volterra.

**Il più pesante finora lato simulazione**: la convoluzione SmoothLife campiona un vicinato
circolare di raggio fino a 10 (441 texel per cella) a ogni passo — contro i pochi texel del
laplaciano 9-punti di Gray-Scott. Raggio di default abbassato a 6 (154 texel) con slider fino a
10; il ciclo interno resta comunque a 21×21 iterazioni per il vincolo WebGL1 sui loop a bound
costante, ma un `continue` salta il campionamento vero e proprio oltre il raggio impostato,
quindi il costo scala comunque con lo slider anche se il ciclo "gira a vuoto" per il resto.
**Da verificare le prestazioni nel browser prima di considerarlo pronto**, specialmente con più
layer attivi o supersampling alto in Output.

`iMouse` (disegno interattivo) e `iChannel2` (tasti di debug/reset di Shadertoy) rimossi;
`iChannel1` (rumore extra per l'innesco casuale) sostituito con un secondo hash procedurale
(differenza di due hash, come l'originale usava due texture di rumore diverse). Esposte le 4
soglie "genoma" dell'automa (`birthLow/High`, `deathLow/High`) che ne decidono il comportamento
(macchie, onde, glider-like) — è il cuore esplorativo di SmoothLife, coerente con l'ampiezza di
controllo già data a Morphogen Growth. `sourceInfluence` fa nascere l'automa con più densità dove
l'immagine è più chiara, stesso schema degli altri Morph con stato.

## 2026-09-04 — Shader extra fuori lista: "Hexagone" (saltati 21° e 22°)

- Effetti 21 (`3sfczf`) e 22 (`4sK3RD`): **saltati su richiesta dell'utente**.
- "Hexagone" di Martijn Steinrucken/BigWings (licenza CC BY-NC-SA 3.0), **fuori dai 27 link
  originali** — codice incollato direttamente dall'utente → `src/shaders/psyHexagone.glsl`,
  categoria Psy. Piano esagonale animato visto dall'alto tramite intersezione raggio-piano (non un
  vero raymarch: un solo `p = ro + rd*(ro.y/rd.y)`, economico), 3 "fiori" di 7 esagoni ciascuno
  impilati in profondità e ciclati nel tempo, con bordi pulsanti e colore per-id. `iMouse` (pan
  orizzontale) rimosso, non disponibile nel motore. Diversi parametri fissi dell'originale
  (larghezza del bordo, soglie di dissolvenza in lontananza) accorpati in singoli slider con un
  rapporto fisso fra le due costanti originali, per tenere il numero di controlli ragionevole.

## 2026-09-04 — Import shader da Shadertoy: "Noise Animation - Lava" (20/27, saltato il 19°)

- Effetto 19 (`4sl3Dr`): **saltato su richiesta dell'utente**.
- Effetto 20 (`lslXRS`) → `src/shaders/psyNoiseAnimationLava.glsl`, categoria Psy. Stesso autore
  (nimitz) e stessa dipendenza da `iChannel0` di "Noise Animation - Electric" (13/27): sostituito
  con lo stesso value-noise procedurale (hash + interpolazione bilineare). Flow noise (ogni ottava
  spostata da un campo vettoriale ruotato invece che sommata come in un fbm classico) — qui il
  conteggio del loop originale (`i=1.;i<7.` → 6 iterazioni) corrisponde esattamente al default
  `octaves=6.0` della porta, a differenza del caso Electric dove serviva -1.

**Aggiornamento nella stessa sessione**: su richiesta dell'utente, spostato in famiglia Morph
(`psyNoiseAnimationLava.glsl` → `morphNoiseAnimationLava.glsl`). Aggiunti `morphDepth`/
`blackThreshold` standard: la luminanza della sorgente spinge la fase del flow noise
(`time += lum*morphDepth*0.05`), blend finale con `mix(source.rgb, fx+source.rgb*fx, 0.85)` come
Disco Sun Vortex/Morphing Abstract.

## 2026-09-04 — Import shader da Shadertoy: "Bumped Sinusoidal Warp" (18/27)

Effetto 18 (`4l2XWK`) → `src/shaders/morphBumpedSinusoidalWarp.glsl`, categoria Morph su richiesta
dell'utente ("deve essere anche morph se serve"). A differenza degli altri Morph, qui l'adattamento
all'asset non passa solo da `lum*morphDepth` (comunque presente, spinge la fase del warp): la
texture campionata per il materiale bump-mapped (`iChannel0` nell'originale, generica) è **l'asset
stesso**, campionato con un piccolo offset deformato dalla stessa funzione di warp che genera la
mappa di rilievo — la superficie increspata e illuminata mostra letteralmente la foto dell'utente,
non un pattern estraneo. Rimossa la doppia conversione gamma manuale dell'originale (`texCol*=texCol`
in entrata, `sqrt()` finale in uscita, auto-descritta nel commento come "2.0 gamma correction"):
stessa ragione di Lotka-Volterra, la pipeline colore del progetto lavora già in spazio gamma e
applicarla avrebbe scurito/schiarito il risultato in modo scorretto rispetto agli altri shader.

## 2026-09-04 — Import shader da Shadertoy: "Synthetic Aperture Sun" (17/27)

Effetto 17 (`ldlSzX`) → `src/shaders/psySyntheticApertureSun.glsl`, categoria Psy. **Lettura
attenta necessaria**: il file dichiara `int MODE = 5;` come default globale, ma dentro
`mainImage` viene subito sovrascritto da un'espressione che dipende dai toggle da tastiera
speciali di Shadertoy (`iChannel2`), sempre "spenti" finché l'utente non preme un tasto —
risultato: il comportamento realmente visibile di default è `MODE=4` (23 sorgenti d'onda su un
anello, spaziatura quasi-casuale) in modalità "energia" (il doppio ciclo O(n²) che calcola
l'interferenza vera fra ogni coppia di sorgenti, non la somma semplice delle onde). `MODE=5`
(sorgenti a griglia) è codice morto, mai raggiunto. Portato il comportamento di default realmente
osservabile, con gli switch da tastiera (`waveMode`, `randomSpacing`, `driftSpeed`) trasformati in
slider veri invece che nascosti dietro tasti. `iMouse` sostituito dal ramo sintetico che
l'originale già usava quando il mouse non è premuto (stesso schema degli effetti precedenti).
`sourceCount` (default 23, il numero pieno originale) permette di abbassare il costo O(n²) se
serve più margine di fps con più layer attivi.

## 2026-09-04 — Import shader da Shadertoy: "Ribbon Assault" (16/27, saltato temporaneamente il 15°)

Effetto 16 (`MdBGDK`, David Hoskins, licenza CC BY-NC-SA 3.0) → `src/shaders/morphRibbonAssault.glsl`,
categoria Morph **su richiesta esplicita dell'utente**. Frattale di Möbius (20 iterazioni di
inversione + fold) attorno a un punto attrattore che nell'originale segue il mouse o, in sua
assenza, un moto Lissajous sintetico — usato sempre quest'ultimo (`iMouse` non disponibile). La
luminanza della sorgente sposta l'attrattore (`p += (lum-0.5)*morphDepth*0.03`), stesso schema
`lum*morphDepth` degli altri Morph. L'utente ha dato il codice del 16° link (`MdBGDK`) saltando
il 15° (`wlGXRD`), non ancora affrontato — resta in sospeso in `TODO.md`, non segnato come saltato.

## 2026-09-04 — Import shader da Shadertoy: "Botanical Fireworks" (14/27, architettura non replicabile in pieno)

Effetto 14 (`NddSWs`) → `src/shaders/psyBotanicalFireworks.glsl`, categoria Psy. Prima richiesta di
questo lotto con un problema architetturale reale, non solo di dipendenze mancanti: l'originale
(Leon Denise, "taste of noise 7") fa girare un raymarch 3D completo (IFS caleidoscopica di sfere,
30 step) **dentro un Buffer A con feedback**, accumulando `max(nuovo, precedente-0.01)` per
ammorbidire nel tempo il rumore che varia a ogni frame in una scia organica sfumata. Il meccanismo
`//! SIMULATION` di questo progetto (usato da Morphogen Growth e Lotka-Volterra) gira invece su
una griglia fissa 320×320 pensata per campi di concentrazione economici, non per un raymarch 3D a
piena risoluzione — infilarcelo sarebbe stato sproporzionato (fino a 8 passi di simulazione/frame,
ciascuno un raymarch a 30 step) e comunque a risoluzione/aspect sbagliati.

**Scelta (concordata con l'utente)**: portato senza stato, ricalcolato ogni frame. Per attenuare lo
sfarfallio che il rumore per-frame (`rng`, usato per il seed, il wobble delle sfere e il dithering
del passo) avrebbe causato senza il buffer, il seed si aggiorna a `flickerRate` scatti al secondo
(default 3) invece che a ogni frame — resa più "a scatti" e meno vellutata dell'originale, ma senza
build engine aggiuntive. `iMouse` (controllo camera) rimosso come per Starleidoscope. Prima
richiesta di questo lotto in cui l'utente ha incollato per errore il file common di un altro
shader (nimitz, effetto 13): richiesto e ottenuto il file corretto prima di procedere.

## 2026-09-04 — Import shader da Shadertoy: "Noise Animation - Electric" (13/27)

Effetto 13 (`ldlXRS`) → `src/shaders/psyNoiseAnimationElectric.glsl`, categoria Psy. Nimitz
(stormoid.com), licenza CC BY-NC-SA 3.0. `iChannel0` (texture di rumore fornita da Shadertoy)
sostituito con value-noise procedurale hash+bilineare (`ecNoise`): la turbolenza dell'fbm a
domain-warping ne risulta pressoché identica. **Bug evitato in porting**: il loop originale
`for(i=1.;i<6.;i++)` esegue 5 iterazioni (i=1..5), non 6 — l'uniform `octaves` di default è 5.0,
non 6.0, altrimenti il pattern sarebbe stato visibilmente più fitto del dovuto.

## 2026-09-04 — Import shader da Shadertoy: "Lotka-Volterra" (12/27, primo con stato dopo Morphogen)

Effetto 12 (`Xtcyzr`) → `src/shaders/morphLotkaVolterra.glsl`, categoria Morph. Simulazione vera
preda-predatore-vegetazione a tre canali (non calcolabile in un solo pass): usa il meccanismo
`//! SIMULATION`/`//! DISPLAY` già introdotto per Morph Morphogen Growth (ping-pong FBO 320×320,
vedi `engine/simulation.ts`/`SimulationPass.tsx`) — **secondo effetto della libreria a usarlo**.
Diffusione a 4 vicini diretti (non `easyvj_lap`, che è il laplaciano 9-punti dei Morphogen: qui
l'originale usa uno schema più ruvido che fa parte del regime di oscillazione). Il gradiente
spaziale di riproduzione/predazione dell'originale (basato su `fragCoord/iResolution`) diventa
`uv.x`/`uv.y` della griglia di simulazione, quadrata e toroidale per costruzione. `sourceInfluence`
fa spingere la vegetazione locale dove l'immagine è più chiara (stesso schema di
`morphMorphogenGrowth.glsl`). **Omessa** la barra di avanzamento stagionale a righe fisse in fondo
allo schermo dell'originale (non ha senso su una proiezione ritagliata sui bordi dell'asset) e la
correzione gamma manuale finale (`pow(col,1/2.2)`: la pipeline colore del progetto è già in spazio
gamma, raddoppiarla avrebbe schiarito tutto). Uniform `speed`/`scale` non letti dentro il GLSL:
sono letti da `SimulationPass.tsx` lato TS (passi/secondo, mapping uv↔griglia), stesso pattern già
presente in Morphogen Growth. Attribuzione hash di David Hoskins (CC BY-SA 4.0) lasciata in testa
al file.

## 2026-09-04 — Import shader da Shadertoy: "Morphing Abstract" (11/27)

Effetto 11 (`sfsSDs`) → `src/shaders/morphMorphingAbstract.glsl`. Stesso autore (Frostbyte, licenza
CC-BY-NC-SA-4.0) e stesso trattamento Morph di "Disco Sun Vortex": la luminanza spinge la profondità
di partenza del raymarch (`p.z += lum*morphDepth*0.3`). Raymarch con rumore "Xor's Dot Noise"
(wfsyRX) e tonemap ACES (Xc3yzM), entrambi portati come funzioni proprie. **Rimosso il
supersampling 2×2 interno dell'originale** (girava il raymarch 4 volte per pixel, campionando su
una griglia 2×2): l'Output di questo progetto ha già il proprio supersampling regolabile, farlo
due volte sarebbe solo costo GPU sprecato senza differenza percepibile.

## 2026-09-04 — Import shader da Shadertoy: "Disco Sun Vortex" (10/27)

Effetto 10 (`7cfGzn`) → `src/shaders/morphDiscoSunVortex.glsl`. **Richiesto esplicitamente in
famiglia Morph** (non Psy come gli altri raymarch portati finora): a differenza degli effetti Psy
puramente generativi, qui la luminanza della sorgente spinge la profondità di partenza nel tunnel
(`p.z = t + lum*morphDepth`, stesso schema di `morphTunnelDepth.glsl`/`3DSurfaceMorphSpirals.glsl`
— `lum*morphDepth` sommato a un termine di "z"/profondità), quindi il pattern reagisce alla forma
dell'asset invece di ignorarlo. Raymarch fedele all'originale "Abstract Shine" di @Frostbyte
(remixato da @WorkingClassHacker): tunnel a corkscrew, palette IQ, strato di shimmer/interferenza,
vignetta e bagliore centrale, compressione finale con `tanh` (stesso fix `exp`-based già usato per
Kaleido Cloud Tunnel, GLSL ES 1.00 non ha `tanh` nativo). **Licenza CC-BY-NC-SA-4.0** (non
commerciale, attribuzione richiesta, più restrittiva delle altre finora) — attribuzione lasciata
in testa al file.

## 2026-09-04 — Import shader da Shadertoy: "Starleidoscope" (9/27)

Effetto 9 (`ftt3R7`) → `src/shaders/psyStarleidoscope.glsl`, categoria Psy. Sfondo a fiocco di neve
da fold ricorsivo (mirror + abs, 5 iterazioni) con 10 strati di campo stellare in parallasse
(ciclano in profondità via `fract(i+t)`), ogni stella con raggi/flare e tinta hash-based che
cangia. Due dipendenze non disponibili nel motore: `iMouse` (pan del mouse, rimosso — il pan
globale del layer già copre lo stesso bisogno) e `iChannel0` (piccola variazione di tinta da
audio/webcam su Shadertoy, sostituita con una deriva procedurale lenta `sin/cos(time)`). Esposti
`foldIterations`/`foldScale` sul fold di sfondo, `starDensity`/`flareIntensity`/`twinkleSpeed`
sulle stelle, `brightness`/`colorIntensity`/`tint` sul colore finale.

## 2026-09-04 — Import shader da Shadertoy: "Kaleido Cloud Tunnel" (8/27, con salto)

- Effetto 7 (`4dcGW2`, "Expansive Reaction"): **saltato** — solo il pass Image incollato, la vera
  simulazione (Buffer A, presumibilmente reaction-diffusion) e la sfocatura (Buffer B) mancano,
  oltre a una texture di rumore su `iChannel3`. Impossibile ricostruirlo senza quel codice.
- Effetto 8 (`sctXDn`) → `src/shaders/psyKaleidoCloudTunnel.glsl`, categoria Psy. Shader Gaijin
  Entertainment (licenza: libero, non rivendibile come prodotto a sé — attribuzione lasciata in
  testa al file), un raymarch caleidoscopico a specchio (default 3 spicchi) con "nuvola" fractal
  noise-like e sequenza di rivelazione a scatti (apertura di 15s poi uno scatto di rotazione ogni
  4s, guidata da `time` quindi rispetta lo slider `speed`). **Fix necessario**: l'originale usa
  `tanh()` per il tonemap finale, non disponibile in GLSL ES 1.00 (WebGL1/three.js `ShaderMaterial`
  di default) — sostituito con un'approssimazione via `exp` che non overflowa (`kctTanh`), nessun
  altro shader della libreria usava funzioni iperboliche finora. Y non flippata (l'originale fa
  `iResolution.y - fragCoord.y`, omesso per coerenza con l'orientamento uv del resto della
  libreria — differenza puramente estetica, l'effetto ha comunque simmetria radiale).

## 2026-09-04 — Import shader da Shadertoy: "Palette Fract Loop" (6/27)

Effetto 6 (`mtyGWy`) → `src/shaders/psyPaletteFractLoop.glsl`, categoria Psy. Il celebre shader del
tutorial YouTube di kishimisu (loop `fract(uv*zoom)-0.5` a 4 iterazioni + palette coseno di iq).
Nessun titolo nel codice incollato: nome descrittivo scelto da Claude. Portato fedele con
`speed`/`zoomFactor`/`iterations`/`ringFreq`/`glowPow` al posto delle costanti fisse (`1.5`, `4`,
`8.`, `1.2`), palette esposta come due vec3 (`colorFreq`/`colorPhase`) al posto dei parametri `c`/`d`
fissi della formula di iq (`a`/`b` restano `0.5` fissi, sono l'offset/ampiezza della palette).

## 2026-09-04 — Import shader da Shadertoy: "Silexar Globe" (5/27)

Effetto 5 (`XsXXDn`) → `src/shaders/psySilexarGlobe.glsl`, categoria Psy. Il classico minimale
della demoscene di Danilo Guanabara "Creation by Silexars" (3 iterazioni, formula compattissima),
**rinominato "Silexar Globe" su richiesta dell'utente** (file+NAME rinominati insieme). Portato
fedele con `speed`/`scale`/`swirl`/`colorSpread`/`brightness` al posto delle costanti fisse
dell'originale (`.07`, `9.`, `.01`). L'originale scrive `fragColor.a = iTime` (probabilmente
ignorato da Shadertoy): **non riprodotto**, l'alpha del nostro wrapper moltiplica l'opacità finale
del layer, quindi avrebbe fatto pulsare/sparire l'effetto nel tempo — impostato a 1.0.

## 2026-09-04 — Import shader da Shadertoy: "Wire Grid Zoom" (4/27, con salti)

- Effetto 3 (`w323DK`): **saltato** — nessun codice fornito dall'utente.
- Effetto 4 (`fcyXD3`) → `src/shaders/psyWireGridZoom.glsl`, categoria Psy. Nel codice incollato
  non c'era il blocco `SHADERDATA` con il titolo Shadertoy: nome scelto da Claude ("Wire Grid
  Zoom", descrittivo). Rete di nodi/segmenti generata per cella (stesso trucco hash-per-cella di
  `wireNetwork.glsl`, ma qui un solo segmento a direzione casuale per cella invece della
  triangolazione a link) disposta su 2-6 strati che si susseguono in uno zoom infinito ciclico
  (stessa struttura di `psyInfiniteZoom.glsl`: `layerProgress`/`fract(time)`/dissolvenza in
  ingresso e uscita), con trattini di impulso che scorrono lungo i fili e vignettatura finale.
  Colori fissi ciano/blu dell'originale esposti come `colorA`/`colorB`.

## 2026-09-04 — Import shader da Shadertoy: "Fractal Pyramid" (2/27)

Avviato l'import di una lista di 27 shader Shadertoy scelti dall'utente, un effetto alla volta con
conferma prima di ogni implementazione (vedi sezione dedicata in `TODO.md`).

- Effetto 1 (`ffyXWc`, "Inception Tunnel"): **saltato su richiesta dell'utente** — raymarch 3D con
  PBR/AO/soft-shadow annidati, troppo pesante per l'uso live.
- Effetto 2 (`tsXBzS`, "Fractal Pyramid") → `src/shaders/psyFractalPyramid.glsl`, categoria Psy.
  Primo shader della libreria con un **vero raymarch 3D** (camera che orbita attorno a un frattale
  IFS a fold ricorsivo): finora tutti gli effetti "fractal"/"tunnel" (Kali Fractal, Psy Vortex
  Fractal, Star Nest...) erano trucchi in screen-space 2D, più economici. Scelto di portarlo fedele
  (64 step, nessun AO/shadow quindi comunque leggero) invece di appiattirlo in 2D, su conferma
  esplicita dell'utente. Uniform aggiunti: `speed`, `orbitSpeed`, `camDist`, `fov`, `scale` (scala
  lo spazio di campionamento e divide il passo di marcia per restare stabile), `fold`, `iterations`
  (loop troncato con `break`, come `psyVortexFractal`), `glow`, due colori `colorA`/`colorB` al
  posto della `palette()` fissa ciano→magenta dell'originale.

## 2026-09-01 — Bug: la playlist degli effetti seguiva il layer selezionato

Segnalato che impostando una playlist di effetti veniva applicata a tutti i layer. Confermato in
codice: `applyClip` chiamava `applyEffectSnapshot`, che scriveva sul layer **attivo letto a ogni
tick**. Cambiare selezione durante un set spostava la sequenza sul layer appena selezionato e ne
riscriveva l'effetto — e con una sola playlist per progetto non era comunque possibile dare
sequenze diverse a due layer. È lo stesso difetto che il loop delle palette aveva già risolto per
conto suo (vedi il commento in `use-palette-loop.ts`).

La playlist degli effetti è ora **per layer**, come quella degli asset:

- `playlistStore` passa a `playlists: Record<layerId, { clips, loop }>`, con `playing`,
  `currentIndex` e `clipProgress` per layer.
- `transitionMode` e `transitionDuration` restano **globali**: non sono la sequenza, sono come si
  passa da un clip al successivo — e quella durata la usa anche `sync.ts` per la dissolvenza degli
  invii manuali all'Output, che non appartiene a nessun layer.
- `applyEffectSnapshot` e `setTransitionProgress` accettano un `layerId` opzionale (omesso =
  comportamento di prima). Con un id, i layer spuntati in `syncTargetIds` seguono solo se è il
  layer attivo, come già faceva `setLayerPaletteColors`.
- Il motore esce da `PlaylistBar` e diventa `use-effect-playlist.ts`, un rAF unico su tutti i
  layer in riproduzione, montato in `ControlPage`: la barra ora ha due tab e non è il posto dove
  tenere in vita un set. Gli stati vivono in una ref, così mettere in play un secondo layer non
  azzera il conto del primo.
- Persistenza: `StoredProject.playlists`, col vecchio `playlist` letto ancora in sola lettura e
  convertito da `migrateLegacyPlaylist`, che assegna la sequenza al layer che era attivo — l'unico
  su cui poteva davvero girare. Verificato caricando un progetto nel vecchio formato.
- `snapshot()` pota le playlist dei layer eliminati: essendo indicizzate per layer sarebbero
  rimaste nello snapshot per sempre, crescendo a ogni salvataggio.

Nota di metodo, per la prossima volta: i primi test dal browser risultavano "il motore non parte".
Era falso — `import('/src/store/playlistStore.ts')` dalla console carica una **seconda istanza**
del modulo quando Vite serve all'app la versione con `?t=` dopo un HMR. Per pilotare gli store da
DevTools va usato l'URL che l'app ha davvero caricato (`performance.getEntriesByType('resource')`),
oppure un reload completo.

## 2026-09-01 — Playlist di asset per layer (rotazione di contenuti da una cartella)

Un layer poteva mostrare **un solo** media fisso (`Layer.media` è uno slot singolo). Nel progetto
"TV frame" serviva che il layer dentro lo schermo alternasse da solo gif e video brevi, in
parallelo alla playlist degli effetti, che continua a cambiare lo *shader* sullo stesso layer.

Vincolo di partenza: non caricare tutta la cartella nel browser. La feature quindi **punta** a una
cartella (File System Access, `showDirectoryPicker`) e ne legge i soli nomi; un file diventa un
object URL solo quando va in onda o quando la sua anteprima entra nella parte visibile della barra.

Perché è costata poco: `ShaderPlane` ricrea già il controller di texture quando cambia
`media.url`/`id` e `mediaTexture.ts` gestisce già image/video/gif, quindi cambiare clip è solo
scrivere un `MediaAsset` diverso nel layer — **nessuna modifica al motore di rendering**.

Decisioni non ovvie, tutte prese per non pagare due volte cose già risolte altrove:

- **Store separato** (`assetPlaylistStore`) e non un campo di `Layer`: l'elenco non deve entrare
  nel payload che il publisher spedisce all'Output a ogni modifica, e l'handle della cartella non
  ha senso fuori dalla finestra che ne ha il permesso.
- **Motore per-layer con un solo rAF** (`use-asset-playlist.ts`), copiato da `usePaletteLoop` e non
  dalla playlist effetti, che è un singleton sul layer *attivo*: qui la rotazione non deve seguire
  la selezione. Montato in `ControlPage`, non nella barra, che ora ha due tab e si smonterebbe.
- **Canale `media` in `sync.ts`**, gemello di `applyPaletteTick`: un cambio di clip è il contenuto
  della scena *già in onda* che scorre, non una modifica in preparazione, quindi viaggia anche in
  modalità Live senza far scattare il badge. Gli "hello" ricevono la clip corrente da
  `lastAssetMedia`, non lo stato del layer, altrimenti in Live un media cambiato **a mano** (che è
  a tutti gli effetti una modifica non inviata) sarebbe finito su una nuova finestra Output.
- **Niente `blob` nei MediaAsset di playlist**: se i byte finissero nel layer, l'autosave
  riscriverebbe ogni video nello snapshot ogni 5 s (è lo stesso problema che ha prodotto
  `AUTOSAVE_MIN_INTERVAL_MS`). Il prezzo è che alla riapertura del progetto la cartella va
  riautorizzata — il browser non conserva il permesso, solo l'handle.
- **Cache LRU di 24 object URL** con pin sull'asset in onda: `stripBlobs` manda all'Output il solo
  url, quindi revocare la clip in onda lascerebbe il proiettore su una texture vuota.
- **Playhead in CSS** (`@keyframes asset-playhead`, riavviato dal `key` del blocco) invece di un
  rAF: il conto è lineare e non merita un re-render per frame durante un live.
- Cambio **secco**, senza crossfade tra asset: sarebbe servita una seconda texture media in
  `ShaderPlane`, che oggi ne campiona una sola. Su una cornice TV il taglio è anche più credibile.

`detectType` era duplicato in `MediaUploader`: spostato in `mediaDetect.ts` con una variante per
nome file, perché i file letti da una cartella possono arrivare col MIME vuoto.

Due difetti emersi solo provandola nel browser, non previsti dal piano:

- Lo stato attivo del `ToggleGroup` (`data-[state=on]:bg-muted`) su `bg-sidebar` è a un passo di
  luminanza dal fondo: non si capiva quale sequenza si stesse guardando. Ora usa il segnale pieno
  della toolbar di mapping.
- Se la scrittura dell'handle della cartella fosse fallita, l'eccezione avrebbe fatto fallire il
  salvataggio **dell'intero progetto** (visto succedere con un handle di prova non clonabile).
  `putProject` ora riprova senza gli handle: si perde il riferimento alla cartella, non il lavoro.

**Su richiesta, il selettore Effetti/Assets è passato in cima alla barra**, sotto la maniglia di
resize e sopra il proprio trasporto: governa tutta la fascia sottostante, e in linea coi controlli
si leggeva come un controllo fra gli altri. La barra è diventata una colonna e i suoi limiti di
altezza salgono di 36px (96/192 → 132/228), cioè esattamente quanto occupa la nuova riga: senza,
i clip avrebbero perso in altezza quello che prende lei.

## 2026-08-28 — Dark: rampa non lineare, l'accento brillante torna

Segnalato che selezionando Dark l'effetto si scuriva, con l'impressione che fosse solo un
effetto visivo. Non lo era: `setPaletteCategory` scrive davvero solo `palette.category` e nessun
uniform di brightness cambia, ma con `amount` al 100% il colore in uscita **è** la palette,
quindi la luminanza della rampa è la luminanza dell'effetto. Misurata: Dark stava a 0,163 di
luminanza media contro 0,399 di "Tutte", con lo stop più chiaro a 0,32 — il 59% in meno.

Sotto c'era un difetto vero. Le palette "dark" reali non sono tutte scure: sono tre toni
scurissimi **più un accento brillante**. Il rimappaggio tonale su [0.02, 0.32] lo cancellava:

```
originale (#222831 #393E46 #00ADB5 #EEEEEE)   0.15  0.24  0.48  0.93
rimappata su [0.02, 0.32]                     0.02  0.04  0.07  0.09  0.32
```

L'accento a 0,93 finiva a 0,32 e i primi quattro stop si schiacciavano fra 0,02 e 0,09,
percettivamente indistinguibili. In projection mapping è doppiamente grave: a quella luminanza
l'effetto proiettato sulla superficie è quasi invisibile.

Introdotto `lightCurve` (esponente della progressione di lightness, default 1 = lineare). Dark usa
`2.4` con tetto alzato a 0,52–0,70: la rampa resta bassa a lungo e sale solo sull'ultimo stop,
che è la struttura vera di quelle palette. Esito tipico: `0.02 0.04 0.12 0.27 0.53`.

**La curva si applica solo al ramo procedurale**, non alle curate: quelle la distribuzione
"scuro + accento" ce l'hanno già nei dati, e applicarla anche lì la schiaccerebbe due volte. Alle
curate basta il tetto più alto — la stessa palette di prima ora dà `0.02 0.07 0.13 0.17 0.62`.

Dopo: luminanza media da 0,163 a 0,239, stop più chiaro da 0,320 a 0,605. Dark resta comunque la
più scura dopo Space (0,229) e mantiene il carattere notturno, ma con più contrasto. Monotonia
per luminanza sempre rispettata: 0 rampe invertite su 2000.

## 2026-08-28 — Categorie di palette (Forest, Autumn, Happy, Space, Dark, Neon)

Sette bottoni di categoria nella sezione "Colori casuali" del pannello Shader e in Palette:
indirizzano la generazione casuale — e il Loop — verso un genere di colori. "Tutte" è l'assenza
di vincolo, cioè il generatore libero.

Nuovo file `src/store/paletteCategories.ts`: per ogni categoria un **profilo generativo** (archi
di tinta con pesi, intervallo di saturazione, rampe di lightness, armonie ammesse) e un **seed
set** di 14 palette curate del genere. `randomPaletteColors(count, prev, category)` pesca dal
seed set nel 35% dei casi e genera nel profilo nel resto.

**Perché ibrido e non uno dei due puri.** Solo curate: con 14 palette e il Loop a 2s la sequenza
si esaurisce in mezzo minuto e ricomincia — il problema appena risolto. Solo procedurale: Forest
e Autumn hanno un'identità fatta di rapporti specifici (verde desaturato + marrone caldo) che la
generazione libera non centra sempre. Il seed set fa da àncora, il profilo porta la varietà; il
profilo tonale è riestratto anche sulle curate, quindi 14 palette × 3 rampe danno 42 esiti.

**Le palette da galleria non sono utilizzabili così come sono.** Misurata la luminanza degli stop
nell'ordine pubblicato: 4 su 6 palette campione non sono monotone e una (Happy di ColorHunt) è
decrescente. Lì i colori sono campiture affiancate, non una rampa. `normalizeCuratedColors` le
riordina per luminanza e rimappa l'escursione sul profilo tonale scelto — necessario anche
perché l'escursione pubblicata è spesso troppo stretta (una halloween tipica sta fra 0,12 e
0,47) e sull'effetto arriverebbe tutta scura. Si tocca solo la lightness: tinta e saturazione
restano intatte.

**Due difetti trovati dalla verifica, entrambi corretti:**

1. **Un terzo delle rampe non era monotono per luminanza percettiva** — difetto preesistente,
   non introdotto dalle categorie. La rampa cresce in lightness HSL, ma la gradient map indicizza
   per luminanza percettiva, e le due non coincidono: a parità di lightness un giallo è molto più
   luminoso di un blu, quindi con le armonie che spostano la tinta fra gli stop la gradient map
   invertiva il contrasto a metà rampa. Ora la rampa viene riordinata per luminanza in
   `randomPaletteColors`: non altera i colori né la tinta dominante (una media, indipendente
   dall'ordine). Misurato dopo: 0 rampe non monotone su 4200.
2. **La rotazione minima non si applicava al ramo curato**, che poteva restituire una palette a
   pochi gradi dalla precedente. Ora `pickCurated` prova fino a 6 candidate.

**Rotazione dentro una categoria.** `MIN_HUE_ROTATION = 70` non è applicabile tale e quale:
Forest vive in ~190° di arco totale, Autumn in ~125°. Dentro una categoria la soglia scala al 35%
dell'arco (`CATEGORY_ROTATION_SHARE`), e il vincolo resta comunque non sempre soddisfacibile —
misurata la rotazione fra palette consecutive, la mediana va da 51° (Autumn, la categoria più
stretta) a 126° (Happy, Neon), ma il minimo scende a 4–18°. È voluto: dentro una categoria stretta
lo stacco lo portano saturazione e profilo tonale, non la tinta. Senza categoria resta garantita
a 70°.

`Palette.category` è opzionale, quindi i progetti e i preset effetti salvati prima la leggono come
`undefined` → trattata come 'all': nessuna migrazione del database.

**Peso**: il bundle passa da 5655,10 a 5663,72 KiB di precache, +8,6 KB per 84 palette curate,
7 profili e la UI. Il costo a runtime resta quello di prima: il generatore gira una volta per
ciclo di Loop per layer, non per frame.

## 2026-08-28 — Generatore di palette casuali: varietà cromatica e tonale

Le palette casuali "sembravano sempre le stesse". Analizzando `randomPaletteColors` in
`src/store/paletteStore.ts` la causa non era una sola:

- **Struttura tonale congelata**: la lightness era `0.07 + t * 0.62`, deterministica (per 5 stop
  sempre `0.07 → 0.23 → 0.38 → 0.53 → 0.69`) e la saturazione sempre fra 0.75 e 1. Ogni palette
  aveva quindi la stessa curva "quasi-nero → tinta satura → chiaro": variava solo la tinta.
- **Tinta non percettivamente uniforme**: `Math.random() * 360` su HSL, dove il verde occupa 90°
  del cerchio e il giallo 25. Misurato su 4000 estrazioni: verde+blu+ciano nel 51% dei casi.
- **Nessuna memoria fra un'estrazione e l'altra**: due palette consecutive potevano cadere a
  pochi gradi di distanza, e col Loop attivo la sequenza si leggeva come colori ripetuti.
- **Solo 10 strutture cromatiche discrete** (5 armonie × 2 flip), che a `count` basso collassavano
  ulteriormente (con 2 colori `0/30` e `0/15` sono indistinguibili, come `0/180` e `0/150`).

Quattro interventi, tutti dentro `randomPaletteColors`:

1. `TONAL_PROFILES` — quattro rampe di lightness (cupa, standard, high-key, contrastata) estratte
   a caso al posto dell'unica fissa, e saturazione allargata a 0.35–1.0 così escono anche palette
   tenui e non solo fluo.
2. `HUE_FAMILIES` — la tinta si campiona scegliendo prima la famiglia percettiva (rosso, arancio,
   giallo, verde, ciano, blu, viola, magenta) e poi un punto nel suo arco: ogni famiglia esce con
   la stessa frequenza a prescindere da quanti gradi di cerchio occupa.
3. `MIN_HUE_ROTATION = 70` — la nuova palette viene generata ad almeno 70° di tinta dalla
   precedente, che ora `randomPaletteColors(count, prev)` riceve come secondo argomento.
   Aggiornati i chiamanti: `PalettePanel`, `EffectsPanel`, `use-palette-loop`.
4. `HARMONY_JITTER` — ±10° su ogni offset di armonia, così due estrazioni con la stessa armonia
   non danno rapporti cromatici identici.

**Il punto non ovvio**: il vincolo di rotazione e l'equalizzazione vanno ancorati alla tinta
**dominante** della palette, non alla tinta base. Nella prima stesura agivano su `baseHue` e la
verifica mostrava rotazione minima 0,0° e verde ancora al 20,6%: l'armonia sparpaglia gli stop
anche di 240°, quindi allontanare la base non sposta il colore che si percepisce. La versione
finale sceglie la dominante voluta e ricava la base per differenza — la media circolare pesata
ruota rigidamente con gli stop, perché i pesi (`stopWeight`) dipendono solo dalla lightness e non
dalla tinta, quindi la palette prodotta ha esattamente la dominante richiesta.

Misure su 4000 estrazioni, prima → dopo: famiglie di tinta da 7,5–24,8% a 11,7–13,9% (piatta);
freddi dal 51,4% al 35,5%; rotazione minima fra palette consecutive da 0° a 70°; combinazioni
tonali distinte da 1 a ~340 su 400 estrazioni.

**Costo**: nullo. Il generatore gira una volta per ciclo di loop per layer, non per frame: da 1167
a 1407 ns per chiamata, cioè 0,011 ms/s di CPU nel caso peggiore (8 layer a 1s) contro i 16,67 ms
di budget di un singolo frame a 60fps. Gli uniform restano cinque `vec3` e `easyvj_gradient` è
invariata: sulla GPU non cambia nulla.

## 2026-08-28 — Tooltip sostituito da HoverCard, componente rimosso

Installato `hover-card` con la CLI (`npx shadcn@latest add hover-card`) e rimosso
`src/components/ui/tooltip.tsx`. Gli usi erano tre:

- **`ControlRow.tsx`**, l'unico applicativo: l'icona "?" che apre la spiegazione di un controllo.
- **`main.tsx`**: il `TooltipProvider` che avvolgeva l'app. HoverCard non richiede provider, quindi
  è sparito e basta.
- **`sidebar.tsx`**: la prop `tooltip` di `SidebarMenuButton`. Quel componente non è usato da
  nessuna parte nel progetto, ma il ramo è stato convertito lo stesso per non lasciare il file
  generato a metà. Seconda divergenza da shadcn in quel file, dopo `keyboardShortcut`/`cookieName`.

Tre differenze fra i due componenti hanno richiesto una scelta, non una sostituzione meccanica:

- **Ritardo**: il `TooltipProvider` era a `delayDuration={0}`, HoverCard aprirebbe a 700ms. Per un
  aiuto contestuale 700ms si leggono come "non funziona", quindi `openDelay={150} closeDelay={100}`.
- **Larghezza**: `HoverCardContent` porta `w-64` fissa, il Tooltip era `w-fit max-w-xs`. Passato
  `w-auto max-w-64`, così un testo breve non resta in una card mezza vuota.
- **Aspetto**: da pillola scura (`bg-foreground text-background`, 12px, con freccia) a card popover
  (`bg-popover`, 14px, senza freccia). È il cambiamento voluto.

**Il dubbio sull'accessibilità era infondato, verificato invece che dato per buono.** Il commento in
`ControlRow` dice che il trigger è un `button` perché la spiegazione si raggiunga da tastiera, e la
documentazione Radix presenta HoverCard come componente per chi usa il mouse. Ma il `Trigger` di
Radix gestisce `onFocus`/`onBlur`, e provato nel browser: dando il focus al trigger (esattamente ciò
che fa il Tab) la card si apre. Quel commento resta valido.

Verificato anche l'hover reale: card a 256px, `data-side="right"` come da `hintSide`, zero nodi
`data-slot="tooltip*"` rimasti nel DOM. `tsc` pulito, `oxlint` senza nuovi warning.

## 2026-08-28 — Layer Inspector: il divisorio passa alla chrome fissa

Il bordo sotto la lista dei layer spariva appena si cominciava a scorrere, e sembrava che la sezione
"Proprietà" avesse un `border-t` che scivolava via col contenuto.

Non era così: il bordo stava sulla **Root** della `ScrollArea` (`border-t`) ed era immobile —
misurato, restava a y=239 prima e dopo lo scroll. A coprirlo era la **sfumatura**: parte dallo
stesso identico pixel del bordo, è alta 24px, ha `z-10` e `from-sidebar`, cioè in cima è opaca.
Accendendosi allo scroll si mangiava la riga sottostante. Da fuori l'effetto è indistinguibile da un
bordo che scorre via.

Ora il divisorio è il `border-b` del blocco fisso che contiene `LayerList`, cioè della chrome che
non si muove: sta *sopra* la sfumatura invece che sotto, quindi non può più essere coperto. La
sfumatura è rimasta identica. Verificato: divisorio a y=240, sfumatura da y=240 in giù, bordo
visibile sia a scroll 0 sia a scroll 260.

**Stesso schema, stesso difetto, nella colonna sinistra** (non toccato, fuori dalla richiesta): lì
il titolo del pannello ha `border-b` (1px, `oklch(1 0 0 / 0.1)`) e la `ScrollArea` ha *anche* un
`border-t` (1px, `/0.06`), entrambi sullo stesso pixel y=97. A riposo si vedono due righe adiacenti,
scorrendo la sfumatura ne copre una e il bordo cambia spessore. Basterebbe togliere il `border-t`
alla `ScrollArea`, come fatto a destra. Annotato in `TODO.md`.

## 2026-08-28 — TopToolbar: nav a sole icone quando lo spazio manca

Chiude il bug preesistente annotato poco sopra: sotto i ~1200px di viewport la toolbar andava in
overflow e l'ultimo pulsante — quello che apre la colonna destra — finiva sotto la sidebar `fixed`,
**irraggiungibile proprio mentre la colonna era aperta**, cioè quando serviva per chiuderla.

Le etichette dei cinque pulsanti della nav (Effetti, Palette, Progetti, Playlist, Output) spariscono
sotto soglia e restano le sole icone: misurato, libera **310px** contro i 38 che mancavano, quindi
copre con margine anche la modalità Live. Il nome resta nel `title`, che prima su quei pulsanti non
c'era e ora serve davvero.

**La soglia è sulla larghezza della toolbar, non della finestra** (`@container` sull'`<header>`,
supportato da Tailwind v4 senza plugin). Lo spazio utile cambia anche aprendo o chiudendo le due
colonne a finestra ferma: con una media query la toolbar non se ne sarebbe accorta. Verificato a
1200px con Live attivo — colonna destra aperta: 592px, sole icone; chiusa: 912px, le etichette
tornano; riaperta: spariscono di nuovo. Nessun overflow in nessuno dei tre stati.

Due soglie (`@max-[660px]` e `@max-[860px]`) perché in Live compare anche "Esegui in output", che
da solo vale quanto due pulsanti della nav.

Tolto `data-icon` dai pulsanti della nav, contro la regola generale della skill: serve al padding
asimmetrico fra icona e testo, ma qui il testo sparisce sotto soglia e lascerebbe l'icona fuori
centro di un paio di pixel. Il `px` simmetrico del variant la tiene centrata in entrambi gli stati.

## 2026-08-28 — La colonna destra diventa una Sidebar shadcn

Il Layer Inspector era un `<aside>` scritto a mano, montato con `{rightSidebarOpen && …}`: si
smontava di colpo invece di scivolare, non aveva `data-state`/`data-side`, e la maniglia di resize
ne duplicava inline le classi invece di riusare `SidebarResizeHandle`. Ora usa lo stesso
`<Sidebar side="right">` della colonna sinistra.

**Perché serve un secondo `SidebarProvider`**: il context ne regge una sola. Quello destro è
controllato dallo store (`open={rightSidebarOpen}` / `onOpenChange={setRightSidebarOpen}`), così il
pulsante in `TopToolbar` resta la fonte di verità e non nasce un secondo stato parallelo.

**Due prop nuove in `sidebar.tsx`**, entrambe con il default identico a prima, quindi la colonna
sinistra non cambia comportamento:

- `keyboardShortcut` (default `true`) — ogni provider registra il proprio listener su ⌘B chiamando
  il *suo* `toggleSidebar`: con due provider la scorciatoia muoveva entrambe le colonne insieme.
  Sul destro è `false`, ⌘B resta della sola sinistra (scelta dell'utente).
- `cookieName` (default `SIDEBAR_COOKIE_NAME`) — due provider che scrivono `sidebar_state` si
  sovrascriverebbero a vicenda. Al destro va `inspector_state`.

È una divergenza dal file generato da shadcn: un futuro `shadcn add sidebar` la sovrascriverebbe.

**Nota su quel cookie**: viene scritto ma **mai letto**. `defaultOpen` è sempre `true` e nessuno
legge `document.cookie` — quella scrittura serve all'SSR di Next.js, dove il server legge il cookie
e passa `defaultOpen`. In questa app, quindi, **nessuna delle due colonne ricorda il proprio stato
al reload**: tornano sempre aperte. Se un giorno servisse la persistenza vera, va letto il cookie
(o si usa localStorage come fa `playlistVisible`), non basta il componente.

Altri due dettagli del montaggio: il wrapper del provider è `flex min-h-svh w-full`, e in quella
riga flex `w-full` avrebbe preso tutta la larghezza — corretto con `className="w-auto min-h-0"`. E
`SidebarContent` porta `overflow-auto`, che avrebbe aggiunto un secondo scroll sopra la `ScrollArea`
già presente dentro `LayerInspector`: passato `overflow-hidden`.

`SidebarResizeHandle` ha ora una prop `side` ('right' di default, il bordo esterno della colonna
sinistra): la destra usa lo stesso componente invece delle 4 righe di classi duplicate.

Verificato in browser: entrambe le sidebar espongono `data-side`/`data-state` e la transizione
`left, right, width`; larghezze 288 e 320px, entrambe `position: fixed`. ⌘B porta la sinistra a
`collapsed` lasciando la destra `expanded`. Il pulsante in toolbar porta la destra a `collapsed`
**restando nel DOM** a `right: -320px` (prima si smontava), e il canvas si riprende lo spazio senza
salti. Riaprendola torna a 320px con la maniglia al suo posto. Console pulita.


Rifinitura successiva, sempre sulla stessa colonna:

- Il titolo "Layer Inspector" esce da `LayerInspector.tsx` e diventa un `<SidebarHeader>` in
  `ControlPage`, simmetrico all'header col logo della colonna sinistra. Con `h-12 p-0
  items-center justify-center` (il componente porta `p-2 gap-2`, che centrerebbe male un titolo su
  riga singola). Guadagnato anche un pixel di allineamento: la fascia era alta 49px contro i 48
  della TopToolbar e dell'header sinistro, e il bordo cadeva più in basso. Ora le tre fasce in cima
  chiudono tutte a 48px esatti, misurato.
- L'icona del pulsante che apre la colonna passa da `PanelRight` a **`Layers`**: dice cosa c'è
  dentro invece di dove si apre. Tolta anche la `size-4` scritta a mano, il variant `icon` la
  applica da sé (verificato: 16px).

**Bug preesistente trovato durante la verifica, non introdotto qui**: sotto i ~1200px di viewport
la TopToolbar va in overflow (servono 630px, ce ne sono 592) e il pulsante che apre la colonna
destra finisce sotto la sidebar, diventando **inaccessibile** quando la colonna è aperta. Misurato
sullo stato originale con `git stash`: prima delle modifiche di oggi ne servivano **635**, quindi
il problema c'era già ed era di 5px peggiore. Sopra i ~1350px non si manifesta. Annotato in
`TODO.md`: la toolbar non ha una strategia per lo spazio stretto (né wrap, né overflow scrollabile,
né riduzione a sole icone).

## 2026-08-28 — Audit skill shadcn e allineamento dei Button ai variant

Installata la skill `shadcn` (symlink `.claude/skills/shadcn` → `.agents/skills/shadcn`, tracciata da
`skills-lock.json`, non ancora committata). Audit delle sue regole sui 39 `.tsx` applicativi: già a
posto spacing (`gap-*`, zero `space-x/y-*`), `cn()`, dark mode, z-index. Restano da sistemare 69
icone con classe di sizing manuale, 44 colori raw Tailwind, 17 `<button>` nativi, 5 divisori
`border-t` al posto di `Separator`, 2 `SelectItem` fuori da `SelectGroup`.

Applicato a 13 file, in due lotti. Primo lotto, `MediaUploader.tsx` e `OutputLauncher.tsx`:

- Le icone nei `Button` passano da `className="size-4"` / `"size-3.5"` a `data-icon="inline-start"`.
  Il `button.tsx` installato dimensiona già le icone **per variant**
  (`[&_svg:not([class*='size-'])]:size-4`, `sm` → `size-3.5`, `xs` → `size-3`): il selettore è un
  `:not([class*='size-'])`, quindi ogni classe di sizing scritta a mano **disattivava**
  l'automatismo e bloccava l'icona su una misura che non seguiva più il variant. `data-icon` attiva
  in più il padding asimmetrico (`has-data-[icon=inline-start]:pl-2`).
- Il pulsante "Ripristina" aveva `size="sm"` **e** `className="h-7 gap-1.5 px-2 text-xs"`, cioè la
  riscrittura a mano di ciò che il variant `sm` già fa. Rimossi: ora è `className="press
  text-muted-foreground"`.

Secondo lotto, 25 icone in 11 file (`TopToolbar`, `EffectsPanel`, `PalettePanel`, `MaskPanel`,
`FxControlsPanel`, `PlaylistBar`, `LayerList`, `LayerProperties`, `AudioInputPanel`,
`ProjectsPanel`, `CameraPicker`). Due scoperte hanno ristretto il lavoro rispetto alle 69
occorrenze contate nell'audit:

- **`data-icon` vale solo per i Button con icona *e* testo**: dà il padding asimmetrico fra i due.
  Sui 35 `size="icon*"` non ha senso, non c'è padding da correggere. `MappingControls.tsx`, che
  l'audit indicava come il file peggiore con 14 occorrenze, è **interamente icon-only**: non è
  stato toccato. Le sue `size-3.5` su `size="icon-xs"` (che darebbe `size-3`) sono per giunta una
  scelta deliberata, 14px invece di 12px su una toolbar di 30 pulsanti — la regola della skill
  ammette esplicitamente le dimensioni custom.
- Dei 29 Button con icona+testo, ne sono stati modificati **23**: quelli dove la classe scritta a
  mano coincideva già con la dimensione del variant, quindi a rischio visivo zero. I 5 dove
  differisce restano invariati e sono annotati in `TODO.md`.

Rimosso anche `shrink-0` dove presente: è già nella base del Button (`[&_svg]:shrink-0`).

Il fix è stato scritto come script (`re` + un parser dei tag JSX) e non a mano, ma la prima
versione ha marcato `inline-end` una quindicina di icone che invece precedono il testo, per due
motivi entrambi di parsing: la fine del tag `<Button …>` cercata col primo `>`, che però cade
dentro le arrow function `() =>` degli `onClick`; e il prefisso dell'icona valutato senza
distinguere un'espressione JSX chiusa (`{control.name}`, contenuto che conta) da una graffa ancora
aperta (`{state.active ? <MicOff/> : …}`, wrapper che *contiene* l'icona e non la precede).
Corretti entrambi, restano 2 soli `inline-end`, che sono i due pulsanti con `justify-between`
(`ProjectsPanel` "Nuovo progetto", il toggle dei controlli booleani in `EffectsPanel`).

Terzo lotto, le regole restanti a rischio visivo nullo:

- **`SelectItem` dentro `SelectGroup`** in `CameraPicker.tsx` e `LayerProperties.tsx`: il gruppo è
  il contenitore che Radix si aspetta, senza cambia nulla a video ma la lista resta senza il ruolo
  ARIA corretto.
- **`h-N w-N` uguali → `size-N`**: 4 in `CornerPinOverlay.tsx` (maniglie di corner, curvatura e
  reticolo) e 1 in `EffectsPanel.tsx`. La `transition-[height,width]` delle maniglie continua a
  funzionare, `size-*` genera comunque `width` e `height`.
- **14 classi che riscrivevano il variant**: `h-8` su `size` default, `h-7` su `sm`, `text-sm` su
  default (che è già la base del Button). Rimosse: erano identiche a ciò che il componente applica
  da sé, quindi a video non cambia niente.

Restano aperte solo scelte di aspetto, elencate in `TODO.md`: `text-xs` contro il `text-[0.8rem]`
del variant `sm` (11 pulsanti), i colori raw, i divisori `border-t`, i `<button>` nativi.

Quarto lotto, su decisione dell'utente: `text-xs` rimosso da 13 `Button` con `size="sm"` (il
variant porta `text-[0.8rem]`, quindi il testo passa da 12px a 12,8px in top toolbar, pannello
Effetti, Palette e ingresso audio). In `TopToolbar.tsx` la classe stava dentro `cn()` e non nella
stringa letterale, quindi lo script non la vedeva: rimossa a parte in 3 punti.

Sempre per decisione dell'utente **restano invariati**, e non vanno riproposti come difetti:

- i **44 colori raw**: la palette dell'app è costruita su questi valori, e sugli overlay del canvas
  sono marker che devono restare leggibili sopra qualunque proiezione;
- i **5 divisori `border-t`**: `Separator` porta `data-horizontal:w-full`, che romperebbe lo
  stretch nel flex-col, e servirebbe `data-horizontal:w-auto` più l'override del colore — più
  codice del `div` attuale, per lo stesso risultato. Il commento in `ControlPage.tsx:53` già lo
  documentava.

Nota di metodo: gli script di sostituzione erano tre, e due hanno sbagliato qualcosa che il
type-check non poteva vedere (i `data-icon` invertiti; poi un `re.sub(r'\s+>', '>')` che ha
risucchiato il `>` di chiusura sulla riga dell'ultimo attributo, rompendo la formattazione
multi-riga di 10 tag). Entrambi corretti rileggendo il diff, non l'output dello script: su
modifiche di questo tipo il `git diff` è l'unica verifica che conta.

Verificato in browser sulla `/control` leggendo gli stili calcolati: "Ripristina" h 28px, font
12.8px (`text-[0.8rem]` del variant, prima 12px), gap 4px, `padding-left` 6px contro 10px a destra,
icona 14×14; "Apri finestra Output" e "Carica media…" h 32px, icona 16×16, `padding-left` 8px contro
10px. Il padding asimmetrico conferma che `data-icon` è attivo. `npx tsc -b --noEmit` pulito,
console senza errori nuovi.

## 2026-08-24 — `.gitignore`: configurazioni degli assistenti fuori dal repo

Le regole scritte a mano non funzionavano per due motivi indipendenti, entrambi corretti:

1. **Pattern sbagliato**: `*.claude` copre i file che *finiscono* in ".claude", non la cartella
   nascosta `.claude/`. Per una directory serve il nome con la barra. Ora: `.agents/`, `agents/`,
   `.claude/*`. La forma `.claude/*` (contenuto) e non `.claude/` (directory) è obbligatoria
   perché git non scende dentro una directory esclusa, e l'eccezione `!.claude/launch.json` non
   verrebbe mai valutata. `launch.json` resta tracciato di proposito: è la config del dev server,
   citata in CLAUDE.md e utile a chi clona.
2. **File già tracciati**: `.gitignore` non ha alcun effetto su ciò che è già nell'indice, e
   `.claude/skills/apple-design/SKILL.md` lo era. Rimosso con `git rm -r --cached .claude/skills`
   (resta sul disco, sparisce solo dal repo).

Nota: `AGENTS.md` — il file di istruzioni, gemello di CLAUDE.md — **resta tracciato**, non è
toccato da nessuna di queste regole. La cartella `.agents/` è un'altra cosa (contenitore locale di
skill installate, qui vuoto).

## 2026-08-24 — Shader "SD Shape Tunnel" (`src/shaders/sdShapeTunnel.glsl`) + uniform `uShapeCentroid`

Nuovo effetto richiesto dall'utente: il **profilo esterno** della sagoma replicato in copie sempre
più piccole che collassano verso il centro dell'oggetto (tunnel fatto con la forma dell'asset).

Come funziona: la copia i-esima è la sagoma scalata di `s(i)` attorno al centro, quindi per sapere
se il pixel appartiene a quella copia basta campionare la texture al punto de-scalato
`p = centro + (vUv - centro) / s`. Nessun passaggio extra, nessuno stato: tutto il tunnel si
disegna in un solo fragment. Il contorno **non** è un gradiente a differenze centrali (darebbe una
riga spessa un texel, invisibile sul proiettore) ma la media della sagoma su un anello di raggio
`lineWidth`: nel pieno vale 1, nel vuoto 0, sul bordo ~0.5 → `1 - |2m - 1|` è una banda centrata
sul profilo, larga e senza direzione privilegiata. Fuori dall'intervallo uv la sagoma vale 0,
altrimenti il ClampToEdge ripeterebbe i texel di bordo e ogni copia trascinerebbe quattro strisce.

Controlli: copie 3–40, velocità, modalità ciclo, prospettiva (lineare ↔ geometrica), spessore e
guadagno della linea, sfumatura verso il centro, glow, torsione progressiva, centro X/Y, scala
minima, shapeKey, sourceAmount, colore vicino/lontano. Campiona su `vUv` come tutta la famiglia SD:
la copia più grande deve coincidere esattamente con la sagoma, quindi Size/pan/kaleido non la
spostano. Costo: 6 prelievi per copia attiva — a 40 copie sono ~240 per pixel, è il primo slider da
abbassare se in Output cala il frame rate.

Le due modalità di ciclo (`cycleMode`): **continuo** = copie equispaziate, il tunnel non si svuota
mai; **a blocco** = le copie nascono **una dopo l'altra** dal bordo nella prima metà del ciclo e
percorrono il tunnel nella seconda, poi il quadro si svuota e la sequenza riparte. Prima versione
di "a blocco" sbagliata (`mix(offset, 1.0, f)`): comparivano tutte insieme e venivano aspirate
verso il centro — corretta su segnalazione dell'utente. Fuori dal proprio intervallo di vita la
copia viene saltata con `continue`, quindi non costa nemmeno un prelievo.

**Nuovo uniform globale `uShapeCentroid`** (baricentro della sagoma in uv, pesato sull'alpha):
serve perché il tunnel deve collassare verso il centro dell'**oggetto**, e su un palco o una
statua scontornata quel punto non coincide quasi mai col centro del quad. Calcolato su CPU una
volta alla decodifica dell'immagine (`computeCentroid` in `src/engine/mediaTexture.ts`, miniatura
96×96, una sola lettura di pixel) ed esposto da `MediaTextureController.getCentroid()`. Se
l'immagine è quasi tutta opaca — asset con sfondo **nero** invece che trasparente, caso frequente —
l'alpha non descrive nessuna sagoma e si ripiega sulla luminanza, come fa il luma key. La Y è
ribaltata perché le texture arrivano con `flipY`. Per video/camera/GIF il metodo è assente e resta
(0.5, 0.5): ricalcolarlo a ogni frame costerebbe una lettura di pixel per frame.
`ShaderPlane` rilegge il centroide ogni frame come fa con la texture, perché arriva in ritardo
rispetto al montaggio (fine decodifica).

**`holeFill` — solo il contorno esterno** (aggiunto subito dopo, su richiesta dell'utente): spegne
i bordi che stanno *dentro* l'oggetto — fori, finestre, dettagli della texture — e lascia il solo
profilo della silhouette. `stRim` da solo non li sa distinguere: per lui una finestra dentro il
palco e il profilo del palco sono la stessa transizione pieno/vuoto. Il discriminante è
l'**immersione** (`stFill`, media della sagoma su un anello LARGO di raggio `holeFill`): sul
profilo esterno metà dell'anello cade nel vuoto attorno all'oggetto (~0.5), sul bordo di un foro
più piccolo del raggio l'anello è quasi tutto dentro la sagoma (→1). Si tengono quindi i bordi con
immersione bassa. Per questo il controllo è un **raggio** e non un interruttore: un foro più
grande del raggio ha un bordo localmente indistinguibile da un profilo esterno e resta, quindi si
alza lo slider finché i dettagli da togliere spariscono. A 0 il ramo non viene eseguito e non
costa nulla; sopra sono 8 prelievi in più per copia.

**`ringDistance` + nascita sul bordo esatto** (terza richiesta dell'utente). `ringDistance` regola
la distanza fra le copie agendo sulla **profondità del percorso**: `u = v * ringDistance`, dove `v`
è la progressione relativa della copia nel proprio giro (0 → 1). A 1 (default, comportamento
precedente) il tunnel arriva fino al centro; sotto, le copie svaniscono a mezza strada e restano
più fitte fra loro. `life` si misura su `v` e non su `u`, altrimenti con un tunnel corto la
dissolvenza di fine giro non scatterebbe mai e le copie sparirebbero di colpo.

Prima versione sbagliata (segnalata dall'utente come "non funziona più il selettore continuo/a
blocco, resta sempre a blocco"): comprimeva gli **offset di partenza** (`i * ringDistance / N`).
Matematicamente avvicinava le copie, ma le raggruppava in un plotone seguito da un vuoto rotante,
quindi in "continuo" il risultato era indistinguibile da "a blocco" — il selettore funzionava
(verificato leggendo lo stato dei bottoni), era il rendering delle due modalità a coincidere.
Con la profondità il flusso resta continuo a qualsiasi distanza e le modalità tornano distinte.

Le copie sembravano nascere **lontano dai bordi**: la causa era il fade-in di nascita
(`smoothstep(0.0, 0.12, u)`), che le rendeva visibili solo dopo il 12% del percorso, quando erano
già rimpicciolite. Ora la rampa è 0.02, cioè praticamente istantanea: a u = 0 la copia coincide
esattamente con la silhouette ed è lì che si accende. Il pop non si vede perché la maschera del
layer taglia comunque tutto sul contorno. La morte resta morbida (0.86 → 1), altrimenti le copie
sparirebbero di scatto al centro.

Verificato nel browser con un PNG scontornato di prova (sagoma di palco con fori interni):
contorni concentrici che avanzano verso il baricentro in entrambe le modalità; con `holeFill` a ~25
i bordi delle finestre e dei fori spariscono e resta la sola silhouette (confronto A/B fatto con
`speed` quasi a zero, così le copie restano ferme fra i due scatti). Nessun errore in console,
`npx tsc -b --noEmit` pulito.

## 2026-08-22 — Pagina 404 (`src/routes/not-found/NotFoundPage.tsx`)

Qualunque URL fuori da `/control` e `/output` (prima cadeva su un `<Routes>` senza match, schermo
bianco) ora mostra una pagina 404 basic: "404" / "Pagina non trovata" / link "Torna all'app" verso
`/control`. Route catch-all `path="*"` aggiunta in fondo a `App.tsx`. Verificato nel browser
(URL inesistente → 404 → click sul link → arriva su `/control`). `npx tsc -b --noEmit` pulito.

## 2026-08-22 — Blocco a schermo intero da telefono (`MobileBlockOverlay.tsx`)

L'app non ha senso su un telefono (corner-pin, sidebar ridimensionabili, canvas WebGL): sotto i
768px ora compare un blocco a schermo intero non richiudibile invece di lasciar provare un layout
rotto. Un tablet in orizzontale (1024px+) resta sopra soglia e passa senza vederlo — di proposito
il testo non lo nomina, per non suggerire "prova comunque ruotando il telefono".

- **Nuovo componente** `src/components/layout/MobileBlockOverlay.tsx`: riusa `useIsMobile()`
  (`src/hooks/use-mobile.ts`, soglia 768px già esistente e già in uso altrove nel progetto per la
  sidebar — nessun hook nuovo). Overlay `fixed inset-0` sopra tutto (`z-100`), icona
  `MonitorSmartphone` di lucide-react, messaggio breve senza menzionare i tablet.
  Deciso con l'utente (AskUserQuestion) prima di implementare: bloccante e non richiudibile (non un
  avviso ignorabile), soglia sulla larghezza del viewport (non user-agent, così reagisce anche
  restringendo la finestra su desktop), attivo su entrambe le route.
- **Montato una sola volta** in `src/App.tsx`, fuori da `<Routes>`: copre sia `/control` sia
  `/output` senza doverlo inserire in ciascuna pagina.
- Verificato nel browser: a 390×844 (telefono) compare il blocco su entrambe le route; a 1024×768
  (tablet orizzontale) l'app resta pienamente utilizzabile, nessun overlay. `npx tsc -b --noEmit`
  pulito.

## 2026-08-22 — Titolo del pannello sinistro allineato a quello della colonna destra (`ControlPage.tsx`, solo UI)

L'utente aveva aggiunto a mano `bg-secondary/40` + testo centrato al titolo "Layer Inspector" della
colonna destra (`LayerInspector.tsx:38`). Applicato lo stesso trattamento al titolo condiviso dei
quattro pannelli della colonna sinistra (Effetti/Palette/Progetti/Output — un solo blocco, il testo
cambia via `PANEL_TITLE[activePanel]`): `src/routes/control/ControlPage.tsx`, il div che prima era
`shrink-0 px-4 pt-3.5 pb-2.5` è ora `flex shrink-0 justify-center border-b border-sidebar-border
bg-secondary/40 py-4.5` (stesso di destra, senza `px-4` perché il testo è centrato, non a bordo).
Verificato dall'utente nel browser. `npx tsc -b --noEmit` pulito.

## 2026-08-22 — Riposizionato il tasto di riduzione + tutti i pulsanti della toolbar di mapping ora shadcn `Button` (`MappingControls.tsx`, solo UI)

Due correzioni richieste dall'utente sulla toolbar appena rifatta: il tasto di riduzione a cavallo
del bordo era "parzialmente invisibile", e voleva ogni pulsante come componente shadcn `Button`
(molti erano ancora `<button>` nativi con classi scritte a mano).

- **Tasto di riduzione spostato dentro il riquadro.** Non più una badge assoluta `-top-2.5 -right-2.5`
  a cavallo del bordo (tagliata visivamente e poco leggibile su sfondo nero), ma un `Button` in coda
  alla riga 1, accanto a "Grande": la riga usa `justify-between` fra il gruppo di controlli a
  sinistra e il tasto, che finisce così nell'angolo in alto a destra ma **dentro** il riquadro.
- **Tutti i pulsanti custom convertiti a `<Button variant="ghost">`** (Tutti/TL/TR/BL/BR, lati,
  Fine/Medio/Grande, −1°/+1°, ⌃K/⌐K, Bordi/Reticolo, dimensioni reticolo, pillola compressa): la
  costante `CUSTOM_BUTTON` è sparita, non serviva più (feedback alla pressione e focus-visible
  arrivano gratis dal componente). Lo stato "attivo" (sfondo pieno viola/ciano/bianco) è ora una
  classe passata via `className`, non più una variante — servono colori custom (purple-500,
  cyan-500) che non hanno un token shadcn corrispondente.
  - **Bug preso e corretto prima di consegnare**: il primo tentativo componeva la classe hover a
    runtime (`` `hover:${bg}` ``) per evitare che l'hover di `variant="ghost"` sbiadisse la pillola
    selezionata. Tailwind genera le classi scansionando il *testo* del file, non l'output a
    runtime: una stringa costruita con un'interpolazione non produce mai la regola CSS
    corrispondente. Sostituito con tre costanti letterali (`PILL_ACTIVE_PURPLE/CYAN/WHITE`), una
    per colore, verificate poi nel browser (pillole "Tutti"/"Medio"/"Bordi" restano piene anche
    passandoci sopra col mouse).
- Verificato nel browser: tasto di riduzione ben visibile e cliccabile nell'angolo, collassa/espande
  con l'animazione già esistente, stato di selezione (Tutti, Medio, Bordi) intatto dopo un giro di
  collassa→espandi. `npx tsc -b --noEmit` pulito, nessun `<button>` nativo rimasto nel file.

## 2026-08-22 — Tasto di riduzione sulla toolbar di mapping + audit UI (`MappingControls.tsx`, solo UI)

Skill `apple-design` applicata alla toolbar flottante di posizionamento/mapping in basso a sinistra
nel canvas (`src/components/Positioning/MappingControls.tsx`). Decisioni concordate con l'utente
prima di implementare (AskUserQuestion): riduzione = collasso totale a sola icona (non una versione
compatta né uno zoom-out), tasto agganciato all'angolo in alto a destra del riquadro, stato
persistito in `localStorage` come l'altezza della playlist, più un audit esteso su feedback/a11y.

- **Nuovo tasto di riduzione** (`Minimize2`/`Maximize2` da lucide-react): comprime la toolbar a una
  pillola quadrata di 36px nello stesso angolo, lasciando il canvas sgombro durante un live. Stato
  in `localStorage['easyvj-mapping-toolbar-collapsed']`, letto pigro come `barHeight` in
  `PlaylistBar.tsx`.
- **Animazione**: stessa tecnica a due stadi di `CollapsibleSection` (§7 apple-design — entra ed
  esce lungo lo stesso percorso, non un semplice fade) — wrapper esterno che comprime l'altezza con
  `grid-template-rows: 1fr → 0fr` (`--dur-base`/`--ease-fluid`), contenuto interno che si dissolve
  un po' prima di schiacciarsi (`--dur-fast`). La pillola compressa vive nello stesso punto di
  ancoraggio (`origin-bottom-left`) e si materializza con opacità+scala, non con un fade piatto.
  **Attenzione alla combinazione con `.press`**: quella classe (CSS non layerizzato) vince sempre su
  `transition-property/duration/timing-function` contro le utility Tailwind layerizzate come
  `transition-colors` — per questo la pillola NON usa `.press` (userebbe la durata sbagliata,
  100ms invece di `--dur-base`, e droppherebbe l'opacità dalla lista animata), usa invece
  `active:scale-95` dentro lo stesso `transition-[opacity,transform]` che già controlla.
- **Audit UI** (lacune reali, non solo preferenza): i pulsanti "custom" testuali (Tutti/TL/TR/BL/BR,
  lati, passo frecce, −1°/+1°, ⌃K/⌐K, Bordi/Reticolo, dimensioni reticolo) non avevano feedback alla
  pressione né un contorno visibile da tastiera — ora condividono la costante `CUSTOM_BUTTON`
  (`.press` + `focus-visible:ring-white/50`, ring bianco perché il contesto è nero, non i token
  `--ring` dell'app pensati per superfici card/sidebar). Aggiunti gli `aria-label` mancanti su tutti
  i pulsanti icon-only (rotazione, scala, specchia/raddrizza, deforma superficie, reset, undo/redo,
  griglia/snap/test pattern, lucchetto, lati del mapping) — prima solo `title`, invisibile a chi
  naviga con screen reader senza hover.
- Verificato nel browser: collassa/espande con animazione, la pillola riapre la toolbar intatta
  (stato del warp mode, Bordi/Reticolo condizionali, tutti i controlli). `npx tsc -b --noEmit` pulito.

## 2026-08-22 — Etichette dei cursori nel popover clip allineate al pannello "Controlli" di sinistra (solo UI)

Le label di Size e dei parametri shader nell'editor clip (`ClipEditor` in `PlaylistBar.tsx`) usavano
`.ui-label text-foreground` (nome col peso pieno) e valore `.ui-value text-muted-foreground`: l'opposto
esatto del pannello "Controlli" della sidebar sinistra, dove label e valore vivono in `ControlRow`
(`src/components/layout/ControlRow.tsx`) come `.ui-sublabel text-muted-foreground` (grigio tenue,
maiuscola solo sulla prima lettera via `first-letter:uppercase`) e `.ui-value text-foreground/80`.
Riportate a questa combinazione — stesso font, stesso colore, stessa capitalizzazione — così l'editor
della clip e il pannello sorgente dei parametri si leggono come lo stesso linguaggio. Verificato nel
browser affiancando i due pannelli sullo stesso effetto (Morph Petal Bloom). `npx tsc -b --noEmit` pulito.

## 2026-08-22 — Skill `apple-design` applicata al popover "Opzioni clip" della Playlist (solo UI, nessuna logica toccata)

Seconda passata sulla stessa barra, questa volta sul popover che si apre dai tre puntini di ogni
clip (`ClipEditor` dentro `PlaylistBar.tsx`).

- **Sfumature invece di un taglio secco sui parametri.** La lista di Size + cursori dello shader
  (`max-h-56 overflow-y-auto`) non dava alcun segnale che continuasse oltre il bordo — niente
  scrollbar visibile a riposo, quindi con shader dagli 8+ controlli (es. famiglia SD) gli ultimi
  restavano nascosti senza indizi. Aggiunto `useEdgeScrollFade`, un hook locale (non condiviso: la
  lista è un `overflow-y-auto` semplice, non una Radix ScrollArea come `useScrollShadow` in
  `LayerInspector`) che sfuma bordo alto e basso solo quando c'è davvero altro contenuto oltre —
  ricalcolato anche al cambio di shader, quando il numero di cursori cambia sotto lo stesso scroll.
- **Footer separato in due gruppi.** "Cattura dal layer" (azione primaria di contenuto) e
  Duplica/Elimina (azioni di riga) erano nello stesso filo senza gerarchia visiva. Aggiunto un
  `<Separator orientation="vertical">` fra i due gruppi, stesso pattern già in uso nel trasporto
  della barra per separare play/loop dal toggle Smooth/Secca.
- Verificato nel browser (dev server temporaneo, chiuso a fine verifica) con uno shader a 8
  parametri: scroll funzionante, sfumatura alta/bassa che compare e sparisce coerentemente con la
  posizione, separatore del footer visibile. `npx tsc -b --noEmit` pulito.

## 2026-08-22 — Skill `apple-design` applicata alla barra Playlist (solo UI, nessuna logica toccata)

Stesso trattamento già dato alle due colonne laterali, ora sulla barra in fondo alla Control page
(`src/components/Playlist/PlaylistBar.tsx`): nessun handler, store o comportamento di riproduzione è
cambiato, solo superfici, tipografia e affordance.

- **Card dei clip allineate a `LayerList`.** Usavano `bg-card` su una barra `bg-sidebar` che in dark
  mode ha lo stesso valore: le card non avevano contrasto visibile contro lo sfondo. Ora `bg-sidebar-
  accent/25` (hover `/45`, corrente `/70`) come le righe layer della colonna destra, con
  `rounded-lg` invece di `rounded-md` per lo stesso raggio delle altre card dell'app.
- **Etichette dell'editor clip → token condivisi.** I quattro `text-[11px] font-medium uppercase
  tracking-wide text-muted-foreground` ripetuti a mano (Nome, Durata, Effetto, Colori effetto) sono
  ora `.ui-eyebrow`; i readout di Size e dei parametri shader sono `.ui-value` (cifre tabellari) con
  etichetta `.ui-label`, stessi token già in uso nel resto della sidebar.
- **Maniglie di resize rese scopribili (wayfinding, §16).** Sia quella dell'altezza della barra
  (bordo superiore) sia quella della durata di un clip (bordo destro) erano aree invisibili,
  scopribili solo passandoci sopra per caso. Ora mostrano un segno visivo permanente e leggero (grip
  pill in alto, filo verticale sul bordo del clip) che si accende al passaggio del mouse — l'area di
  presa non è cambiata, solo il segnale che la rende trovabile.
- **Indicatore "in riproduzione" più leggibile.** Bordo d'attacco del playhead acceso (`bg-primary/70`
  largo 1px) invece del solo riempimento translucido, più un puntino animato (`animate-pulse`) accanto
  al nome del clip corrente mentre è in play — stesso trattamento già usato per il loop-palette attivo
  in `LayerList`.
- **Azioni hover raggiungibili anche senza hover** (§10): il gruppo tre-puntini/elimina su ogni clip
  restava a `opacity-0` anche su device touch, dove `group-hover` non scatta mai — irraggiungibile.
  Aggiunta la stessa via d'uscita già usata da `.row-action`: `[@media(hover:none)]:opacity-100`.
- **Toggle Smooth/Secca differenziato.** Era sempre `variant="outline"` indipendentemente dallo stato:
  ora `secondary` quando attivo (smooth) coerente con gli altri toggle a due stati dell'app
  (`TopToolbar`: Live, pannelli, playlist visibile).
- Verificato nel browser (dev server temporaneo, chiuso a fine verifica): card vuote, con 1-2 clip,
  stato "in riproduzione", hover sulle azioni, editor del clip in popover. `npx tsc -b --noEmit` pulito.

## 2026-08-21 — Skill `apple-design` applicata alla sidebar sinistra (solo UI, nessuna logica toccata)

Passata la colonna sinistra allo stesso linguaggio della destra: nessun handler, store o comportamento
è cambiato, solo tipografia, gerarchia, feedback e larghezze.

- **Ruoli tipografici unificati.** Tutti i pannelli usavano `text-xs uppercase tracking-wide` per
  qualsiasi livello: titolo di sezione ed etichetta di slider gridavano uguale (§15). Ora i titoli
  sono `.ui-eyebrow`, le etichette dei controlli `.ui-sublabel` in maiuscolo iniziale, i valori
  `.ui-value` con cifre tabellari.
- **`ControlRow` condiviso** (`src/components/layout/ControlRow.tsx`): la riga etichetta/valore/hint
  esisteva in quattro copie leggermente diverse (EffectsPanel, FxControlsPanel, PalettePanel,
  OutputLauncher) più quella di LayerProperties. Ora è una sola; LayerProperties la avvolge per far
  uscire il tooltip a sinistra, verso il canvas. Il nome dell'uniform prende la maiuscola iniziale
  con `first-letter:uppercase` (non `capitalize`, che maiuscolava ogni parola delle etichette scritte
  a mano nella colonna destra).
- **Note lunghe → tooltip** nel pannello Output: gli hint stampati sotto ogni cursore occupavano più
  spazio dei controlli stessi. Stesso pattern `HelpCircle` già usato a destra (§16 Simplicity).
- **Intestazione del pannello** allineata a quella della colonna destra (`.ui-eyebrow`, `px-4`,
  stesso ritmo verticale) e bordo fisso sostituito dalla sfumatura che compare solo a scorrimento
  iniziato (§12). La logica è in `useScrollShadow` (`src/hooks/use-scroll-shadow.ts`), estratta da
  LayerInspector che la aveva inline.
- **Feedback alla pressione** (§1): classe `.press` su lista effetti, chip delle famiglie, preset
  palette, swatch, pulsanti dei pannelli; `focus-visible` sui bottoni custom che ne erano privi;
  transizioni agganciate ai token `--dur-*` / `--ease-*` invece dei default del browser.
- **Etichette più dirette** (§16): pannello "Sliders" → "Effetti" (descriveva il widget, non il
  contenuto), "Size" → "Scala" con nota che la distingue da "Dimensione" della colonna destra,
  "Controlli effetto" → "Controlli", tolto il titolo "Progetti" duplicato dentro il pannello
  Progetti, empty state esplicito per la lista dei progetti salvati.
- **Fix di larghezza (era un bug reale, non solo estetica).** Il Viewport di Radix ScrollArea rende
  il contenuto come `display: table`, che non scende mai sotto il proprio min-content: stringendo la
  sidebar il contenuto restava largo com'era e usciva oltre il bordo. In `ui/scroll-area.tsx` il
  figlio è ora `!block !w-full` — verificato a 240px (il minimo) su entrambe le colonne. La riga
  "Controlli" ha in più `flex-wrap`, perché i Button hanno `shrink-0` di serie e Reset/Random
  sarebbero comunque usciti.
- Verificato nel browser: i quattro pannelli (Effetti, Palette, Progetti, Output) a larghezza piena e
  al minimo, tooltip inclusi. `npx tsc -b --noEmit` e `npm run build` puliti.

## 2026-08-21 — Intestazione della colonna destra: allineata ai ruoli tipografici del resto della UI

Ripresa l'intestazione a due righe aggiunta a mano ("Layer Inspector" + "Layer selezionato: <nome>"),
lasciandone i testi e sistemandone la forma.

- Il titolo era `uppercase text-[0.875rem]`: un maiuscoletto da 14px, il testo più grande della colonna,
  che sovrastava il nome del layer. Ora usa `.ui-eyebrow` (11px/600), lo stesso di LAYERS, PROPRIETÀ,
  SORGENTE — verificato a runtime che corpo, peso, colore e tracking coincidano.
- Mancava il `px-4`: era l'unico testo appoggiato al bordo mentre tutta la colonna rientra di 16px.
- I tre span erano tutti `text-sidebar-foreground`, quindi senza gerarchia. Ora sono tre livelli (§15,
  peso + corpo + colore come insieme): etichetta indietro (12px/500 muted), nome del layer avanti
  (15px/600, pieno, `tracking -0.011em` come vuole il testo grande), conteggio in coda (11px muted).
- `<Separator />` sostituito dalla hairline `border-sidebar-border/60` usata negli altri divisori della
  colonna: quello pieno pesava più del titolo che stava separando.
- `h-12` fissa tolta (con un nome lungo il contenuto andava a capo e sfondava) e aggiunto `min-w-0` al
  contenitore, senza il quale `truncate` non ha effetto: verificato che un nome molto lungo tronchi
  invece di allargare la colonna.
- Tolti i due punti dopo "Layer selezionato": con l'etichetta muted e il nome in grassetto non servono.

## 2026-08-21 — "Sorgente" resta il posto del media: i suoi due cursori passano in "Proprietà"

`Rimuovi sfondo scuro` (luma key) e `Nitidezza bordo` erano proprietà del layer finite in mezzo al
caricamento del media. Spostati in "Proprietà" subito sotto Opacità, con le rispettive note passate nel
tooltip "?" come per gli altri cursori. `BackgroundKeyPanel.tsx` resta vuoto e viene **eliminato**.

Ordine della sezione: Nome layer → Blend mode → Dimensione (+Reset) → Opacità → **Rimuovi sfondo scuro →
Nitidezza bordo** → Curvatura obiettivo → Sfumatura bordi.

### "Adatta al preview" rimosso
Via il pulsante "Adatta immagine" e la sua informativa; `PositioningPanel.tsx` conteneva solo quelli ed è
stato **eliminato**. `requestFit()` continua a essere chiamato da solo dove serve davvero — al caricamento
di un media (`MediaUploader`), all'accensione della camera (`CameraPicker`) e sull'asset di default
(`lib/defaultAsset.ts`); quello che sparisce è la possibilità di **richiederlo di nuovo a mano** dopo aver
spostato o deformato la proiezione.

"Sorgente" ora contiene solo ciò che riguarda il media: caricamento file e ingresso video live.

Verificato in browser: ordine delle otto etichette, cinque tooltip agganciati, i due cursori spostati
scrivono nello store (riportati a "off" dopo la prova), pulsante e informativa spariti. `npm run build`
verde.

## 2026-08-21 — Via la sezione "Posizione": i suoi controlli continui passano in "Proprietà"

Il pad direzionale spostava la proiezione a passi di 0.05 — il modo lento di fare una cosa che il gesto
diretto sul canvas fa meglio (§2 della skill `apple-design`, la manipolazione diretta batte il comando a
scatti). Eliminato insieme all'intera sezione. Quel che restava erano tre valori continui, che ora vivono
in "Proprietà" insieme all'opacità.

### Ordine finale della sezione Proprietà
Nome layer → Blend mode → **Dimensione (+Reset) → Opacità → Curvatura obiettivo → Sfumatura bordi**:
l'opacità è scesa sotto la select insieme agli altri, così i controlli continui stanno tutti di seguito
invece di essere separati da una tendina. "Obiettivo" si chiama **Curvatura obiettivo**, che dice cosa fa
lo slider invece di nominare solo l'oggetto su cui agisce.

### File
- `LayerProperties.tsx` riscritto: accoglie i quattro cursori con un sotto-componente `ControlRow`
  (etichetta, valore sulla stessa riga, comando sotto) — uno solo per tutte le righe, così ciò che si
  somiglia si comporta uguale (§16 Craft).
- **Eliminati** `MovePanel.tsx` e `MappingOpticsPanel.tsx` (non più referenziati), voce `'move'` tolta da
  `LayerSection` e da `DEFAULT_SECTIONS` in `uiStore.ts` — `loadSections` fa merge sui default, quindi le
  chiavi rimaste nel localStorage sono innocue.

### Le note lunghe sono diventate tooltip
Curvatura obiettivo e Sfumatura bordi si portavano dietro 3-4 righe di spiegazione ciascuna: in "Proprietà"
avrebbero occupato più spazio dei controlli. Ora stanno dietro un "?" accanto all'etichetta, con il
**Tooltip nativo di shadcn** usato direttamente (`Tooltip`/`TooltipTrigger`/`TooltipContent`, provider già
globale in `main.tsx`) — nessun componente wrapper. Il trigger è un `button`, quindi la spiegazione si
raggiunge anche da tastiera.

### Il Reset ora tocca solo la Dimensione, e una conseguenza da conoscere
`resetActiveTransform` azzerava pan **e** zoom; sotto l'etichetta "Dimensione" avrebbe annullato anche il
posizionamento fatto sul canvas. Ora riporta solo `zoom` a 1.

Conseguenza: `transform.offsetX/offsetY` era scrivibile **soltanto** da quel pad, quindi da oggi nessun
controllo lo modifica più (il pan sul canvas muove i `corners`, che sono un'altra cosa; il "Pan X/Y" dei
Controlli globali agisce sullo shader dentro il quad, un'altra ancora). Un progetto salvato prima con un
offset ≠ 0 sarebbe rimasto spostato senza via d'uscita: per questo compare un "Ricentra la proiezione"
**solo** quando l'offset non è zero — sui progetti nuovi la riga non si vede mai.

Verificato in browser: sezione Posizione sparita, Reset che porta la dimensione a 1.00× e si disabilita a
default lasciando intatti opacità e obiettivo, tooltip che si apre col testo giusto, "Ricentra" invisibile
a offset zero. `npm run build` verde.

## 2026-08-21 — Skill `apple-design` installata nel progetto e applicata alla sidebar destra

Installata `.claude/skills/apple-design/SKILL.md` (da github.com/emilkowalski/skills, file singolo, scaricato
non modificato). Vale solo per questo progetto. Poi usata per rifare la colonna destra.

### Fondamenta condivise (`src/index.css`)
- Token di motion in un posto solo: `--ease-fluid` (`cubic-bezier(.32,.72,0,1)`, spring criticamente
  smorzato — nessun rimbalzo), `--ease-out`, e tre durate (`--dur-press` 100ms, `--dur-fast` 180ms,
  `--dur-base` 320ms). Le durate si azzerano sotto `prefers-reduced-motion: reduce`, quindi ogni
  componente che le usa eredita il comportamento senza doverlo gestire.
- Ruoli tipografici con tracking specifico per dimensione: `.ui-eyebrow` (maiuscoletto 11px, solo per i
  titoli di sezione), `.ui-sublabel` (12px maiuscolo iniziale, dentro le sezioni), `.ui-label`, `.ui-value`.
- Utility `.press` (scala 0.96 su `:active`) e `.row-action` (azioni di riga attenuate che si accendono
  in hover, piene dove l'hover non esiste).

### Gerarchia tipografica: 13 etichette che gridavano più del titolo che le conteneva
Le sotto-etichette dei pannelli erano `text-xs uppercase` (12px), i titoli di sezione 11px: le figlie erano
più grandi delle madri, e la colonna era una parete di maiuscoletto tutta sullo stesso piano. Ora il
maiuscoletto resta ai soli titoli di sezione; dentro si torna al maiuscolo iniziale (`.ui-sublabel`) in
`MediaUploader`, `CameraPicker`, `BackgroundKeyPanel`, `PositioningPanel`, `MaskPanel`, `MovePanel`,
`MappingOpticsPanel`.

### `CollapsibleSection.tsx`
Apertura animata con `grid-template-rows: 0fr → 1fr` invece di `{open && ...}`: il contenuto entra ed esce
lungo lo stesso percorso. `overflow: hidden` **solo durante** la transizione — a riposo torna `visible`,
altrimenti taglierebbe i popover ancorati ai controlli interni.

### `LayerInspector.tsx`
- L'intestazione porta il **nome del layer attivo** e il conteggio, non più la parola "Layer" che la lista
  sotto ripeteva già.
- Titoli di sezione più diretti: Asset → **Sorgente**, Mask → **Maschere**, Move → **Posizione** (e via il
  misto italiano/inglese).
- Sfumatura in cima all'area di scorrimento al posto del bordo fisso da 1px, visibile solo quando c'è
  davvero del contenuto nascosto sopra.

### `LayerList.tsx` — riordino con Pointer Events al posto dell'HTML5 drag & drop
L'HTML5 DnD dà solo un fantasma disegnato dal browser e nessun controllo sul movimento intermedio. Ora la
riga resta incollata al puntatore 1:1, le vicine scivolano per fare spazio, e ai bordi della lista la
resistenza cresce (rubber-band) invece di bloccarsi di colpo. Al rilascio la riga si posa sullo slot scelto
e **solo dopo** l'ordine cambia davvero, così non si vede alcun salto fra animazione e nuovo layout.

**La presa sta sulla maniglia a pallini, non su tutta la riga** (scelta dell'utente): il corpo della riga
resta dedicato alla selezione. L'icona è di 14px ma l'area che risponde è allargata di ~8px per lato con uno
pseudo-elemento, che era il vero motivo per cui in una prima versione la maniglia risultava introvabile.

**Due errori commessi e corretti durante il lavoro, entrambi non ovvi:**
1. **Lo stato del drag non può stare in `useState` se l'updater ha side-effect**: in `StrictMode` React
   invoca gli updater due volte per verificarne la purezza, e il mio avviava lì il timer di commit → il
   riordino veniva applicato due volte e si annullava da solo. Ora il drag vive in una `ref` e lo stato è
   solo il suo riflesso per il render.
2. Al commit i transform vanno azzerati **senza** transizione (un frame di `settling`): React riusa i nodi
   per `key`, quindi la riga già disegnata nella posizione giusta animerebbe una seconda volta un movimento
   che l'occhio ha appena visto.

Verificato in browser: drag di 1 e di 2 slot dalla maniglia, trascinamento dal nome del layer (seleziona e
non riordina), click sotto soglia, nessun transform residuo, console pulita, `npm run build` verde.

## 2026-08-21 — Morph Morphogen Growth: reaction-diffusion VERA (primo effetto con stato)

Su richiesta esplicita (riferimento visivo: uno screenshot di photismapp), il quarto Morphogen non e' analitico come gli altri tre ma una **Gray-Scott vera**, con lo stato che si accumula frame su frame. E' il primo effetto della libreria che non e' una funzione pura della uv e del tempo, e per reggerlo l'engine ha ora un percorso **multipass**.

### Come e' fatto

- **`isfParser.ts`** — un file `.glsl` puo' ora dichiarare, fra i marcatori `//! SIMULATION` e `//! DISPLAY`, un passo di simulazione (`vec4 simulate(sampler2D state, vec2 uv, vec2 texel, float phase)`) oltre al solito `processColor`. L'intestazione (uniform e costanti) finisce in **entrambi** i programmi, cosi' i controlli sono leggibili sia da chi evolve lo stato sia da chi lo disegna. Il wrapper della simulazione fornisce `easyvj_lap` (laplaciano a 9 punti), `easyvj_seedMask` e `easyvj_sourceUv`; quello di disegno riceve `uSimState`, `uSimTexel`, `uSimPhase` e `easyvj_simUv`.
- **`engine/simulation.ts`** (nuovo) — coppia di render target in ping-pong, **toroidali** (`RepeatWrapping`: il laplaciano ai bordi legge il lato opposto, quindi il pattern non ha mai una cucitura comunque lo si mappi). Griglia 320x320: non e' una scelta di qualita' ma di tempo, le strutture di Gray-Scott hanno taglia fissa in texel e su 512 la colonia impiegava minuti a riempire il campo.
- **`engine/SimulationPass.tsx`** (nuovo) — fa girare i passi e consegna lo stato al materiale. Il conteggio e' agganciato al **tempo trascorso** (150 passi/s a velocita' 1, tetto di 8 per frame), non ai frame: due finestre a fps diversi devono arrivare allo stesso numero di passi.
- **`EffectsPanel.tsx` + parser** — nuovo marcatore `@options a|b|c`: un uniform float che rappresenta una scelta fra modi si renderizza come gruppo di bottoni invece che come slider a scatti (`seeds`, `lifecycle`).

### Due errori che sono costati tempo, entrambi non ovvi

1. **Il dizionario di uniform passato a `<shaderMaterial>` non e' quello che il materiale usa.** Scrivevo `uSimState` sull'oggetto memoizzato passato come prop, e non arrivava nulla: R3F, applicando la prop, non lascia in giro lo stesso oggetto. Tutto il resto dell'aggiornamento per-frame infatti passa da `materialRef.current.uniforms` — ora anche la simulazione. Sintomo: lo shader leggeva la texture di **fallback** (bianca), quindi il quadro era di colore pieno invece che nero.
2. **A mezza precisione Gray-Scott cambia regime.** Con `HalfFloatType` la crescita produceva un tappeto di macchie invece del labirinto: vicino a 1.0 l'ulp di un half float vale circa 0.001, ed e' esattamente li' che vive il substrato non consumato, quindi gli incrementi piu' piccoli sparivano e la coda che alimenta il fronte non si formava. Con `FloatType` (quando la GPU sa filtrarlo, altrimenti si ripiega su half) il regime corretto e' comparso subito.

Inoltre: **`active` e' parola riservata in GLSL ES** — gia' annotato per gli altri Morphogen, ricapitato qui.

### Comportamento

`speed`, `scale`, `pattern`, `growTime`, `seeds` (1-5), `posX/posY`, `lifecycle` (Matura | Ciclo | Manuale), `cycleTime`, `restart`, `symmetry`, `sharpness`, `glow`, piu' i soliti `sourceInfluence`/`blendAmount`/`blackThreshold`. La luminanza del media sposta **feed e kill locali** (di millesimi: la mappa di Gray-Scott e' ripidissima), quindi il rilievo della statua guida davvero la reazione invece di limitarsi a mascherarla. `speed` a 0 congela il pattern, ed e' un gesto utile in live.

I tre regimi sono punti noti della mappa (F, k): crescita `coral` (0.0545, 0.0620), maturo `mitosis` (0.0367, 0.0649) oppure `maze` (0.0290, 0.0570) secondo `pattern`. La transizione e' larga apposta: cambiare (F,k) di colpo fa collassare le strutture gia' formate.

### Sincronizzazione Control/Output — cosa vale e cosa no

Verificato con le due finestre affiancate: i parametri viaggiano (provato con `scale`) e il **Restart si propaga**, riavviando entrambe le colonie insieme. Il ciclo automatico e' derivato dall'orologio di sistema (`Date.now()`), quindi le due finestre resettano nello stesso istante senza scambiarsi nulla.

Resta un limite, da conoscere: in modalita' **Matura**, due finestre avviate in momenti diversi mostrano due realizzazioni diverse della stessa colonia (stesso regime, disegno diverso), perche' non c'e' un istante di partenza condiviso. **Un click su Restart le riallinea.** Nota di contorno emersa qui: `uTime` viene da `state.clock.elapsedTime`, che parte da zero all'apertura di *ciascuna* finestra — anche gli altri 106 shader sono quindi in fase diversa fra anteprima e proiettore, cosa che non si nota perche' sono ciclici.

Misurato a 120 fps (limite del vsync) con la simulazione attiva: il costo dei passi e' trascurabile.

## 2026-08-21 — Tre effetti Morphogen: pattern di Turing, micelio, mitosi

Nuova mini-famiglia di effetti morfogenetici (i pattern che in biologia nascono dalla diffusione dei morfogeni), tutti e tre nella famiglia **Morph** e tutti con lo stesso controllo `sourceInfluence` (0 = generativo puro che riempie la sagoma, 1 = geometria guidata dalla luminanza dell'immagine).

**Vincolo di partenza**: una reaction-diffusion vera (Gray-Scott) e' iterativa e ha bisogno di un buffer di stato in ping-pong, che la pipeline non ha — `isfParser.ts` compila un solo fragment shader per layer, senza texture di stato. I tre pattern sono quindi ottenuti in forma analitica: stesso risultato visivo, ricalcolato a ogni frame invece che accumulato (in piu' non ha stato da resettare e non puo' divergere durante un live).

- **`morphMorphogenTuring.glsl`** — macchie e labirinti. Il campo e' una somma di 12 onde piane con la STESSA lunghezza d'onda, direzioni sull'angolo aureo e fasi che derivano a velocita' diverse: e' il modello matematico del pattern di Turing (la reazione seleziona una sola lunghezza d'onda e lascia libere direzione e fase), quindi le macchie hanno tutte la stessa taglia. Un fbm darebbe chiazze di ogni dimensione, cioe' una nuvola. Lo slider `pattern` muove solo la soglia: frazione coperta bassa -> isole separate, meta' esatta -> labirinti connessi. Prima di arrivarci ho provato l'interpolazione fra due formule diverse (macchie e `abs()` per le bande): a meta' corsa i due campi si cancellano e il pattern sparisce — scartata.
- **`morphMorphogenMycelium.glsl`** — rete di ife che cresce dal centro. I filamenti sono le **isolinee** n = 0.5 di un value noise ciclico sull'angolo, non le creste di un ridged noise: le creste si spezzano dove il massimo locale non tocca il valore pieno, le isolinee invece sono continue, si biforcano sulle selle e si richiudono in anelli. La distanza dalla isolinea e' divisa per il gradiente, altrimenti dove il campo e' piatto la fascia si apre in chiazze larghe invece di restare un filo. Tre generazioni con rami raddoppiati, ognuna attiva solo oltre una certa distanza dal centro. Scartati per strada: la raggiera di isolinee angolari (rami sempre rettilinei, o fusi in pennellate se si alza il warp) e il ridged noise puro.
- **`morphMorphogenMitosis.glsl`** — tessuto di cellule che si dividono. Voronoi con **due nuclei per cella**: quando si separano, il bordo che nasce fra loro taglia la cella in due, quindi la citocinesi viene dalla geometria e non da un'animazione disegnata. Il secondo nucleo entra in gioco solo oltre una separazione minima (`split`): con i nuclei coincidenti `f2 - f1` vale zero su tutta la cella e la cella si riempiva interamente di membrana — era il bug delle "celle bianche" viste al primo test. L'escursione totale (wobble + separazione) resta sotto mezza cella, oltre i nuclei uscirebbero dal vicinato 3x3 e i bordi si spezzerebbero.

Note trasversali:
- Tutti e tre correggono `uQuadAspect`: su un mapping largo le macchie diventerebbero ellissi e le cellule si schiaccerebbero.
- Il gate `blackThreshold` e' pesato su `sourceInfluence`, cosi' a 0 il pattern copre tutta la sagoma anche sulle zone scure dell'immagine (a differenza degli altri Morph, che sono sempre source-driven).
- **`active` e' parola riservata in GLSL ES**: usarla come nome di variabile fa fallire la compilazione del fragment con "Illegal use of reserved word" e il canvas resta nero. Rinominata in `split`.

Verificato nel browser (dev server su :5173) su tutti e tre: nessun errore GLSL in console, gli estremi di `pattern` (isole / labirinti), `sourceInfluence` a 0 e a 0.6 con `default-stage.png` caricato — il pattern segue il rilievo della statua e resta ritagliato dai bordi del PNG.

## 2026-08-21 — Fix riga doppia fra sliders e "Controlli globali"

Dopo il fix del padding (voce precedente), il divisorio fra la fine degli sliders e "Controlli globali" era doppio: il `<Separator />` originale (fra `EffectsPanel` e il gruppo) più un `border-t border-sidebar-border` aggiunto sul gruppo per dargli un bordo proprio — due righe vicine invece di una.

- **`ControlPage.tsx`**: rimosso il `<Separator />` ridondante, tenuto solo `border-t border-sidebar-border` sul `div.-mx-4` che avvolge le due `CollapsibleSection` — un solo divisorio, con lo stesso token di colore già usato dal `border-b` interno di `CollapsibleSection` (più coerente del `bg-border` generico di `Separator`). Import di `Separator` rimosso, non più usato in questo file.
- Ripristinato anche lo stile del file (virgolette singole, niente punto e virgola, JSX multi-riga): un format-on-save dell'IDE con impostazioni diverse da quelle del progetto aveva riformattato l'intero file in un salvataggio precedente, senza modifiche di sostanza a parte il `border-t` aggiunto a mano — nessun'altra riga di codice è cambiata di significato.

## 2026-08-21 — Fix padding doppio nelle sezioni collassabili della sidebar sinistra

Le due sezioni appena rese collassabili (voce precedente) avevano il testo del titolo rientrato di 36px in più rispetto a "COLORI CASUALI"/"CONTROLLI EFFETTO" sopra di loro, invece di allinearsi come fanno a destra.

- **Causa**: in `ControlPage.tsx` tutto il pannello Shader vive dentro `<div className="p-4">`, mentre a destra `CollapsibleSection` sta in una `ScrollArea` senza padding proprio. Il `px-4` di `CollapsibleSection` si sommava al `p-4` del wrapper (16+16=32px) invece di essere l'unico inset. Misurato nel browser: "CONTROLLI GLOBALI" a x=52 contro "COLORI CASUALI" a x=16 (stessa colonna); a destra "PROPRIETÀ" sta a 37px dal bordo dell'aside, che è il valore corretto (px-4 + chevron + gap).
- **`ControlPage.tsx`**: le due `CollapsibleSection` sono avvolte in un unico `<div className="-mx-4">`, che annulla il padding orizzontale ereditato dal wrapper e riporta il `px-4` di `CollapsibleSection` a essere l'unico inset — stesso risultato della colonna destra (verificato: x=36, contro i 37 di destra, 1px di arrotondamento). Rimosso anche il `<Separator />` fra le due sezioni: con `last:border-b-0` che ora si applica correttamente dentro il gruppo, il divisorio fra "Controlli globali" e "Preset salvati" lo dà il `border-b` di `CollapsibleSection` stesso, senza righe doppie.
- Non toccato `CollapsibleSection.tsx`: la colonna destra non aveva il problema (il suo contenitore non ha padding proprio) e non doveva essere modificata.

## 2026-08-21 — Sidebar sinistra: "Controlli globali" e "Preset salvati" collassabili

Su richiesta dell'utente, le due sezioni in fondo al pannello Shader si comportano ora come quelle della colonna destra (Proprietà/Asset/Mask/Move): chevron cliccabile, stato ricordato tra le sessioni.

- **`store/uiStore.ts`**: `LayerSection` esteso con `'fxControls' | 'effectPresets'`, di default aperte (`DEFAULT_SECTIONS`) — comportamento invariato per chi apre l'app la prima volta. Il tipo e `CollapsibleSection` non erano davvero legati alla sola colonna destra: solo la documentazione lo era, aggiornata di conseguenza.
- **`FxControlsPanel.tsx`** e **`EffectPresetsPanel.tsx`**: tolto il titolo maiuscolo che disegnavano da soli (ora lo fornisce `CollapsibleSection`, come già fanno `LayerProperties`/`MaskPanel`/`MovePanel` a destra). In `FxControlsPanel` il pulsante Reset resta, spostato da `justify-between` con l'ex titolo a `justify-end` da solo.
- **`ControlPage.tsx`**: i due pannelli sono avvolti in `<CollapsibleSection section="fxControls" title="Controlli globali">` e `<CollapsibleSection section="effectPresets" title="Preset salvati">`, riusando il componente già esistente in `components/Layers/`.

Verificato nel browser: chevron e persistenza dopo reload identiche alla colonna destra, nessun errore in console, nessuna riga doppia nel punto di giunzione con i `<Separator />` esistenti.

## 2026-08-21 — Fix bug: la cornice corner-pin spariva dopo aver selezionato una maschera e cambiato layer

Selezionando una maschera su un layer e passando poi a un altro layer, la cornice viola col corner-pin non tornava più: nemmeno il tasto "Nascondi/mostra i riferimenti di mapping" la faceva ricomparire, serviva un refresh della pagina.

- **Causa**: `activeMaskId` in `layersStore` è una selezione *per-layer*, ma nessuna delle azioni che cambiano `activeLayerId` la azzerava. `ControlPage` decideva quale overlay montare con `activeMaskId != null` (`editingMask`), quindi restava montato `MaskOverlay` al posto di `CornerPinOverlay`; e siccome `MaskOverlay` disegna solo le maschere del layer *attivo*, sul nuovo layer non disegnava nulla — canvas apparentemente senza overlay. Il toggle `overlaysVisible` alternava fra "niente" e "niente", mentre il refresh funzionava solo perché `activeMaskId` riparte da `null`.
- **`layersStore.ts`**: `selectLayer` azzera `activeMaskId` quando il layer cambia davvero (no-op se si riclicca quello già attivo). Stessa pulizia in `addLayer`, `duplicateLayer`, `removeLayer` (solo se cancella il layer attivo), `setScene`, `beginSceneCrossfade` e in `undoMapping`/`redoMapping` (che spostano la selezione sul layer dello snapshot).
- **`ControlPage.tsx`**: `editingMask` non si fida più del solo `activeMaskId` — verifica che la maschera esista fra quelle del layer attivo. Rete di sicurezza: qualunque percorso futuro dimentichi l'azzeramento, l'overlay non può più restare bloccato su una maschera irraggiungibile.

Verificato nel browser (dev server su :5173): creato Layer 2, aggiunta una maschera rettangolo, selezionata (corner-pin sostituito dalle maniglie della maschera come previsto), poi click su Layer 1 → cornice viola coi pin di nuovo visibile; tornando su Layer 2 la maschera resta applicata al layer ma non più selezionata, quindi si vede il corner-pin.

## 2026-08-21 — Halo: toggle mirror interno + controllo speed per-shader su tutti i 12 effetti

Molti effetti della famiglia Halo specchiano internamente la texture sorgente (`uv_sym = vec2(0.5 + abs(uv.x - 0.5), uv.y)` dentro `processColor`, indipendente dal Mirror X/Y globale del pannello Controlli globali, che agisce *prima* su un'altra copia della uv). Non c'era modo di disattivarlo, e nessuno shader Halo esponeva un controllo di velocità proprio (solo il moltiplicatore di tempo globale `uFxSpeed`, uguale per qualsiasi effetto).

- **`isfParser.ts`**: `UNIFORM_RE` ora riconosce un marcatore opzionale `@step N` dopo `@default`; `UniformControl` ha un campo `step?` corrispondente. Serve a distinguere, lato UI, un controllo booleano (`@min 0 @max 1 @default 1 @step 1`) da uno slider continuo che usa lo stesso range (es. `intensity`).
- **`EffectsPanel.tsx`**: i controlli con `step === 1 && min === 0 && max === 1` si renderizzano come bottone on/off (icona `Power`, stile identico a Mirror X/Y nei Controlli globali) invece che come slider continuo.
- **`layersStore.ts`** (`randomizeActiveParams`): rispetta `control.step` invece di usare sempre `(max-min)/200` — altrimenti "Random" avrebbe scelto un valore intermedio (es. 0.37) per un uniform pensato come booleano, che lo shader legge poi con `mix(...)`.
- **12 shader `.glsl`** (`symmetricalHaloSwirl[-2]`, `haloPetalKaleido`, `haloRadialKaleido`, `haloLiquidSymmetry`, `haloSpiralDrift`, `haloTwinVortex`, `haloMirrorBloom`, `haloPrismaticSwirl`, `haloMandala`, `haloFractalBloom`, `haloConcentricPulse`): aggiunto uniform `mirror` (default 1 = comportamento identico a prima, `uv_sym = mix(uv, ..., mirror)`) a tutti tranne `haloRadialKaleido` (non ha mirror interno: la sua simmetria viene dal folding angolare, non da uno specchio pixel). Su `haloMirrorBloom` e `haloConcentricPulse` (che specchiavano già su entrambi gli assi) un solo bottone `mirror` disattiva X e Y insieme.
- **Uniform `speed`** (`time * speed`, min 0 max 3 default 1) aggiunto a 10 shader su 12: escluse `haloLiquidSymmetry` (l'uniform `flow` già esistente scala il dominio del noise nel tempo) e `haloConcentricPulse` (l'uniform `pulse` già esistente scala la frequenza dell'anello) per non duplicare un controllo che c'era già.
- Extra solo su `symmetricalHaloSwirl` e `symmetricalHaloSwirl-2` (unici due shader quasi identici della famiglia): smontate due costanti hardcoded in uniform — `swirlAmount` (torsione dello swirl, prima fissa a 0.12) e `petals` (righe del fiore in `makeFlower`, prima fisse a 8.0).

Verificato nel browser su tutti e 12 gli shader (dev server già attivo su :5173): nessun errore di compilazione GLSL in console, bottone Mirror e slider speed/swirlAmount/petals presenti e funzionanti (petals portato a 20 cambia visibilmente il numero di petali del fiore).

## 2026-08-20 — Pannello Progetti: pulsante "Nuovo progetto" con conferma di salvataggio

Prima si poteva solo salvare/caricare/eliminare progetti già esistenti: non c'era modo di ripartire da zero senza ricaricare la pagina (che perde comunque lo stato solo se non c'è autosave).

- **`newProject()`** in `persistence.ts`: azzera la scena a un solo layer vuoto (`createLayer` + `setScene`) e resetta la playlist (`setPlaylistData(undefined)`), senza toccare i progetti già salvati su IndexedDB.
- **`AlertDialog`** (`src/components/ui/alert-dialog.tsx`): nuovo wrapper su `radix-ui`'s `AlertDialog` primitive, sullo stesso modello di `sheet.tsx`. Primo dialog modale del progetto — prima esisteva solo lo `Sheet` (drawer laterale).
- **`ProjectsPanel.tsx`**: il tasto "Nuovo progetto" apre il dialog con tre azioni — *Annulla*, *Non salvare* (chiama `newProject()` diretto), *Salva e nuovo* (disabilitato finché non c'è un nome nel campo dedicato del dialog, poi `saveProject` + `newProject`). Non esiste un dirty-flag nello store: il dialog compare sempre al click, non solo quando ci sono modifiche non salvate (scelta deliberata, coerente con l'assenza di tracking esistente — vedi `isSceneEmpty()` in `persistence.ts`, che è un'euristica per l'autosave, non un vero dirty flag).

## 2026-08-20 — Barra playlist: azioni in hover sui clip e toggle di visibilità

### Il clip non è più cliccabile (`PlaylistBar.tsx`)

Prima l'intero blocco del clip era il trigger del popover, e aprire l'editor applica il look al layer come anteprima: durante un live un click accidentale mandava in onda l'effetto sbagliato. Ora il blocco è solo trascinabile (riordino) e in hover compaiono due icone in alto a destra:

- **tre puntini** (`MoreHorizontal`) → apre lo stesso pannello editor di prima (con l'anteprima sul layer, che ora è una scelta esplicita);
- **cestino** (`Trash2`) → `removeClip`, che toglie il clip **solo dalla playlist**: shader e preset restano nella libreria.

Le icone restano visibili anche con l'editor aperto (`focus-within` + stato `isEditing`), e il contenitore ha `draggable={false}` per non far partire il drag del clip dal pulsante.

### Toggle "Playlist" nella barra in alto (`TopToolbar.tsx`, `uiStore.ts`)

Nuovo bottone fra *Progetti* e *Output* che mostra/nasconde la barra playlist (`playlistVisible`, persistito in `localStorage` con chiave `easyvj-playlist-visible`). Non è un `Panel` della sidebar, quindi la nav è divisa in due gruppi con il bottone in mezzo.

La barra viene nascosta con `hidden` (display:none) e **non smontata**: il motore di riproduzione (`usePlaylistPlayback`) vive dentro `PlaylistBar`, smontarlo fermerebbe la sequenza in corso.

## 2026-08-20 — Mapping, seconda parte: reticolo, keystone, correzione obiettivo, soft edge, undo/redo

Completate le voci rimaste dal brainstorming sul canvas di mapping. Tutta la matematica nuova è stata verificata in browser importando i moduli veri, non a occhio.

### Reticolo di nodi (la terza modalità concordata)

`Warp` ha ora un `mode` (`bezier` | `grid`) e un reticolo opzionale di celle 2×2…4×4 (3×3…5×5 nodi). Le due modalità sono **alternative e non si sommano**, ma i dati dell'altra restano memorizzati: si torna indietro senza rifare il lavoro.

L'interpolazione è Catmull-Rom bicubica sui nodi. **La trappola**: fuori dai bordi i nodi fantasma non vanno clampati ma **estrapolati linearmente** (`P₋₁ = 2P₀ − P₁`). Col clamp la tangente al bordo verrebbe dimezzata e la superficie si affloscerebbe lì anche a reticolo fermo, rompendo l'identità. Con l'estrapolazione l'identità è esatta: errore misurato 1.1e-16.

Altre invarianti verificate: i nodi sono interpolati esattamente (3.1e-16), i 4 angoli restano ancorati al corner-pin (3.1e-16), il flip andata/ritorno è esatto (0).

Cambiare densità **conserva la forma solo approssimativamente**: i nodi nuovi cadono esattamente sulla superficie vecchia (errore 0), ma fra un nodo e l'altro la spline è un'altra e su una deformazione marcata lo scarto misurato arriva a 0.042 in spazio unitario. È inerente al passare a un reticolo che non contiene il precedente, non un difetto da correggere.

**Difetto trovato provando la UI**: con reticolo 3×3 i nodi di bordo cadono esattamente sotto le maniglie a rombo di selezione del lato — due maniglie diverse sovrapposte, ingovernabili. Le maniglie del lato ora spariscono mentre si lavora col reticolo; il lato resta selezionabile dai pulsanti della toolbar.

### Correzione dell'obiettivo (barile / cuscino)

Deformazione radiale in spazio unitario, applicata sopra la modalità attiva. Il fattore è costruito per **lasciare fermi i 4 angoli** (a raggio d'angolo vale 1), così si corregge l'ottica senza perdere l'allineamento: verificato, errore 0 sui corner a ogni valore.

**Il limite ±0.5 non è arbitrario.** Il profilo radiale `lensRadius(a) = 2·lens·a³ + (1−lens)·a` resta crescente su tutto il quadrato unitario solo per lens ≥ −0.5: sotto ha un massimo prima del raggio d'angolo, quindi due raggi diversi finiscono sullo stesso punto e **la mesh si ripiega su sé stessa** vicino agli angoli. A −0.5 il massimo cade esattamente sull'angolo. Verificato monotono al limite.

Percorso sbagliato, per non ripeterlo: prima avevo scritto l'inversa della lente a punto fisso (`a ← target/f(a)`) per far passare anche le maniglie attraverso la lente. **Non converge**: con lens forte il fattore scende a 0.4 vicino al centro, il passo scavalca la soluzione e oscilla — errore misurato 0.172, un sesto del quad. La bisezione monotona che l'ha sostituita sbagliava ramo proprio nella zona di ripiegamento, e cercare l'ultimo attraversamento peggiorava (1.35). Conclusione: **le maniglie non passano per la lente**. Vivono nello spazio pre-correzione, dove `screenToControl` è l'inverso esatto di `controlToScreen` e il trascinamento segue il puntatore alla perfezione. Il prezzo è che con la lente spinta la maniglia si stacca di poco dalla superficie che comanda — molto meglio di un gesto approssimato o appiccicoso proprio agli estremi.

### Keystone numerico

`keystoneCorners` in `mappingGeometry.ts`: agisce sui **corner** come rotazione e scala, non come valore memorizzato. Il keystone è già interamente esprimibile dai 4 angoli, e uno stato parallelo entrerebbe in conflitto col trascinamento diretto delle maniglie. Due pulsanti in toolbar (⌃K / ⌐K, Alt per il verso opposto). Verificato: centro invariato, lato alto 1.92 contro lato basso 1.28.

### Soft edge del perimetro

Uniform `uEdgeFeather` e campo per-layer `edgeFeather?`. Nel fragment la uv **è** lo spazio del quad, quindi la distanza dal bordo si legge direttamente e la sfumatura segue il warp senza calcoli aggiuntivi. Diverso da `edgeSharp`, che lavora sul contorno della sagoma dell'asset: qui si ammorbidisce il bordo della luce proiettata.

### Undo/redo del mapping

`patchActiveMapping` era già l'imbuto unico di ogni modifica di mapping (drag sul canvas incluso): è lì che si fotografa lo stato precedente. Cronologia da 80 voci, non persistita.

Le raffiche vengono **accorpate**: due modifiche sullo stesso layer entro 500 ms contano come una, e si tiene la voce più vecchia (è lo stato a cui l'utente vuole tornare). Senza, un trascinamento avrebbe riempito la cronologia di micro-passi. ⌘Z / ⇧⌘Z più due pulsanti in toolbar. Verificato: annulla, ripeti e ritorno allo stato identico.

### Rimosso su richiesta dell'utente

Preset di mapping e campi numerici delle coordinate degli angoli: fatti e poi tolti nella stessa sessione. Restano due tracce da conoscere: la versione di IndexedDB è salita a **6** (la 5 aveva lo store `mappingPresets`; non si può scendere di versione, quindi la 6 elimina lo store orfano dove esiste), e `MappingNumbersPanel` è diventato `MappingOpticsPanel` con le sole regolazioni continue.

### Nota di processo

`npx prettier --write` su un file ha riformattato tutto con i default (virgolette doppie, punto e virgola): il progetto **non ha configurazione prettier** e usa virgolette singole, niente punto e virgola, righe da 100. Rimediato con `--single-quote --no-semi --print-width 100`. Non lanciare prettier senza quei flag.

## 2026-08-20 — Mapping: corner-pin proiettivamente corretto + curvatura dei 4 bordi

L'utente ha chiesto di aggiungere al canvas di mapping solo le opzioni strettamente necessarie che mancavano: prospettiva, curvatura separata dei lati, punti di controllo aggiuntivi, selezione di un lato cliccando fra due pin. Fatte le prime due fasi delle tre concordate (la terza — griglia NxM di nodi — resta aperta).

### Il difetto trovato: il corner-pin non aveva prospettiva

La mesh del layer era una `PlaneGeometry(1,1,1,1)`: **4 vertici, 2 triangoli, uv interpolate in modo affine**. Appena i 4 corner non formano un parallelogramma — cioè in qualunque keystone su una statua o un palco — i due triangoli si deformano indipendentemente e la texture si spezza **lungo la diagonale**, con la classica piega a "V". Non era un'opzione mancante: era un difetto presente su ogni mapping non frontale.

**Correzione** (`src/lib/warp.ts` + `src/engine/warpGeometry.ts`): si calcola l'omografia quadrato-unitario → quad (algoritmo di Heckbert, con caso affine separato per i parallelogrammi, dove il denominatore si annullerebbe). Ogni vertice porta l'attributo `aPersp` = 1/W; il wrapper GLSL trasporta `vec3(uv*k, k)` e il fragment ricostruisce `vUv` dividendo.

Il trucco che ha evitato di toccare i 103 shader della libreria: nel fragment `vUv` non è più un varying ma una **macro** — `#define vUv (vUvW.xy / vUvW.z)`. I file `.glsl` continuano a scrivere `vUv` come prima. (Verificato prima che nessuno shader dichiari un proprio `varying vUv`: nessuno lo fa.)

**Verificato numericamente in browser**, simulando l'interpolazione baricentrica della GPU su un quad in forte keystone e confrontandola con l'inversa esatta dell'omografia: uv corretta `0.198496, 0.413534` = uv esatta alle 6 cifre; l'interpolazione affine di prima dava `0.200000, 0.500000`, **sbagliata di 0.087 in v** (8.7% dell'altezza della texture in quel punto).

Nota per i progetti già allineati: il contenuto si ridistribuisce (correttamente) rispetto a prima, quindi un mapping tarato sul palco con keystone forte va rivisto.

### Curvatura dei bordi (patch di Coons)

I 4 bordi sono Bézier cubiche definite **in spazio unitario**, non in coordinate mondo: così la curvatura resta indipendente da posizione, rotazione e scala del quad (che vivono nei corner) e sopravvive a qualunque spostamento del mapping. La superficie è una patch di Coons fra i 4 bordi.

La scelta che ha tenuto il codice senza casi speciali: gli handle memorizzano lo **scostamento** dalla posizione a bordo dritto (t = 1/3 e 2/3). A scostamento zero le Bézier sono rette e la patch degenera **esattamente** nell'identità — verificato, errore massimo 6.7e-16. Quindi "nessun warp" = mesh a 4 vertici e comportamento identico a prima, senza un ramo `if` nel rendering: la suddivisione (24×24) si accende sola quando `isWarpActive` è vero.

Altre invarianti verificate in browser: i 4 angoli restano ancorati anche con curvatura forte (errore 0), il bordo segue esattamente la sua Bézier (errore 0), `flipWarp` andata/ritorno è esatto.

`flipWarp` è servito perché `flipCorners` scambia i corner senza spostare il quad: l'omografia si ribalta, e senza ribaltare anche il warp la curvatura sarebbe saltata dall'altro lato cambiando la sagoma proiettata.

### Selezione del lato

`uiStore.selectedCorner` (indice o null) è diventato `mappingSelection`: `all` | `corner` | `edge`. Con un lato selezionato le frecce muovono **i due angoli insieme**; sul canvas lo stesso si ottiene dalla maniglia a rombo al centro del lato. `nudgeActiveCorners` accetta ora una lista di indici invece di un indice singolo. Verificato col drag della maniglia centro-lato: TL e TR si spostano del delta esatto, BL e BR di zero.

### Dove tocca

- `src/lib/warp.ts` (nuovo): omografia, Coons, handle, `flipWarp`, contorno campionato.
- `src/engine/warpGeometry.ts` (nuovo): costruzione/aggiornamento della mesh, attributo `aPersp`, `computeBoundingSphere` (senza, il frustum culling avrebbe usato la sfera della PlaneGeometry originale e a mapping molto spostati la mesh sarebbe sparita). Qui viene anche disposta la geometria, che prima restava appesa.
- `src/engine/isfParser.ts`: vertex shader con `aPersp`, macro `vUv` nel fragment.
- `src/engine/TestPattern.tsx`: stessa geometria e stessa correzione — è la griglia con cui si legge la deformazione, dev'essere mappata come il contenuto.
- `src/store/layersStore.ts`: campo `warp?` (opzionale come `edgeSharp`, i progetti salvati prima non ce l'hanno e assente = bordi dritti), `setActiveWarpHandle`, `resetActiveWarp`. Persistenza e sync viaggiano già per layer intero: nessuna modifica lì.
- `src/components/Positioning/CornerPinOverlay.tsx`: contorno curvo campionato, maniglie centro-lato, handle Bézier con stelo (solo in modalità curvatura, per non affollare il canvas durante il live).
- `src/components/Positioning/MappingControls.tsx`: 4 pulsanti di selezione lato, toggle curvatura, azzera curvatura.

## 2026-08-19 — Qualità dell'immagine proiettata: compositore di output, colore, supersampling, diagnostica

L'utente ha chiesto se la finestra Output avesse limiti di qualità propri o se dipendesse tutto dal proiettore (un Full HD), notando che un video HD sullo stesso proiettore si vede molto meglio dei visual. Sono emersi **due difetti veri nel nostro codice**, entrambi misurati, più una serie di leve mancanti.

### Il difetto grosso: mezza conversione di colore (immagini scure di oltre la metà)

Le texture di contenuto erano marcate `SRGBColorSpace`. Three le carica allora come `SRGB8_ALPHA8` e l'hardware **le linearizza a ogni prelievo**; il guadagno ci sarebbe se l'immagine venisse ri-codificata in uscita, ma i layer sono `ShaderMaterial` con sorgente scritta a mano e Three inserisce la conversione finale **solo nei materiali che includono il chunk `colorspace_fragment`** — il nostro wrapper non lo fa. Metà conversione, quindi, e a senso unico.

**Misurato in browser con un test WebGL isolato**: un pixel grigio `128` nel file arrivava allo schermo come **55**. Non un'inezia — le mezze luci di ogni foto, video e ripresa webcam venivano schiacciate verso il nero, proprio su un dispositivo che di contrasto ne ha già poco.

Le texture ora usano `SOURCE_COLOR_SPACE = NoColorSpace` (`mediaTexture.ts`, più lo stencil della maschera-immagine in `ShaderPlane`): i byte del file arrivano intatti. La pipeline lavora tutta in spazio gamma, che è anche lo spazio in cui sono pensati i 100+ shader della libreria, le palette prese dai color picker e le formule dei blend mode (Overlay, Soft Light e compagnia sono definite su valori non lineari, come in Photoshop). **Le immagini caricate ora appaiono più chiare: è la resa corretta, non una schiaritura.**

Nota di rotta: all'inizio avevo indicato come colpevole il tone mapping ACES che R3F imposta di default. **Era sbagliato, e per la stessa ragione**: senza `#include <tonemapping_fragment>` quella curva non tocca i nostri shader. Il `flat` sul Canvas è stato messo lo stesso, per fissare la scelta e proteggere i materiali non nostri (TestPattern, futuri).

### Il compositore (`OutputComposer.tsx`)

La scena non va più diritta a schermo: passa per un buffer interno e un passaggio finale. Serve per quattro cose che prima non erano possibili.

- **Supersampling 1× / 1.25× / 1.5× / 2×.** Il MSAA del canvas lavora solo sui bordi della *geometria*, cioè i 4 lati del quad — che con un PNG scontornato sono trasparenti, quindi invisibili. Tutto ciò che si vede davvero (i contorni disegnati dal fragment shader, il bordo della sagoma) non ne beneficiava in alcun modo: **l'`antialias: true` che c'era non salvava un solo bordo visibile**. L'unico antialiasing che agisce lì è disegnare più grande e ridurre. Riduzione a 4 prelievi quando il rapporto non è intero (1.25×, 1.5×), dove un prelievo solo lascerebbe fuori dei texel.
- **Buffer a mezza precisione float**, così i blend Add/Screen possono superare 1.0 invece di essere tagliati subito.
- **Dither** sugli 8 bit finali. Verificato numericamente: su una colonna a valore teorico costante, con dither i pixel alternano 76/77, senza dither sono tutti 77 — cioè lo scalino che al buio si legge come banding.
- **Grana** opzionale. Un video ha dettaglio ad alta frequenza ovunque, uno shader generativo no: è anche per questo che sullo stesso proiettore il video "sembra migliore" a parità di pixel.

Niente MSAA sul buffer interno, di proposito: un framebuffer multisample non si può copiare con `copyTexSubImage2D`, e la copia del backdrop per i blend avanzati avviene proprio mentre quel buffer è legato. Visto che il MSAA lì non salverebbe comunque nessun bordo visibile, l'antialiasing lo fa il supersampling.

**Il supersampling vale solo per la finestra Output**: durante un set le due finestre girano sulla stessa GPU, e far pagare all'anteprima il quadruplo dei pixel significherebbe toglierli al proiettore.

### Sfondamento morbido, e un errore intercettato dal cartello di prova

Il controllo delle alte luci era nato come curva di compressione classica. Il cartello di prova ha mostrato subito il conto: **il bianco pieno usciva a 239 invece di 255**, cioè il 6% dei lumen del proiettore regalato a una curva — esattamente il difetto che avevo contestato ad ACES. Riscritto come *versamento dell'eccesso*: sotto il fondo scala non tocca niente, e solo ciò che sfonda vira verso il bianco invece di far scivolare la tinta (senza, un `clamp` porta un (1.6, 1.2, 0.3) a giallo pieno). Dopo la correzione: bianco 255, primari a fondo scala, rampa a 128.

### Backdrop dei blend avanzati (`backdrop.ts`)

Due correzioni obbligate dal buffer interno, entrambe altrimenti fatali: le dimensioni si leggono dal **bersaglio legato** e non dal canvas (con supersampling attivo i due numeri differiscono, e `gl_FragCoord` parla in pixel del bersaglio: il backdrop sarebbe stato campionato spostato e ingrandito); e il tipo della copia segue quello del bersaglio, perché copiare un buffer a mezza precisione float dentro una texture a byte non è una conversione ma un'operazione **non consentita**. Verificato con due layer in Overlay a 2× e buffer HDR: nessun errore WebGL, blend allineato, 119 fps.

### Nitidezza del bordo (per-layer)

`edgeSharp` comprime la rampa dell'alpha attorno a metà scala **senza spostarla**, così il mapping non si muove. Il contorno di un PNG è largo pochi pixel e il corner-pin lo ingrandisce fino a decine di pixel di proiettore, dove si legge come alone sfocato. Effetto collaterale gradito, visto in prova: con il luma key attivo sparisce anche il pulviscolo di pixel semitrasparenti attorno al soggetto.

### Anisotropia (`textureQuality.ts`)

Mai impostata finora, quindi ferma a 1. Nel projection mapping il quad è **sempre** guardato di sbieco: senza filtro anisotropico i lati inclinati perdono dettaglio molto prima di quelli frontali, e a occhio sembra fuori fuoco. Il valore massimo lo conosce solo il renderer, che nasce col Canvas — cioè dopo che qualche texture può già essere stata creata: per questo le texture si registrano e vengono aggiornate a ritroso.

### Diagnostica e cartello di prova

- **Pannello sulla finestra Output** (tasto S): pixel reali del canvas, dimensione del buffer interno, supersampling, precisione, fps, e se la finestra copre davvero lo schermo. "Sembra povero" ha troppe cause che a occhio si confondono; questi numeri le separano in due secondi. Vive fuori da Zustand di proposito: aggiornarlo dentro il ciclo di disegno via React sarebbe il tipo di costo che dovrebbe aiutare a scovare.
- **Cartello di prova** (tasto C, o dal pannello): righe da un pixel, rampa, barre sature, gradini di nero e di bianco. Si è ripagato subito trovando il bianco a 239. Non si ricorda mai acceso fra le sessioni: ritrovarselo a tutto schermo cinque minuti prima di un set sarebbe solo un danno.
- Le impostazioni di resa viaggiano su un **messaggio dedicato** del BroadcastChannel e passano **sempre**, modalità Live compresa: non sono la scena, sono il modo di disegnarla, e alzare la qualità durante un set deve avere effetto subito. Stanno in localStorage e non nei progetti: dipendono dalla macchina e dal proiettore, non dal lavoro.

### Finestra di proiezione

Si apre sullo schermo secondario quando il browser espone la Window Management API (prima nasceva 1280×720 sopra il pannello di controllo, da trascinare a mano). Pieno schermo con F o doppio click — comandabile solo da lì, perché il browser lo concede solo a chi ha ricevuto un gesto nella finestra che lo chiede.

**Il pieno schermo può fallire in silenzio**: provato nel pannello di anteprima, la promise non viene rifiutata e lo stato non cambia. Si controlla quindi `document.fullscreenElement` dopo la richiesta, non l'esito della promise, e si scrive a schermo cosa fare al suo posto. Un tasto che sul palco non fa niente e non dice niente è il modo peggiore di fallire.

### 3× e 4× rimossi dopo la prova sul proiettore (la scala si ferma a 2×)

Provati sul proiettore reale: **nessun miglioramento visibile oltre il 2×**, come previsto dalla teoria ma ora verificato. A quel punto il limite della nitidezza non è più l'aliasing, è l'ottica — messa a fuoco, contrasto, dimensione del pixel proiettato — e il supersampling in più si paga senza ricevere niente.

Tolti dall'elenco. Un'opzione che non migliora nulla ma dimezza gli fps, in un'app che si usa dal vivo, non è una scelta in più: è un modo di rovinarsi la serata con un click. La motivazione è scritta nel commento di `SUPER_SAMPLE_STEPS`, insieme all'avvertenza per chi volesse riaprire la questione — **il confronto va fatto sul proiettore**, perché a monitor la differenza fra 2× e 4× si vede, ed è proprio questo che rende ingannevole la prova.

I valori già salvati si sistemano da soli: `sanitizeRender` accetta solo i fattori in elenco, quindi chi avesse 3× o 4× in localStorage (o lo ricevesse via BroadcastChannel) torna al default.

**Restano** il tetto di memoria video e il fattore effettivo nel pannello, nati per gestire i fattori alti ma utili comunque: su un display 4K anche il 2× arriva a sfiorare il limite, e una riduzione silenziosa resterebbe invisibile.

### Scala del supersampling estesa a 3× e 4× (poi rimossa, vedi sopra), default alzato a 2×

L'utente ha girato il set a 2× ("molto più nitido da proiettore") e ha chiesto se avesse senso arrivare a 4×. Misurato invece che stimato, su un canvas da 2,03 MP — cioè praticamente un 1080p (2,07 MP), quindi i numeri valgono direttamente per il caso reale — con un layer e uno shader:

| Fattore | Buffer | Memoria | FPS |
| ------- | ------ | ------- | --- |
| 1× | 1336×1522 | 16 MB | 124 |
| 2× | 2672×3044 | 62 MB | 126 |
| 3× | 4008×4566 | 140 MB | 93 |
| 4× | 5344×6088 | 248 MB | 56 |

- **A 2× il costo è nullo**: 126 fps contro 124, cioè entrambi limitati dal vsync e non dalla GPU. Da qui la decisione di **alzare il default a 2×** — chiude il punto lasciato aperto ieri, che aspettava solo il riscontro sul proiettore. Su una macchina modesta si abbassa con un click, e il pannello avvisa da sé sotto i 50 fps.
- **3× e 4× aggiunti ma marcati "oltre il punto di resa"**, con avviso in pannello: il guadagno cala (da 4 a 16 campioni per pixel si vede poco, e su un 1080p il limite diventa l'ottica del proiettore) mentre il costo continua a crescere col quadrato. I numeri qui sopra sono con **un solo layer**: in una scena da tre o quattro, a 4× si scende sotto la soglia utile.
- **Tetto di memoria video** (`MAX_BUFFER_BYTES`, 256 MB) accanto a quello già presente sul lato massimo delle texture: a mezza precisione un pixel costa 8 byte e i blend avanzati allocano un secondo buffer grande uguale, quindi il consumo reale raddoppia. Un'allocazione fallita non dà un errore leggibile, dà uno schermo nero — a metà set, il modo peggiore di scoprirlo.
- **La riduzione non è più silenziosa**: il pannello pubblica il fattore *effettivo* letto dal bersaglio allocato accanto a quello chiesto, e quando differiscono mostra `4× → 2.10×` con la spiegazione. Prima il clamp c'era già ma nessuno lo vedeva: si sarebbe creduto di proiettare a una qualità che non si ha.

### Esito e documentazione

Provato dall'utente sul proiettore reale: **qualità aumentata molto**. `README.md` aggiornato di conseguenza — nuova sezione "Qualità dell'immagine proiettata" fra le funzionalità, sottosezione tecnica "Pipeline di output", tabella delle scorciatoie della finestra di proiezione (F/S/C), voce in cima alle novità v4 e roadmap di Fase 3. Nel README è documentato anche il fix del colore: chi conosceva l'app nelle versioni precedenti deve sapere che le immagini ora appaiono più chiare **perché prima erano sbagliate**, non perché siano state schiarite.

### Cosa resta al proiettore e al sistema (fuori dal nostro codice)

Il Full HD non è il limite. Contano molto di più: **keystone digitale del proiettore da spegnere** (ricampiona e distrugge la nitidezza — la deformazione la fa il nostro corner-pin), risoluzione del display **nativa e non "scalata"** in macOS, modalità immagine del proiettore su Standard/Cinema con sharpness a zero, ed evitare i fade a bassa opacità su nero (un proiettore somma luce: Add/Screen leggono molto meglio).

## 2026-08-19 — Interruttore rapido della palette (e stop del loop che la riaccendeva)

Richiesta dell'utente: un pulsante on/off accanto a "Colori casuali" nel pannello Shader per spegnere al volo la palette; poi, subito dopo, che spegnendola si spenga anche il loop dei colori.

- Icona power a destra dell'intestazione (in `justify-between`), verde quando la palette è attiva e grigia quando è spenta. Spegnere la palette **non perde i colori generati**: restano nel layer, pronti alla riaccensione.
- **Il secondo requisito non era solo comodità, era un bug**: il motore del loop scrive con `setLayerPaletteColors`, che riabilita la palette a ogni tick. Senza fermare il loop, spegnerla non avrebbe avuto alcun effetto — si sarebbe riaccesa entro un trentesimo di secondo.
- Nuova azione `stopPaletteLoopFor` in `uiStore` (spegne senza invertire, idempotente), usata **in entrambi** i punti che disattivano la palette: il nuovo interruttore e il pulsante "Palette attiva/disattivata" del pannello Palette — dove lo stesso difetto esisteva già ed è stato corretto ora.
- Verificato nel browser: con loop acceso, un click spegne palette e loop insieme, e dopo due secondi la palette è ancora spenta (con il loop vivo si sarebbe riaccesa) mentre i cinque colori generati sono conservati.

## 2026-08-19 — Reset dei controlli effetto ai valori di partenza

Richiesta dell'utente: un pulsante per riportare i controlli di qualunque effetto ai valori standard e ripartire puliti (nasce come contraltare del Random).

- **`resetActiveParams`** in `layersStore`: riscrive uniform e colori dello shader attivo con i default dichiarati dal file `.glsl` (`defaultParamsFor` / `defaultColorsFor`, già usati altrove). Passa da `editEffect`, quindi rispetta la propagazione ai layer collegati come ogni altra modifica di effetto.
- **Azzera solo lo shader corrente**: i valori messi a punto su altri effetti restano dove sono e tornandoci si ritrovano intatti — `params` è una mappa per nome di shader, sarebbe stato facile (e sbagliato) svuotarla tutta.
- **Cosa NON tocca**: Size, palette e controlli globali del layer. Sono proprietà del layer, non dell'effetto, e hanno già i loro reset; azzerarle da qui cancellerebbe il lavoro fatto sul layer per rimettere a posto un solo effetto. Scritto nel tooltip.
- Il blocco "Controlli effetto" ora compare anche per gli shader che espongono **solo** colori e nessuno slider: prima la condizione guardava i soli `controls` e lì il pulsante non sarebbe mai apparso.
- Verificato nel browser: dopo Random più un colore modificato a mano, il pulsante riporta tutti e nove i parametri e i due colori esattamente ai default del file.

## 2026-08-19 — Due nuovi effetti da riferimenti visivi: "Wire Network" e "Liquid Zebra Flow"

L'utente ha allegato due immagini di proiezioni su statua e ha chiesto un effetto per ciascuna, animato e parametrico.

**Wire Network** (`wireNetwork.glsl`, famiglia Altri, 13 controlli + 2 colori) — maglia di nodi e segmenti tratteggiati con scaglie poligonali scure che scoprono il soggetto.
- Griglia di celle con nodo spostato a caso e animato: ogni cella collega il proprio nodo a quelli delle vicine. **Una vera triangolazione di Delaunay in un fragment shader costerebbe molto di più per una differenza che a schermo non si distingue.**
- **`linkChance`**: al primo tentativo la rete tradiva la griglia di partenza (trama regolare di X, visibile in prova). Scartare a caso una parte dei collegamenti — con hash **simmetrico** nelle due celle, altrimenti il filo comparirebbe o no a seconda di quale cella lo disegna — è ciò che l'ha resa organica. Il test viene prima del calcolo del nodo vicino, così le coppie scartate non costano nulla.
- Tratteggio ricavato dalla posizione **lungo** il segmento, non dalle coordinate schermo: altrimenti scorrerebbe via dal filo invece di viaggiarci sopra.
- Le scaglie usano la cella di Voronoi più vicina con soglia animata: unendosi fra loro formano macchie frastagliate che si aprono e si richiudono.

**Liquid Zebra Flow** (`liquidZebraFlow.glsl`, famiglia Liquid, 9 controlli + 2 colori) — bande ad altissimo contrasto piegate in vortici, tagliate con soglia netta.
- Domain warping a due stadi: un campo di rumore deforma il piano, un secondo deforma il risultato, e solo alla fine si taglia. È la piega ripetuta a produrre gli "occhi"; alzando la frequenza senza warp si otterrebbero solo righe dritte.
- **Niente `atan` per l'avvolgimento**: al primo tentativo un termine sull'angolo polare tagliava l'immagine con una riga netta — è il salto da +π a −π sul semiasse negativo, ben visibile in prova. Sostituito da una torsione (rotazione crescente col raggio), continua ovunque.
- Taratura finale trovata a schermo confrontando con il riferimento: il warp deve **dominare** la direzione di base (`flow` 1.5, `warp` 1.9), altrimenti restano bande parallele invece di vortici chiusi.
- `sourceWarp` (default 0) fa deformare le bande dalla luminanza del soggetto, come negli effetti Morph: sul mapping è ciò che fa "aderire" il pattern al corpo.

Verificati entrambi nel browser sull'asset dimostrativo, senza errori di compilazione GLSL. Libreria a 103 effetti.

## 2026-08-19 — Nove blend mode in più (Overlay, Difference, Soft Light…) via copia del backdrop

Richiesta dell'utente: aggiungere i blend mode di una lista tipo Photoshop, avendo in app solo Normal/Add/Screen/Multiply.

- **Perché i quattro esistenti erano quelli e non altri**: il blending hardware calcola `src·fattore OP dst·fattore`, e da lì escono esattamente Normal, Add, Screen e Multiply. Overlay, Soft/Hard Light, Difference, Exclusion, Darken, Lighten, Color Burn e Color Dodge sono formule che devono **leggere** il colore sottostante — cosa che un fragment shader non può fare sul framebuffer su cui sta scrivendo.
- **Soluzione scelta**: `renderer.copyFramebufferToTexture` dentro l'`onBeforeRender` della mesh del layer (`backdrop.ts`), poi la formula nello shader (`easyvj_blend` nel wrapper). Il materiale in questo caso **sostituisce** invece di fondere (`One`/`Zero`), perché lo shader scrive il colore già composto; dove il layer è trasparente riscrive il backdrop tale e quale, quindi fuori dalla sagoma non cambia nulla.
- **Alternativa scartata**: pipeline multi-pass con render target e ping-pong. È la strada "giusta" in astratto, ma avrebbe richiesto di riscrivere il rendering della scena (crossfade fra scene, test pattern, ordini di disegno) per un guadagno solo teorico a questi numeri di layer.
- **Una sola texture condivisa**: i layer si disegnano in sequenza e ciascuno la riscrive al proprio turno, quindi ognuno vede esattamente ciò che ha sotto. Costo: una copia a schermo pieno per layer a blend avanzato, **zero** per le scene che non ne usano (i quattro classici restano sulla via hardware).
- Le formule sono quelle dei *separable blend modes* del compositing standard, con due attenzioni: la sorgente va limitata a 0..1 prima del blend (gli shader emettono spesso valori oltre 1) e le divisioni di Color Burn/Dodge hanno il denominatore protetto.
- **L'opacità del layer entra come `mix(backdrop, blended, outA)`**, quindi continua a funzionare da dissolvenza anche sui blend avanzati: verificato a 30%, dove l'effetto si attenua senza scurire.
- Verificato nel browser su due layer sovrapposti: Difference, Overlay, Color Dodge e opacità parziale, senza errori WebGL in console.

## 2026-08-19 — Famiglie di effetti e filtri rapidi nella libreria

Richiesta dell'utente: con cento effetti la lista non è più scorribile — raggrupparli per famiglia (halo, sd, psy…) e filtrare la lista con dei pulsanti.

- **La famiglia si deduce dal percorso del file** (`psyStrobeGrid.glsl` → Psy), non dal nome visualizzato: il prefisso è la convenzione con cui la libreria è cresciuta e resta stabile anche rinominando un effetto. Il percorso è disponibile solo in `effectsStore` (le chiavi di `import.meta.glob`), quindi `parseShader` riceve la categoria come parametro invece di indovinarla.
- **Due eccezioni esplicite** (`shaderCategories.ts`): i due `symmetricalHaloSwirl` sono Halo e `3DSurfaceMorphSpirals` è il capostipite dei Morph, ma sono nati prima della convenzione sui prefissi. Lasciarli in "Altri" li renderebbe introvabili proprio a chi cerca quella famiglia.
- **`usesAudio` vince sul prefisso**: un effetto audio-reattivo si cerca fra gli Audio, qualunque nome abbia il file.
- Ripartizione risultante: Psy 30, Morph 22, Halo 12, Liquid 11, SD 11, Altri 14 (con "Nessun effetto"), Audio 1 — 101 voci.
- **UI**: pulsanti con il conteggio sopra la lista, a capo automatico invece che in riga scorrevole — la sidebar è stretta e ridimensionabile, e pulsanti oltre il bordo sarebbero irraggiungibili. Ricerca e filtro si combinano in AND.
- **Via d'uscita dal filtro**: se la ricerca non trova nulla nella famiglia scelta ma trova altrove, compare "N risultati in altre famiglie — mostra tutti". Senza, il modo più facile di credere che un effetto non esista è cercarlo mentre un filtro è attivo. Mostrato **solo mentre si cerca**: al primo tentativo appariva anche a ricerca vuota (visto in prova), ed era puro rumore — filtrare per famiglia è una scelta esplicita.
- **Lo scorrimento segue il filtro** (chiesto dall'utente subito dopo): frecce ◀ ▶ e ⌥A/⌥S restano dentro la famiglia selezionata, con lo stesso giro ciclico di prima. Per farlo il filtro è passato da `useState` locale del picker a **`uiStore.shaderCategory`**: non governa più solo quali voci si vedono, ma anche comandi che vivono in altri componenti — con un filtro attivo, quella lista è "dove ci si trova". `layersStore` importa `uiStore` (nessun ciclo: `uiStore` dipende solo da zustand). Se l'effetto in uso sta fuori dalla famiglia filtrata, la freccia entra dal primo elemento — è il ramo che già gestiva l'ingresso da "Nessun effetto". I tooltip delle frecce nominano la famiglia, così non sembra che manchino effetti.
- Il filtro arriva gratis anche nell'editor clip della playlist, che usa lo stesso `ShaderPicker`.
- Verificato nel browser: conteggi corretti per famiglia, filtro Halo che mostra i soli Halo, ricerca "psy" dentro Halo che offre i 30 risultati fuori famiglia.

## 2026-08-19 — Forme dell'oscilloscopio + preset rapidi (⌥1…⌥6)

Richiesta dell'utente: tasti preset, almeno quattro, per ottenere al volo forme belle — fiore, cerchio, triangolo — sempre reattive al suono e sempre "da oscilloscopio".

- **Nodo di progetto**: una figura riconoscibile e insieme reattiva non si ottiene scuotendo una linea. La soluzione è che il pennello disegni una **figura parametrica** e che il suono ne **increspi il contorno** (`waveDepth` moltiplica il raggio): un cerchio resta un cerchio, ma respira.
- **`shape` sostituisce `xyMode`** ed è un selettore continuo: 0 traccia temporale, 1 cerchio, 2 rosa (fiore), 3 poligono, 4 stella, 5 piano XY.
- **Stella come figura a sé** (aggiunta dopo il primo giro: era una rosa a cinque petali, quindi indistinguibile dal fiece — segnalato dall'utente). Ora è una spezzata fra vertici alternati punta/rientranza, con il raggio del lato ricavato dalla formula della retta per due punti in polare: **lati dritti e punte aguzze**, che è esattamente ciò che la distingue dai petali arrotondati della rosa. La profondità delle rientranze scala col numero di punte (`0.62 − 0.04·k`, limitata a 0.22–0.5): con dieci raggi una stella profonda diventa un riccio illeggibile. Il morphing fra una figura e la successiva è **gratuito**: il disegno passa da un solo percorso (polilinea con distanza punto-segmento) e le due letture dell'onda — le uniche cose care — restano condivise. Nuovi parametri: `shapeSides` (petali della rosa / lati del poligono), `waveDepth`, `spin`.
- Rosa con `abs(cos(k·θ/2))` invece della rosa classica `cos(kθ)`: così i petali sono **esattamente** `shapeSides`, sia pari sia dispari (con la formula classica un k pari ne dà il doppio). Poligono come apotema diviso il coseno dell'angolo dentro il settore: `shapeSides` = 3 dà il triangolo, 4 il quadrato, e così via.
- **Chiusura del contorno**: sulle figure chiuse l'ultimo campione veniva letto a distanza di un buffer dal primo, lasciando lo scalino del "retrace" — tollerabile su una traccia, brutto su un cerchio (visto in prova). Ora la lettura si dissolve in quella di un giro prima (`mix(w(t), w(t-1), t)`), che a t=1 vale esattamente il campione di t=0. Il fetch in più si paga solo lì: il ramo dipende da un uniform, quindi traccia e piano XY non lo eseguono.
- **Preset** in `src/lib/oscilloscopePresets.ts` (Traccia, Cerchio, Fiore, Triangolo, Stella, Lissajous): ognuno definisce l'insieme **completo** dei parametri di forma, così il risultato non dipende da dove si arrivava prima. Restano fuori `autoGain` e `reactivity`, che dipendono dalla sorgente audio collegata e non dall'estetica: si tarano una volta a inizio serata e non devono saltare a ogni cambio di forma.
- **`setActiveParams`** (nuova azione dello store): un preset è **una sola** scrittura. Con quindici `setActiveParam` separate sarebbero quindici notifiche dello store, cioè quindici invii della scena all'Output per un click.
- **Scorciatoie ⌥1…⌥6**, attive solo quando il layer attivo usa l'oscilloscopio: altrove sarebbero tasti muti. Come per ⌥A/⌥S si confronta `e.code` e non `e.key`, perché su macOS Option cambia il carattere prodotto.
- Verificato nel browser con sorgente audio sintetica: rosa a sei petali, cerchio chiuso senza scalino, triangolo con i lati incisi dal suono, stella con scia di fosforo; preset applicati dal pulsante e scorciatoie confermate simulando eventi di tastiera reali. **Nota metodologica**: i tasti sintetici del pane di anteprima arrivano con `e.code` vuoto, quindi *nessuna* scorciatoia dell'app risponde lì — non è un difetto del codice (verificato che anche ⌥A/⌥S preesistenti si comportano così), e la verifica va fatta con `KeyboardEvent` costruiti a mano.

## 2026-08-19 — Ingresso audio minimale + shader "Audio Oscilloscope"

Richiesta dell'utente: un oscilloscopio come in un video di riferimento, reattivo al suono, con gestione dell'audio tenuta semplicissima e la complessità concentrata nei parametri dell'effetto. I metadati del video non sono leggibili via fetch (YouTube non li espone), quindi l'estetica precisa resta da confermare: lo shader copre entrambe le letture possibili — traccia temporale classica e piano XY — con un parametro che passa dall'una all'altra.

- **Catena audio (`src/engine/audioInput.ts`)**: un solo ingresso condiviso, `getUserMedia({audio})` → `AnalyserNode` (fftSize 256) → forma d'onda copiata ogni frame in una `DataTexture` 256×1. Niente FFT a bande né beat detection: la richiesta era esplicita. La sorgente non è **mai** collegata alla destinazione del contesto — un microfono aperto sulle casse darebbe un Larsen immediato.
- **Livello con attacco immediato e rilascio lento** (`level = rms > level ? rms : level*0.92 + rms*0.08`): i transienti passano intatti, la discesa è smorzata. Senza, tutto ciò che si aggancia al volume "pompa" a ogni frame — si è visto subito sulla normalizzazione dell'oscilloscopio.
- **Esposizione a tutti gli shader** (wrapper in `isfParser.ts`): uniform `uAudio`/`uAudioLevel`/`uAudioOn` più gli helper `easyvj_wave(x, t)` e `easyvj_level(t)`. **A ingresso spento restituiscono un'onda sintetica**, non una linea piatta: così i parametri si regolano prima di aprire il microfono e la miniatura in playlist non resta vuota. `ParsedShader.usesAudio` marca gli shader che li usano.
- **Tick unico per frame** (`AudioSampler` in `StageCanvas`): il campionamento è chiamato da ogni layer ma si protegge da sé confrontando `elapsedTime`.
- **UI**: il pannello di attivazione compare **solo** quando l'effetto selezionato è audio-reattivo — altrove sarebbe un controllo inerte. La barra di livello legge il volume in un `requestAnimationFrame` invece che dallo stato React, per non ri-renderizzare il pannello sessanta volte al secondo.
- **Finestra Output**: apre l'ingresso da sé quando la scena contiene un effetto audio-reattivo (`use-audio-autostart.ts`), come per le camere — uno stream non attraversa il BroadcastChannel. Montato solo lì: in Control l'attivazione resta manuale, un microfono non si apre a sorpresa.
- **Shader `audioOscilloscope.glsl`** (14 controlli + 2 colori): un solo percorso di disegno — polilinea sui campioni con distanza punto-segmento — dove ogni vertice è interpolato fra la posizione "traccia temporale" e quella "XY", quindi `xyMode` fa il morphing **senza costo aggiuntivo**. In XY il secondo asse è la stessa onda letta con `xyDelay` di ritardo (phase plot): le figure di Lissajous nascono anche da un ingresso mono, senza gestire due canali.
  - Perché una polilinea e non una funzione y(x) con distanza analitica: l'audio ha salti verticali enormi fra campioni adiacenti, e l'approssimazione con la derivata spezzava la traccia proprio sui transienti.
  - **Fosforo** (`persistence`): l'età di ogni tratto rispetto alla testa del pennello ne attenua la luminosità — è la persistenza del CRT, non una scia accumulata (che richiederebbe un feedback buffer).
  - **Taglio dei segmenti lontani**: in traccia pura la X dei campioni è nota senza leggere l'onda, quindi i segmenti fuori portata si saltano **prima** di campionare (è il numero di letture a pesare, non la matematica); rientrando, il vertice precedente viene ricostruito, altrimenti il primo segmento utile partirebbe da un punto vecchio. In XY il taglio non è applicabile e il costo resta quello dei campioni scelti.
  - **`autoGain`**: normalizza la scala sul volume misurato, con tetto — un'uscita di linea e un microfono a tre metri dalle casse danno segnali di ampiezza diversissima, e senza tetto una pausa del brano mandava la traccia fuori scala (visto e corretto in prova).
  - Alpha di uscita = quanto il pixel è acceso: fuori dalla traccia il layer resta trasparente, quindi l'oscilloscopio si sovrappone in Add/Screen (per esempio sopra la ripresa della camera) senza coprirla di nero.
- Verificato nel browser con una sorgente audio sintetica al posto del microfono (oscillatore → `MediaStreamDestination`): compilazione GLSL senza errori, traccia che riproduce il dente di sega del segnale, phase plot che chiude il triangolo atteso, pannello "in ascolto" con livello 0.41, una sola chiamata a `getUserMedia`.
- In dev `window.__easyvj.audio` espone stato e livello: senza, verificare se sta entrando segnale richiederebbe di leggerlo dall'interfaccia.

## 2026-08-19 — Fix: la tendina non cambiava la camera di ingresso

Segnalazione dell'utente: con un layer già su una camera, scegliendo un'altra sorgente dalla tendina l'immagine restava quella di prima.

- **Causa, autoinflitta**: per evitare l'`OverconstrainedError` da deviceId stantio avevo allentato il vincolo a `deviceId: { ideal }`. Ma `ideal` è una preferenza che il browser può ignorare, e con una camera già aperta Chrome restituisce quella: `getSettings().deviceId` riportava il device vecchio, il codice lo registrava fedelmente sul layer e il cambio si annullava da solo. Il sintomo era esatto — non "non cambia immagine" ma "torna sempre alla stessa".
- **Correzione** (`openDevice` in `cameraSources.ts`): si torna a `exact`, che è l'unico vincolo che il browser deve rispettare, ma con **fallback esplicito a una camera qualsiasi** solo su `OverconstrainedError`/`NotFoundError` — cioè quando quell'id davvero non esiste più. Si tengono entrambe le proprietà: cambio sorgente affidabile e nessun blocco fatale con un id invalidato.
- **Cambio sorgente = spegnimento immediato della precedente** (`dropCameraTexture` sul device vecchio, dopo che il nuovo controller è già nato, quindi senza buco visivo): il rilascio ritardato di 4s teneva due camere accese insieme, e due webcam USB sullo stesso controller spesso non ci stanno per banda. Se l'apertura della nuova fallisce con `NotReadableError`/`AbortError` (`isCameraBusyError`) durante un cambio, la vecchia viene chiusa e si riprova una volta sola.
- Verificato nel browser con due camere finte (stub di `getUserMedia`/`enumerateDevices` con stream da canvas distinti): A → B → A, richiesta sempre emessa con `{"exact": "<id>"}`, media del layer e immagine sul canvas aggiornati a ogni passaggio, console pulita.

## 2026-08-19 — Ingresso video live (webcam / capture card) come sorgente di layer

Richiesta dell'utente: riprendere il DJ dal vivo, proiettare la ripresa sullo sfondo e poterla effettare su più strati.

- **Modello dati**: `MediaType` guadagna `'camera'` e `MediaAsset` un campo `deviceId` (`projectStore.ts`). Il layer tratta la ripresa come qualunque altro media: shader, palette, maschere, corner-pin, luma key e blend valgono senza modifiche.
- **`src/lib/cameraSources.ts`** (nuovo): elenco device, apertura/chiusura degli stream **condivisi per deviceId con refcount** e rilascio ritardato di 4s. La condivisione è ciò che rende praticabile la stratificazione (più layer sulla stessa ripresa = un solo device aperto e un solo upload GPU); il ritardo serve perché un cambio di scena smonta i vecchi layer prima di montare i nuovi — senza attesa la camera si spegnerebbe e riaccenderebbe nel mezzo.
- **`createCameraController` in `mediaTexture.ts`**: elemento `<video>` + `VideoTexture` condivisi per device (a differenza dei video da file, che hanno un playhead per istanza). Fino al primo frame espone la FALLBACK invece di un rettangolo nero.
- **Due finestre**: un `MediaStream` non è serializzabile, quindi via BroadcastChannel viaggia **solo il deviceId** e l'Output apre il device per conto proprio (nessuna latenza aggiunta, nessun WebRTC fra finestre). Serve il consenso alla camera anche nella finestra Output.
- **Persistenza**: `StoredMedia.blob` diventa opzionale e compare `deviceId`; della camera si salva il riferimento al device, che riparte da solo al ripristino del progetto (verificato con reload).
- **UI `CameraPicker`** nel blocco Asset: attivazione, select del device (aggiornata su `devicechange`), badge LIVE, riavvio a freddo della sorgente, stop, e **“Nuovo strato”** — duplica il feed su un layer sopra, già allineato (corner e transform copiati) e in Screen, perché in Normal uno shader generativo coprirebbe semplicemente il layer sotto.
- **Robustezza (dopo un test dal vivo dell'utente finito con immagine congelata e device irriconoscibile)**:
  - vincolo `deviceId: { ideal }` invece di `exact`: un id stantio (cam staccata, permessi resettati) non produce più un `OverconstrainedError` che blocca del tutto la riattivazione, ma ripiega su una camera disponibile;
  - stream con tutti i track `ended` scartato e riaperto invece di essere riusato (era la ricetta per l'immagine congelata per sempre);
  - riaggancio automatico alla morte di un track (max 5 tentativi, 1,2s di pausa) e `play()` di sicurezza nel tick se il video finisce in pausa da solo;
  - `import.meta.hot.accept(() => invalidate())` in `cameraSources.ts` e `mediaTexture.ts`: **le cache degli stream vivono nei moduli**, e un hot-replace in sviluppo le sdoppiava lasciando i componenti montati agganciati alle vecchie — è la causa del blocco visto durante il test, che avveniva mentre i file venivano salvati.
- **Diagnostica in-app** (aggiunta dopo un secondo tentativo dell'utente, "non riesco ad attivare la cam"): al fallimento il pannello mostra `hint` + una riga tecnica con contesto sicuro, stato del permesso (`navigator.permissions.query`), numero di camere viste, nome dell'errore e origin (`cameraDiagnostics` in `cameraSources.ts`); c'è anche il link "Perché non si attiva?" per lanciarla senza errori. Serve perché "la camera non si attiva" nasconde quattro cause che dal solo messaggio del browser non si distinguono: pagina non in contesto sicuro (aperta dall'IP di rete invece che da localhost), permesso bloccato per il sito, device occupato da un altro programma, nessuna camera autorizzata a livello di sistema. Verificato nel pane di anteprima, dove il permesso è negato: riporta `permesso: denied · camere: 1 · NotAllowedError` con l'istruzione per sbloccare.
- **README aggiornato** (19/08): voce in cima a "Novità della versione 4", punto 5 di "Cosa fa in pratica", blocchi "Layer e maschere", "Assets" (con la nota su quali shader elaborano davvero un feed opaco), "Multi-layer", tabella dello stack (`MediaDevices.getUserMedia`), "Architettura in breve" (perché fra le finestre viaggia solo il deviceId) e Fase 3 della roadmap, dove l'ingresso live risulta il primo punto completato.
- **Esito del test dal vivo**: la camera non si attivava perché il permesso era rimasto **bloccato a livello di browser/sistema** dopo il primo tentativo andato male — non un problema di codice. Risolto riattivando i permessi dalle impostazioni e **riavviando il browser** (su macOS l'autorizzazione di sistema alla fotocamera ha effetto solo dopo il riavvio dell'applicazione). Da lì la sorgente live funziona.
- **Nota d'uso**: 56 shader su 99 campionano la texture sorgente (`halo*`, `liquid*`, `morph*`, `sd*`, `3DSurface*`) e quindi elaborano davvero la ripresa; gli altri sono generativi e sulla camera — opaca, quindi senza alpha da ritagliare — la coprono, a meno di usarli in Add/Screen o con opacità ridotta.
- Verificato nel browser sostituendo `getUserMedia` con uno stream da canvas (il pane di anteprima blocca i device reali): fit automatico al formato del feed, due layer sullo stesso device con `getUserMedia` chiamato **una sola volta**, ripristino del layer camera dopo reload, messaggio d'errore leggibile a permesso negato.

## 2026-08-17 — Texture immagine condivise per URL (cache con refcount) + indagine sul lampo nero al push

Segnalazione dell'utente: premendo Spazio in Live, la finestra Output diventa nera per una frazione di secondo prima di applicare la modifica.

- **Cosa è stato corretto**: `createImageController` creava una texture nuova per ogni istanza, partendo dalla FALLBACK (un pixel 40,40,48 — praticamente nero) per tutta la decodifica. Il crossfade degli invii monta la scena uscente come componenti *nuovi* (`out-<id>` in `ShaderPlane`), quindi la scena che nel primo tratto della dissolvenza è a piena opacità è proprio quella appena costruita, ancora senza immagine. Ora le texture delle immagini sono condivise per URL con refcount (`imageCache`), con rilascio ritardato di 10s perché un cambio di scena smonta i vecchi componenti *prima* di montare i nuovi e senza attesa la stessa immagine verrebbe buttata e ricaricata subito. Beneficio anche fuori dal crossfade: due layer con lo stesso asset (il duplicato in Add/Screen per i bordi illuminati) decodificano e occupano memoria GPU una volta sola.
- Restano esclusi video e GIF: hanno uno stato di riproduzione per istanza (playhead, frame corrente), condividerli legherebbe fra loro layer che devono restare indipendenti. **È però la pista più probabile per il lampo segnalato**: se lo stage è un video o una GIF, la scena uscente ricrea l'elemento `<video>` o ridecodifica la GIF da zero, e lì il nero dura quanto il buffering.
- **Indagine non conclusiva**: il lampo *non* si riproduce nel mio ambiente. Misurato con screencast CDP a ~60 fps sulla finestra Output, confrontando la luminosità media dei frame prima e dopo lo Spazio, in sei scenari: modifica di un parametro, cambio di effetto, cambio dell'immagine, transizione smooth e secca, con e senza la cache. Il calo massimo osservato è 4–10% a metà dissolvenza — il dip fisiologico di un crossfade su fondo nero — mai un nero. La cache non cambia i numeri perché il browser riserve i blob già decodificati quasi istantaneamente; serve a garantire il caso in cui non lo faccia.
- Da chiarire con l'utente per chiudere il caso: tipo di media sul layer (immagine/video/GIF), che modifica stava inviando, transizione smooth o secca, e se l'Output è a schermo intero su un secondo monitor. Nota metodologica: il primo test era mal costruito — cambiava effetto, quindi la salita di luminosità era semplicemente la dissolvenza fra due effetti di luminosità diversa, non un artefatto.
- Falsa pista scartata: la transizione al push c'è già ed è attiva di default (`transitionMode: 'smooth'`, 1s in `playlistStore`), quindi il problema non era la mancanza del crossfade.

## 2026-08-17 — Nuovo shader "SD Edge Pulse": bordi illuminati che seguono la forma, con respiro

Richiesta dell'utente: un effetto che accende i bordi delle forme dello stage e pulsa. Idea iniziale sua: un secondo layer con lo stesso stage a cui applicare l'effetto. Il ritaglio non lo richiede (il wrapper confina già ogni effetto nell'alpha), ma il layer duplicato in blend Add/Screen resta il modo giusto per dosare il glow separatamente dal corpo — quindi lo shader è progettato per funzionare in entrambi i modi (slider `sourceAmount`).

- **Perché nessuno dei 98 shader lo faceva già**: gli "SD" sono guidati dal gradiente della **luminanza** (`sdSlope` campiona `.rgb`), quindi vedono i dettagli interni ma non il profilo della sagoma. Mancava chi leggesse la forma.
- `src/shaders/sdEdgePulse.glsl`: due sorgenti di contorno dosabili separatamente — **sagoma** (profilo della forma) e **dettagli** (gradiente di luminanza interno), con colori e fase del respiro indipendenti.
- Il profilo è stimato con `sdRim`: 16 campioni sul disco distribuiti con l'angolo aureo (`r = sqrt(i)` per densità uniforme), pesati verso il centro. È un surrogato a raggio limitato di un distance field: dà una banda che sfuma verso l'interno invece di un contorno di 1 px. Oltre ~20 texel di `edgeWidth` degenera in un riempimento morbido delle forme sottili — è il limite strutturale che motiva l'SDF precalcolato (vedi TODO).
- **Campiona `vUv`, non la uv trasformata**: `varying vec2 vUv` è dichiarata dal wrapper prima di `${raw}`, quindi è accessibile dagli shader. Serve perché il contorno deve restare incollato alla sagoma: Size, pan e kaleido non lo devono far scivolare via dalla forma.
- **`shapeKey`** (soglia sulla luminanza, default 0.05): senza, l'effetto era invisibile sull'asset di default. `public/default-stage.png` è **RGB senza canale alpha** (colorType 2, verificato leggendo l'IHDR): lo sfondo è nero opaco, l'alpha vale 1 ovunque e non esiste alcun profilo da illuminare. `sdShape` combina alpha e soglia, usando il più permissivo fra `shapeKey` e il Luma key globale del layer (`uLumaKey`) per non contraddire la maschera. Effetto collaterale utile: sugli asset a fondo nero anche le forme *interne* separate dal nero prendono il loro contorno.
- Il pixel centrale moltiplica sia la banda sia i dettagli (`inside`): senza, su un'immagine a fondo nero con alpha piena — che il wrapper non scarta — si sarebbe acceso anche il vuoto attorno all'oggetto.
- Alpha di uscita = quanto il pixel è acceso (`sqrt` della componente massima), non 1: dove non c'è bordo il layer resta trasparente, quindi si sovrappone allo stage in Add/Screen senza coprirlo con un rettangolo nero. `sourceAmount` alza il pavimento fino a mostrare l'immagine piena.
- Niente uniform `speed` come negli altri shader: il ritmo è `pulseRate` e la velocità globale del layer (`uFxSpeed`) scala già il tempo a monte — uno slider in più sarebbe stato inerte.
- Verificato nel browser su profilo pulito: con `detailAmount` a 0 il contorno della sagoma si accende su tutte le forme; con il respiro al massimo la luminosità media dell'area di stage passa da **10.8 a 38.1** su sei frame consecutivi (misurata decodificando i PNG), nessun errore di compilazione GLSL in console.
- Richieste dall'utente in fase di brainstorming e ancora aperte: onde che si propagano dal bordo verso l'interno e cometa lungo il perimetro — entrambe hanno bisogno dell'SDF (o dei contorni vettoriali), vedi TODO.

## 2026-08-17 — Fix bug: in modalità Live il loop delle palette non arrivava alla finestra Output

Segnalazione dell'utente: con il loop colori attivo su un effetto e la scena mandata in Live all'Output, il proiettore riproduceva l'effetto ma restava su un colore fisso mentre l'anteprima ciclava.

- **Causa**: il loop scrive nello store come qualsiasi altra modifica, e in Live il publisher (`sync.ts`) *non* pubblica: marca la scena "in sospeso" (`markDirty`) in attesa di "Esegui in output". Il ciclo dei colori è però l'animazione di una scena **già in onda**, non una modifica in preparazione: congelarlo è esattamente il contrario di quello che serve. Effetto collaterale: il badge delle modifiche non inviate restava acceso in permanenza, perché il loop "sporcava" lo stato ~30 volte al secondo.
- `sync.ts`: nuovo messaggio `{ type: 'palette', entries }` e funzione esportata `applyPaletteTick(layerId, colors)`, che scrive nello store e propaga i soli colori all'Output **sempre, Live compreso**. Durante la scrittura alza il flag `paletteTickInFlight`, che fa saltare al publisher sia `publishNow` sia `markDirty`: il tick viaggia sul canale dedicato e non conta come modifica in sospeso.
- Le `entries` sono calcolate confrontando le palette prima/dopo la scrittura, così la propagazione ai layer collegati (`syncTargetIds`) arriva all'Output senza duplicare qui la logica dello store.
- Lato Output il tick si applica **solo ai layer presenti nella scena in onda**: se in Live si sta preparando un'altra scena, i colori di un layer che lì non esiste vengono ignorati e Live resta Live.
- Fuori da Live il tick **sostituisce** l'invio dello stato completo: l'Output riceve i soli colori invece dell'intero elenco di layer 30 volte al secondo (meno lavoro di serializzazione per ogni fade).
- Conseguenza da coprire: `lastPayload` (la risposta all'`hello` di una finestra Output appena aperta) non vede più passare i colori del loop. La risposta viene quindi ricostruita innestando le palette correnti nei layer omonimi, altrimenti una finestra aperta a metà ciclo ripartiva dai colori del push e restava indietro fino al ciclo successivo.
- `use-palette-loop.ts`: il motore chiama `applyPaletteTick` al posto di `setLayerPaletteColors`.
- Verificato con Control + Output reali (Chrome, due tab, Live attivo *prima* di accendere il loop): l'Output ha ricevuto **123 messaggi `palette` contro 2 `state`**, i suoi frame sono tutti diversi tra loro (palette giallo/blu → rosso/ciano sullo shader Female Eyes) e il pulsante "Esegui in output" è rimasto **disattivato**, cioè i tick non sporcano più la scena.

## 2026-08-16 — Fix bug: il loop delle palette seguiva la selezione → ora è per-layer

Segnalazione dell'utente: attivando il loop palette su un layer e poi passando a un altro layer, il loop veniva applicato anche a quest'ultimo.

- **Causa**: `paletteLoop` era un booleano *globale* in `uiStore` e il motore scriveva sempre sul **layer attivo** (`getActiveLayer()`). Non era quindi un loop "del layer" ma un loop "della selezione": cambiando layer, il motore si portava dietro il pennello.
- `uiStore`: `paletteLoop: boolean` → `paletteLoopLayerIds: string[]` con `togglePaletteLoopFor(layerId)`. Aggiunto `prunePaletteLoopLayers(existingIds)`, chiamato quando cambia la lista dei layer, così un layer eliminato non resta acceso nell'elenco. L'intervallo resta **comune a tutti i cicli**: è una preferenza persistita, e nessuno ha chiesto tempi diversi per layer (se servirà, va spostato nella stessa mappa).
- `layersStore`: nuova azione `setLayerPaletteColors(layerId, colors, count?)`, che scrive sulla palette di un layer indicato invece che sull'attivo. La propagazione ai layer spuntati (`syncTargetIds`) avviene **solo se il layer indicato è quello attivo**: un loop che gira su un layer di sfondo non deve trascinarsi dietro la selezione di sincronizzazione. `setPaletteColors` resta com'era per tutto il resto dell'interfaccia.
- `use-palette-loop.ts`: il motore ora tiene una `Map<layerId, LoopState>` e fa girare **cicli indipendenti** (ognuno con i suoi `from`/`to`/`stepStart`) dentro un solo rAF. Resta il throttle a ~30 Hz per ciclo introdotto col fix di performance.
- `EffectsPanel`: il pulsante Loop riflette e commuta **solo il layer selezionato**, e il tooltip lo dice per nome ("Loop attivo su Layer 1… Gli altri layer non ne sono toccati").
- `LayerList`: icona `Repeat` pulsante accanto al blend mode sui layer in loop — con il loop per-layer serviva un modo di vedere dove sta girando senza selezionarli uno per uno.
- Verificato nel browser osservando i payload di sync: con il loop attivo solo sul Layer 1 e la selezione sul Layer 2, in 9 secondi il Layer 1 ha assunto **133 palette distinte e il Layer 2 esattamente 1** (prima del fix il layer selezionato veniva ricolorato). Con entrambi accesi: 115 e 116 palette, cicli indipendenti.
- **Seguito (stessa sessione): anche l'intervallo è per-layer**, su richiesta dell'utente — prima tutti i cicli ereditavano lo stesso tempo. `paletteLoopIntervals: Record<layerId, number>` in `uiStore`; `paletteLoopInterval` resta ma cambia significato: è il **tempo di partenza** dei loop accesi da qui in avanti (ultimo impostato, persistito in localStorage). La voce del layer viene materializzata all'accensione copiandoci il default: senza, i layer sprovvisti di voce propria avrebbero continuato a condividere il default, e cambiare il tempo a uno lo avrebbe cambiato agli altri — cioè lo stesso bug in forma attenuata. Spegnendo il loop la voce si conserva, così riaccendendolo il layer ritrova il suo tempo.
- Il motore legge l'intervallo **a ogni giro** (`intervalOf`) invece di catturarlo all'avvio: cambiare il tempo mentre il loop gira non fa più ripartire la dissolvenza, e l'effetto React dipende ormai solo dall'elenco dei layer. Anche `fade` è calcolato per ciclo, perché dipende dall'intervallo di quel layer.
- Verificato con due layer a 1s e 6s: in 12 secondi **287 palette distinte contro 60** (rapporto ~4,8×, coerente con i due intervalli), e tornando sul primo layer il campo mostra ancora il suo 1s.

## 2026-08-16 — Fix bug: la tendina degli effetti era inservibile → lista scrollabile con ricerca

Segnalazione dell'utente: la select a tendina degli effetti nella sidebar spesso non si lasciava scorrere, o tornava subito sull'effetto selezionato, rendendo impossibile leggere e scegliere gli altri. Proposta sua: spostare gli effetti in una sezione con scroll.

- **Causa**: `components/ui/select.tsx` usa `position="item-aligned"` (default di Radix), cioè il menu si ancora all'elemento selezionato e ne mantiene la posizione sotto il cursore. Con ~100 shader il contenuto eccede l'altezza disponibile e Radix riporta la vista sull'item corrente: il "rimbalzo" descritto. Non è un problema di CSS del progetto ma della modalità di posizionamento.
- `src/components/EffectsLibrary/ShaderPicker.tsx` (nuovo): campo di ricerca + lista sempre aperta, scrollabile, con l'effetto attivo evidenziato. Nessun ancoraggio da rispettare, quindi lo scroll è libero. **L'unico scroll automatico** scatta quando l'effetto cambia da fuori (frecce ◀ ▶, ⌥A/⌥S, playlist) e usa `block: 'nearest'`: non muove niente se l'elemento è già visibile — è proprio la differenza col comportamento di prima. `overscroll-contain` evita che, arrivati in fondo, lo scroll prosegua trascinando la sidebar.
- `EffectsPanel`: al posto della select resta il nome dell'effetto corrente in sola lettura fra le due frecce (serve perché con la lista filtrata o scorsa altrove l'attivo può non essere in vista), poi ricerca + lista alta 224px.
- `PlaylistBar`: stessa sostituzione nell'editor della clip, che aveva identico problema; lista più bassa (160px) per lo spazio ridotto del popover.
- La ricerca filtra per sottostringa (es. "liquid" → 14 risultati, inclusi i nomi che la contengono in mezzo come *Halo Liquid Symmetry*) e non tocca lo scorrimento con ⌥A/⌥S, che continua a girare su tutta la libreria.
- Verificato nel browser: lo scroll resta dove lo si mette (0 e metà lista, nessun ritorno automatico), la ricerca filtra, il click seleziona, la freccia "successivo" riporta in vista l'attivo, e l'editor clip mostra la lista senza rompere il layout. La `Select` resta in uso dove ha poche voci (blend mode del layer).

## 2026-08-16 — Indagine su scatti e crash della tab + throttle di palette loop e autosave

Segnalazione dell'utente: dopo un po' di utilizzo la tab del browser è crashata e l'effetto andava a scatti, con il sospetto che fosse colpa delle modifiche al motore. **Non lo era**, e vale la pena tenere i numeri.

- **Misure sul nuovo shader**: `Female Eyes` costa **0,12 ms** per frame fullscreen 1080p, sotto la media della libreria (Liquid Marble 0,23, Metallic 3D Fluid 0,21, SD Nebula Drift 0,22). `quadAspect()`, chiamato per ogni passaggio di ogni frame, costa **0,019 ms di CPU al secondo**. Nessun leak: l'heap fa il dente di sega e il GC recupera tutto.
- **Dove andava davvero il tempo (in dev)**: profilo CPU del trace → 10,3 s su 15 spesi in `performance.measure` e `createTask`, cioè la strumentazione che React emette in dev quando un profiler/DevTools è connesso. In **build di produzione** la stessa scena (2 layer, occhi + palette loop a 1,5s) gira a **120 fps costanti con ZERO long task**, heap stabile fra 15 e 38 MB su 50s di osservazione — contro 66 fps e 19 long task in dev. Lezione per le prossime misure: **le performance vanno misurate su `vite preview`, non sul dev server con CDP attaccato**, altrimenti si insegue un fantasma.
- Restano comunque due sprechi reali, corretti perché pesano anche in produzione (e molto su macchine più lente del portatile di sviluppo):
  - `use-palette-loop.ts`: la dissolvenza scriveva la palette nello store **a ogni frame** (120/s a 120 Hz), e ogni scrittura fa ri-renderizzare l'interfaccia, pubblica lo stato sul canale di sync e risveglia l'autosave. Ora c'è un passo minimo di 33 ms (~30 aggiornamenti al secondo, misurati 12/s reali durante il fade): l'occhio non vede differenza perché i colori restano interpolati **sul tempo**, non sul numero di passi. L'ultimo passo si applica sempre, altrimenti il throttle lascerebbe la palette su un valore intermedio.
  - `persistence.ts`: l'autosave era un debounce puro che si ri-armava a ogni modifica, quindi durante un'animazione continua scattava a ogni pausa. Ogni scrittura costa **~53 ms misurati**, perché lo snapshot include i blob dei media (l'asset dimostrativo pesa 7,08 MB): un long task che salta 3-6 frame. Ora un salvataggio già pianificato non viene più rimandato dalle modifiche successive, e c'è un tetto di `AUTOSAVE_MIN_INTERVAL_MS` (5s) fra due scritture. Verificato che l'autosave continua ad aggiornarsi dopo una modifica.
- **Fix rimandato** (scelta dell'utente: prima l'intervento senza rischi): spostare i blob dei media in uno store IndexedDB separato, così il progetto ne salva solo il riferimento e l'autosave scende da 7 MB a pochi KB. Richiede schema v5 con migrazione. Vedi TODO.

## 2026-08-16 — Nuovo effetto "Female Eyes" + uniform globale `uQuadAspect`

Richiesta dell'utente: un effetto con due occhi femminili che si aprono e chiudono a loop e guardano a destra e sinistra, da usare come layer sopra altri layer.

- `src/shaders/eyesFeminine.glsl` (nuovo, NAME: *Female Eyes*): occhi a mandorla con eyeliner alato, ciglia lunghe, iride a fibre radiali, pupilla che respira e riflessi speculari. `feOpen()` gestisce il battito di palpebre — l'istante di chiusura dentro il ciclo è pseudo-casuale (`feHash`) e ogni tanto il battito è doppio, così non risulta metronomico; `feGaze()` sposta lo sguardo su direzioni discrete (sinistra/centro/destra) con una saccade rapida a inizio ciclo e poi fissazione, come un occhio vero.
- **Trasparenza**: `processColor` restituisce alpha 0 fuori dagli occhi (il wrapper la moltiplica per la maschera del media), quindi il layer si sovrappone davvero agli altri invece di coprirli. Verificato con un secondo layer sopra un effetto psichedelico.
- I due occhi sono disegnati una volta sola in coordinate locali specchiate (`q.x *= side`, `q.x > 0` = coda esterna): ciglia, coda dell'eyeliner e sguardo restano coerenti su entrambi. Lo sguardo va rispecchiato anch'esso (`side * gaze`), altrimenti gli occhi guardano in direzioni opposte.
- `src/engine/isfParser.ts` + `ShaderPlane.tsx`: nuovo uniform globale del wrapper **`uQuadAspect`** (rapporto larghezza/altezza del quad, calcolato dai corner-pin con `quadAspect()`), disponibile a qualsiasi shader. Serviva perché le coordinate uv seguono la deformazione del layer: senza correzione gli occhi si schiacciavano su un mapping largo, e l'aspect del canvas (`uResolution`) non bastava — il quad può avere proporzioni molto diverse dal canvas. Con la correzione l'iride resta circolare e `eyeSize` è in frazioni di **altezza** del layer.
- `src/engine/effectThumbnail.ts`: la miniatura passa l'aspect del proprio riquadro a `uQuadAspect` (in `buildUniforms` il default è 1).
- Iterato sull'estetica con un harness WebGL usa-e-getta (fondo a scacchi per controllare la trasparenza, tempo pilotabile) invece che dentro l'app: nel preview dell'editor gli occhi sono troppo piccoli per giudicare ciglia, eyeliner e iride. Difetti corretti così: occhi troppo piatti, iride ovalizzata (era calcolata in coordinate già scalate da `eyeHeight`), eyeliner che sbavava oltre l'angolo interno come trattino sospeso (la curva della palpebra vale solo per `|q.x| < 1`), coda alata staccata dal corpo della linea.

## 2026-08-16 — README: sezione "Novità della versione 4"

Richiesta dell'utente: documentare il loop palette nel README come novità della versione 4.

- Nuova sezione **"Novità della versione 4"** subito dopo il blocco di stato, con il loop palette in prima voce. Le altre voci sono le novità già in `main` dal merge di v3 in poi (`git log 45ca819..HEAD`): cambio effetto rapido + Random dei controlli, barra spaziatrice per l'invio in Live, rifiniture UI (pannello Move, troncamento dei nomi file lunghi). Il progetto non ha tag né versione in `package.json`: "v4" è il ciclo di lavoro sul branch omonimo.
- **"Effetti e palette colori"**: voce dedicata al loop, marcata _(novità v4)_ — intervallo regolabile in corsa, dissolvenza, il fatto che prosegua cambiando pannello e che rispetti la modalità Live.
- **"Motore di rendering shader"**: il perché tecnico dell'interpolazione in HSL invece che in RGB, e il motore rAF che smette di scrivere a dissolvenza conclusa.

## 2026-08-16 — Loop delle palette casuali (Colori casuali, pannello Shader)

Richiesta dell'utente: accanto a "Genera" un tasto che attivi una generazione automatica di palette casuali a intervalli regolari. Scelte concordate: intervallo regolabile (default 5s), dissolvenza morbida fra una palette e l'altra, e nessuna eccezione alla modalità Live.

- `src/store/paletteStore.ts`: aggiunte `rgbToHsl()` (privata) e `lerpPaletteColors(from, to, t)`. L'interpolazione è **in HSL, non in RGB**: in RGB due tinte opposte si incontrano passando per un grigio slavato a metà transizione, mentre ruotando la tinta sul percorso più corto la palette resta satura per tutto il fade (verificato: saturazione media 0.886 → 0.863 → 0.846 fra inizio, metà e fine).
- `src/store/uiStore.ts`: `paletteLoop` (on/off) e `paletteLoopInterval` (0.5–60s). Lo stato di esecuzione non è persistito — come il play della playlist, riaprendo l'app si riparte da fermi — mentre l'intervallo è una preferenza e va in localStorage (`easyvj-palette-loop-interval`).
- `src/hooks/use-palette-loop.ts` (nuovo): motore rAF. Ogni step genera una palette casuale col `count` corrente e ci dissolve dentro partendo **dai colori che ci sono in quel momento**, non dal target precedente: così un intervento manuale (Genera, 2/3/4/5, color picker) non viene scavalcato con uno stacco. A dissolvenza conclusa smette di riscrivere la palette (`settled`), per non tenere sync e autosave attivi a ogni frame. Fade di 1s, accorciato a `interval * 0.8` sotto i ~1.2s di intervallo.
- Montato in `ControlPage`, non nel pannello: la sidebar sinistra smonta i pannelli al cambio tab e il loop si sarebbe spento passando su Palette o Progetti.
- Nessun trattamento speciale per il Live: passando da `setPaletteColors` come il pulsante Genera, in Live l'Output resta fermo e i colori lo raggiungono con "Esegui in output", come ogni altra modifica.
- `EffectsPanel`: seconda riga nel blocco "Colori casuali" con il toggle Loop (`variant=default` quando attivo, icona `Repeat` in pulse) e il campo secondi.
- Verificato nel browser: intervalli rispettati (cambi a 1.41s / 3.42s / 5.44s / 7.45s con intervallo 2s), dissolvenza con una decina di stati intermedi seguita dalla palette piena, loop che prosegue nel tab Palette, e colori fermi a loop spento. **Nota per i test futuri**: con la finestra Chrome in background `requestAnimationFrame` viene throttlato a ~1–2 fps e ogni fade sembra uno stacco secco — serve `osascript -e 'tell application "Google Chrome" to activate'` e `select_page({bringToFront: true})` prima di misurare le animazioni.

## 2026-08-16 — Fix bug: nome file troppo lungo rompeva la sidebar destra

Richiesta dell'utente: nella sidebar destra, sezione Asset, un nome file troppo lungo faceva uscire la colonna dai bordi del browser nascondendo il contenuto.

- `src/components/ControlPanel/MediaUploader.tsx`: aggiunto `truncateName()` con limite `MAX_NAME_LENGTH = 28` caratteri che tronca il nome del media mostrato nel bottone (con `…` finale), invece di affidarsi solo alla classe CSS `truncate` che in quel layout a flex non bastava a contenere la larghezza. Aggiunto anche `title={media?.name}` sullo span per vedere il nome completo al passaggio del mouse.
- Verificato caricando un file con nome molto lungo via dev server + screenshot: la sidebar ora resta dentro i bordi.

## 2026-08-15 — README aggiornato con le novità della sessione

Richiesta dell'utente: includere nel README le funzioni aggiunte oggi (scorciatoie da tastiera e pulsante Random).

- **Nuova sezione "Scorciatoie da tastiera"** dentro "Funzionalità disponibili", con la tabella completa: non solo ⌥A/⌥S e Spazio, ma anche i tasti che esistevano già e non erano documentati da nessuna parte (frecce del nudge con Shift ×5, Spazio+drag e rotellina per pan/zoom della vista, Alt+click sui pulsanti larghezza/altezza, ⌘/Ctrl+B per la sidebar). Verificati uno per uno nel codice prima di scriverli.
- **"Effetti e palette colori"**: aggiunte le voci sul cambio effetto rapido (frecce + scorciatoie, ciclico e con "Nessun effetto" escluso) e sul Random dei controlli.
- **"Output e modalità Live"** e **"Controllo del palco"**: menzionato l'invio con la barra spaziatrice, con la nota che fuori da Live il tasto resta al pan — il criterio con cui le scorciatoie sono state tenute separate.
- **"Cosa fa, in pratica"**: integrato il punto 3 sugli shader, senza aggiungere un punto nuovo alla lista.

## 2026-08-15 — Barra spaziatrice = "Esegui in output"

Richiesta dell'utente: un tasto rapido (Spazio) per inviare le modifiche alla finestra Output in modalità Live.

**Conflitto risolto**: lo Spazio è già il modificatore del pan della vista (Spazio+drag in `useViewportPanZoom`). Per questo la scorciatoia è attiva **solo quando Live è attivo e ci sono modifiche in sospeso** (`live && dirty`), cioè esattamente quando il pulsante della toolbar è cliccabile. Fuori da Live l'handler esce subito senza `preventDefault`, quindi il pan resta identico a prima e non c'è nessun override invisibile.

- **`src/hooks/use-output-hotkeys.ts`** (nuovo): listener su `window` montato in `ControlPage`, chiama `pushToOutput()` dell'`outputStore` — la stessa azione del pulsante, quindi passa per `useBroadcastPublisher` e ottiene gratis la dissolvenza impostata nella barra playlist.
- **`preventDefault` in Live**: senza, con il focus su un pulsante (situazione normale dopo averlo cliccato) lo Spazio ri-attiverebbe quel pulsante *insieme* all'invio. Durante una performance il tasto deve fare una cosa sola. Restano esclusi i campi di testo, dove lo Spazio scrive.
- **`TopToolbar.tsx`**: aggiunto il badge `Spazio` dentro il pulsante "Esegui in output" e la scorciatoia nel `title`.
- **Limite noto**: in Live, tenendo premuto lo Spazio per pannare la vista parte anche un invio (uno solo: `e.repeat` è bloccato). Il pan col click centrale non è toccato. Se dovesse dare fastidio, l'alternativa è riservare il pan al solo click centrale mentre Live è attivo.
- **Verificato nel browser** con Control e Output aperti in due schede: in Live il cambio effetto lascia l'Output fermo e accende il pulsante; lo Spazio manda la scena (Output aggiornato con dissolvenza) e riporta il pulsante a spento; col focus nel campo "Nome preset" lo Spazio scrive e l'invio resta in sospeso; fuori da Live non fa nulla. Nessun errore in console, type-check pulito.

## 2026-08-15 — Sezione "Controlli effetto" con pulsante Random, e fix dell'overflow della riga effetto

Richiesta dell'utente: un pulsante che randomizzi le impostazioni dello shader scelto, preceduto da un titolo di sezione ("CONTROLLI EFFETTO") con il pulsante di fianco, sotto la sezione "Colori effetto".

- **`src/store/layersStore.ts`**: nuova azione `randomizeActiveParams()`. Pesca un valore per ogni uniform float dentro il range dichiarato dallo shader (`@min`/`@max` del parser ISF) e lo **quantizza sullo stesso passo dello slider** (`(max-min)/200`), altrimenti il readout mostrerebbe valori con dieci decimali. Passa da `editEffect`, quindi si propaga ai layer sincronizzati come ogni altra modifica d'effetto.
- **Non tocca gli uniform colore** (`colorControls`): i colori hanno già i loro randomizer nella sezione "Colori casuali" e nel pannello Palette; mescolarli qui renderebbe il pulsante meno prevedibile.
- **`EffectsPanel.tsx`**: intestazione "Controlli effetto" + pulsante Random sulla stessa riga, prima degli slider degli uniform. Il blocco ora è condizionato a `shader.controls.length > 0`, così l'intestazione non compare sugli shader senza parametri.
- **Fix di una regressione introdotta con la riga ◀ select ▶**: con i nomi di effetto lunghi il pannello sbordava (contenuto 313px in un viewport da 287). Causa: il **Viewport di Radix ScrollArea è `display: table`**, quindi si dimensiona sul *max-content* dei figli — e il testo `nowrap` del trigger più i 76px delle due frecce superavano la larghezza della sidebar. Misurato in pagina che nascondendo la riga il contenuto tornava a 287. Soluzione **locale** (niente modifiche al componente ScrollArea condiviso, che avrebbero toccato tutta la sidebar): `overflow-hidden` sulla riga e trigger con base 0 (`w-0 flex-1`). Aggiunto anche il troncamento con ellissi sul valore del trigger (`*:data-[slot=select-value]:block/truncate`), che con `line-clamp-1` da solo non si otteneva.
- **Verificato nel browser**: Random cambia tutti gli slider entro i rispettivi range e il visual si aggiorna; nessun errore in console; con l'effetto dal nome più lungo della libreria il contenuto del pannello misura esattamente la larghezza del viewport. Type-check pulito. **Nota**: i parametri del layer sono rimasti sui valori random dell'ultimo test e l'autosave li ha memorizzati; si riportano a piacere a mano o con un altro Random.

## 2026-08-15 — Cambio rapido dell'effetto: frecce nel pannello + scorciatoie ⌥A/⌥S

Richiesta dell'utente: selezionare un effetto più in fretta che aprendo la select, con tasti dedicati e frecce di navigazione.

**Perché non le frecce direzionali**: Su/Giù sono già il nudge del corner-pin (`useNudgeKeys` in `MappingControls.tsx`), che è il gesto centrale dell'allineamento; e Cmd+A/Cmd+S sono occupati dal browser (seleziona tutto / salva pagina). Scelto **Option/Alt + A/S**, libero sia lato browser sia lato app (l'unica altra combo con modificatore è Cmd/Ctrl+B della sidebar).

- **`src/store/layersStore.ts`**: nuova azione `cycleActiveShader(dir: 1 | -1)`. Passa da `editEffect` come `setActiveShader`, quindi eredita gratis la propagazione ai layer sincronizzati. Esclude `NONE_SHADER_NAME` dallo scorrimento (è il blackout, non una tappa) e cicla a loop; partendo da "Nessun effetto" entra dal primo o dall'ultimo secondo la direzione.
- **`src/hooks/use-effect-hotkeys.ts`** (nuovo): listener su `window`, montato in `ControlPage`. Esporta anche `ALT_LABEL` (⌥ su macOS, Alt+ altrove) usato dai tooltip.
- **Trappola macOS**: con Option premuto la tastiera produce caratteri diversi (⌥A → "å", ⌥S → "ß"), quindi `e.key` non serve a nulla: si confronta **`e.code`** (`KeyA`/`KeyS`), stabile su ogni layout e su Windows/Linux con Alt.
- **Guardia più stretta del nudge**: esclusi solo i campi di testo (`INPUT`/`TEXTAREA`/contenteditable), dove ⌥S scriverebbe un carattere. Gli slider **non** sono esclusi, a differenza del nudge: lì la guardia serve perché le frecce muovono lo slider, mentre ⌥A/⌥S non sono usati da nessun altro controllo. Bloccato `e.repeat`: tenendo premuto si salterebbero decine di effetti, ognuno con la propria ricompilazione dello shader.
- **`src/components/EffectsLibrary/EffectsPanel.tsx`**: pulsanti ◀ ▶ **in linea** con la select (non sotto: non aggiunge altezza al pannello e la relazione con la lista resta leggibile). Il `title` mostra la scorciatoia, così si impara guardando la UI.
- **Ambito volutamente limitato alla finestra Control**: se il focus del SO è sulla finestra Output i tasti arrivano lì e non alla Control. Estendere richiederebbe di registrare l'hotkey anche in Output e rimandare il comando via BroadcastChannel — non fatto perché il flusso normale è pilotare dalla Control.
- **Verificato nel browser**: ⌥S/⌥A avanti e indietro, wrap in entrambe le direzioni saltando "Nessun effetto", click sulle frecce, hotkey attivo con focus su un pulsante e su uno slider e inerte nel campo "Nome preset". Type-check pulito, console col solo warning noto THREE.Clock.

## 2026-08-14 — Purga dai file markdown di una feature non più esistente

Richiesta dell'utente: eliminare da tutti i `.md` ogni traccia di una sezione dell'app rimossa il 2026-08-13. Chiesto prima di procedere fin dove spingersi, dato che `MEMORY.md` è un registro storico e non una descrizione del prodotto: scelta esplicita dell'utente la **purga totale**, log compreso.

- **`README.md`**: eliminate le due sezioni dedicate (lato utente e lato tecnico), il passo 5 di "Cosa fa, in pratica" (da 9 a 8 punti, gli altri rinumerati), la riga di fase completata nella roadmap, una riga dello stack tecnologico ormai senza riscontro nel codice e una frase in coda alla nota sugli shader ISF-like. I **controlli globali**, che erano citati solo nella riga di roadmap eliminata, sono stati spostati nella voce di Fase 2: esistono ancora, e cancellarli sarebbe stato perdere informazione vera.
- **`TODO.md`**: eliminata la sezione "Fase 2.5"; ripulite la voce sull'import di shader GLSL da parte dell'utente e la descrizione del modello multi-layer, che vi rimandavano.
- **`MEMORY.md`**: eliminate le quattro voci di changelog dedicate (28-29 luglio) e quella della rimozione (13 agosto), più i riferimenti sparsi dentro voci di altro argomento. **Eccezione motivata**: la voce del 2026-07-28 sul toggle degli overlay di mapping è stata mantenuta e riscritta, perché documentava anche due cose ancora vive nel codice — il limite di larghezza in `use-resizable-width` e la trappola del `Viewport` di Radix ScrollArea (`display: table; min-width: 100%`, che non si restringe sotto la larghezza del contenuto), ora formulata in modo generale invece che legata a un pannello che non c'è più.
- Restano invece le occorrenze dell'aggettivo "generativo" riferite agli **shader** della libreria (che sono davvero generativi): non sono tracce della feature.
- **Residuo fuori scope** (non è un `.md`): `@uiw/react-codemirror` e `@codemirror/lang-cpp` sono ancora in `package.json` senza essere importati da nessun file di `src/`.

## 2026-08-14 — Pannello Move: pad direzionale centrato e grafica allineata all'ispettore

Richiesta dell'utente: migliorare grafica e posizionamento dei tasti del pannello Move, e centrarlo.

**Perché il pad era sbilanciato**: la griglia usava `grid-cols-3` dentro la colonna dell'ispettore, quindi ogni colonna prendeva un terzo della larghezza disponibile (~95px) mentre i pulsanti restavano `size-8`. Le frecce si ancoravano a sinistra della propria cella e la croce si leggeva come tre tasti sparsi invece che come un pad. Ora le colonne sono dimensionate sul contenuto e il blocco è centrato da un wrapper `flex justify-center` (misurato in pagina: pad 130px, 78.5px di margine identici sui due lati in un pannello da 287px).

- **`src/components/Positioning/MovePanel.tsx`**: il pad è dentro un riquadro (`rounded-xl border bg-muted/25`) che lo fa leggere come un unico controllo fisico. Nuovo componente interno `PadButton` (36px, bordo + `bg-secondary/60`, ombra leggera) al posto del `Button` shadcn: serve una dimensione fissa e indipendente dalla griglia, che `size="icon"` da solo non garantiva nel contesto sbagliato.
- Il tasto **Centra** resta visivamente distinto (fondo `background`, bordo pieno) e si **disabilita quando l'offset è già 0**, come il **Reset** quando l'intero transform è al default: così lo stato del layer si legge dai pulsanti, senza dover confrontare i numeri.
- Aggiunta la **lettura numerica dell'offset** (`0.00 : 0.00`) accanto al titolo Posizione, nello stesso stile del valore di zoom già presente; entrambi ora sono chip su `bg-muted/60`.
- I due pulsanti dello zoom passano da `ghost` (di fatto invisibili finché non ci si passa sopra) a `outline` `icon-sm`, e si disabilitano ai limiti 0.1×/4×. Reset a larghezza piena.
- **Nessun cambio di comportamento**: passi, limiti e azioni dello store sono gli stessi di prima.
- **Verificato nel browser**: pad centrato e simmetrico, frecce e zoom aggiornano readout e proiezione, Centra e Reset si accendono appena il transform esce dal default e tornano spenti dopo il Reset. Stato dell'app riportato ai valori iniziali dopo il test. Type-check e lint puliti, console col solo warning noto THREE.Clock.

## 2026-08-13 — 10 shader "SD": source-driven guidati dal gradiente (libreria a 97 effetti)

Richiesta dell'utente: 10 effetti nuovi sulla scia del source-driven, con nome che inizia per "SD", che si deformino insieme alle curve dello stage o dell'oggetto, con almeno 8 controlli ciascuno.

**Cosa distingue la famiglia SD dalla Morph** (la scelta progettuale centrale): i Morph usano la luminanza come **quota scalare** (`lum * morphDepth`), quindi il pattern si alza e si abbassa ma resta orientato come il piano dello schermo. Gli SD calcolano anche il **gradiente** della luminanza campionando la texture ai quattro lati (`sdSlope()`), ottenendo un vettore che punta nella direzione in cui la superficie sale. Da lì derivano tre cose che ai Morph mancano: (a) i pattern possono scorrere **lungo le isoipse** (perpendicolari alla pendenza), cioè avvolgere l'oggetto invece di attraversarlo; (b) le uv si possono warpare lungo la pendenza, così le trame si stirano sui fianchi; (c) si può illuminare la superficie apparente con un prodotto scalare tra pendenza e direzione della luce, dando volume. Il raggio di campionamento è esposto come `sampleRadius`, che regola quanto il rilievo è "fine o morbido".

**10 nuovi file `src/shaders/sd*.glsl`**, ognuno con **11-12 controlli** (ben oltre gli 8 richiesti): SD Ridge Flow (creste lungo le isoipse), SD Contour Map (curve di livello animate, brillano dove l'oggetto è ripido), SD Relief Lattice (reticolo inclinato dalla pendenza, maglie che respirano), SD Molten Drape (materiale che cola deviato dai rilievi, con speculare), SD Spark Veins (vene elettriche concentrate nei solchi), SD Halo Bloom (anelli sollevati dalla quota, centro spostabile), SD Silk Weave (intreccio trama/ordito tirato dalla pendenza, con sopra/sotto alternati), SD Prism Shards (sfaccettature con dispersione cromatica per canale RGB), SD Nebula Drift (nube fbm che si accumula nei solchi), SD Pulse Sonar (onde emesse dalle creste dell'oggetto, non da un centro fisso).

**Verifica**: compilati tutti in un contesto WebGL reale — 0 errori. Per il provino visivo il trucco della misura pixel non funziona (il canvas R3F non ha `preserveDrawingBuffer`, quindi `drawImage` legge un buffer vuoto e ogni luminanza risulta 0): ho invece **disposto gli 11 shader come griglia 4×3 di layer** con lo stesso asset, sfruttando il corner-pin per dare a ciascuno una cella — un solo screenshot mostra tutti gli effetti sull'immagine reale. Il provino ha scovato 3 shader quasi neri, corretti: **SD Prism Shards** (usava le luminanze dei canali rifratti invece dei canali stessi: ora dispersione cromatica vera e guadagno 2.4×), **SD Nebula Drift** (fbm non normalizzato sulla somma delle ampiezze: con `octaveGain` basso restava sotto 0.25), **SD Halo Bloom** (anelli troppo deboli). Dopo la correzione tutti e 11 risultano vivi e distinti.
- **Consegnati 10, non 11**: ne avevo scritto uno in più; ho eliminato `sdDepthScanner.glsl` perché il suo concetto (piano di scansione che attraversa la quota) duplicava `morphDepthScan.glsl` già in libreria, mentre gli altri dieci non hanno equivalenti.
- Libreria da 87 a **97 file** `.glsl`; aggiornati i tre conteggi nel README e aggiunta la descrizione della quinta famiglia. Scena di lavoro ripristinata dopo il provino (un solo layer, shader e fit originali).

## 2026-08-13 — Nuovo shader "Morph Pulse Beacon" (tradotto dal runtime MAPSHROOM + reso source-driven)

Richiesta dell'utente: aggiungere uno shader GLSL fornito per intero nel messaggio, poi renderlo "più morph" e capace di adattarsi alle forme dello stage.

**Traduzione dal formato originale**: la sorgente fornita non era nella convenzione ISF-like del progetto — usava uniform del runtime MAPSHROOM (`tex`/`tex2`/`tres`/`fparams`/`iparams`/`ftime`/`itime`/`tcoord`) e scriveva `gl_FragColor` direttamente in un `main()`, ignorando del tutto la texture sorgente. Tradotto in `processColor(sampler2D tex, vec2 uv, float time, vec2 resolution)`: `gl_FragCoord.xy/resolution.xy` → il parametro `uv` già fornito (equivalente per un quad fullscreen); `itime+ftime` → il parametro `time`; i tre controlli `fparams[0..2]` (commentati nel sorgente come "x pos/y pos/zoom") diventati tre uniform `posX`/`posY`/`zoomAmount` (0..1, default 0.5) con lo stesso `mix()` interno ai range originali (0.05–0.95 per la posizione, 0.2–0.95 per lo zoom).
**Da "ignora l'asset" a source-driven (famiglia Morph)**: la richiesta di renderlo "più morph e che si adatti alle forme dello stage" corrisponde esattamente alla DNA della famiglia Morph già documentata (vedi voce del 2026-07-29): campiona `source`, salta l'effetto sotto `blackThreshold` (nuovo uniform, default 0.05 — stesso default della famiglia), usa la luminanza per deformare la geometria (`u += lum * morphDepth * 0.08`, nuovo uniform 0–10 default 3 — stesso range della famiglia) invece di limitarsi a disegnarci sopra, e mescola il risultato con `source.rgb` invece di sostituirlo (`mix(source.rgb, beacon + source.rgb*beacon, 0.85)`, stessa proporzione 85% usata da `morphConcentricWaves.glsl`). Aggiunta anche una guardia `u = max(u, 0.001)` sulla divisione `1.0/u`: nella versione originale u poteva toccare esattamente zero al centro del campo (singolarità/NaN potenziale), un rischio concreto ora che `lum*morphDepth` può spingere u vicino a zero in punti diversi dal solo centro geometrico.
- **File rinominato** da `pulseBeacon.glsl` a **`src/shaders/morphPulseBeacon.glsl`** (`// NAME: Morph Pulse Beacon`), per coerenza con gli altri file `morph*.glsl` e per comparire raggruppato coi suoi simili nel dropdown Effetto.
- **Verificato nel browser**: il campo pulsante ora segue visibilmente i rilievi della statua (non più un cerchio piatto sopra l'immagine); `morphDepth` a 9 produce una trama puntinata più fitta e distinta lungo i contorni, coerente con l'estetica degli altri Morph; `blackThreshold` a 0.8 lascia intatte le zone scure/desature e applica l'effetto solo dove l'asset ha colore. Console pulita (solo il warning noto THREE.Clock).

## 2026-08-13 — Nuovo shader "Emboss Light Pro"

Richiesta dell'utente: aggiungere uno shader GLSL già scritto (fornito per intero nel messaggio).

- **Nuovo `src/shaders/embossLightPro.glsl`**: rilievo (emboss) calcolato dai gradienti dell'immagine sorgente in due raggi di campionamento (largo + stretto, sommati), con una sorgente di luce puntiforme animata in cerchio (`lightSpeed`) che illumina il rilievo con `lightColor`; il canale rosso ridisplazzato (`dispStrength`) viene ricolorato per dare profondità cromatica. Sotto `threshold` di luminanza il pixel passa invariato (`return source`), che assieme all'alpha preservato (`source.a`) è già sufficiente perché la maschera automatica (moltiplicazione dell'alpha finale nel wrapper) ritagli l'effetto dentro i bordi dell'asset senza bisogno di codice apposito nello shader.
- Nessuna modifica al parser o al wrapper: caricato automaticamente da `import.meta.glob` in `effectsStore.ts`, come ogni altro file `.glsl`. Unico intervento oltre a copiare la sorgente: indentazione a 2 spazi per coerenza con gli altri file della libreria (il contenuto GLSL è identico a quello fornito).
- **Verificato nel browser**: lo shader compare nel dropdown Effetto (libreria passata da 86 a 87 file, invariato il conteggio "87 shader" già nel README — coincidenza, non un aggiustamento fatto apposta), i 4 slider e il color picker `lightColor` sono generati correttamente dal parser, applicato al layer attivo renderizza il rilievo animato ritagliato dentro l'asset. Console pulita (solo il warning noto THREE.Clock).

## 2026-08-13 — Crossfade dell'intera scena sugli invii all'Output (via il cambio secco)

Richiesta dell'utente: la transizione smooth della playlist deve valere anche quando si mandano le modifiche alla finestra Output, per eliminare il taglio netto. Scelte confermate: **crossfade dell'intera scena** (non solo dell'effetto), su "Esegui in output" **e** sull'uscita dalla modalità Live, con durata presa dai valori già impostati nella barra playlist.

**Perché non bastava riusare il crossfade esistente**: `Layer.transition` sfuma il solo `EffectSnapshot` (shader, parametri, colori, size, palette), mentre un invio all'Output può cambiare qualsiasi cosa — media, mapping, maschere, opacità, perfino il numero di layer. Riusarlo avrebbe fatto sfumare l'effetto lasciando secco tutto il resto.

- **`src/store/layersStore.ts`**: nuovi `outgoingLayers` (copia congelata della scena precedente, viva solo durante la dissolvenza e solo nella finestra Output) e `sceneFade` (0 = solo scena uscente, 1 = solo nuova). `beginSceneCrossfade(layers, activeLayerId)` applica la nuova scena conservando la vecchia; se un crossfade è già in corso **mantiene la scena uscente di partenza** invece di sostituirla con quella intermedia, altrimenti l'immagine già in dissolvenza salterebbe indietro. `setSceneFade(p)` avanza e a `>= 1` libera `outgoingLayers`. `setScene` azzera entrambi: un cambio secco interrompe una dissolvenza in corso.
- **`src/engine/ShaderPlane.tsx`**: `LayerMesh` ed `EffectPass` accettano una `SceneSource` (`current` | `outgoing`) e leggono il layer dalla lista corrispondente tramite l'helper `findLayer`. Il crossfade si ottiene scalando `uOpacity` per `sceneWeight()` — pesi incrociati `p` e `1 - p`, gli stessi del crossfade della playlist, quindi le due transizioni si comportano in modo identico. `ShaderPlane` monta entrambe le scene, con la uscente tenuta interamente sotto l'entrante da uno scarto di renderOrder (`OUTGOING_ORDER_OFFSET`) e con key `out-<id>` distinta, perché lo stesso layer può comparire in entrambe.
- **`src/lib/sync.ts`**: il payload porta `fadeDuration`, valorizzato **solo** sugli invii espliciti (push e uscita da Live) leggendo `transitionMode`/`transitionDuration` dalla playlist (`smooth` → durata, `cut` → 0). Gli aggiornamenti automatici fuori da Live restano istantanei, altrimenti ogni movimento di slider arriverebbe smorzato e in ritardo. `lastPayload` (la risposta agli `hello`) è memorizzato **con `fadeDuration: 0`**: una finestra Output aperta più tardi deve trovarsi subito la scena, non riprodurre la transizione di un invio già avvenuto. L'animazione è un rAF nel subscriber dell'Output, cancellato al dismount e riavviato se arriva un nuovo invio a dissolvenza in corso.
- **Verificato con due finestre reali**: in Live l'Output resta congelato sul vecchio effetto; premendo "Esegui in output" `outgoingLayers` si popola con la scena precedente e `sceneFade` sale da 0, con lo screenshot a metà che mostra i due effetti sovrapposti; a fine transizione `outgoingLayers` torna null. Sull'uscita da Live il log sullo store misura **6006 ms** contro i 6 s impostati. Type-check pulito, console con il solo warning noto THREE.Clock.
- **Nota sui test in due finestre**: con la tab Output in background Chrome rallenta i `requestAnimationFrame`, quindi campionare la dissolvenza da lì è inaffidabile (nell'uso reale l'Output è su un secondo schermo e resta visibile). Per verificare conviene loggare dalle notifiche dello store, non da rAF.

## 2026-08-13 — Colonna destra "ispettore del layer": Layers + Asset + Mask + Move insieme

Richiesta dell'utente: spostare Layers, Mask e Assets in una sidebar destra collassabile dove siano **tutti visibili insieme e sincronizzati sul layer selezionato**, così che selezionando Layer 1 si veda in un colpo d'occhio il suo asset, la sua maschera e i suoi controlli di posizione. Scelte confermate: Move entra nella colonna destra; lista layer **fissa** in alto (è la selezione che comanda tutto) e Proprietà/Asset/Mask/Move come blocchi **richiudibili**; overlay delle maschere quando se ne seleziona una; a sinistra restano Shader, Palette, Progetti, Output.

- **`src/store/uiStore.ts`**: il tipo `Panel` passa da 7 a 4 voci (`shader | palette | projects | output`) — tutto ciò che descrive il singolo layer ha lasciato la sidebar sinistra. Default `activePanel` da `layers` a `shader`. Nuovi `rightSidebarOpen`/`toggleRightSidebar` e `sectionsOpen`/`toggleSection` per i blocchi richiudibili, **persistiti in localStorage** (`easyvj-layer-sections`) con fallback silenzioso se lo storage è pieno o disabilitato: chi lavora con Move chiuso non se lo ritrova aperto a ogni avvio.
- **`LayersPanel.tsx` eliminato**, diviso in due: **`LayerList.tsx`** (lista riordinabile + "Nuovo", con `max-h-52` e scroll proprio così molti layer non spingono fuori i blocchi sotto; mostra un lucchetto ambra sui layer con mapping bloccato, stato che va visto senza doverli selezionare) e **`LayerProperties.tsx`** (nome, opacità, blend mode).
- **Nuovo `CollapsibleSection.tsx`**: intestazione cliccabile con chevron e `badge` opzionale, leggibile anche a sezione chiusa.
- **Nuovo `LayerInspector.tsx`**: header, blocco fisso con la lista, poi `ScrollArea` con le quattro sezioni. Badge utili a colpo d'occhio: numero di maschere (forme + stencil) e "vuoto" sull'Asset se il layer non ha media.
- **`ControlPage.tsx`**: la colonna destra è un `<aside>` ridimensionabile (`easyvj-inspector-width`, 260–560px) — non il componente shadcn `Sidebar`, che in modalità collassabile usa `position: fixed inset-y-0` e confliggerebbe col TopToolbar (trappola già documentata il 2026-07-24). `PanelContent` ridotto ai 4 pannelli rimasti; `ProjectsPanel` è ora un pannello a sé (era dentro "Assets", ma è **globale**, non per-layer, quindi non appartiene a una colonna che parla del layer selezionato).
- **`TopToolbar.tsx`**: nav a 4 voci (Shader, Palette, Progetti, Output) più un pulsante `PanelRight` che apre/chiude l'ispettore.
- **Overlay maschere**: il trigger passa da `activePanel === 'mask'` (non più esistente) a **`activeMaskId != null`**. Conseguenza non ovvia scoperta provando: `selectMask` non aveva un modo di deselezionare, quindi una volta scelta una maschera non si sarebbe mai più tornati al corner-pin. Il click sulla voce in `MaskPanel` è ora un **toggle** (ri-cliccare la maschera selezionata la deseleziona).
- **Verificato nel browser**: layout a tre colonne; le quattro sezioni si aprono/chiudono e lo stato sopravvive al reload (Asset chiuso resta chiuso); aggiungendo una maschera compare il badge "1" e sul canvas le maniglie della maschera sostituiscono il corner-pin; deselezionandola torna il corner-pin; il toggle in toolbar chiude la colonna e il canvas si allarga (1064px). Stato dell'app ripulito dopo i test (maschera di prova rimossa, sezioni riaperte). Type-check pulito, console col solo warning noto THREE.Clock.

## 2026-08-13 — Controlli di mapping professionali (toolbar in basso a sinistra sul canvas)

Richiesta dell'utente: più controlli per gestire il mapping su un oggetto fisico (statua o stage), collocati nel canvas in basso a sinistra. Dopo l'analisi dell'esistente ha scelto tutti e quattro i gruppi proposti (precisione, sicurezza, trasformazioni, assistenza visiva) **escludendo l'undo/redo**, quindi della "sicurezza" resta il solo lucchetto.

**Buchi individuati nell'analisi**: il pad direzionale aveva step fisso 0.05 e muoveva solo l'intero layer (nessuna precisione fine sul singolo angolo); nessun lucchetto (un click accidentale sul poligono distruggeva minuti di allineamento); nessuna rotazione né flip **geometrici** — `FxControls.rotation`/`mirrorX`/`mirrorY` esistono ma agiscono sulle uv dell'effetto dentro il quad, non sul mapping; scala solo uniforme; nessun modo di azzerare la sola deformazione corner-pin; nessun riferimento visivo (griglia, test pattern).

- **Nuovo `src/lib/mappingGeometry.ts`**: funzioni pure sui 4 corner — `rotateCorners`, `scaleCorners` (non uniforme), `flipCorners`, `straightenCorners`, `snapValue`/`snapCorner`. **Scelta architetturale chiave**: rotazione, scala non uniforme e flip agiscono sui corner esistenti invece di aggiungere campi a `Transform`. I corner sono già persistiti e sincronizzati, quindi zero modifiche a shader, persistence e sync. Il flip *scambia* i corner (TL↔TR) invece di spostarli: ogni vertice porta con sé la propria uv, quindi il quad resta fermo ed è il contenuto a ribaltarsi.
- **`src/store/layersStore.ts`**: nuovo `Layer.locked` (default false, retrocompatibile come `fx`: lo spread in `deserializeLayer` non sovrascrive con undefined) + `setLayerLocked`/`toggleActiveLocked`. Nuovo helper **`patchActiveMapping`**, gemello di `patchActive` che salta i layer bloccati: è l'unico punto in cui il lucchetto è applicato, così ogni via d'ingresso (drag sul canvas, pad, frecce, toolbar) lo rispetta senza ricontrolli sparsi. Tutte le azioni di mapping (`setActiveCorner(s)`, `moveActiveCorners`, `setActiveTransform`, `resetActiveTransform`) ci passano ora. Nuove azioni `rotateActiveCorners`, `scaleActiveCorners`, `flipActiveCorners`, `straightenActiveCorners`, `nudgeActiveCorners(dx, dy, index|null)`. Nuovo stato di scena `testPattern` + `setTestPattern`.
- **`src/store/uiStore.ts`**: `selectedCorner` (0..3 o null = tutti), `nudgeStep` con la tabella `NUDGE_STEPS` (fine 0.002 ≈ 1px su un'anteprima da 1080, medio 0.01, grande 0.05), `gridVisible`, `snapEnabled`, costanti `GRID_DIVISIONS`/`GRID_STEP`.
- **Nuovo `src/components/Positioning/MappingControls.tsx`**: toolbar flottante in basso a sinistra (speculare a `ViewportZoomControls`) su due righe — bersaglio delle frecce (Tutti/TL/TR/BL/BR) e passo; rotazione ±90° e ±1°, scala larghezza/altezza (Alt+click per ridurre), flip H/V, raddrizza, griglia, snap, test pattern, lucchetto. Include l'hook `useNudgeKeys`: le frecce muovono l'angolo selezionato del passo corrente (**Shift = ×5**), ignorate quando il focus è su input/textarea/select/contenteditable o su uno slider Radix (`[role="slider"]`), che le usa già per i suoi valori.
- **`CornerPinOverlay.tsx`**: rispetta il lucchetto (niente drag di angoli né del poligono), il click su una maniglia la seleziona come bersaglio delle frecce, snap opzionale alla griglia. Feedback visivo: bloccato = maniglie ambra e cornice tratteggiata, angolo selezionato più grande con ring. Lo snap è applicato alla posizione **renderizzata** (prima di `invertTransform`) perché è lì che l'utente vede la griglia.
- **Nuovo `src/components/Positioning/AlignmentGrid.tsx`**: griglia SVG in coordinate mondo che segue zoom/pan della vista (assi centrali più marcati), montata in `ControlPage` solo se `overlaysVisible && gridVisible` — il toggle occhio esistente la nasconde come gli altri riferimenti. Solo Control.
- **Nuovo `src/engine/TestPattern.tsx`**: griglia di calibrazione (bordo ciano, reticolo, diagonali magenta che rivelano la prospettiva sbagliata, crocino giallo) disegnata sui corner del layer attivo con `renderOrder` 100000, montata in `StageCanvas` quindi visibile **anche in Output** — è lì che serve, proiettata sull'oggetto reale. `testPattern` è stato di scena transiente: aggiunto al payload di `sync.ts`, ma non entra in `snapshot()` quindi non viene persistito.
- **Trappola**: un commento GLSL dentro il template literal conteneva backtick, che chiudevano la stringa (`TS1005`). Nei template literal degli shader niente backtick, nemmeno nei commenti.
- **Verificato nel browser** (Control + Output): griglia e test pattern renderizzati correttamente; rotazione 90° ruota contenuto e quad insieme; frecce con TL selezionato spostano **solo** TL di +0.01 e Shift di +0.05 (letto dallo store); col lucchetto attivo frecce, `rotateActiveCorners` e `moveActiveCorners` non hanno alcun effetto e i pulsanti risultano disabilitati; il test pattern compare nella finestra `/output` col mapping deformato identico. Stato dell'app riportato ai valori iniziali dopo i test. Type-check pulito, console con il solo warning noto THREE.Clock.

## 2026-07-29 — README aggiornato con le feature recenti

Richiesta dell'utente: documentare nel `README.md` le funzionalità aggiunte nelle ultime sessioni.

- Contato il numero reale di shader prima di scriverlo (37 preesistenti + 30 `psy*` + 20 `morph*` = **87** file). Sostituiti i riferimenti obsoleti "oltre 35"/"37 shader".
- Sezione **"Cosa fa, in pratica"**: aggiunto il passo sui controlli globali.
- **"Effetti e palette colori"**: libreria descritta per famiglie (Halo, Liquid, Psy, Morph) con la spiegazione del `morphDepth`; aggiunti controlli globali e palette casuale 2–5 colori con schemi di armonia.
- **"Layer e maschere"**: aggiunti i riferimenti di mapping nascondibili; precisato che la sincronizzazione fra layer propaga anche i controlli globali.
- **"Progetti e preset"**: chiarito che i controlli globali *non* sono catturati da preset e clip, ed è una scelta voluta — evita che l'utente lo scambi per un bug.
- Roadmap: aggiunta una voce "Oltre" con motore particellare 3D e feedback buffer. Aggiornato lo stato in cima.

## 2026-07-29 — 20 effetti "Morph": source-driven con morphDepth come 3D Surface Morph Spirals

Richiesta dell'utente: altri 20 effetti sulla scia di `3DSurfaceMorphSpirals.glsl`, di cui apprezza il `morphDepth`.

**Cos'è il morph depth** (la caratteristica da replicare): lo shader legge la texture sorgente, ne ricava la luminanza e la usa come **mappa di quota** per deformare la geometria dell'effetto (`lum * morphDepth`). L'asset non fa solo da maschera: modella il pattern, che così sembra avvolgere il soggetto. Lo schema, già usato dai `liquid*.glsl`, è: leggi `source`, esci se `length(source.rgb) <= blackThreshold`, calcola `lum`, inserisci `lum * morphDepth` nella geometria, chiudi con `mix(source.rgb, fx + source.rgb * psyColor, 0.85)`.

**20 nuovi file `src/shaders/morph*.glsl`** (libreria da 71 a 91 effetti): Concentric Waves, Electric Contours (isoipse della luminanza), Hex Lattice, Ribbon Flow, Crystal Facets, Radial Shards, Liquid Dunes, Torus Field, Kaleido Depth, Spiral Galaxy, Voronoi Depth, Interference Grid (moiré sfasato dal rilievo), Chrome Folds, Tunnel Depth, Petal Bloom, Lightning Web, Fractal Depth, Aurora Depth, Molten Rings, Depth Scan (piano di scansione tipo lidar che attraversa la quota). Ognuno espone `speed`, `morphDepth`, `blackThreshold`, un uniform colore e 2-4 parametri propri, quindi eredita gratis slider, palette e controlli globali.

**Verifica**: compilati tutti e 91 i fragment shader in WebGL — 0 errori. Poiché sono source-driven, la verifica con la texture di fallback sarebbe inutile: ho renderizzato un provino di tutti e 20 **con l'asset reale** (`/default-stage.png`) tramite un renderer offscreen, misurando luminanza media e percentuale di pixel bruciati dentro la sagoma. `Morph Fractal Depth` risultava un verde piatto saturo (accumulo IFS senza limite): corretto con decadimento più rapido e `clamp`. Risultato finale: luma 19–64, bruciature ≤1.3%, nessuno spento. Type-check, build e console puliti.

## 2026-07-28 — 30 nuovi effetti psytrance/techno + controlli globali + palette casuale a N colori

Richiesta dell'utente: più effetti creativi ispirati ai software di visual mapping, palette casuali fino a 5 colori per *tutti* gli effetti, e più controlli di regolazione.

**30 nuovi shader** in `src/shaders/psy*.glsl` (la libreria passa da 41 a 71 voci), pensati per stage psytrance/techno: Strobe Grid, Tunnel Rush, Bass Rings, Fractal Mandala, DNA Helix, Laser Sweep, Hex Pulse, Plasma Storm, Sacred Geometry, Digital Rain, Warp Stars, Liquid Mercury, Trippy Spiral, Circuit Board, Kaleido Fractal, Neon Wireframe, Acid Melt, Pulse Bars, Vortex Fractal, Techno Scanlines, Eye, Infinite Zoom, Energy Web, Chrome Ripple, Alien Organism, Strobe Tunnel, Fractal Flower, Glitch Blocks, Aurora Veil, Mandel Slice. Nessuna modifica al parser: rispettano la convenzione ISF-like già in uso, quindi sono caricati da `import.meta.glob` come gli altri.

**Controlli globali per-layer** (`FxControls` in `layersStore`, uniform `uFx*` nel wrapper di `isfParser.ts`): velocità, rotazione, pan X/Y, kaleidoscopio, mirror X/Y, pixelate, luminosità, contrasto, saturazione, posterize, negativo. Applicati nel wrapper — `easyvj_fxUv` prima di `processColor` e `easyvj_fxColor` dopo — quindi valgono per **qualsiasi** shader, inclusi i 41 preesistenti, senza toccarne il codice. È la risposta scalabile a "più controlli": con 71 effetti, aggiungere uniform a ciascuno non lo sarebbe. UI in `FxControlsPanel.tsx` (tab Shader).
- Scelta: `fx` è proprietà del **layer** (come opacità/blend/lumaKey), non parte di `EffectSnapshot`. Così cambiando effetto o clip della playlist i trattamenti restano applicati invece di azzerarsi a ogni transizione. Viene però propagato ai layer sincronizzati (`withEffectOf`) perché passa da `editEffect`.
- Retrocompatibilità: i progetti salvati senza `fx` prendono i default da `createLayer` in `deserializeLayer` (lo spread non sovrascrive con `undefined`).

**Palette casuale a N colori**: `randomPaletteColors(count)` ora accetta il numero di stop (2..5) e sceglie tra 5 schemi di armonia (analoga, complementare, triadica, split-complementare, monocromatica) invece della sola deriva di tinta. Riempie comunque tutti i `PALETTE_STOPS` ripetendo l'ultimo colore, così alzare "Numero colori" non lascia buchi. `setPaletteColors(colors, count)` imposta anche il conteggio attivo. Pulsanti 2/3/4/5 sia nel pannello Palette sia nel pannello Shader — la palette è una gradient map, quindi ricolora ogni effetto.

**Verifica**: compilati tutti e 71 i fragment shader in un contesto WebGL reale — 0 errori GLSL. Misurata la luminanza media delle anteprime per scovare shader "morti": 8 erano troppo scuri o saturi (Warp Stars a 0.4/255, Tunnel Rush 1.2, Neon Wireframe 1.8, Kaleido Fractal 209.9) e sono stati corretti nelle formule e nei default; ora il range è 10–153. Provino visivo dei 30 controllato a schermo. Lint e `npm run build` puliti, nessun errore in console.

## 2026-07-28 — Limite di larghezza dei pannelli ridimensionabili + toggle overlay di mapping

Due richieste dell'utente: un pannello laterale trascinato al massimo finiva fuori dallo schermo, e la cornice viola del corner-pin impediva di valutare l'effetto applicato.

- **Trappola Radix ScrollArea** (emersa qui, vale per ogni pannello stretto): il `Viewport` avvolge i figli in un div con `display: table; min-width: 100%`, che **non si restringe** sotto la larghezza naturale del contenuto — il contenuto sfora e l'`overflow-hidden` dell'`<aside>` lo taglia invece di adattarlo. Si risolve con `[&>div>div]:block!` sullo ScrollArea (sintassi important di Tailwind v4 — il postfisso `!`, non il prefisso), più `min-w-0`/`truncate` sui controlli che possono sforare.
- **`src/hooks/use-resizable-width.ts`**: il massimo è ora limitato a due terzi del viewport (`window.innerWidth * 0.66`), così su finestre strette il pannello non può essere trascinato fuori dallo schermo.
- **Toggle overlay**: nuovo `overlaysVisible` + `toggleOverlays` in `uiStore`, pulsante occhio (Eye/EyeOff, ambra quando spento) nella toolbar flottante `ViewportZoomControls`, e `ControlPage` che condiziona il rendering di `MaskOverlay`/`CornerPinOverlay`. È puramente visivo e locale alla finestra Control: l'Output non ha mai disegnato quegli overlay, quindi la proiezione non è toccata.
- Verificato nel browser: a 280px tutto il contenuto sta dentro il pannello; il drag della maniglia allarga/restringe e persiste; il trascinamento estremo si ferma al limite senza uscire dallo schermo; l'occhio nasconde e ripristina cornice e maniglie. Type-check, lint e `npm run build` puliti.

## 2026-07-25 — Link live preview nel README

Richiesta dell'utente: aggiungere il link alla live preview su Vercel (https://easymap-studio-nine.vercel.app/control) nel `README.md`, subito sotto titolo e logo.

## 2026-07-25 — Fix `npm run build`: workbox precache limit

La build falliva perché `vite-plugin-pwa` (workbox) rifiuta di precachare asset sopra 2 MB di default, e `public/default-stage.png` (immagine di default al primo avvio, 3146×1312, 7.1 MB) superava il limite.

- **`vite.config.ts`**: aggiunto `workbox.maximumFileSizeToCacheInBytes: 10 * 1024 * 1024` per includere l'immagine nel precache (l'app è offline-first per uso live senza rete, quindi va precachata anche lei). L'utente ha scelto questa opzione invece di comprimere l'immagine.
- Verificato: `npm run build` completa con successo, precache 9 entries (~9996 KiB) inclusa l'immagine.

## 2026-07-25 — README: sezione "Funzionalità disponibili"

Richiesta dell'utente: elenco delle feature a disposizione dell'utente (layer/mask, palette, assets, output/live, playlist, progetti/preset), distinto dalla sezione tecnica "Funzionalità principali" già esistente.

- Nuova sezione in `README.md`, inserita tra "Cosa fa, in pratica" e "Funzionalità principali": 6 sottosezioni (Layer e maschere, Effetti e palette colori, Assets, Output e modalità Live, Playlist, Progetti/template/preset), scritte dal punto di vista di cosa può fare l'utente nell'UI pannello per pannello, non come changelog tecnico.
- Contenuto verificato contro il codice reale dei pannelli (LayersPanel, MovePanel, MaskPanel, EffectsPanel, PalettePanel, MediaUploader/BackgroundKeyPanel, OutputLauncher, PlaylistBar, ProjectsPanel/EffectPresetsPanel) per non descrivere funzioni inesistenti: **non esistono "template" pre-costruiti** oltre l'asset demo e i preset effetto, quindi la sezione parla di "preset" (look salvabili/riapplicabili), non di template.

## 2026-07-25 — Favicon dal logo

Richiesta dell'utente: usare `logo.png` (1024×1024, quadrato) come favicon invece del file `favicon.png` precedente. Rigenerato `public/favicon.png` ridimensionando il logo a 192×192 via `sips` (stesso path già referenziato in `index.html`/`vite.config.ts`, nessuna modifica di codice necessaria) — evita di servire il file originale da 1.2MB a ogni caricamento pagina solo per l'iconcina della tab. Verificato nel browser: `/favicon.png` risponde 200, 52KB, `image/png`.

## 2026-07-25 — Logo accanto al nome nella sidebar

`ControlPage.tsx`, `SidebarHeader`: aggiunta `<img src="/logo.png">` (24px, arrotondata) prima del testo "EASYMAP STUDIO". Cambiato il layout dell'header da `flex-col justify-center` a `flex-row items-center gap-2` per affiancare logo e testo sulla stessa riga entro l'altezza fissa `h-12`; aggiunto `truncate` al testo per sicurezza su sidebar molto stretta (min 240px). Verificato nel browser: logo e marchio allineati correttamente nell'header.

## 2026-07-25 — Favicon PNG + logo nel README

Richiesta dell'utente, che ha aggiunto `public/favicon.png` e `public/logo.png`.

- **`index.html`**: `<link rel="icon">` da `favicon.svg` a `favicon.png` (type `image/png`). `favicon.svg` lasciato sul disco (non richiesta la rimozione), ma non più referenziato.
- **`vite.config.ts`**: `includeAssets` della PWA aggiornato da `['favicon.svg']` a `['favicon.png']`, coerente col nuovo file effettivamente servito.
- **`README.md`**: aggiunta `![Logo EasyMap Studio](public/logo.png)` subito sotto il titolo, sopra la descrizione.
- Verificato nel browser: `<link rel="icon">` risolve a `/favicon.png`, fetch 200 con `content-type: image/png`. Type-check pulito.

## 2026-07-25 — Rinominato il progetto in "EasyMap Studio"

Richiesta esplicita dell'utente. Rinominati solo i punti di **branding user-facing**: `<title>` in `index.html`, manifest PWA (`name`/`short_name`, quest'ultimo accorciato a "EasyMap" per il limite pratico ~12 caratteri delle icone home screen), `name` in `package.json` (→ `easymap-studio`, slug npm-safe), il marchio nella sidebar di `ControlPage.tsx` ("EASYMAP" + "STUDIO" attenuato, stesso pattern grafico di prima), i titoli di README.md/CLAUDE.md/TODO.md/MEMORY.md (solo l'intestazione, non le voci storiche del changelog — restano fedeli a cosa era vero in quel momento), e i due commenti/log cosmetici in `defaultAsset.ts`.

**Deliberatamente NON rinominati** gli identificatori tecnici interni (nessun beneficio visibile, rischio di rompere dati esistenti): nome del database IndexedDB (`'easyvj'` in `persistence.ts` — rinominarlo avrebbe reso irraggiungibili gli autosave/progetti già salvati dall'app, comportamento distruttivo non richiesto), nome del canale `BroadcastChannel` (`'easyvj-sync'`), le chiavi `localStorage` (`easyvj-sidebar-width`, `easyvj-playlist-height`, `easyvj-default-stage-seen`), il nome della finestra in `window.open` (`'easyvj-output'`), il global di debug `window.__easyvj`, i prefissi delle funzioni GLSL nel wrapper (`easyvj_gradient`, `easyvj_maskRegion`), il tipo TS `EasyVjDB`, e il nome della cartella del progetto sul disco / config `.claude/launch.json` (`easyvj-dev`).

Verificato nel browser: titolo tab e marchio sidebar aggiornati a "EasyMap Studio" / "EASYMAP STUDIO"; type-check pulito.

## 2026-07-25 — Asset dimostrativo caricato di default al primo avvio

Richiesta: l'utente ha aggiunto `public/Default Stage.png` (7.4MB) e vuole che chi apre l'app per la prima volta lo trovi già caricato, per poter testare subito senza dover cercare un'immagine propria.

- **Rinominato** `public/Default Stage.png` → `public/default-stage.png` (niente spazi/maiuscole in un path servito da URL, evita rogne di encoding).
- **Nuovo `src/lib/mediaDetect.ts`**: estratta `isFullyOpaque()` da `MediaUploader.tsx` (era locale al componente) per riusarla anche nel loader del default.
- **Nuovo `src/lib/defaultAsset.ts`**: `loadDefaultStageIfFirstVisit()` — gate su `localStorage['easyvj-default-stage-seen']` (settato **subito**, prima del fetch, per non ritentare a ogni reload se il file fallisce o l'utente naviga via) così scatta una volta sola per browser, indipendentemente da quante volte la scena torna vuota in futuro (es. l'utente cancella il media caricato: il default non ricompare, non è quello il comportamento "prima apertura"). Fetch del PNG → blob → `Image` per le dimensioni, poi `setActiveMedia` + `setActiveLumaKey` (con lo stesso `isFullyOpaque` dell'upload manuale) + `requestFit()` sul layer attivo — stessa pipeline di un upload utente, incluso il blob per la persistenza. Ricontrolla `getActiveLayer()?.media` dopo gli await (stesso pattern di guardia race già usato nel restore autosave): se l'utente ha caricato qualcosa nel frattempo, non sovrascrive.
- **`persistence.ts` → `useAutosave`**: nel ramo "scena vuota, nessun autosave" (prima non faceva nulla) ora chiama `loadDefaultStageIfFirstVisit()`. Il ramo "autosave esiste" resta invariato (restore normale, ha priorità).
- **`MediaUploader.tsx`** aggiornato per importare `isFullyOpaque` da `mediaDetect.ts` invece di definirla localmente (nessuna duplicazione).
- **Verificato nel browser**: azzerati `localStorage` + IndexedDB `easyvj` (simulando un browser mai usato) → reload su `/control` → il Default Stage compare subito, fittato nel corner-pin, con lo shader di default sopra. Reload successivo (ora l'autosave esiste) → ripristina lo stesso layer dall'autosave, nessuna ricarica/duplicazione. Console pulita (solo il warning noto THREE.Clock), type-check pulito.

## 2026-07-25 — 10 shader "Liquid", colori per-effetto (uniform vec3), palette casuale

Tre richieste dell'utente: nuovi effetti sulla scia di "3D Surface Morph Spirals" (che gli piace), scelta dei colori per ogni effetto, e generatore casuale di palette accanto ai preset.

### 10 nuovi shader Liquid (file `liquid*.glsl`)
Liquid Morph Ribbons, Liquid Vortex Bloom, Liquid Metaball Spirals, Liquid Silk Waves, Liquid Twist Tunnel, Liquid Plasma Veins, Liquid Chrome Melt (con noise custom `lcm_*` incluso nel file, come da lezione metallic3dFluid), Liquid Orbit Petals, Liquid Fractal Flow, Liquid Aurora Spirals (2 uniform colore). **DNA condiviso col capostipite**: source-driven con gate `length(source.rgb) > blackThreshold`, campo fluido (spirale/onde/metaball/fold) deformato dalla luminanza via `morphDepth`, `psyColor = 0.5+0.5*cos(...)` moltiplicato per l'uniform colore, `mix(source.rgb, fx + source.rgb*psyColor, 0.85)` che preserva l'alpha. Tutti con `uniform vec3 ...; // @default r,g,b` così la nuova UI colori si applica anche a loro.

### Colori per-effetto (uniform vec3 finalmente editabili — chiude il TODO "color picker per vec3")
- **`layersStore`**: nuovo `Layer.colorParams: Record<shaderName, Record<uniform, RGB>>` (default {} = si usano i @default dello shader); `EffectSnapshot.colors` (quindi anche `LayerTransition` per il crossfade); azione `setActiveColorParam` via editEffect (si propaga con le spunte sync); `withEffectOf`/`duplicateLayer`/`applyEffectSnapshot` aggiornati.
- **`effectsStore.defaultColorsFor(shader)`**; **`ShaderPlane`**: `passEffect` espone `colors` (main da colorParams, ghost dalla transition) e `useFrame` setta i Vector3; **`effectThumbnail`** applica i colori e li include nella chiave cache.
- **UI**: sezione "Colori effetto" nel pannello Shader (swatch `input type=color` per ogni vec3) e nell'editor clip della playlist; `PlaylistClip.colors` (cloneClip normalizza i clip salvati senza campo); "Cattura dal layer" e cambio shader nel clip gestiscono i colori; `EffectPreset.colors?` (opzionale, retrocompatibile) in snapshot/apply.
- Helper `rgbToHex`/`hexToRgb` spostati in `paletteStore` (prima duplicati in PalettePanel) e riusati ovunque.

### Palette casuale
- **`paletteStore.randomPaletteColors()`**: 5 colori HSL armonici da scuro (l≈0.07) ad acceso (l≈0.67), hue base random + deriva ±100°, saturazione 0.75–1 — stessa struttura dei preset (mappati per luminanza). Helper `hslToRgb` interno.
- Nuova azione `layersStore.setPaletteColors(colors)` (via editEffect): sostituisce i colori, marca Custom e **attiva** la palette. Bottone "Palette casuale" (icona Dices) nel PalettePanel sotto la griglia preset.

### Verifica browser
I 5 liquid più rischiosi (noise custom, loop+break, doppio vec3) aggiunti come clip → thumbnail renderizzate e distinte (= compilano); Liquid Vortex Bloom selezionato live sul canvas con sezione "Colori effetto" e swatch azzurro del default; "Palette casuale" → palette verde generata, attivata e applicata live all'effetto. Console senza errori, type-check pulito. (Il click sul color picker nativo non è automatizzabile — è un dialog OS — ma la catena setActiveColorParam→uniform è identica a quella collaudata degli slider.)

## 2026-07-25 — Barra playlist: scroll orizzontale, thumbnail degli effetti, altezza ridimensionabile

Tre migliorie richieste dall'utente dopo il test (con troppi clip la timeline sbordava senza modo di raggiungerli):

- **Scroll orizzontale della timeline**: la rotellina verticale del mouse ora scrolla in orizzontale (listener `wheel` non-passive sul container — i delta orizzontali nativi di trackpad/shift+rotellina passano invariati) + scrollbar sottile sempre visibile (classe `.timeline-scroll` in index.css: `scrollbar-width: thin` + `::-webkit-scrollbar` 6px). Aggiunto anche auto-scroll animato in fondo alla timeline quando si aggiunge un clip dal "+" (callback `onAdded` → `scrollTo` post-render), così il nuovo clip è subito visibile.
- **Thumbnail dell'effetto in ogni card**, sotto il nome: nuovo `src/engine/effectThumbnail.ts` — renderer WebGL offscreen condiviso (128×72, `preserveDrawingBuffer` per `toDataURL`) che disegna UN frame statico dello shader a `uTime=2.5` (istante rappresentativo, il t=0 è spesso vuoto) con params/size/palette del clip, texture fallback e maschere spente. Cache per look (chiave JSON, max 200 voci): il costo (compile+render) si paga una volta per look. `buildUniforms` esportato da ShaderPlane per riuso. Nel `ClipBlock` la thumbnail è un `<img>` flex-1 object-cover rigenerato via useMemo quando cambia il look del clip.
- **Barra ridimensionabile in altezza**: maniglia sul bordo superiore (cursor-ns-resize), min 96px (altezza precedente) max 192px (il doppio), persistita in localStorage (`easyvj-playlist-height`). Con la barra più alta le thumbnail guadagnano spazio (sono il flex-1 della card).
- Verificato nel browser: 8 clip → overflow con scrollbar, auto-scroll all'aggiunta, thumbnail corrette e distinte per ogni effetto (Plasma/Neon Rings/Hypno/Acid/Julia/Star Nest/Voronoi/Warp Grid), console pulita, type-check pulito. La playlist salvata è sopravvissuta al reload (conferma della persistenza nel progetto).
- **Bug fix resize altezza (segnalato dall'utente)**: alzando la barra, questa cresceva verso il basso fuori dallo schermo invece di alzare il bordo superiore. Causa: `SidebarProvider` ha `min-h-svh` (solo min-height) e `SidebarInset` è `flex-1 flex-col` senza tetto → aumentando l'altezza della barra la colonna si allungava oltre il viewport (contenuto tagliato dall'overflow hidden globale) invece di comprimere il canvas. Fix: `SidebarInset` in ControlPage ora ha **`h-svh overflow-hidden`** — altezza bloccata al viewport, il `<main>` (`flex-1 min-h-0`) si comprime e la barra si espande visivamente verso l'alto. Verificato col valore massimo (192px) salvato in localStorage.

## 2026-07-25 — Playlist di effetti con transizioni (barra timeline in basso)

Feature richiesta dall'utente: sequenza di effetti riproducibile con play/pause, durate modificabili e transizione smooth/secca. Scelte confermate dall'utente: la playlist agisce sul **layer attivo + layer spuntati** in syncTargetIds (riusa il meccanismo di sincronizzazione effetto esistente); persistita **dentro il progetto** (autosave + salvataggi con nome, i progetti vecchi caricano con playlist vuota — campo opzionale, nessun bump di versione DB); extra scelti: **loop on/off** e **durata del crossfade regolabile** (no shuffle/prev/next).

- **Nuovo `src/store/playlistStore.ts`**: `PlaylistClip` = { id, name, shaderName, params, size, palette, duration } (come i preset: niente media/posizione, riapplicabile ovunque). Stato: clips, transitionMode ('cut'|'smooth', default smooth), transitionDuration (0.1–10s, default 1), loop (default on) + stato di riproduzione non persistito (playing, currentIndex, clipProgress, editingClipId). `playlistSnapshot()` esporta il sottoinsieme persistibile.
- **`layersStore`**: nuovi tipi `EffectSnapshot` (shader+params+size+palette) e `LayerTransition` (EffectSnapshot + progress 0..1); nuovo campo **`Layer.transition`** (transiente: viaggia nel sync verso l'Output ma NON viene persistito). Azioni: `applyEffectSnapshot(effect, smooth)` — applica l'effetto ad attivo+spuntati; con smooth salva l'effetto precedente in `transition` — e `setTransitionProgress(p)` che anima/chiude tutti i crossfade. **Scelta architetturale chiave**: lo stato del crossfade vive sul Layer stesso, così `sync.ts` lo trasmette gratis e l'Output renderizza la dissolvenza identica senza canali dedicati.
- **`ShaderPlane.tsx` ristrutturato**: `LayerMesh` ora possiede le risorse condivise (geometria warpata, controller media, texture stencil) e delega il rendering a 1–2 **`EffectPass`** ('main' = effetto corrente, 'ghost' = effetto uscente durante il crossfade, montato solo se `layer.transition`). Il ghost renderizza sotto (renderOrder index*2) col vecchio shader a opacità `opacity*(1-progress)`, il main sopra a `opacity*progress`. Il tick del media (video/gif) avviene solo nel passaggio main per non avanzare i frame due volte. renderOrder globale passato da `index` a `index*2/index*2+1`.
- **`persistence.ts`**: `StoredLayer` esclude `transition`; `StoredProject.playlist?: PlaylistData` incluso in snapshot/applyProject; l'autosave ora osserva anche il playlistStore ma salva solo quando cambia il sottoinsieme persistibile (confronto JSON) — playing/clipProgress cambiano a 60fps e non devono azzerare di continuo il debounce.
- **Nuovo `src/components/Playlist/PlaylistBar.tsx`** (montato in fondo a ControlPage, h-24): cluster trasporto (play/pause; loop evidenziato; toggle Smooth/Secca con input secondi visibile solo in smooth) + timeline (clip = blocchi larghi `durata*18px`, nome+shader+durata, playhead di avanzamento sul clip corrente, **resize durata trascinando il bordo destro**, riordino drag&drop come LayersPanel) + pulsante "+" (popover con preset salvati e libreria effetti). **Click su un clip** = popover editor (nome, durata, select effetto — cambio shader resetta i params ai default —, slider size+parametri, "Cattura dal layer" che copia il look corrente del layer attivo nel clip, duplica, elimina); aprire l'editor o modificare applica subito il clip al layer come anteprima.
- **Motore di riproduzione** (`usePlaylistPlayback`, solo finestra Control): rAF loop; a fine clip applica il successivo (secco o crossfade animando `setTransitionProgress`); fine sequenza senza loop = pausa sull'ultimo; il cleanup chiude i crossfade a metà. In modalità Live vale la semantica esistente: il preview anima, l'Output resta congelato fino a "Esegui in output".
- Installato il componente shadcn **`popover`** (solo file locale, nessuna dipendenza nuova → niente re-optimization Vite).
- **Verificato nel browser**: barra renderizzata; aggiunti 3 clip (Plasma Bloom, Neon Rings, Hypno Tunnel); play → avanzamento col playhead, cambio effetto sul canvas, loop a fine sequenza; editor col click (slider parametri, anteprima immediata); finestra `/output` specchia la sequenza in riproduzione. Console pulita (solo il warning noto THREE.Clock). Type-check pulito.

## 2026-07-25 — Zoom/pan della vista di anteprima (Control), indipendente dall'Output

Bug segnalato: quando l'asset viene ingrandito/spostato molto (zoom layer alto in MOVE), le 4 maniglie viola del corner-pin escono dal canvas nero e vengono clippate da `overflow-hidden` sul `<main>` → diventano irraggiungibili, impossibile correggere il mapping.

Soluzione: uno **zoom/pan di vista** puramente visivo, locale alla sola finestra Control, che scala il frustum della camera ortografica di R3F (non tocca mai `corners`/`transform` nello store, quindi l'Output resta invariato — la finestra Output non legge mai questo stato).

- **`uiStore.ts`**: nuovo `view: { zoom, panX, panY }` (default 1/0/0, range zoom 0.2–4) + azioni `setViewZoom/zoomViewBy/panView/resetView`. Store separato da `layersStore` (l'unico broadcast via `sync.ts`), e comunque Control e Output sono finestre/realm JS distinti quindi anche senza guardie `uiStore` non attraverserebbe mai il `BroadcastChannel`.
- **`StageCanvas.tsx`**: nuova prop `controlView` (come il pattern già esistente di `autoFit`). `ResponsiveCamera` accetta `view` opzionale e allarga/restringe il frustum (`halfWidth = aspect/zoom + pan`, ecc.) invece del fisso `-aspect..aspect / -1..1`. Passata `controlView` solo da `ControlPage`; `OutputPage` non la passa mai → camera Output sempre al frustum originale.
- **`CornerPinOverlay.tsx` e `MaskOverlay.tsx`**: le funzioni `screenToWorld`/`worldToScreen` (e in MaskOverlay anche `scale` px/unità) ora derivano il frustum dallo stesso `view` (helper `frustum()` duplicato nei due file, stessa formula della camera) — così le maniglie/forme restano perfettamente allineate al contenuto renderizzato a qualsiasi zoom di vista. Il drag del poligono (pan dell'intera proiezione) e il drag delle singole maniglie sono stati corretti per convertire i delta schermo tramite il frustum corrente invece di `2*aspect`/`2` fissi.
- **Nuovo `src/components/layout/ViewportZoomControls.tsx`**: hook `useViewportPanZoom(containerRef)` (rotellina = zoom centrato sulla vista corrente; Spazio+drag o click centrale = pan, con guardia per non intercettare Spazio quando si digita in un input) + componente `ViewportZoomControls` (mini toolbar flottante in basso a destra: −, percentuale/reset, +, "adatta"). Montati nel `<main>` di `ControlPage` insieme a `StageCanvas controlView` e all'overlay attivo.
- Scelte utente (chiesto esplicitamente prima di implementare): trigger sia rotellina che pulsanti; pan incluso (Spazio+drag / click centrale), non solo zoom centrato, per coprire anche il caso di asset spostato molto lontano dal centro oltre che ingrandito.
- **Verificato nel browser**: portato lo zoom del layer (MOVE) a ~2x → le maniglie sparivano oltre i bordi del canvas nero; con lo zoom vista ridotto al 46% le 4 maniglie sono tornate visibili e cliccabili, il riquadro viola combacia esattamente con i bordi dell'immagine renderizzata. Type-check pulito.

## 2026-07-24 — Fix sincronizzazione effetto: guidata dalle spunte (rimosso il toggle-gate)

Bug segnalato: spuntando i layer nel riquadro e cambiando effetto, l'effetto cambiava solo sul layer sorgente. Causa: la propagazione era gated dal booleano `syncEffect` (il toggle "Applica a tutti"); con il toggle spento le spunte non facevano nulla, ma il riquadro (reso sempre visibile) faceva pensare che bastasse spuntare.

Redesign: **la selezione a spunta è ora l'unico controllo**. Rimosso `syncEffect` + `setSyncEffect`. `editEffect` propaga sempre l'effetto completo ai layer in `syncTargetIds` (nessun gate). `toggleSyncTarget`: spuntando un layer gli applica **subito** l'effetto del layer attivo e lo tiene sincronizzato ai successivi edit. Nuovo `setSyncAll(on)`: on = spunta tutti (e li allinea), off = azzera (layer indipendenti). Il bottone "Applica a tutti i layer" ⇄ "Rendi layer indipendenti" ora fa select-all/clear (label da `allSynced`).

Default cambiato: `syncTargetIds` parte **vuoto** (layer indipendenti); nuovi layer e duplicati NON entrano più in automatico nella selezione; `setScene` (load/sync) riparte con selezione vuota. Motivo: con la propagazione sempre attiva, un default "tutti selezionati" avrebbe sovrascritto a sorpresa gli effetti degli altri layer. La selezione (`syncTargetIds`) persiste comunque al cambio effetto. Semantica direzionale: `syncTargetIds` = layer che ricevono l'effetto del layer ATTIVO (sorgente = attivo, escluso e mostrato disabilitato). Verificato nel browser: spuntato Layer 2, cambiato Layer 1 → Plasma Bloom, Layer 2 diventa Plasma Bloom.

## 2026-07-24 — Link effetto persistente (con target) + modalità Live (output on-demand)

Due meccanismi richiesti dall'utente. Type-check pulito; verificato nel browser con finestra Output.

### Link effetto (da one-shot a interruttore persistente + selezione target)
- **`layersStore`**: rimosso `applyEffectToAll` (one-shot). Aggiunti stato `syncEffect: boolean` + `syncTargetIds: string[]` e azioni `setSyncEffect(on)` / `toggleSyncTarget(id)`. Nuovo helper interno **`editEffect(patch)`**: applica la patch al layer attivo e, se `syncEffect`, propaga l'**effetto completo** (shader + params + size + palette, via `withEffectOf`) ai layer target. Tutti i setter di EFFETTO (setActiveShader/Size/Param + i 5 setter palette) passano ora da `editEffect`; media/lumaKey/corners/transform/maschere restano per-layer (usano ancora `patchActive`).
- Scelte utente: propaga **solo l'effetto completo** (non maschere/posizione/contenuto/opacità/blend); **nuovi layer inclusi di default** (addLayer/duplicateLayer aggiungono l'id a `syncTargetIds`, e col link on il nuovo layer nasce già con l'effetto corrente); removeLayer/setScene mantengono `syncTargetIds` coerente. Attivando il link, i target vengono subito allineati; spuntando un target mentre è on, riceve subito l'effetto.
- **`EffectsPanel`**: il bottone diventa toggle ("Applica a tutti i layer" ⇄ "Effetto sincronizzato"); sotto, lista checkbox dei layer (il layer attivo = "(sorgente)", disabilitato) per includere/escludere i target.
  - *Aggiornamento*: il riquadro di selezione dei target è ora **sempre visibile** (anche a link spento — header "(link spento)", righe attenuate ma spuntabili) per pre-selezionare i layer; la selezione persiste al cambio effetto (`syncTargetIds` è stato indipendente). Prima era mostrato solo con il link attivo.

### Modalità Live (output on-demand)
- Nuovo **`src/store/outputStore.ts`**: `{ live, pushId, dirty, setLive, pushToOutput, markDirty, clearDirty }`.
- **`sync.ts` riscritto**: il publisher tiene `lastPayload` (ultimo stato inviato). Se `live` è on, gli edit dei layer NON pubblicano (solo `markDirty`); l'Output resta congelato. `pushToOutput` (pushId++) e l'uscita da Live (`wasLive && !live`) chiamano `publishNow()`. Gli "hello" delle finestre Output appena aperte ricevono `lastPayload` (in Live = lo stato committato, non l'in-progress). Il preview dell'editor mostra sempre il live.
- **`TopToolbar`**: cluster a destra con toggle **LIVE** (rosso quando attivo) e bottone **"Esegui in output"** (visibile solo in Live, disabilitato se non ci sono modifiche in sospeso, con pallino ambra quando `dirty`).
- Scelta utente: uscendo da Live l'Output si **allinea subito** allo stato corrente e riprende il sync in tempo reale.

### Verifica browser
Link: attivando "Applica a tutti" con Layer 3 = Neon Rings, il Layer 1 riceve Neon Rings; toggle persiste cambiando layer attivo; lista target con sorgente disabilitata. Live: nascondendo un layer nel Control l'Output resta fermo (dirty acceso), "Esegui in output" lo aggiorna, disattivando Live si allinea subito (schermo nero = stato corrente).

## 2026-07-24 — Multi-layer (Fase B+C): maschere, media dinamici, "nessun effetto", sync effetto

Completate Fase B (maschere per-layer) e Fase C (video/gif) + due extra richiesti dall'utente: opzione "Nessun effetto" e "Applica effetto a tutti i layer". Type-check pulito; verificato nel browser (porta 5188).

### Maschere per-layer (Fase B)
- **Modello**: `Layer.masks: Mask[]` (unione) + `Layer.maskImage: MediaAsset | null` (stencil). `Mask` = { type rectangle/ellipse, cx/cy, hx/hy, rotation, feather 0..1, invert }, definita nello **spazio dei corner** del layer.
- **Scelta chiave**: maschere in spazio-corner invece che UV → il vertex shader passa `vPos = position.xy` (posizione base pre-transform) come varying; il fragment confronta lì. Così le maschere seguono warp corner-pin e zoom/pan del layer, e l'overlay riusa la stessa matematica world↔screen del corner-pin (niente inverse-bilinear).
- **`isfParser.ts`**: uniform `uMaskCount/Center/Half/Rot/Feather/Type/Invert[8]` + `uMaskTex/uMaskTexOn`; funzione `easyvj_maskRegion()` (rettangolo con smoothstep sul bordo, ellisse per raggio normalizzato, feather = frazione della semi-dimensione minore, invert per forma, unione via max). Stencil PNG: `luminanza * alpha` sulla vUv. `outA *= easyvj_maskRegion()`.
- **`layersStore.ts`**: `activeMaskId` + azioni addMask/removeMask/updateMask/selectMask/setMaskImage; `defaultMask` centrata sul bbox dei corner.
- **UI**: nuovo pannello `MaskPanel` (aggiungi rett/ellisse, lista select/elimina, sfumatura + rotazione + invert, upload PNG stencil) e `MaskOverlay` (SVG sul canvas: forme trascinabili + handle di resize; scala pixel uniforme = zoom·height/2). Voce toolbar "Mask" (icona `Scissors`); l'overlay maschera sostituisce il corner-pin overlay solo quando il pannello Mask è attivo.

### Media dinamici (Fase C)
- **`MediaAsset.type: 'image' | 'video' | 'gif'`**. Nuovo `src/engine/mediaTexture.ts` con `createMediaTexture()` → controller `{ getTexture, tick(elapsed), dispose }`: immagine (TextureLoader), **video** (`THREE.VideoTexture`, loop+muted+playsInline, `needsUpdate` nel tick), **GIF** (`gifuct-js` → frame decompressi renderizzati su canvas con gestione disposalType 2 → `THREE.CanvasTexture`, avanzamento frame nel tick basato sui delay).
- **`ShaderPlane.tsx`**: usa il controller (ricreato al cambio media), chiama `tick` ogni frame. `FALLBACK_TEXTURE` spostata in mediaTexture.
- **`MediaUploader`**: accetta png/webp/jpeg/gif/mp4/webm/ogg; `detectType` da MIME; per video legge le dimensioni da `loadedmetadata`. Il luma-key auto resta solo per immagini statiche.
- Dipendenza aggiunta: **`gifuct-js`** (porta i suoi tipi). NB: nuovo import → Vite re-optimization → riavviare dev server (trappola R3F nota).

### Extra
- **"Nessun effetto"**: shader passthrough sintetico (`NONE_SHADER_NAME`) in cima alla libreria in `effectsStore.ts` (emette il contenuto grezzo, alpha governato dalla maschera). `DEFAULT_SHADER_NAME` resta il primo effetto reale.
- **"Applica a tutti i layer"**: azione `applyEffectToAll()` copia shader+params+size+palette del layer attivo su tutti; bottone in `EffectsPanel` (visibile con >1 layer).

### Persistenza / sync
- `persistence.ts`: `StoredMedia` ora ha `type`; serializza/deserializza anche `maskImage` (helper `serializeMedia/deserializeMedia`). `masks` sono dati puri già inclusi.
- `sync.ts`: `stripBlobs` toglie i blob anche da `maskImage`.

### Verifica browser
GIF (test pattern ffmpeg) e video mp4 renderizzati e animati con "Nessun effetto"; maschera ellisse con feather ritaglia il layer (invert e resize handle ok); "Applica a tutti" e toggle visibilità ok; nessun errore console.

## 2026-07-24 — Multi-layer (Fase A): scene = pila di layer indipendenti

Refactor architetturale grosso: lo stato "piatto" (un media, uno shader, una posizione, una palette) diventa una **scena = array ordinato di Layer**, ognuno unità completa e autonoma. Fedele al modello Resolume/MadMapper concordato con l'utente (vedi TODO Fase 2). Fase A = scaffold multi-layer + mixing; maschere (Fase B) e media dinamici gif/video (Fase C) restano da fare.

- **Nuovo `src/store/layersStore.ts`** = sorgente di verità unica. `Layer` = { id, name, visible, opacity, blendMode, media, lumaKey, shaderName, size, params (per-shader), palette, corners, transform }. Azioni per struttura (add/remove/duplicate/reorder/rename/select, setLayerVisible/Opacity/BlendMode) e per il layer attivo (setActive{Media,Shader,Size,Param,Corner(s),Transform,LumaKey} + palette). Helper `patchActive`. `setScene()` per persistence/sync. Sempre ≥1 layer.
- **`projectStore.ts` svuotato dello store**: resta solo modulo di tipi/helper geometrici (MediaAsset, Corner(s), Transform, computeContainCorners, DEFAULT_CORNERS/TRANSFORM). Motivo: media/corner/transform/lumaKey vivono ora nel layer.
- **`effectsStore.ts` ridotto** alla sola libreria shader globale (`shaders`) + costanti (DEFAULT_SIZE, DEFAULT_SHADER_NAME, defaultParamsFor). Shader attivo/size/params sono per-layer.
- **`paletteStore.ts` de-storizzato**: da store Zustand a modulo di costanti + tipo `Palette` + `createDefaultPalette()`/`clonePresetColors` esportati. La palette è per-layer.
- **`isfParser.ts`**: aggiunto uniform `uOpacity`; output ora **premoltiplicato** (`vec4(rgb*a, a)`). Necessario perché il compositing multi-layer usa `CustomBlending`: così opacità e blend mode (add/screen/multiply) si comportano correttamente e le zone mascherate (alpha 0) non inquinano i layer sotto.
- **`ShaderPlane.tsx` riscritto**: `ShaderPlane` mappa i layer → N `LayerMesh` impilate con `renderOrder = index` (0 = sfondo). Ogni mesh: geometria warpata dai suoi corner, texture dal suo media, uniform dal suo shader/palette letti live in useFrame via `getState`. `depthTest/Write=false` + `CustomBlending` (fattori per blend mode, equation Add). Key del materiale = `shaderName|blendMode` per ricompilare al cambio.
- **`AutoFit.tsx`**: adatta i corner del **layer attivo** (non più globali).
- **Pannelli agganciati al layer attivo**: EffectsPanel, PalettePanel, MovePanel, PositioningPanel, BackgroundKeyPanel, MediaUploader, CornerPinOverlay (guardie per corners/transform undefined).
- **Nuovo `src/components/Layers/LayersPanel.tsx`**: lista riordinabile via drag&drop (mostrata top-first = primo piano in cima), toggle occhio, duplica, elimina (disabilitato se resta 1 layer), rinomina, slider opacità, select blend mode. Nuova sezione toolbar "Layers" (icona lucide `Layers`), pannello di default.
- **`sync.ts`**: broadcast di `{ layers (blob strippati), activeLayerId }` → Output via `setScene`.
- **`persistence.ts` DB v3**: StoredProject ora ha `layers: StoredLayer[]` + `activeLayerId` (media serializzato come blob, url rigenerato al load). Upgrade v<3 svuota lo store `projects` (formato incompatibile). Effect preset = look del layer attivo (shader+params+size+palette), applicato al layer attivo. Autosave/restore basato su `isSceneEmpty()` (1 layer senza media).
- **`debug.ts`, `uiStore.ts` (+ tipo Panel 'layers'), `TopToolbar`, `ControlPage`** aggiornati.
- **Verificato nel browser** (porta 5188): type-check pulito; 2 layer con shader diversi (Plasma Bloom + 3D Surface Morph Spirals) e blend Add compositano correttamente; parametri per-layer indipendenti; finestra Output specchia i layer via BroadcastChannel.

## 2026-07-24 — Sidebar shadcn (Provider/Sidebar/Inset) + resize + collapse nativo

- **Installato il componente shadcn `sidebar`** (CLI: `add sidebar`, coerente con lo stile `radix-nova` già in `components.json`): porta `sidebar.tsx`, `use-mobile.ts`, `sheet.tsx`, `skeleton.tsx`.
- **Scoperta chiave sull'architettura shadcn sidebar**: nelle modalità collassabili reali (`offcanvas`/`icon`, il default), il componente usa `position: fixed inset-y-0` per il contenitore visivo — assume che la Sidebar occupi l'intera altezza del viewport, senza nulla sopra. Il nostro TopToolbar a piena larghezza sopra la riga sidebar+canvas andava quindi in conflitto (la sidebar fixed si sarebbe sovrapposta al toolbar).
- **Prima iterazione** (poi superata): usato `collapsible="none"` per evitare il conflitto, mantenendo TopToolbar sopra — ma l'utente ha chiesto esplicitamente anche il **pulsante di collapse nativo** (`SidebarTrigger`), che con `collapsible="none"` è inerte.
- **Architettura finale**: `SidebarProvider` avvolge l'intera pagina (non più annidato sotto TopToolbar). `Sidebar` (default `collapsible="offcanvas"`) è a tutta altezza a sinistra, con `SidebarHeader` che ora contiene il brand "EASYVJ" (spostato lì dal TopToolbar). `TopToolbar` (nav Move/Shader/Palette/Assets/Output + settings) si è spostato **dentro `SidebarInset`** insieme a `SidebarTrigger` — pattern standard delle dashboard shadcn (sidebar full-height + header locale nel content pane).
- **Resizable**: nessun supporto nativo shadcn per il resize (confermato via fetch della doc ufficiale). Creato `src/hooks/use-resizable-width.ts` (drag via Pointer Events su `window`, clamp min 240/max 520, persistito in localStorage) + `src/components/layout/SidebarResizeHandle.tsx` (striscia 8px sul bordo destro, si nasconde quando `useSidebar().state !== 'expanded'`). La larghezza pilota `--sidebar-width` passato come CSS var inline a `SidebarProvider`.
- **Bug fix importante — flex stretch rotto da `h-full`**: il wrapper `<div className="relative flex h-full shrink-0">` attorno a Sidebar+handle aveva altezza 0. Causa: `SidebarProvider` ha `min-h-svh` (min-height), non `height` esplicito; per lo spec CSS, `height:100%` su un figlio richiede che il genitore abbia un'altezza "specificata" in modo esplicito — `min-height` non conta, quindi `h-full` si risolve come se il genitore avesse altezza indefinita. Il flex stretch di default (`align-items:stretch`) invece funziona SOLO se la cross-size del figlio calcola `auto` — impostare `h-full` (che calcola a `100%`, non `auto`) disattiva lo stretch automatico. **Fix: rimosso `h-full`**, lasciando che lo stretch flex di default (nessuna classe di altezza) faccia il suo lavoro.
- **Bug fix minore — persistenza stale su drag rapidissimi**: `onUp` scriveva su localStorage leggendo un `ref` sincronizzato via `useEffect` (che flush in modo asincrono); su drag simulati molto rapidi (pointerdown+move+up nello stesso tick) il valore letto poteva essere quello di un update precedente. Fix: tracciare il valore più recente in una variabile locale sincrona dentro `onMove`, letta direttamente da `onUp` — indipendente dai tempi di render/effect di React.
- Verificato: collapse/espandi funziona, drag-resize aggiorna live style E localStorage in sync, persistenza sopravvive al reload, nessun errore console su /control e /output.

## 2026-07-23 — Preset degli effetti (salva/carica look)

- **Cosa**: salvare il "look" corrente come preset riusabile. Un preset cattura shaderName + parametri di quello shader + size globale + palette (enabled/colors/count/amount/activePreset). NON include media/posizionamento, così è riapplicabile su qualsiasi asset.
- **Persistence**: nuovo object store `effectPresets` in IndexedDB. **DB portato a versione 2** con upgrade incrementale (`if oldVersion < 1` crea projects, `if oldVersion < 2` crea effectPresets) → i DB esistenti degli utenti non perdono i progetti. Funzioni: `saveEffectPreset`, `loadEffectPreset`, `deleteEffectPreset`, `listEffectPresets`, + `applyEffectPreset`/`effectPresetSnapshot`.
- **UI `EffectPresetsPanel`**: in fondo al pannello Shader (sotto gli slider). Input nome + salva, lista preset con nome + shader di provenienza + carica/elimina.
- Verificato end-to-end: salvato "Mandala Fuoco" (Halo Mandala, size 1.8, petals 16, palette Fire), cambiato tutto, ricaricato → ripristino esatto; preset sopravvive al reload.

## 2026-07-23 — Sistema palette colori (gradient map globale)

Feature richiesta: poter scegliere/creare la palette colori per ogni shader, con preset fluorescenti caldi.

- **Approccio**: gradient map globale nel wrapper. Dopo `processColor`, si calcola la luminanza dell'effetto e la si mappa sulla palette scelta (`easyvj_gradient`), poi `mix` con l'originale per l'intensità. Universale: funziona su OGNI shader (generativi, source-driven, metallic, spirali) preservando la struttura ma cambiando i colori. Uniforms nel wrapper: `uPalette[5]`, `uPaletteCount`, `uPaletteAmount`, `uPaletteOn` (gradient con loop a indice costante per compatibilità WebGL1).
- **`paletteStore`**: enabled, colors[5] (RGB 0..1), count (2..5), amount (0..1), activePreset. 7 preset fluorescenti caldi: Neon Red, Jungle Green, Neon Blue, Dark Violet, Earth, Jungle, Fire (ognuno da scuro → acceso). `applyPreset` attiva anche la palette. `setColor` marca "Custom".
- **ShaderPlane**: uniforms palette inizializzati (array di 5 `THREE.Vector3`) e aggiornati ogni frame da paletteStore.
- **UI `PalettePanel`** (nuova tab toolbar "Palette", icona lucide): toggle on/off, anteprima gradiente CSS, griglia preset con swatch, 5 color picker nativi (`input type=color`) per creare palette al volo, slider "Numero colori" e "Intensità".
- Incluso in sync (BroadcastChannel → Output), persistence (snapshot/apply + autosave subscribe a paletteStore). Debug: esposti anche usePaletteStore e useUiStore in `window.__easyvj`.
- Verificato: Plasma → verde (Jungle Green), Halo Twin Vortex → viola (Dark Violet), sempre ritagliato sul soggetto. Nessun errore.
- **Nota UX**: la palette è globale (vale per lo shader attivo e tutti). Se in futuro serve una palette diversa memorizzata per-shader, va esteso il paletteStore.

## 2026-07-23 — Supporto uniform vec3 + fix 3D Surface Morph Spirals

- **3D Surface Morph Spirals** compilava ma era invisibile: ha un `uniform vec3 spiralColor` che il parser ISF (solo `float`) ignorava, quindi Three.js lo lasciava a `(0,0,0)` e `psyColor *= spiralColor` azzerava l'effetto.
- **Fix generale nel parser (`isfParser`)**: aggiunto `VEC3_RE` per gli uniform `vec3 nome; // @default r,g,b` → nuovo campo `ParsedShader.colorControls`. In `ShaderPlane` questi uniform vengono inizializzati con `new THREE.Vector3(...default)`. Così questo e ogni futuro shader MAPSHROOM con uniform colore renderizzano col loro default. Verificato: le due spirali psichedeliche ora si vedono, ritagliate sul soggetto.
- **Nota**: manca ancora una UI per cambiare i colori (color picker); per ora si usa il @default. (in TODO).

## 2026-07-23 — 10 varianti Halo Swirl + fix metallic3dFluid

### Fix metallic3dFluid.glsl
- Non compilava (schermo nero) perché usava `node_noise()` e `node_rand()`, funzioni fornite dal runtime MAPSHROOM/ISF ma non presenti nel nostro wrapper. Aggiunte le due funzioni (hash + value noise) direttamente nel file. Ora "Metallic 3D Fluid Shadows" renderizza correttamente.
- **Nota generale**: gli shader importati dall'app MAPSHROOM possono usare helper del loro runtime (`node_noise`, `node_rand`, ecc.) che qui vanno inclusi nel file .glsl.

### 10 varianti in stile Symmetrical Halo Swirl
- L'utente ne aveva 2 (`symmetricalHaloSwirl.glsl` + `symmetricalHaloSwirl-2.glsl`) e ha curato la lista rimuovendo alcuni dei generativi.
- Aggiunti 10 shader nello stesso stile (file `halo*.glsl`): Halo Radial Kaleido, Halo Mirror Bloom, Halo Spiral Drift, Halo Twin Vortex, Halo Petal Kaleido, Halo Liquid Symmetry, Halo Concentric Pulse, Halo Prismatic Swirl, Halo Mandala, Halo Fractal Bloom.
- **DNA condiviso dello stile**: campionano la texture sorgente, simmetria a specchio (`uv_sym = 0.5 + abs(uv.x-0.5)`) o quad/radiale, warp con swirl, colori da palette psichedelica, e soprattutto `blended = mix(source.rgb, col, intensity * smoothstep(0.0, 0.4, lum))` + `return vec4(blended, source.a)`. Questo blend per luminanza fa sì che l'effetto compaia solo sul soggetto e lo sfondo scuro resti tale → si "mascherano" naturalmente anche su asset con sfondo nero, come piace all'utente.
- Verificato: tutti i 27 shader compilano (compilazione fragment in WebGL), metallic e Halo Radial Kaleido testati visivamente su immagine a sfondo nero.

## 2026-07-23 — Luma key per asset con sfondo nero opaco

### Problema segnalato dall'utente
Con l'asset reale, solo "Symmetrical Halo Swirl" appariva ritagliato; gli altri 22 shader riempivano tutto lo schermo. Causa: Halo Swirl **campiona la texture** e colora in base ad essa (lo sfondo nero resta nero → sembra mascherato), mentre gli shader generativi si affidano al **canale alpha**. L'immagine dell'utente ha lo sfondo **nero opaco** (alpha=1 ovunque), quindi la maschera alpha non ritaglia nulla.

### Soluzione: luma key
- **Wrapper (`isfParser`)**: aggiunto uniform `uLumaKey`. `mask = src.a`; se `uLumaKey > 0`, `mask *= smoothstep(0.0, uLumaKey, luma)` (luma = luminanza del pixel). Così le zone scure dell'immagine diventano trasparenti. La maschera usa sempre la uv originale.
- **`projectStore.lumaKey`** (default 0 = off) + `setLumaKey`, incluso in sync e persistence (con fallback 0 per progetti vecchi). Uniform `uLumaKey` aggiornato ogni frame in ShaderPlane.
- **Auto-rilevamento all'upload (`MediaUploader`)**: `isFullyOpaque()` disegna l'immagine ridotta (max 128px) su canvas e controlla l'alpha; se totalmente opaca → `setLumaKey(0.12)` automatico, altrimenti 0. Accettati anche i JPEG. Verificato: immagine con sfondo nero opaco → lumaKey 0.12 auto, effetto ritagliato sul soggetto per tutti gli shader.
- **UI (`BackgroundKeyPanel`)**: slider "Rimuovi sfondo scuro" (0–0.6, 0=off) nel pannello Assets, per regolare/attivare manualmente anche sull'immagine già caricata.

## 2026-07-23 — 22 shader psichedelici, size globale, fix maschera

### Libreria shader (22 nuovi + 1 esistente = 23)
- **`effectsStore` refactor**: gli shader si caricano automaticamente con `import.meta.glob('../shaders/*.glsl', {query:'?raw', eager:true})`, ordinati alfabeticamente. Basta aggiungere un `.glsl` in `src/shaders/` e appare nella libreria.
- Aggiunti 22 shader generativi in stile psichedelico (tutti compilano, verificato compilando ogni fragment in un contesto WebGL): Plasma Bloom, Kaleido Prism, Hypno Tunnel, Julia Dream, Kali Fractal, Voronoi Cells, Liquid Marble, Rainbow Spiral, Electric Web, Mandala Pulse, Acid Waves, Neon Rings, Warp Grid, Psy Flower, Melt Noise, Star Nest, Trippy Checker, Fractal Onion, Aurora Flow, Digital Vortex, Bubbling Metaballs, Interference Moire. Sono tutti puramente generativi (non campionano il media): la maschera alpha del wrapper li ritaglia da sola.

### Size globale dello shader
- **`effectsStore.size`** (default 1) + `setSize`, incluso in sync e persistence. Uniform `uScale` aggiunto in ShaderPlane e nel wrapper.
- **Wrapper (`isfParser`)**: la maschera usa SEMPRE `vUv` originale; l'effetto usa `fxUv = (vUv-0.5)/uScale + 0.5`. Così Size scala il pattern dell'effetto ma la forma dell'immagine non cambia mai. Aggiunto anche early-out `if (sourceAlpha <= 0.0) { gl_FragColor = vec4(0.0); return; }`.
- **Slider Size** nel pannello Shader (sopra i controlli per-shader, con Separator), valido per tutti gli effetti.

### Fix maschera persa al cambio shader (bug reale)
- Cambiando shader il `<shaderMaterial key={shader.name}>` si rimonta e l'uniform `uTexture` tornava al FALLBACK (alpha=1) → l'effetto riempiva tutto il quad invece di stare dentro i bordi. L'effect che carica la texture non ri-partiva (media invariato).
- **Fix in ShaderPlane**: la texture del media vive in `textureRef` persistente; l'effect di load aggiorna il ref; in `useFrame` si riassegna `uTexture = textureRef.current` ogni frame, così sopravvive al rimontaggio. Verificato: dopo aver ciclato più shader, Plasma Bloom resta ritagliato nella sagoma.

## 2026-07-23 — shadcn/ui, layout MAPSHROOM-style, controller Move

### File di tracciamento
- Creati `CLAUDE.md` (contesto + regole di lavoro obbligatorie: ogni modifica → MEMORY.md → TODO.md), `MEMORY.md`, `TODO.md` in root del progetto. Confermato che la root è la posizione corretta per CLAUDE.md (caricato automaticamente da Claude Code solo se in root).

### shadcn/ui
- **Installato shadcn/ui** (CLI: `init --template vite -b radix -p nova`) su Vite + Tailwind v4. Path alias `@`→`src` in `vite.config.ts` (resolve.alias) e in tsconfig (`paths`, senza `baseUrl` che è deprecato in TS 6). CSS variables e tema in `index.css` (riscritto dal CLI). Aggiunto `class="dark"` all'`<html>` in index.html per attivare i token scuri; rimosso l'override colore hardcoded dal blocco custom in index.css (restano solo height/overflow).
- Componenti aggiunti in `src/components/ui/`: button, slider, card, input, label, tabs, tooltip, separator, toggle, toggle-group, select, scroll-area. App avvolta in `<TooltipProvider>` in main.tsx.
- **Ricostruiti con shadcn** MediaUploader, EffectsPanel (Select+Slider), ProjectsPanel (Input+Button), OutputLauncher, PositioningPanel — tutti con icone lucide-react.
- Nota: dopo l'aggiunta dei pacchetti Radix, Vite ha ri-ottimizzato le deps a caldo causando "Invalid hook call" (doppia copia di React). Risolto riavviando il dev server (stessa classe di problema già documentata per idb).

### Layout ispirato a MAPSHROOM (solo struttura, colori dopo)
- **Creato `src/store/uiStore.ts`**: pannello attivo (`move|shader|assets|output`).
- **Creato `src/components/layout/TopToolbar.tsx`**: top bar con logo EASYVJ + nav MOVE/SHADER/ASSETS/OUTPUT (icone lucide) + settings. Il pulsante attivo cambia il contenuto del pannello sinistro.
- **Riscritto `ControlPage`**: colonna [TopToolbar | (sidebar sinistra con ScrollArea che mostra il pannello attivo) + canvas centrale]. Sidebar con header di sezione.

### Controller Move (posizione + zoom)
- **`projectStore`**: aggiunto `transform {zoom, offsetX, offsetY}` (default 1/0/0) applicato all'intero mesh via `<group position scale>` in ShaderPlane, sopra il corner-pin warp. Funzioni `setTransform`/`resetTransform`. Incluso in `sync.ts` (payload broadcast) e in `persistence.ts` (snapshot/apply, con fallback `DEFAULT_TRANSFORM` per progetti vecchi).
- **Creato `src/components/Positioning/MovePanel.tsx`**: pad direzionale 3x3 (pan ±0.05), centra, slider zoom 0.1–4 con pulsanti +/-, reset. Componenti shadcn.
- **`CornerPinOverlay` aggiornato**: le maniglie ora sono disegnate sulla posizione *renderizzata* (base·zoom+offset) e il drag inverte il transform (÷zoom) — così gli angoli seguono l'immagine anche con zoom/pan attivi. Aggiunto `overflow-hidden` al `<main>` per non far sbordare le maniglie sopra la sidebar quando un angolo esce dal canvas. Verificato numericamente (a zoom 0.5 le maniglie si avvicinano al centro).

## 2026-07-23 — Sessione iniziale: scaffolding → persistenza

### Persistenza progetti (IndexedDB)
- **Creato `src/lib/persistence.ts`**: DB `easyvj` via `idb`, store `projects`. Autosave con debounce 600ms su slot `__autosave__`, ripristino all'avvio della Control page, salvataggi manuali con nome (save/load/delete/list). Il media è salvato come Blob perché i blob URL non sopravvivono al refresh.
- **Creato `src/components/ControlPanel/ProjectsPanel.tsx`**: pannello sidebar con input nome + Salva, lista progetti con load/delete.
- **Fix race restore-vs-upload**: il ripristino autosave ricontrolla `media == null` anche dopo l'await IDB, per non sovrascrivere un upload fatto nel frattempo.
- **Aggiunto campo `blob` a `MediaAsset`** (projectStore) e escluso dal payload BroadcastChannel in `sync.ts` (il blob serve solo alla persistenza locale).
- **Creato `src/lib/debug.ts`** (dev-only): espone gli store in `window.__easyvj` per ispezione da console.
- **Debug canvas R3F morto**: dopo l'introduzione di `idb`, Vite ha ri-ottimizzato le deps a caldo rompendo silenziosamente il mount dei child di `<Canvas>` (canvas fermo a 300x150, zero errori). Risolto riavviando il dev server. Documentato in CLAUDE.md → Trappole note.

### AutoFit ripensato
- **`src/engine/AutoFit.tsx`**: il fit dei corner avviene solo su richiesta esplicita (`requestFit()`: chiamato da upload nuovo e dal pulsante "Reset posizione"), non più al cambio media — così i progetti ripristinati mantengono i corner salvati. Fix precedente: il calcolo usa il frustum reale della camera (half-width = aspect canvas, half-height = 1), non `viewport` di R3F che ignora il frustum custom.

### Maschera alpha automatica
- **`src/engine/isfParser.ts`**: il fragment shader wrapper moltiplica l'alpha del colore finale per l'alpha della texture sorgente → ogni shader è ritagliato automaticamente dentro i bordi dell'immagine caricata, indipendentemente da come gestisce l'alpha internamente. (Richiesta esplicita dell'utente: "l'effetto solo all'interno dei bordi dell'immagine".)

### Corner-pin editor
- **Creato `src/components/Positioning/CornerPinOverlay.tsx`**: overlay SVG+div sopra il canvas della Control page — 4 maniglie trascinabili agli angoli, drag del poligono per pan. Conversioni schermo↔mondo coerenti col frustum della camera.
- **Creato `src/components/Positioning/PositioningPanel.tsx`**: istruzioni + pulsante "Reset posizione".
- **`projectStore` ristrutturato**: rimosso il vecchio `transform` (x/y/scale/rotation) in favore dei soli `corners` (il corner-pin copre tutto); ordine TL,TR,BL,BR coerente con PlaneGeometry.

### Sync Control ↔ Output
- **`src/lib/sync.ts`**: handshake `hello` → una finestra Output aperta dopo i cambi di stato richiede e riceve lo stato corrente (prima mostrava lo stato di default).

### Scaffolding iniziale
- Progetto Vite + React 19 + TS; installati zustand, three, @react-three/fiber, @react-three/drei, idb, vite-plugin-pwa, react-router-dom, tailwindcss v4 (@tailwindcss/vite), @types/three.
- Config PWA in `vite.config.ts` (manifest EasyVJ, autoUpdate); `server.port` legge env `PORT` con `strictPort` (porta 5173 spesso occupata da altro processo).
- Struttura `src/`: components/{ControlPanel,Positioning,EffectsLibrary}, engine, store, lib, shaders, routes/{control,output}.
- **`src/engine/isfParser.ts`**: parser degli uniform `@min @max @default` → controlli UI auto-generati; wrapper vertex/fragment per Three.js.
- **`src/engine/ShaderPlane.tsx`**: mesh 4 vertici con posizioni = corners (warp), texture dal media con fallback, uniform aggiornati per-frame da `effectsStore`; `DoubleSide` per winding invertiti durante il drag.
- **`src/engine/StageCanvas.tsx`**: canvas R3F condiviso; `ResponsiveCamera` ortografica con frustum aspect-corretto (fix distorsione tra finestre con aspect diversi).
- **`src/shaders/symmetricalHaloSwirl.glsl`**: primo shader (fornito dall'utente, troncato nell'originale — completato in modo minimale per compilare).
- **Route** `/control` e `/output`; `/` reindirizza a `/control`. Output = canvas fullscreen pulito.
- Store Zustand: `projectStore` (media, corners, fit), `effectsStore` (shader, parametri live).
- UI base: MediaUploader (PNG/WebP con alpha), EffectsPanel (select shader + slider generati), OutputLauncher (window.open /output).
