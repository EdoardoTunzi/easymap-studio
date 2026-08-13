# MEMORY — Registro modifiche EasyMap Studio

Ogni modifica al progetto va registrata qui con data, descrizione e motivazione. Le voci più recenti in alto dentro ogni giornata.

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

## 2026-08-13 — Rimosso interamente il Generative Lab

Richiesta esplicita dell'utente ("elimina tutta la sezione generative lab... non mi piace"). Chiarito prima di procedere: i dati vecchi in IndexedDB restano orfani (nessun bump di versione DB, nessuna migrazione di pulizia) e i meccanismi generici usati solo dal Generative Lab vanno rimossi insieme al resto.

- **Eliminati**: `src/components/Generative/` (intera cartella: `GenerativeLabPanel`, `ModuleStackEditor`, `CodeEditorTab`, `GenerativePreview`, `GenerativeLibrary`, `useLiveApply`), `src/engine/generativeModules.ts`, `src/store/generativeStore.ts`.
- **`src/lib/persistence.ts`**: rimossi `GenerativeVisual`, l'object store `generativeVisuals` dallo schema `EasyVjDB` (DB resta a v4, nessun bump: lo store residuo nei browser che l'avevano già creato resta semplicemente inutilizzato), `saveGenerativeVisual`/`listGenerativeVisuals`/`deleteGenerativeVisual`/`uniqueVisualName`/`registerVisuals`/`useLoadGenerativeVisuals`.
- **`src/lib/sync.ts`**: rimossi `publishGenerativeShader`, il canale `shaderChannel` e la gestione del messaggio broadcast `{ type: 'shader' }` in `useBroadcastSubscriber`.
- **`src/store/effectsStore.ts`**: rimossi `registerShaders`/`unregisterShader` (nessun altro consumatore: la libreria shader torna a essere solo quella statica caricata dai file).
- **`src/store/layersStore.ts`**: rimossa l'azione `adoptShaderDefaults` (usata solo da `useLiveApply.ts` del Generative Lab).
- **`src/store/uiStore.ts`**: rimossi `generativeLabOpen`/`toggleGenerativeLab`.
- **`src/components/layout/TopToolbar.tsx`**: rimosso il bottone "Generative".
- **`src/routes/control/ControlPage.tsx`**: rimossi il pannello destro ridimensionabile (`labWidth`/`startLabResize`, storageKey `easyvj-generative-width`), `useLoadGenerativeVisuals()` e l'import di `GenerativeLabPanel`.
- **`src/routes/output/OutputPage.tsx`**: rimossa la chiamata a `useLoadGenerativeVisuals()`.
- **`TODO.md`**: sezione "Fase 2.5 — Generative Lab" sostituita da una nota di rimozione; ripristinati a `[ ]` i due item di Fase 1 che referenziavano la feature (pannello destro, import shader GLSL utente).
- Verificato: `npx tsc -b --noEmit` pulito, nessun riferimento residuo a "generative" nel codice (`grep -rli` su `src`). **Verifica visiva nel browser non eseguita**: il profilo Chrome condiviso di chrome-devtools-mcp risultava già occupato da un'altra istanza (probabilmente un processo orfano di una sessione precedente) e non è stato possibile aprire una pagina per lo screenshot.

## 2026-07-29 — README aggiornato con le feature recenti

Richiesta dell'utente: documentare nel `README.md` le funzionalità aggiunte nelle ultime sessioni.

- Contato il numero reale di shader prima di scriverlo (37 preesistenti + 30 `psy*` + 20 `morph*` = **87** file; le 91 voci viste nei test includevano i visual generativi salvati in locale durante le prove). Sostituiti i riferimenti obsoleti "oltre 35"/"37 shader".
- Sezione **"Cosa fa, in pratica"**: aggiunti i passi su controlli globali e Generative Lab (da 7 a 9 punti).
- **"Effetti e palette colori"**: libreria descritta per famiglie (Halo, Liquid, Psy, Morph) con la spiegazione del `morphDepth`; aggiunti controlli globali e palette casuale 2–5 colori con schemi di armonia.
- Nuova sezione **"Generative Lab — crea i tuoi visual"** (lato utente) e **"Generative Lab"** (lato tecnico, con la nota sugli identificatori prefissati e i valori emessi come `@default`).
- **"Layer e maschere"**: aggiunti i riferimenti di mapping nascondibili; precisato che la sincronizzazione fra layer propaga anche i controlli globali.
- **"Progetti e preset"**: chiarito che i controlli globali *non* sono catturati da preset e clip, ed è una scelta voluta — evita che l'utente lo scambi per un bug.
- Stack: aggiunto CodeMirror 6. Roadmap: aggiunta la Fase 2.5 completata e una voce "Oltre" con motore particellare 3D e feedback buffer. Aggiornato lo stato in cima.

