# TODO — Roadmap EasyMap Studio

Spuntare gli step completati; aggiungere nuovi step quando emergono. Tenere allineato con MEMORY.md.

## Fase 1 — MVP core

- [x] Scaffolding Vite + React + TS + Tailwind v4 + Zustand + R3F + router + PWA plugin
- [x] Route `/control` (editor) e `/output` (finestra proiettore pulita)
- [x] Sync Control ↔ Output via BroadcastChannel (con handshake `hello`)
- [x] Upload immagine PNG con alpha (MediaUploader)
- [x] Canvas R3F con ShaderMaterial e primo shader GLSL (Symmetrical Halo Swirl)
- [x] Parser ISF-like (`@min @max @default`) → slider auto-generati
- [x] Maschera alpha automatica: effetti ritagliati dentro i bordi dell'immagine
- [x] Corner-pin: 4 maniglie trascinabili + pan del poligono
- [x] Fit automatico dell'immagine al viewport (su upload e reset)
- [x] Persistenza IndexedDB: autosave + progetti con nome (salva/carica/elimina)
- [x] Pannello Progetti: pulsante "Nuovo progetto" (scena azzerata a un solo layer vuoto) con dialog di conferma salva/non salvare/annulla prima di procedere
- [x] Installare shadcn/ui (Vite + Tailwind v4) e ricostruire i pannelli di controllo
- [x] Ristrutturare il layout ispirato allo screenshot MAPSHROOM (top toolbar MOVE/SHADER/ASSETS/OUTPUT + pannello sinistro a sezioni + canvas)
- [x] Controller MOVE: transform globale (zoom + pan) su store/mesh/sync/persistence + pannello con pad direzionale e slider zoom; corner-pin overlay che segue il transform
- [x] Libreria di 22 shader psichedelici (auto-load via import.meta.glob) + slider Size globale (uScale) valido per tutti gli effetti
- [x] Garantire il ritaglio dell'effetto dentro i bordi immagine anche al cambio shader (fix texture ref in ShaderPlane)
- [x] Luma key per asset con sfondo nero opaco: uniform uLumaKey + auto-rilevamento opacità all'upload + slider "Rimuovi sfondo scuro"
- [x] Fix metallic3dFluid.glsl (aggiunte node_noise/node_rand mancanti dal runtime MAPSHROOM)
- [x] 10 varianti in stile Symmetrical Halo Swirl (file halo*.glsl, source-driven + blend per luminanza)
- [x] Famiglia Halo (12 shader): toggle `mirror` per disattivare lo specchio interno hardcoded (default acceso, invariato) + uniform `speed` dedicato dove non c'era già un controllo equivalente (`flow`/`pulse`); parser e `EffectsPanel` estesi con un marcatore `@step` per renderizzare i controlli booleani come bottone invece che slider
- [x] Supporto uniform vec3 nel parser ISF (colorControls) + fix 3D Surface Morph Spirals (spiralColor restava nero)
- [x] Sistema palette colori (gradient map globale): 7 preset fluorescenti caldi + editor color picker + intensità, valido per ogni shader (tab Palette)
- [x] Preset degli effetti: salva/carica il look (shader + parametri + size + palette) su IndexedDB (store effectPresets, DB v2), pannello nel tab Shader
- [x] Sidebar shadcn (Provider/Sidebar/Inset) con collapse nativo (SidebarTrigger) e resize via drag handle (localStorage, min 240/max 520px). Toolbar Move/Shader/Palette/Assets/Output spostata dentro SidebarInset, brand EASYVJ in SidebarHeader
- [x] Toggle visibilità dei riferimenti di mapping (pulsante occhio nella toolbar del canvas): nasconde cornice corner-pin e maniglie/forme mask per valutare l'effetto senza sovrapposizioni. Solo in Control, l'Output non li disegna mai
- [x] Zoom/pan della vista di anteprima in Control (rotellina + pulsanti + Spazio/click centrale per il pan), puramente visivo — non altera corners/transform, l'Output non ne risente mai. Risolve le maniglie del corner-pin irraggiungibili quando l'asset è ingrandito oltre i bordi del canvas
- [x] **Corner-pin proiettivamente corretto**: il quad era 2 triangoli con uv affine, quindi la texture si spezzava lungo la diagonale a ogni keystone. Ora si calcola l'omografia quadrato→quad e ogni vertice porta `aPersp` = 1/W; nel fragment `vUv` è una macro (`vUvW.xy / vUvW.z`), così nessuno dei 103 shader è stato toccato. Verificato numericamente contro l'inversa esatta dell'omografia (`src/lib/warp.ts`, `src/engine/warpGeometry.ts`)
- [x] **Curvatura dei 4 bordi separata** (patch di Coons): ogni lato è una Bézier cubica con 2 handle, definiti in spazio unitario come scostamento dal bordo dritto — a zero la patch è l'identità esatta, quindi senza curvatura la mesh resta a 4 vertici. Suddivisione 24×24 solo quando serve. Toggle "curvatura" e "azzera curvatura" nella toolbar del canvas
- [x] **Selezione del lato**: cliccando la maniglia a rombo fra due pin (o i 4 pulsanti nella toolbar) le frecce e il drag muovono i due angoli insieme. `uiStore.selectedCorner` → `mappingSelection` (all | corner | edge)
- [x] **Reticolo di nodi NxM** (3×3 → 5×5 nodi trascinabili, i "pin point a piacere"): terza modalità di `warp`, alternativa alle Bézier e memorizzata in parallelo. Interpolazione Catmull-Rom bicubica con nodi fantasma **estrapolati** e non clampati, altrimenti la superficie si affloscia ai bordi anche a reticolo fermo. Cambiare densità riposiziona i nodi sulla superficie attuale (nodi esatti, curva fra i nodi approssimata). Le maniglie di selezione del lato spariscono in questa modalità: a 3×3 finivano esattamente sotto i nodi di bordo
- [x] **Keystone numerico H/V**: pulsanti ⌃K / ⌐K in toolbar, agiscono sui corner come rotazione e scala (nessuno stato parallelo che entrerebbe in conflitto col drag delle maniglie)
- [x] **Correzione dell'obiettivo** (barile/cuscino): slider nel pannello Move, deformazione radiale che lascia fermi i 4 angoli. Limite ±0.5 perché sotto la mappa si ripiega e la mesh si sovrappone a sé stessa vicino agli angoli
- [x] **Soft edge sul perimetro** (`uEdgeFeather` + `edgeFeather` per-layer): sfuma il bordo della proiezione seguendo il warp, perché la uv è già lo spazio del quad
- [x] **Undo/redo del mapping** (⌘Z / ⇧⌘Z + pulsanti): cronologia da 80 voci in `patchActiveMapping`, con accorpamento delle raffiche entro 500 ms così un trascinamento è un solo passo
- [x] ~~Input numerico dei corner + preset di mapping~~ — implementati e poi **rimossi su richiesta dell'utente**. La versione IndexedDB resta a 6: la 5 aveva lo store `mappingPresets`, non si può scendere di versione, quindi la 6 lo elimina dove esiste
- [ ] Definire la palette colori dell'app (rimandata: per ora tema neutro shadcn dark)
- [ ] Drag diretto dell'immagine sul canvas in modalità MOVE (ora il pan è solo da pad direzionale / trascinamento del quad corner-pin)
- [x] Toolbar di mapping sul canvas (in basso a sinistra): spostamento fine da tastiera sull'angolo selezionato (passo fine/medio/grande, Shift ×5), rotazione ±90° e ±1°, scala non uniforme, flip H/V, raddrizza, lucchetto del mapping, griglia con snap, test pattern di calibrazione visibile anche in Output. Rotazione/scala/flip agiscono sui corner (`src/lib/mappingGeometry.ts`), non su `Transform`: nessuna modifica a shader, persistence e sync
- [x] Timeline in basso come nello screenshot MAPSHROOM (barra playlist)
- [x] Pannello destro: ora è l'**ispettore del layer** (lista layer fissa + Proprietà/Asset/Mask/Move richiudibili, tutti riferiti al layer selezionato), collassabile e ridimensionabile. La sidebar sinistra resta al look e al progetto (Shader, Palette, Progetti, Output)
- [x] Pannello live: controlli globali per-layer validi per QUALSIASI shader (velocità, rotazione, pan, kaleidoscopio, mirror X/Y, pixelate, luminosità, contrasto, saturazione, posterize, negativo) — implementati nel wrapper GLSL (`easyvj_fxUv`/`easyvj_fxColor`), UI in `FxControlsPanel`
- [x] 30 shader psytrance/techno (`src/shaders/psy*.glsl`): libreria da 41 a 71 effetti, tutti verificati in compilazione WebGL
- [x] 20 shader "Morph" source-driven (`src/shaders/morph*.glsl`) sulla scia di 3D Surface Morph Spirals: la luminanza dell'asset fa da mappa di quota (`lum * morphDepth`) e deforma la geometria dell'effetto. Libreria a 91 effetti; provino verificato renderizzandoli con l'asset reale, non con la texture di fallback
- [x] Palette casuale con numero di colori selezionabile (2–5) e schemi di armonia (analoga/complementare/triadica/split/monocromatica), disponibile sia nel pannello Palette sia in quello Shader
- [x] Loop delle palette casuali: toggle "Loop" + intervallo regolabile (0.5–60s, default 5) nel blocco "Colori casuali"; motore rAF in `use-palette-loop.ts` montato sulla ControlPage, dissolvenza in HSL fra una palette e l'altra (`lerpPaletteColors`). Rispetta la modalità Live come ogni altra modifica
- [x] Shader "Emboss Light Pro" (`src/shaders/embossLightPro.glsl`): rilievo dai gradienti dell'immagine con una sorgente di luce animata che si muove in cerchio, colore della luce personalizzabile. Fornito già pronto dall'utente, aggiunto senza modifiche funzionali
- [x] 10 shader "SD" (`src/shaders/sd*.glsl`): source-driven di seconda generazione che, oltre alla luminanza, usano il **gradiente** dell'immagine (la pendenza locale) per orientare i pattern lungo le curve dell'oggetto, warpare le trame sui fianchi e illuminare la superficie apparente. 11-12 controlli ciascuno, incluso il raggio di campionamento del rilievo e l'angolo della luce. Libreria a 97 effetti
- [x] Shader "Morph Pulse Beacon" (`src/shaders/morphPulseBeacon.glsl`): campo radiale pulsante con interferenza, tradotto dal formato uniform del runtime MAPSHROOM (`tex`/`fparams`/`ftime`...) alla convenzione ISF-like del progetto, poi reso source-driven come la famiglia Morph — la luminanza dell'asset deforma il raggio del campo (`morphDepth`), così il pattern segue i rilievi della statua invece di sovrapporsi come un piano piatto
- [x] Cambio rapido dell'effetto: frecce ◀ ▶ affiancate alla select + scorciatoie ⌥A (precedente) / ⌥S (successivo). Azione unica `cycleActiveShader` nello store (propaga ai layer sincronizzati come la select), scorrimento a loop che salta "Nessun effetto". Hotkey su `e.code` per non farsi ingannare dai caratteri che Option produce su macOS
- [x] Sezione "Controlli effetto" nel pannello Shader con pulsante **Random**: valori casuali per tutti gli uniform float dello shader attivo, dentro i range `@min`/`@max` e quantizzati sul passo dello slider (`randomizeActiveParams` nello store, propaga ai layer sincronizzati). Non tocca gli uniform colore, che hanno già i loro randomizer
- [x] Barra spaziatrice = "Esegui in output" (`use-output-hotkeys.ts`): invia la scena alla finestra Output. Attiva solo in Live e solo con modifiche in sospeso, così fuori da Live lo Spazio resta al pan della vista; badge `Spazio` sul pulsante della toolbar
- [ ] Estendere ⌥A/⌥S alla finestra Output (serve registrare l'hotkey anche lì e rimandare il comando via BroadcastChannel): utile solo se capita di pilotare col focus sulla finestra proiettata
- [ ] Valutare se includere `FxControls` in `EffectSnapshot` (ora sono per-layer, quindi preset e clip della playlist non li catturano — scelta voluta: non si azzerano a ogni transizione)
- [x] Shader "Female Eyes" (`src/shaders/eyesFeminine.glsl`): due occhi femminili con battito di palpebre irregolare (a volte doppio) e sguardo a saccadi destra/sinistra, pensato come **layer sovrapposto** — fuori dagli occhi l'alpha è 0, quindi i layer sotto restano visibili. Introdotto per questo l'uniform globale `uQuadAspect` nel wrapper (aspect del quad dai corner-pin): senza, le forme si deformano col mapping e l'iride diventa ovale
- [ ] Altri effetti "figurativi" sulla scia di Female Eyes (bocca, mani, simboli) se l'idea del layer-decalcomania regge sul palco
- [ ] Import shader GLSL da parte dell'utente
- [x] Color picker UI per gli uniform vec3 dei singoli shader (sezione "Colori effetto" nel pannello Shader e nell'editor clip; per-layer in colorParams, incluso in preset/playlist/crossfade/thumbnail)
- [x] 10 shader "Liquid" sulla scia di 3D Surface Morph Spirals (file liquid*.glsl, source-driven con morph da luminanza e uniform colore)
- [x] Generatore casuale di palette (bottone "Palette casuale" nel pannello Palette: 5 colori HSL armonici scuro→acceso, attiva la palette)
- [ ] Palette memorizzata per-shader (ora è per-layer) + salvataggio di palette custom dell'utente
- [x] Famiglie di effetti (Psy/Morph/Halo/Liquid/SD/Audio/Altri) dedotte dal prefisso del file, con pulsanti di filtro e conteggi sopra la lista degli effetti (`src/lib/shaderCategories.ts` + `ShaderPicker`)
- [x] Frecce ◀ ▶ e ⌥A/⌥S scorrono dentro la sola famiglia filtrata: il filtro è passato da stato locale del picker a `uiStore.shaderCategory`, che `cycleActiveShader` consulta
- [x] Interruttore rapido della palette accanto a "Colori casuali" (pannello Shader), che spegne anche il loop dei colori — altrimenti il loop la riaccendeva al primo tick. Stessa correzione applicata al toggle del pannello Palette
- [x] Pulsante "Reset" accanto a "Random": riporta uniform e colori dell'effetto attivo ai default dichiarati nel `.glsl` (non tocca Size, palette e controlli globali del layer)
- [x] Due effetti da riferimenti visivi dell'utente: `Wire Network` (maglia di nodi/segmenti con scaglie scure, stile data-sculpture) e `Liquid Zebra Flow` (bande bianco/nere avvolte in vortici, domain warping). Libreria a 103 effetti
- [ ] Anteprime/thumbnail degli shader nella libreria (come i preset nello screenshot MAPSHROOM) — il motore esiste già: `src/engine/effectThumbnail.ts` (usato dalle card della playlist)
- [ ] Export/import progetto come file JSON (backup portabile tra macchine)
- [ ] PWA: icone reali (pwa-192x192.png, pwa-512x512.png mancanti in public/) e test offline
- [ ] Fullscreen automatico della finestra Output (API Fullscreen su doppio click o pulsante)
- [x] Asset dimostrativo di default (`public/default-stage.png`) caricato in automatico sul layer attivo alla primissima apertura dell'app (mai autosave né flag visto prima), con fit e luma key come un upload normale

## Fase 2 — Multi-layer (Resolume-like)

Modello: scena = pila di Layer indipendenti; ogni layer ha contenuto (img/gif/video) + effetto + mapping proprio + maschere + mixing (opacità, blend).

### Fase A — Scaffold multi-layer + mixing ✅
- [x] `layersStore` (array di Layer + activeLayerId) come sorgente di verità; svuotati project/effects/palette store del loro stato per-layer
- [x] Rendering N mesh impilate (renderOrder) con opacità e blend mode (Normal/Add/Screen/Multiply) via premultiplied alpha + CustomBlending
- [x] `LayersPanel`: lista riordinabile (drag&drop), add/remove/duplica, occhio, rinomina, opacità, blend mode; voce toolbar "Layers"
- [x] Pannelli Shader/Palette/Move/Assets agiscono sul layer attivo; corner-pin e AutoFit per-layer
- [x] Sync (BroadcastChannel) + persistence (DB v3) + effect preset aggiornati all'array di layer

### Fase B — Maschere per-layer (dove il layer è visibile) ✅
- [x] Forme mask (rettangolo/ellisse) mobili/ridimensionabili con feather + rotazione + invert, calcolate nello shader in spazio-corner; editor sul canvas (MaskOverlay) + pannello Mask
- [x] Maschera da immagine PNG (stencil) per finestre irregolari
- [x] Stack di più maschere (unione) sullo stesso layer; estensione wrapper GLSL (alpha *= source × region forme × maskTex)

### Fase C — Media dinamici ✅
- [x] Sorgenti video (`THREE.VideoTexture`, loop/play) per-layer
- [x] GIF animate (gifuct-js → CanvasTexture) per-layer
- [x] Persistenza dei blob video/gif (StoredMedia con type + maskImage)

### Extra (multi-layer) ✅
- [x] "Nessun effetto" (shader passthrough) per mostrare l'asset grezzo
- [x] Link effetto: toggle persistente "Applica a tutti i layer" (Effetto sincronizzato) con selezione dei layer target (nuovi inclusi di default); propaga shader+params+size+palette in live
- [x] Modalità Live: l'Output non si aggiorna in automatico; pulsante "Esegui in output" invia lo stato corrente (toggle LIVE + indicatore modifiche in sospeso in toolbar). Uscendo da Live l'Output si allinea subito
- [x] Crossfade dell'intera scena sugli invii all'Output (push manuale e uscita da Live), al posto del cambio secco: copre effetto, media, mapping, maschere e layer aggiunti/rimossi. Durata dai valori della barra playlist; gli aggiornamenti automatici fuori da Live restano istantanei

### Altro editor avanzato
- [ ] Undo/redo del mapping (proposto e scartato dall'utente il 2026-08-13: per ora il lucchetto previene gli incidenti; riconsiderare se emerge il bisogno)
- [ ] Rotazione/scala non-uniforme delle maschere via overlay (ora solo move + resize uniforme; rotazione da slider)
- [ ] Editor maschera manuale di rifinitura (freehand/poligono) per bordi imperfetti
- [x] Playlist/sequenze di effetti con transizioni: barra timeline in basso (clip da libreria/preset, editor al click con anteprima, durata trascinabile, play/pause, loop, transizione smooth con crossfade a durata regolabile o secca; agisce su layer attivo + spunte sync; persistita nel progetto)
- [x] Barra playlist: scroll orizzontale (rotellina + scrollbar visibile + auto-scroll all'aggiunta), thumbnail statica dell'effetto in ogni card (renderer offscreen con cache), altezza ridimensionabile dal bordo superiore (96–192px, persistita)
- [ ] Libreria di playlist salvabili con nome, riusabili tra progetti (per ora la playlist vive solo dentro il progetto)
- [x] Shader "SD Edge Pulse": bordi illuminati che seguono la sagoma dello stage (profilo da alpha o da soglia di luminanza) + contorni interni, con respiro pulsante e slider `sourceAmount` per usarlo su un layer solo o su un layer duplicato in Add/Screen
- [ ] **SDF precalcolato dall'alpha** (distance transform all'upload dell'immagine, texture ausiliaria negli uniform): sblocca il neon morbido a distanza arbitraria e le **onde che si propagano dal bordo verso l'interno**, che il campionamento a raggio limitato di `sdEdgePulse` non può rendere (oltre ~20 texel degenera in un riempimento). Tocca engine, store e persistenza
- [ ] Contorni vettoriali (marching squares → polilinee con coordinata di lunghezza d'arco): abilita la **cometa che corre lungo il perimetro** a velocità costante, non ottenibile né con il gradiente né con l'SDF
- [ ] Editor maschera manuale di rifinitura (per bordi imperfetti)
- [x] Blend mode completi (13): ai quattro risolti dal blending hardware si aggiungono Overlay, Soft Light, Hard Light, Difference, Exclusion, Darken, Lighten, Color Burn e Color Dodge, calcolati nello shader leggendo una copia del backdrop (`src/engine/backdrop.ts`)
- [ ] Opzione "tratta il nero come trasparente" (luminance key) per immagini senza canale alpha
- [ ] Warp proiettivo vero (omografia nello shader o mesh suddivisa) — il warp attuale a 2 triangoli può creare una piega diagonale con deformazioni estreme
- [ ] Rimozione sfondo automatica (client-side ML o servizio esterno — decisione rimandata, per ora si caricano PNG già scontornati)

## Fase 3 — Live performance

- [x] Ingresso video live (webcam / cam USB / capture card HDMI) come sorgente di un layer: `MediaType 'camera'` + `deviceId`, stream condivisi per device con refcount (`src/lib/cameraSources.ts`), texture live in `mediaTexture.ts`, pannello `CameraPicker` con select dei device, riavvio della sorgente e "Nuovo strato" per impilare più effetti sulla stessa ripresa. L'Output riceve solo il deviceId e apre il device per conto suo
- [ ] Mirror orizzontale dedicato per la camera (oggi si usa "Specchia in orizzontale" della toolbar di mapping, che però tocca i corner e non funziona a mapping bloccato)
- [ ] Selezione di risoluzione/frame rate della camera (oggi si chiede sempre il massimo fino a 1080p)
- [ ] Condivisione schermo (`getDisplayMedia`) come sorgente di layer: stesso percorso della camera, sorgente diversa
- [x] Ingresso audio minimale + primo shader audio-reattivo: `AnalyserNode` → forma d'onda in una texture 256×1 (`src/engine/audioInput.ts`), esposta a QUALSIASI shader dal wrapper con `easyvj_wave()`/`easyvj_level()` (onda sintetica di riserva a ingresso spento). Shader `Audio Oscilloscope` con 14 parametri + 2 colori; pannello di attivazione solo per gli effetti che leggono l'audio; la finestra Output apre l'ingresso da sé (`use-audio-autostart.ts`)
- [x] Forme dell'oscilloscopio + preset rapidi: parametro `shape` (traccia / cerchio / rosa / poligono / piano XY) con morphing continuo, dove il suono increspa il contorno invece di scuotere una linea; sei preset a un click nel pannello dell'effetto e da tastiera con ⌥1…⌥6 (attivi solo quando il layer usa l'oscilloscopio)
- [ ] Audio reactive esteso: FFT a bande (bassi/medi/alti) e beat detection come uniform, per rendere reattivi anche gli altri shader della libreria
- [ ] Scelta del dispositivo di ingresso audio (oggi si usa quello predefinito di sistema; per il live serve poter puntare la scheda audio o un loopback invece del microfono)
- [ ] BPM sync / tap tempo
- [ ] MIDI controller (Web MIDI API) con mapping parametri
- [ ] Bridge OSC/DMX (richiede servizio Node locale: il browser non parla UDP)
- [ ] Multi-output / più superfici indipendenti nella stessa scena
- [x] Barra playlist a prova di live: il clip non è più cliccabile (un click accidentale mandava l'effetto in onda), le azioni compaiono in hover — tre puntini per l'editor, cestino per togliere il clip dalla sola playlist
- [x] Toggle "Playlist" nella barra in alto (fra Progetti e Output) per mostrare/nascondere la barra, persistito; nascosta con `display:none` per non fermare la riproduzione in corso

## Qualità dell'immagine proiettata

- [x] **Fix colore**: le texture di contenuto erano marcate `SRGBColorSpace` e venivano linearizzate dall'hardware senza mai essere ri-codificate in uscita (i nostri `ShaderMaterial` non includono il chunk `colorspace_fragment`). Misurato: un grigio 128 nel file arrivava a schermo come **55**. Ora `SOURCE_COLOR_SPACE = NoColorSpace`: pipeline tutta in spazio gamma, coerente con shader, palette e blend mode
- [x] **Compositore di output** (`OutputComposer.tsx`): la scena passa per un buffer interno con passaggio finale, che rende possibili supersampling, precisione HDR, dither e grana
- [x] Supersampling 1×/1.25×/1.5×/2× sulla sola finestra Output (l'anteprima non deve rubare GPU al proiettore), con riduzione a 4 prelievi per i rapporti non interi. È l'unico antialiasing che agisce sui contorni disegnati dagli shader: il MSAA del canvas lavorava solo sui lati del quad, che con un PNG scontornato sono trasparenti
- [x] Buffer interno a mezza precisione float: i blend Add/Screen non vengono più tagliati a 1.0
- [x] Dither finale (verificato: colonna a valore costante alterna 76/77 con dither, tutti 77 senza) e grana opzionale
- [x] **Sfondamento morbido**: l'eccesso oltre il fondo scala vira verso il bianco invece di far scivolare la tinta. Riscritto dopo che il cartello di prova ha mostrato il bianco pieno a 239 invece di 255 con la curva di compressione della prima versione
- [x] Anisotropia delle texture (`textureQuality.ts`): mai impostata prima, quindi ferma a 1, con perdita di dettaglio sui lati inclinati dal corner-pin. Registro delle texture per applicarla anche a quelle create prima che il renderer esista
- [x] Nitidezza del bordo della sagoma per-layer (`edgeSharp`): comprime la rampa dell'alpha senza spostarla, così il mapping non si muove
- [x] `backdrop.ts` adattato al buffer interno: dimensioni dal bersaglio legato (non dal canvas) e tipo della copia uguale a quello del bersaglio — copiare un buffer float in una texture a byte non è consentito
- [x] Pannello diagnostico sulla finestra Output (tasto S): pixel reali, buffer interno, supersampling, precisione, fps, avviso se la finestra non copre lo schermo
- [x] Cartello di prova (tasto C): righe da un pixel, rampa, barre sature, gradini di nero e bianco. Non si ricorda mai acceso fra le sessioni
- [x] Impostazioni di resa in uno store dedicato (`renderStore`), su localStorage e sincronizzate con un messaggio proprio che passa **sempre**, Live compreso: non sono la scena, sono il modo di disegnarla
- [x] Finestra Output aperta sullo schermo secondario (Window Management API) invece che 1280×720 sopra il pannello; pieno schermo con F o doppio click, con avviso a schermo quando il browser lo nega — verificato che può fallire **in silenzio**, senza rifiutare la promise
- [x] Verifica sul proiettore reale: qualità nettamente migliorata (riscontro dell'utente)
- [x] `README.md` aggiornato: sezione "Qualità dell'immagine proiettata", sottosezione tecnica "Pipeline di output", scorciatoie della finestra di proiezione, novità v4 e roadmap
- [x] Default del supersampling alzato a **2×**: misurato che a 1080p non costa nulla (126 fps contro 124 a 1×, entrambi limitati dal vsync)
- [x] Scala estesa a 3× e 4×, poi **rimossi**: provati sul proiettore non danno alcun miglioramento visibile (oltre il 2× il limite è l'ottica, non l'aliasing) mentre 4× dimezza gli fps già con un solo layer. Motivazione e avvertenza per un'eventuale riapertura nel commento di `SUPER_SAMPLE_STEPS`
- [x] Tetto di memoria video sul buffer interno (256 MB) oltre a quello sul lato massimo delle texture, e **fattore effettivo mostrato nel pannello** quando la riduzione scatta: prima il clamp era silenzioso
- [ ] Valutare l'estensione della maschera-immagine e dell'`edgeSharp` alle sorgenti video/camera (oggi l'anisotropia non le tocca: sono senza mipmap, rigenerarle a ogni frame costerebbe più di quanto renda)
- [ ] Valutare il rilevamento automatico del calo di fps con proposta di abbassare il supersampling (oggi l'avviso sotto i 50 fps è solo informativo)

## Manutenzione / debito tecnico

- [x] Sidebar sinistra: sezioni **Controlli globali** e **Preset salvati** collassabili, con la stessa persistenza (chevron, stato ricordato tra le sessioni) delle sezioni della colonna destra — riusano `CollapsibleSection`
- [x] Fix padding doppio delle stesse due sezioni: il `px-4` di `CollapsibleSection` si sommava al `p-4` del wrapper del pannello Shader (titoli rientrati 36px in più del resto del pannello) — risolto con `-mx-4` sul gruppo, senza toccare il componente condiviso con la colonna destra
- [x] Fix riga doppia sopra "Controlli globali": `<Separator />` + `border-t` sommati — tenuto solo il `border-t` sul gruppo, `Separator` rimosso da `ControlPage.tsx`
- [x] Fix `npm run build`: alzato `workbox.maximumFileSizeToCacheInBytes` a 10 MB in `vite.config.ts` per precachare `default-stage.png` (7.1 MB), sopra il limite di default 2 MB di vite-plugin-pwa
- [x] Fix sidebar destra (Asset): nome file troppo lungo mandava la colonna fuori dai bordi del browser — troncamento a 28 caratteri con tooltip sul nome completo (`MediaUploader.tsx`)
- [x] **Morph Morphogen Growth**: reaction-diffusion di Gray-Scott VERA (primo effetto con stato). Percorso multipass nell'engine — marcatore `//! SIMULATION` nel parser, `engine/simulation.ts` (ping-pong FBO toroidali 320x320), `engine/SimulationPass.tsx` (passi agganciati al tempo, non ai frame). Crescita dal seme -> labirinto -> maturita' (mitosi <-> labirinto di Turing), semi 1-5 posizionabili, ciclo di vita Matura/Ciclo/Manuale
- [x] Marcatore `@options a|b|c` nel parser ISF: gli uniform che rappresentano una scelta fra modi si renderizzano come gruppo di bottoni invece che come slider
- [ ] Allineare Control e Output anche in modalita' "Matura": oggi due finestre avviate in momenti diversi mostrano due realizzazioni diverse della stessa colonia (il Restart le riallinea). Servirebbe un istante di partenza condiviso nel payload di sync
- [ ] Valutare se agganciare anche `uTime` a un orologio condiviso: oggi parte da zero all'apertura di ciascuna finestra, quindi tutti gli shader sono in fase diversa fra anteprima e proiettore (invisibile finche' sono ciclici)
- [x] Tre effetti **Morphogen** (famiglia Morph): `Morph Morphogen Turing` (macchie <-> labirinti, campo a banda stretta di 12 onde piane), `Morph Morphogen Mycelium` (rete di ife dalle isolinee di un noise ciclico, con biforcazioni per generazioni), `Morph Morphogen Mitosis` (Voronoi a due nuclei per cella: la separazione dei nuclei disegna la citocinesi). Tutti con `sourceInfluence` 0..1 (generativo puro <-> guidato dalla luminanza)
- [ ] Valutare una vera reaction-diffusion iterativa (Gray-Scott) se un giorno la pipeline avra' un ping-pong FBO: oggi e' single-pass e i tre Morphogen sono analitici
- [x] Fix bug: la cornice corner-pin spariva dopo aver selezionato una maschera e cambiato layer — `activeMaskId` non veniva azzerato al cambio di `activeLayerId`, così restava montato un `MaskOverlay` vuoto al posto di `CornerPinOverlay`. Azzeramento in tutte le azioni che spostano il layer attivo + guardia derivata in `ControlPage` (la maschera deve esistere sul layer attivo)
- [x] Fix bug: il loop delle palette seguiva la selezione (era un flag globale che scriveva sul layer attivo) — ora è per-layer (`paletteLoopLayerIds` + `setLayerPaletteColors`), con cicli indipendenti e indicatore nella lista layer
- [x] Intervallo del loop palette diverso per ogni layer (`paletteLoopIntervals`): il tempo si materializza sul layer all'accensione e viene letto live dal motore, così cambiarlo in corsa non fa ripartire la dissolvenza. Il valore globale resta come tempo di partenza dei loop successivi
- [x] Fix bug: la tendina degli effetti non si lasciava scorrere (Radix `item-aligned` riportava la vista sull'item selezionato, con ~100 shader). Sostituita da `ShaderPicker`: ricerca + lista scrollabile sempre aperta, nel pannello Shader e nell'editor clip della playlist
- [x] Fix bug: in modalità Live il loop delle palette non raggiungeva la finestra Output (restava sul colore del push). I tick ora viaggiano su un messaggio `palette` dedicato (`applyPaletteTick` in `sync.ts`), applicato solo ai layer già in onda, e non marcano più la scena come "da inviare"
- [x] Scatti durante il loop delle palette: la dissolvenza scriveva nello store a ogni frame (~120/s) e l'autosave, debounce puro, scattava a ogni pausa riscrivendo anche i blob dei media (~53 ms a salvataggio). Ora il fade aggiorna a ~30 Hz e l'autosave ha un tetto di 5s fra due scritture
- [x] Texture delle immagini condivise per URL con refcount (`imageCache` in `mediaTexture.ts`): la scena uscente del crossfade non riparte più dalla FALLBACK durante la decodifica, e due layer con lo stesso asset decodificano una volta sola
- [ ] **Lampo nero sull'Output al push in Live (segnalato, non ancora riprodotto)**: misurato a 60 fps in sei scenari senza trovarlo. Piste aperte: media video/GIF (la scena uscente ricrea l'elemento `<video>` / ridecodifica la GIF da zero), molti layer con shader pesanti da ricompilare, GPU reale invece del rendering software del test. Servono i dettagli dell'utente
- [ ] Valutare se il crossfade di scena debba evitare di rimontare i layer invariati (oggi `beginSceneCrossfade` duplica tutte le mesh; per il solo cambio di effetto esiste già il ghost pass per-layer, che non rimonta nulla)
- [ ] Blob dei media in uno store IndexedDB separato (schema v5 + migrazione): il progetto salverebbe solo un riferimento e l'autosave scenderebbe da ~7 MB a pochi KB (da ~53 ms a ~1 ms). È la causa di fondo dei long task durante le animazioni continue
- [ ] Misurare le performance sempre su `npm run build` + `vite preview`: in dev con DevTools connesso React emette `performance.measure` per ogni componente e il profilo è dominato da quello (misurato: 120 fps e 0 long task in produzione contro 66 fps e 19 long task in dev, stessa scena)
- [ ] Recuperare la versione integrale dello shader Symmetrical Halo Swirl (l'originale fornito era troncato a metà loop; completato in modo minimale)
- [ ] Deprecation warning THREE.Clock (da @react-three/fiber, non bloccante — attendere fix upstream)
- [ ] Valutare test automatici (vitest) per parser ISF e persistence
- [ ] Rimuovere da `package.json` le dipendenze non più importate da `src/`: `@uiw/react-codemirror`, `@codemirror/lang-cpp`
- [x] Skill `apple-design` installata nel progetto (`.claude/skills/apple-design/SKILL.md`, da github.com/emilkowalski/skills) e applicata alla **sidebar destra**: token di motion e ruoli tipografici condivisi in `index.css` (`--ease-fluid`, `--dur-*`, `.ui-eyebrow`/`.ui-sublabel`, `prefers-reduced-motion`), sezioni che si aprono animate (`grid-template-rows`), intestazione col nome del layer attivo, gerarchia tipografica raddrizzata in 7 pannelli (le sotto-etichette erano più grandi dei titoli che le contenevano), riordino dei layer con Pointer Events (tracking 1:1, rubber-band ai bordi, assestamento prima del commit) al posto dell'HTML5 drag & drop, con la presa sulla sola maniglia a pallini e area sensibile allargata di ~8px per lato
- [x] Intestazione della colonna destra allineata ai ruoli tipografici condivisi (titolo con `.ui-eyebrow` invece di un maiuscoletto da 14px, tre livelli di gerarchia, hairline al posto del `Separator` pieno, `min-w-0` per il troncamento del nome)
- [ ] "Layer Inspector" è l'unico titolo in inglese fra quelli della colonna (Proprietà, Sorgente, Maschere): valutare se uniformare
- [x] Estendere la stessa passata `apple-design` alla **sidebar sinistra**: ruoli tipografici unificati (`.ui-eyebrow` per i titoli, `.ui-sublabel` per le etichette, `.ui-value` per i valori), `ControlRow` condiviso al posto di cinque copie della stessa riga etichetta/valore, note lunghe del pannello Output spostate nei tooltip, intestazione e scroll-fade allineati alla colonna destra (`useScrollShadow`), feedback `.press` e `focus-visible` sui controlli custom, etichette più dirette (Sliders→Effetti, Size→Scala, niente titolo duplicato in Progetti). Nessuna logica toccata
- [x] Fix: il contenuto delle ScrollArea usciva dal bordo stringendo una colonna ridimensionabile (il viewport di Radix è `display: table` e non scende sotto il min-content) — figlio forzato a `!block !w-full` in `ui/scroll-area.tsx`, verificato a 240px su entrambe le colonne
- [x] Estendere la passata `apple-design` alla **barra Playlist**: card dei clip allineate a `bg-sidebar-accent` come le righe di `LayerList` (su `bg-sidebar` erano senza contrasto in dark mode), etichette dell'editor clip sui token `.ui-eyebrow`/`.ui-label`/`.ui-value` condivisi, maniglie di resize (altezza barra, durata clip) rese scopribili con un segno visivo permanente, indicatore "in riproduzione" con bordo d'attacco e puntino animato, azioni hover raggiungibili anche su touch (`hover:none`), toggle Smooth/Secca differenziato per stato. Nessuna logica toccata
- [x] Popover "Opzioni clip" (stesso file): sfumatura alta/bassa sulla lista di Size+cursori invece del taglio secco a `max-h-56` (`useEdgeScrollFade`, si ricalcola al cambio di shader), separatore verticale nel footer fra "Cattura dal layer" e Duplica/Elimina. Nessuna logica toccata
- [x] Etichette di Size e dei parametri nello stesso popover riportate allo stile di `ControlRow` (pannello "Controlli" della sidebar sinistra): `.ui-sublabel text-muted-foreground` con maiuscola solo sulla prima lettera, valore `.ui-value text-foreground/80`
- [x] Estendere la passata `apple-design` alla **toolbar di mapping** (`MappingControls.tsx`, in basso a sinistra nel canvas): tasto di riduzione (collasso totale a pillola, `Minimize2`/`Maximize2`, stato in `localStorage`) con animazione a due stadi come `CollapsibleSection` (grid-rows + fade interno), più audit — feedback alla pressione e focus-visible mancanti su tutti i pulsanti custom testuali, `aria-label` mancanti sui pulsanti icon-only. Nessuna logica di mapping toccata
- [x] Stessa toolbar, due correzioni su richiesta: il tasto di riduzione era a cavallo del bordo (poco visibile) — spostato dentro la riga 1, spinto a destra da `justify-between` accanto a "Grande"; tutti i pulsanti custom (Tutti/TL/TR/BL/BR, lati, passo frecce, ±1°, keystone, Bordi/Reticolo, dimensioni reticolo, pillola compressa) convertiti da `<button>` nativi a `Button` shadcn/ui, costante `CUSTOM_BUTTON` rimossa perché non più necessaria
- [ ] Estendere la passata `apple-design` alla **top toolbar**: usa ancora `tracking-wide` uniforme e varianti di Button scelte a mano
- [x] Sezione "Posizione" eliminata (il pad direzionale a passi fissi perdeva contro il gesto diretto sul canvas): Dimensione+Reset, Curvatura obiettivo (ex "Obiettivo") e Sfumatura bordi spostati in "Proprietà" dopo Blend mode, con Opacità fra Dimensione e Curvatura obiettivo. `MovePanel.tsx` e `MappingOpticsPanel.tsx` rimossi, voce `'move'` tolta da `LayerSection`
- [x] Note lunghe di Dimensione/Curvatura obiettivo/Sfumatura bordi spostate in un tooltip "?" (Tooltip shadcn usato direttamente, trigger raggiungibile da tastiera)
- [x] `Rimuovi sfondo scuro` e `Nitidezza bordo` spostati da "Sorgente" a "Proprietà" (sotto Opacità), note nel tooltip "?"; `BackgroundKeyPanel.tsx` eliminato perché rimasto vuoto
- [x] Rimossi il pulsante "Adatta immagine" e la sua informativa; `PositioningPanel.tsx` eliminato. `requestFit()` resta automatico su upload media / accensione camera / asset di default, ma non è più richiamabile a mano
- [ ] Restano da spostare in tooltip le note esplicative di camera e maschere (stesso trattamento applicato agli altri cursori). "Sorgente" ora contiene solo media e ingresso video live
- [ ] `transform.offsetX/offsetY` non è più scrivibile da nessun controllo (era solo il pad direzionale). Oggi c'è un "Ricentra la proiezione" che compare solo se l'offset è ≠ 0, per non intrappolare i progetti vecchi. Se si decide che l'offset non serve più, si può togliere dal `Transform` e semplificare `ShaderPlane`/`TestPattern`/`CornerPinOverlay`/`MaskOverlay`
- [ ] `LayerList`: due layer possono avere lo stesso nome (bug preesistente di `addLayer`/`duplicateLayer`), quindi in lista sono indistinguibili
- [ ] Riordino layer: valutare l'autoscroll quando si trascina oltre il bordo della lista (oggi la lista scorre solo con la rotellina)
