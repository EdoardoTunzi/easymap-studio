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
- [x] Installare shadcn/ui (Vite + Tailwind v4) e ricostruire i pannelli di controllo
- [x] Ristrutturare il layout ispirato allo screenshot MAPSHROOM (top toolbar MOVE/SHADER/ASSETS/OUTPUT + pannello sinistro a sezioni + canvas)
- [x] Controller MOVE: transform globale (zoom + pan) su store/mesh/sync/persistence + pannello con pad direzionale e slider zoom; corner-pin overlay che segue il transform
- [x] Libreria di 22 shader psichedelici (auto-load via import.meta.glob) + slider Size globale (uScale) valido per tutti gli effetti
- [x] Garantire il ritaglio dell'effetto dentro i bordi immagine anche al cambio shader (fix texture ref in ShaderPlane)
- [x] Luma key per asset con sfondo nero opaco: uniform uLumaKey + auto-rilevamento opacità all'upload + slider "Rimuovi sfondo scuro"
- [x] Fix metallic3dFluid.glsl (aggiunte node_noise/node_rand mancanti dal runtime MAPSHROOM)
- [x] 10 varianti in stile Symmetrical Halo Swirl (file halo*.glsl, source-driven + blend per luminanza)
- [x] Supporto uniform vec3 nel parser ISF (colorControls) + fix 3D Surface Morph Spirals (spiralColor restava nero)
- [x] Sistema palette colori (gradient map globale): 7 preset fluorescenti caldi + editor color picker + intensità, valido per ogni shader (tab Palette)
- [x] Preset degli effetti: salva/carica il look (shader + parametri + size + palette) su IndexedDB (store effectPresets, DB v2), pannello nel tab Shader
- [x] Sidebar shadcn (Provider/Sidebar/Inset) con collapse nativo (SidebarTrigger) e resize via drag handle (localStorage, min 240/max 520px). Toolbar Move/Shader/Palette/Assets/Output spostata dentro SidebarInset, brand EASYVJ in SidebarHeader
- [x] Toggle visibilità dei riferimenti di mapping (pulsante occhio nella toolbar del canvas): nasconde cornice corner-pin e maniglie/forme mask per valutare l'effetto senza sovrapposizioni. Solo in Control, l'Output non li disegna mai
- [x] Zoom/pan della vista di anteprima in Control (rotellina + pulsanti + Spazio/click centrale per il pan), puramente visivo — non altera corners/transform, l'Output non ne risente mai. Risolve le maniglie del corner-pin irraggiungibili quando l'asset è ingrandito oltre i bordi del canvas
- [ ] Definire la palette colori dell'app (rimandata: per ora tema neutro shadcn dark)
- [ ] Drag diretto dell'immagine sul canvas in modalità MOVE (ora il pan è solo da pad direzionale / trascinamento del quad corner-pin)
- [x] Toolbar di mapping sul canvas (in basso a sinistra): spostamento fine da tastiera sull'angolo selezionato (passo fine/medio/grande, Shift ×5), rotazione ±90° e ±1°, scala non uniforme, flip H/V, raddrizza, lucchetto del mapping, griglia con snap, test pattern di calibrazione visibile anche in Output. Rotazione/scala/flip agiscono sui corner (`src/lib/mappingGeometry.ts`), non su `Transform`: nessuna modifica a shader, persistence e sync
- [x] Timeline in basso come nello screenshot MAPSHROOM (barra playlist)
- [x] Pannello destro: ora è l'**ispettore del layer** (lista layer fissa + Proprietà/Asset/Mask/Move richiudibili, tutti riferiti al layer selezionato), collassabile e ridimensionabile. La sidebar sinistra resta al look e al progetto (Shader, Palette, Progetti, Output)
- [x] Pannello live: controlli globali per-layer validi per QUALSIASI shader (velocità, rotazione, pan, kaleidoscopio, mirror X/Y, pixelate, luminosità, contrasto, saturazione, posterize, negativo) — implementati nel wrapper GLSL (`easyvj_fxUv`/`easyvj_fxColor`), UI in `FxControlsPanel`
- [x] 30 shader psytrance/techno (`src/shaders/psy*.glsl`): libreria da 41 a 71 effetti, tutti verificati in compilazione WebGL
- [x] 20 shader "Morph" source-driven (`src/shaders/morph*.glsl`) sulla scia di 3D Surface Morph Spirals: la luminanza dell'asset fa da mappa di quota (`lum * morphDepth`) e deforma la geometria dell'effetto. Libreria a 91 effetti; provino verificato renderizzandoli con l'asset reale, non con la texture di fallback
- [x] Palette casuale con numero di colori selezionabile (2–5) e schemi di armonia (analoga/complementare/triadica/split/monocromatica), disponibile sia nel pannello Palette sia in quello Shader
- [x] Shader "Emboss Light Pro" (`src/shaders/embossLightPro.glsl`): rilievo dai gradienti dell'immagine con una sorgente di luce animata che si muove in cerchio, colore della luce personalizzabile. Fornito già pronto dall'utente, aggiunto senza modifiche funzionali
- [x] 10 shader "SD" (`src/shaders/sd*.glsl`): source-driven di seconda generazione che, oltre alla luminanza, usano il **gradiente** dell'immagine (la pendenza locale) per orientare i pattern lungo le curve dell'oggetto, warpare le trame sui fianchi e illuminare la superficie apparente. 11-12 controlli ciascuno, incluso il raggio di campionamento del rilievo e l'angolo della luce. Libreria a 97 effetti
- [x] Shader "Morph Pulse Beacon" (`src/shaders/morphPulseBeacon.glsl`): campo radiale pulsante con interferenza, tradotto dal formato uniform del runtime MAPSHROOM (`tex`/`fparams`/`ftime`...) alla convenzione ISF-like del progetto, poi reso source-driven come la famiglia Morph — la luminanza dell'asset deforma il raggio del campo (`morphDepth`), così il pattern segue i rilievi della statua invece di sovrapporsi come un piano piatto
- [ ] Valutare se includere `FxControls` in `EffectSnapshot` (ora sono per-layer, quindi preset e clip della playlist non li catturano — scelta voluta: non si azzerano a ogni transizione)
- [ ] Import shader GLSL da parte dell'utente
- [x] Color picker UI per gli uniform vec3 dei singoli shader (sezione "Colori effetto" nel pannello Shader e nell'editor clip; per-layer in colorParams, incluso in preset/playlist/crossfade/thumbnail)
- [x] 10 shader "Liquid" sulla scia di 3D Surface Morph Spirals (file liquid*.glsl, source-driven con morph da luminanza e uniform colore)
- [x] Generatore casuale di palette (bottone "Palette casuale" nel pannello Palette: 5 colori HSL armonici scuro→acceso, attiva la palette)
- [ ] Palette memorizzata per-shader (ora è per-layer) + salvataggio di palette custom dell'utente
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
- [ ] Editor maschera manuale di rifinitura (per bordi imperfetti)
- [ ] Opzione "tratta il nero come trasparente" (luminance key) per immagini senza canale alpha
- [ ] Warp proiettivo vero (omografia nello shader o mesh suddivisa) — il warp attuale a 2 triangoli può creare una piega diagonale con deformazioni estreme
- [ ] Rimozione sfondo automatica (client-side ML o servizio esterno — decisione rimandata, per ora si caricano PNG già scontornati)

## Fase 3 — Live performance

- [ ] Audio reactive: Web Audio API (microfono + FFT → uniform negli shader)
- [ ] BPM sync / tap tempo
- [ ] MIDI controller (Web MIDI API) con mapping parametri
- [ ] Bridge OSC/DMX (richiede servizio Node locale: il browser non parla UDP)
- [ ] Multi-output / più superfici indipendenti nella stessa scena

## Manutenzione / debito tecnico

- [x] Fix `npm run build`: alzato `workbox.maximumFileSizeToCacheInBytes` a 10 MB in `vite.config.ts` per precachare `default-stage.png` (7.1 MB), sopra il limite di default 2 MB di vite-plugin-pwa
- [ ] Recuperare la versione integrale dello shader Symmetrical Halo Swirl (l'originale fornito era troncato a metà loop; completato in modo minimale)
- [ ] Deprecation warning THREE.Clock (da @react-three/fiber, non bloccante — attendere fix upstream)
- [ ] Valutare test automatici (vitest) per parser ISF e persistence
- [ ] Rimuovere da `package.json` le dipendenze non più importate da `src/`: `@uiw/react-codemirror`, `@codemirror/lang-cpp`