## 2026-07-29 — 20 effetti "Morph": source-driven con morphDepth come 3D Surface Morph Spirals

Richiesta dell'utente: altri 20 effetti sulla scia di `3DSurfaceMorphSpirals.glsl`, di cui apprezza il `morphDepth`.

**Cos'è il morph depth** (la caratteristica da replicare): lo shader legge la texture sorgente, ne ricava la luminanza e la usa come **mappa di quota** per deformare la geometria dell'effetto (`lum * morphDepth`). L'asset non fa solo da maschera: modella il pattern, che così sembra avvolgere il soggetto. Lo schema, già usato dai `liquid*.glsl`, è: leggi `source`, esci se `length(source.rgb) <= blackThreshold`, calcola `lum`, inserisci `lum * morphDepth` nella geometria, chiudi con `mix(source.rgb, fx + source.rgb * psyColor, 0.85)`.

**20 nuovi file `src/shaders/morph*.glsl`** (libreria da 71 a 91 effetti): Concentric Waves, Electric Contours (isoipse della luminanza), Hex Lattice, Ribbon Flow, Crystal Facets, Radial Shards, Liquid Dunes, Torus Field, Kaleido Depth, Spiral Galaxy, Voronoi Depth, Interference Grid (moiré sfasato dal rilievo), Chrome Folds, Tunnel Depth, Petal Bloom, Lightning Web, Fractal Depth, Aurora Depth, Molten Rings, Depth Scan (piano di scansione tipo lidar che attraversa la quota). Ognuno espone `speed`, `morphDepth`, `blackThreshold`, un uniform colore e 2-4 parametri propri, quindi eredita gratis slider, palette e controlli globali.

**Verifica**: compilati tutti e 91 i fragment shader in WebGL — 0 errori. Poiché sono source-driven, la verifica con la texture di fallback sarebbe inutile: ho renderizzato un provino di tutti e 20 **con l'asset reale** (`/default-stage.png`) tramite un renderer offscreen, misurando luminanza media e percentuale di pixel bruciati dentro la sagoma. `Morph Fractal Depth` risultava un verde piatto saturo (accumulo IFS senza limite): corretto con decadimento più rapido e `clamp`. Risultato finale: luma 19–64, bruciature ≤1.3%, nessuno spento. Type-check, build e console puliti.

## 2026-07-28 — 30 nuovi effetti psytrance/techno + controlli globali + palette casuale a N colori

Richiesta dell'utente: più effetti creativi ispirati ai software di visual mapping, palette casuali fino a 5 colori per *tutti* gli effetti, e più controlli di regolazione.

**30 nuovi shader** in `src/shaders/psy*.glsl` (la libreria passa da 41 a 71 voci), pensati per stage psytrance/techno: Strobe Grid, Tunnel Rush, Bass Rings, Fractal Mandala, DNA Helix, Laser Sweep, Hex Pulse, Plasma Storm, Sacred Geometry, Digital Rain, Warp Stars, Liquid Mercury, Trippy Spiral, Circuit Board, Kaleido Fractal, Neon Wireframe, Acid Melt, Pulse Bars, Vortex Fractal, Techno Scanlines, Eye, Infinite Zoom, Energy Web, Chrome Ripple, Alien Organism, Strobe Tunnel, Fractal Flower, Glitch Blocks, Aurora Veil, Mandel Slice. Nessuna modifica al parser: rispettano la convenzione ISF-like già in uso, quindi sono caricati da `import.meta.glob` come gli altri.

**Controlli globali per-layer** (`FxControls` in `layersStore`, uniform `uFx*` nel wrapper di `isfParser.ts`): velocità, rotazione, pan X/Y, kaleidoscopio, mirror X/Y, pixelate, luminosità, contrasto, saturazione, posterize, negativo. Applicati nel wrapper — `easyvj_fxUv` prima di `processColor` e `easyvj_fxColor` dopo — quindi valgono per **qualsiasi** shader, inclusi i 41 preesistenti e i visual generativi, senza toccarne il codice. È la risposta scalabile a "più controlli": con 71 effetti, aggiungere uniform a ciascuno non lo sarebbe. UI in `FxControlsPanel.tsx` (tab Shader).
- Scelta: `fx` è proprietà del **layer** (come opacità/blend/lumaKey), non parte di `EffectSnapshot`. Così cambiando effetto o clip della playlist i trattamenti restano applicati invece di azzerarsi a ogni transizione. Viene però propagato ai layer sincronizzati (`withEffectOf`) perché passa da `editEffect`.
- Retrocompatibilità: i progetti salvati senza `fx` prendono i default da `createLayer` in `deserializeLayer` (lo spread non sovrascrive con `undefined`).

**Palette casuale a N colori**: `randomPaletteColors(count)` ora accetta il numero di stop (2..5) e sceglie tra 5 schemi di armonia (analoga, complementare, triadica, split-complementare, monocromatica) invece della sola deriva di tinta. Riempie comunque tutti i `PALETTE_STOPS` ripetendo l'ultimo colore, così alzare "Numero colori" non lascia buchi. `setPaletteColors(colors, count)` imposta anche il conteggio attivo. Pulsanti 2/3/4/5 sia nel pannello Palette sia nel pannello Shader — la palette è una gradient map, quindi ricolora ogni effetto.

**Verifica**: compilati tutti e 71 i fragment shader in un contesto WebGL reale — 0 errori GLSL. Misurata la luminanza media delle anteprime per scovare shader "morti": 8 erano troppo scuri o saturi (Warp Stars a 0.4/255, Tunnel Rush 1.2, Neon Wireframe 1.8, Kaleido Fractal 209.9) e sono stati corretti nelle formule e nei default; ora il range è 10–153. Provino visivo dei 30 controllato a schermo. Lint e `npm run build` puliti, nessun errore in console.

## 2026-07-28 — Fix: sul layer si vedeva solo il primo modulo del visual generativo

Segnalazione dell'utente: aggiungendo più moduli a un visual, il layer continuava a mostrare solo il primo, mentre l'anteprima nel pannello li mostrava tutti.

**Causa**: in `ShaderPlane.tsx` la `key` del `<shaderMaterial>` era `` `${shader.name}|${blendMode}` ``. Un visual rigenerato **mantiene il nome** ma cambia sorgente, quindi la key non cambiava: React riusava il materiale e Three continuava a eseguire il **programma GLSL già compilato** (assegnare `fragmentShader` a un materiale esistente non lo ricompila senza `needsUpdate`). Il layer restava così alla versione registrata la prima volta. L'anteprima non ne soffriva perché usava `key={shader.fragmentShader}`, che cambia a ogni ricomposizione.

- **`src/engine/isfParser.ts`**: `ParsedShader` ha ora un campo `id` (`crypto.randomUUID()` a ogni parse) — è l'identità della *compilazione*, non del visual. Vive solo in memoria: i visual salvati persistono la `source`, non il ParsedShader, quindi nulla cambia per la persistenza.
- **`src/engine/ShaderPlane.tsx`**: key del materiale basata su `shader.id`.
- **`src/engine/effectThumbnail.ts`**: `shader.id` nella chiave di cache, che aveva lo stesso difetto — restituiva la miniatura della versione precedente per un visual rigenerato con lo stesso nome. Spostata la ricerca dello shader prima del calcolo della chiave.
- **`src/components/Generative/GenerativePreview.tsx`**: key da `shader.id` invece dell'intera sorgente (stesso effetto, molto più leggero).
- Verificato nel browser: un visual con tre moduli (Flow Field + Point Grid + Worley Cells) ora appare sul layer identico all'anteprima. Type-check e `npm run build` puliti, nessun errore in console.

## 2026-07-28 — Fix larghezza pannello Generative Lab + toggle overlay di mapping

Due richieste dell'utente: a larghezza minima il lato destro del Generative Lab finiva tagliato fuori dallo schermo, e la cornice viola del corner-pin impediva di valutare l'effetto applicato.

- **Causa del taglio**: il `Viewport` di Radix ScrollArea avvolge i figli in un div con `display: table; min-width: 100%`, che **non si restringe** sotto la larghezza naturale del contenuto. Col pannello stretto il contenuto sforava e l'`overflow-hidden` dell'`<aside>` lo tagliava invece di adattarlo. Fix in `GenerativeLabPanel.tsx`: `[&>div>div]:block!` sullo ScrollArea (sintassi important di Tailwind v4 — il postfisso `!`, non il prefisso), più `min-w-0`/`truncate` sui controlli che potevano sforare (input nome e i 4 pulsanti azione).
- **`src/hooks/use-resizable-width.ts`**: il massimo è ora limitato a due terzi del viewport (`window.innerWidth * 0.66`), così su finestre strette il pannello non può essere trascinato fuori dallo schermo.
- **Toggle overlay**: nuovo `overlaysVisible` + `toggleOverlays` in `uiStore`, pulsante occhio (Eye/EyeOff, ambra quando spento) nella toolbar flottante `ViewportZoomControls`, e `ControlPage` che condiziona il rendering di `MaskOverlay`/`CornerPinOverlay`. È puramente visivo e locale alla finestra Control: l'Output non ha mai disegnato quegli overlay, quindi la proiezione non è toccata.
- Verificato nel browser: a 280px tutto il contenuto sta dentro il pannello; il drag della maniglia allarga/restringe e persiste; il trascinamento estremo si ferma al limite senza uscire dallo schermo; l'occhio nasconde e ripristina cornice e maniglie. Type-check, lint e `npm run build` puliti.

## 2026-07-28 — Generative Lab: applicazione in tempo reale + fix salvataggi

Segnalazione dell'utente: i salvataggi non funzionavano, le modifiche dal pannello Shader non venivano applicate bene, e non voleva premere "Al layer attivo" a ogni modifica.

**Causa comune dei primi due problemi**: il layer memorizza i parametri per *nome di shader* (`layer.params[shaderName]`). Rigenerando un visual con lo stesso nome, quei valori vecchi **mascheravano i nuovi `@default`** della sorgente ricomposta, quindi le modifiche sembravano non arrivare mai. Il salvataggio invece "non funzionava" perché il draft non sopravviveva al reload: `editingId` andava perso e ogni Salva creava un duplicato (`Visual generativo 2`, `3`, …) invece di aggiornare.

- **`src/store/layersStore.ts`**: nuova azione `adoptShaderDefaults(shaderName)` che assegna lo shader **azzerando** `params`/`colorParams` per quel nome. Passa da `editEffect`, quindi si propaga anche ai layer sincronizzati.
- **`src/store/generativeStore.ts`**: aggiunto `liveApply` (default **true**) e persistenza del draft in `localStorage` (`easyvj-generative-draft`) via `subscribe`, così ricaricando l'app si riprende con lo stesso `editingId` e il Salva successivo aggiorna il record.
- **`src/components/Generative/useLiveApply.ts`** (nuovo): sottoscrive il draft e, a ogni cambio dello shader, lo registra in libreria + `adoptShaderDefaults` + `publishGenerativeShader`. Scelte non ovvie: (a) **non applica al mount**, solo su modifica reale o riattivazione dell'interruttore, così aprire il pannello non sovrascrive a sorpresa l'effetto del layer selezionato; (b) digitando il nome si crea uno shader per ogni carattere, quindi i nomi precedenti orfani vengono rimossi dalla libreria — ma **solo se non corrispondono a un visual salvato** (`setSavedVisualNames`, aggiornata dal pannello), altrimenti si cancellerebbero visual veri.
- **`src/lib/sync.ts`**: `publishGenerativeShader` riusa un `BroadcastChannel` singleton invece di aprirne uno per messaggio — in live viene chiamato a ogni movimento di slider. Serve perché l'Output non conosce un visual **non ancora salvato**: senza, il layer sparirebbe dalla proiezione.
- **`src/components/ui/switch.tsx`** (nuovo, pattern shadcn su Radix) e pannello: interruttore "Applica in tempo reale", "Al layer attivo" disabilitato quando il live è attivo (con tooltip esplicativo), conferma "Salvato" temporanea sul pulsante Salva.
- Verificato nel browser: slider mosso → canvas aggiornato all'istante; aggiunta di un modulo → comparsa immediata anche nella finestra `/output` senza salvare; due Salva consecutivi aggiornano lo stesso record; dopo il reload il draft mantiene nome ed `editingId`. Type-check, lint e `npm run build` puliti.

## 2026-07-28 — Generative Lab: editor di visual generativi (moduli + GLSL live)

Nuova feature richiesta dall'utente: una sezione dedicata a creare e gestire visual generativi al momento, in stile Refik Anadol, usabili a tutto schermo o mappati su un asset/layer. Scelte concordate in brainstorming: editor ibrido (moduli no-code **+** editor GLSL live) in una sidebar a **destra**; si resta sul motore shader 2D attuale (il particellare 3D GPU-instanced è rimandato, vedi `TODO.md`); niente audio-reactive per ora; il risultato è un `Layer` normale.

**Perché si integra senza riscritture**: un visual generativo è semplicemente una sorgente GLSL nella stessa convenzione ISF-like già usata da `src/shaders/*.glsl`, quindi passa da `parseShader()` invariato ed eredita gratis palette, maschere, blend mode, corner-pin, playlist e sync. Nessuna modifica al parser né al wrapper GLSL.

- **`src/engine/generativeModules.ts`** (nuovo): catalogo di 6 moduli (Flow Field, FBM Domain Warp, Worley Cells, Wave Interference, Point Grid, Color Cycle) + `composeModuleSource()`. Decisioni non ovvie: (a) gli uniform NON sono dichiarati nei template GLSL ma emessi dalla composizione a partire dai `controls`, così i **valori correnti finiscono nei `@default`** e il parser resta l'unica fonte di verità; (b) ogni identificatore è **prefissato con l'instanceId** (`flowField1_speed`, `flowField1_noise`) per evitare collisioni tra istanze/moduli con helper omonimi, e perché nel pannello Shader gli slider risultano leggibili e raggruppati per modulo; (c) il **primo modulo dello stack assegna sempre** (`acc = c * w`) invece di applicare il blend, altrimenti un `multiply` su `acc = 0` restituirebbe nero; (d) blend di default `screen` per i moduli aggiunti, così si sommano invece di coprirsi.
- **`src/store/generativeStore.ts`** (nuovo): draft in editing con modalità `modules` (sorgente ricomposta dallo stack) o `code` (il GLSL scritto a mano è la verità e i moduli si congelano). `setSource` ha un guard sull'uguaglianza per evitare che l'editor, ri-sincronizzandosi, passi da solo in modalità codice. `randomize` muta i params in modalità moduli e riscrive i `@default` via regex in modalità codice.
- **`src/components/Generative/`** (nuovo): `GenerativeLabPanel` (contenitore + azioni), `ModuleStackEditor` (stack riordinabile con slider/colori/blend), `CodeEditorTab` (CodeMirror con `lineWrapping`), `GenerativePreview` (mini Canvas R3F), `GenerativeLibrary` (visual salvati con thumbnail).
- **`src/store/effectsStore.ts`**: aggiunte `registerShaders` (upsert per nome) e `unregisterShader` per la libreria a runtime.
- **`src/lib/persistence.ts`**: nuovo store IDB `generativeVisuals` (DB **v4**), CRUD e hook `useLoadGenerativeVisuals` (montato in Control e Output). `uniqueVisualName` deduplica i nomi perché **il nome dello shader è la sua identità** nella libreria e in `layer.shaderName`.
- **`src/lib/sync.ts`**: nuovo messaggio broadcast `{ type: 'shader' }` per registrare un visual appena salvato anche in una finestra Output già aperta.
- **`src/hooks/use-resizable-width.ts`**: opzione `edge: 'left' | 'right'` (default invariato) perché a destra il delta del drag va invertito.
- **Trappole di layout risolte** (il pannello si allargava oltre la sua larghezza): l'`<aside>` ha bisogno di `min-w-0 overflow-hidden` (i flex item hanno `min-width: auto`), il Canvas R3F della preview va ancorato in `absolute inset-0` o detta lui l'altezza ignorando l'`aspect-video`, e CodeMirror va messo in `lineWrapping` per non spingere la larghezza con le righe lunghe.
- **Dipendenze**: `@uiw/react-codemirror` + `@codemirror/lang-cpp` (highlight C-like, la migliore approssimazione per GLSL su CodeMirror 6).
- Verificato nel browser: preview live, creazione layer generativo, comparsa nel dropdown Effetto con slider auto-generati, persistenza dopo reload, rendering in `/output` e aggiornamento live via broadcast. Type-check, lint e `npm run build` puliti; nessun errore in console (resta il warning noto THREE.Clock).

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
