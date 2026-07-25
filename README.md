# EasyMap Studio

![Logo EasyMap Studio](public/logo.png)

**Live preview**: https://easymap-studio-nine.vercel.app/control

**Webapp frontend per projection mapping e performance VJ live**, pensata per essere usata sul palco: si carica l'immagine di una statua, un palco o una superficie qualsiasi, si allinea la proiezione con un corner-pin, si applicano shader GLSL generativi ritagliati automaticamente dentro i bordi del soggetto, e si proietta da una finestra dedicata sincronizzata in tempo reale con l'editor di controllo.

EasyMap Studio è nato come **esperimento estivo di collaborazione con Claude Code**, con l'obiettivo di verificare fino a che punto fosse possibile progettare e sviluppare un'applicazione completa sfruttando un workflow di sviluppo assistito dall'intelligenza artificiale, mantenendo però il pieno controllo sulle decisioni architetturali, sulla progettazione della UX e sull'implementazione tecnica.

L'obiettivo del progetto è rendere il **projection mapping semplice, intuitivo e accessibile**, anche per chi si avvicina per la prima volta a questo mondo. L'intera esperienza è stata progettata mettendo al centro **facilità d'uso, chiarezza dell'interfaccia e rapidità del workflow**, così da permettere di ottenere risultati dall'aspetto professionale con pochi passaggi e senza dover essere esperti di software complessi.

L'intera UI/UX è quindi costruita attorno a un principio fondamentale: **ridurre al minimo la curva di apprendimento**, rendendo ogni funzione facilmente individuabile, comprensibile e utilizzabile anche durante performance live.

Progetto solista, sviluppato in modo iterativo con un ciclo di lavoro rigoroso (ogni modifica documentata, verificata visivamente nel browser prima di essere considerata completa).

> Stato: in sviluppo attivo. Fase 1 (MVP) e Fase 2 (multi-layer) sostanzialmente complete; Fase 3 (audio-reactive, MIDI, DMX) da avviare.

---

## Cosa fa, in pratica

1. Carichi una foto con sfondo trasparente (o nero, con rilevamento automatico) di ciò su cui vuoi proiettare.
2. Allinei i 4 angoli dell'immagine alla superficie reale tramite corner-pin, direttamente da finestra di controllo.
3. Scegli tra oltre **35 shader GLSL** generativi/psichedelici, ognuno con parametri regolabili via slider e colori personalizzabili.
4. Componi più layer indipendenti (immagine/video/GIF), ciascuno con la propria maschera, il proprio effetto, opacità e blend mode.
5. Costruisci una **playlist di effetti** con transizioni a crossfade, per sequenze automatizzate durante il live.
6. Apri la finestra **Output** (su un secondo monitor/proiettore) che riceve lo stato in tempo reale via `BroadcastChannel`, con una modalità **Live** per decidere manualmente quando "mandare in onda" le modifiche.
7. Il progetto si salva da solo in locale (IndexedDB) e funziona anche offline (PWA), utile a bordo palco senza rete.

---

## Funzionalità disponibili

Tutto quello che puoi fare dall'editor, pannello per pannello.

### Layer e maschere

- Scena come pila di **layer indipendenti**: aggiungi, duplichi, riordini (drag&drop), rinomini, nascondi/mostri, regoli opacità e blend mode (Normal/Add/Screen/Multiply) di ognuno.
- Per ogni layer: upload di **immagine, GIF o video**, con rilevamento automatico dello sfondo opaco e slider manuale "rimuovi sfondo scuro" (luma key) per le immagini senza canale alpha.
- **Corner-pin** a 4 maniglie trascinabili per allineare la proiezione alla superficie reale, pad direzionale + zoom per spostare/ridimensionare l'intera proiezione, fit automatico al caricamento.
- **Zoom e pan della vista di anteprima**, indipendenti dall'output: utile per raggiungere le maniglie del corner-pin quando l'asset è ingrandito oltre i bordi del canvas.
- **Maschere per-layer**: forme rettangolo/ellisse (con sfumatura bordo, rotazione, inversione), più forme sommabili, oppure maschera da immagine PNG (stencil).
- **Sincronizzazione effetto** tra i layer che scegli: le modifiche a shader, parametri, size e palette del layer attivo si propagano subito a quelli spuntati.

### Effetti e palette colori

- Libreria di oltre **35 shader GLSL** generativi/psichedelici (famiglie *Halo*, *Liquid*, e altri), ognuno con parametri regolabili via slider generati automaticamente e colori assegnabili ai propri uniform.
- Opzione **"Nessun effetto"** per mostrare il contenuto grezzo del layer.
- **Palette colori** globale con 7 preset fluorescenti pronti, editor a 5 colori personalizzabile, **generatore di palette casuali armoniche**, controllo su numero di colori e intensità.

### Assets

- Caricamento diretto di immagine/GIF/video dal pannello Assets, con anteprima del file selezionato.
- Un **asset dimostrativo** è precaricato automaticamente alla primissima apertura dell'app, per poter provare subito il programma senza dover cercare un'immagine propria.

### Output e modalità Live

- Finestra **Output** dedicata (da trascinare su un secondo monitor/proiettore), sincronizzata in tempo reale con l'editor via `BroadcastChannel`.
- Modalità **Live**: le modifiche restano "in prova" nell'editor di controllo e vengono inviate all'Output solo quando premi esplicitamente "Esegui in output" — utile per sperimentare senza disturbare la proiezione dal vivo.

### Playlist

- Barra **playlist** con timeline dei clip di effetti, riordinabili e con durata regolabile trascinando il bordo del clip.
- Ogni clip mostra una **thumbnail** dell'effetto e si apre in un editor rapido (effetto, parametri, colori, size) con anteprima immediata sul layer.
- Transizioni **crossfade** (durata regolabile) o **taglio secco** tra un clip e il successivo, a scelta.
- Riproduzione con **play/pause** e **loop** on/off per ripetere la sequenza durante il live.

### Progetti, template e preset

- **Salvataggio progetti con nome**, richiamabili in qualsiasi momento, più **autosave automatico** che ripristina l'ultima sessione al riavvio.
- **Preset degli effetti**: salvi il "look" di un layer (shader + parametri + size + palette) con un nome e lo riapplichi su qualsiasi layer o progetto, anche come punto di partenza per un nuovo clip in playlist.

---

## Funzionalità principali

### Motore di rendering shader

- Parser **ISF-like** che legge uniform GLSL commentati (`// @min @max @default`) e genera automaticamente slider e color picker nell'UI — basta aggiungere un file `.glsl` per far apparire un nuovo effetto, senza toccare codice React.
- Libreria di **37 shader** originali (famiglie _Halo_, _Liquid_, generativi psichedelici) scritti/adattati per essere source-driven: reagiscono alla luminanza dell'immagine sorgente e restano sempre ritagliati dentro la sua sagoma.
- **Maschera automatica per canale alpha**, con **luma key** opzionale (rilevata automaticamente all'upload) per le immagini con sfondo nero opaco anziché trasparente.
- Palette colori globali con 7 preset fluorescenti, editor a 5 colori, generatore di **palette casuali armoniche** e colori assegnabili ai singoli parametri `vec3` di ogni shader.

### Multi-layer (stile Resolume/MadMapper)

- Scena come pila di layer indipendenti: ognuno con proprio media, effetto, corner-pin, maschere, opacità e blend mode (Normal/Add/Screen/Multiply), compositati via `CustomBlending` con alpha premoltiplicato.
- Maschere per-layer (rettangolo/ellisse con feather, rotazione, invert) o da stencil PNG, editabili direttamente sul canvas.
- Sorgenti dinamiche: immagini, **video** (`THREE.VideoTexture`) e **GIF animate** (decodifica frame via `gifuct-js`).
- Sincronizzazione dell'effetto tra layer selezionati, con propagazione live dei parametri.

### Playlist / sequencer live

- Timeline di clip riordinabili con durata trascinabile, thumbnail renderizzata offscreen per ogni effetto, transizioni **crossfade** a durata regolabile o taglio secco, loop, editor rapido per clip.

### Controllo del palco

- Corner-pin a 4 maniglie con pan/zoom di vista indipendente dall'output (per correggere il mapping anche quando l'asset è ingrandito oltre i bordi del canvas).
- Modalità **Live**: le modifiche restano "in prova" nell'editor finché non vengono inviate esplicitamente all'Output, per non disturbare la proiezione mentre si sperimenta.
- Persistenza automatica del progetto (autosave + salvataggi con nome) e libreria di preset effetto riutilizzabili tra progetti diversi.

---

## Stack tecnologico

| Ambito                 | Tecnologie                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| Framework / linguaggio | React 19, TypeScript, Vite 8                                            |
| Rendering 3D/shader    | Three.js, React Three Fiber, GLSL custom (parser ISF-like proprietario) |
| Stato globale          | Zustand (store separati per scena, effetti, palette, playlist, UI)      |
| Persistenza            | IndexedDB (`idb`), autosave con debounce                                |
| UI                     | Tailwind CSS v4, shadcn/ui (Radix), lucide-react                        |
| Sync multi-finestra    | `BroadcastChannel` API con handshake `hello`                            |
| Media                  | `THREE.VideoTexture`, `gifuct-js` per GIF animate                       |
| Offline                | `vite-plugin-pwa`                                                       |
| Routing                | react-router-dom                                                        |

---

## Architettura in breve

- **Due finestre sincronizzate**: `/control` (editor) e `/output` (proiettore, fullscreen, nessuna UI) comunicano via `BroadcastChannel`. Control pubblica lo stato della scena, Output lo specchia; una finestra Output appena aperta richiede lo stato corrente con un handshake `hello`.
- **`layersStore`** è la sorgente di verità unica della scena: un array ordinato di layer, ciascuno unità completa e autonoma (media, shader, parametri, corner-pin, maschere, mixing).
- **Corner-pin**: i 4 angoli vivono in coordinate mondo, coerenti con la geometria del piano renderizzato; l'overlay di editing converte schermo↔mondo usando lo stesso frustum della camera ortografica.
- **Maschera automatica**: il wrapper GLSL generato dal parser ISF moltiplica sempre l'alpha finale per l'alpha (o luma) della texture sorgente — ogni effetto resta confinato dentro i bordi dell'immagine, qualunque sia lo shader.
- **Shader "ISF-like"**: uniform `float`/`vec3` con commenti `@min @max @default` letti a build-time (`import.meta.glob`) → slider e color picker generati automaticamente in UI.

---

## Avvio del progetto

```bash
npm install
npm run dev
```

Altri comandi utili:

```bash
npm run build        # type-check completo + build di produzione
npx tsc -b --noEmit   # solo type-check
```

Apri `/control` per l'editor e `/output` (idealmente su un secondo monitor) per la finestra di proiezione.

---

## Roadmap

Il progetto segue una roadmap tracciata in dettaglio in `TODO.md`. Macro-fasi:

- ✅ **Fase 1 — MVP core**: upload, corner-pin, libreria shader, palette colori, preset, persistenza, layout UI.
- ✅ **Fase 2 — Multi-layer**: layer indipendenti, maschere, media dinamici (video/GIF), modalità Live, playlist con transizioni.
- ⏳ **Fase 3 — Live performance**: audio-reactive (Web Audio API + FFT), BPM sync, controller MIDI, bridge OSC/DMX, multi-output.

---

## Nota sul processo di sviluppo

Ogni modifica al codice viene registrata in `MEMORY.md` con motivazione e dettagli tecnici, e verificata visivamente in browser prima di essere considerata conclusa — un log che oggi conta oltre 15 sessioni di sviluppo documentate, utile a chi vuole ripercorrere le decisioni architetturali prese lungo il percorso (es. perché le maschere sono in spazio-corner e non UV, perché il compositing multi-layer richiede alpha premoltiplicato, come funziona il crossfade della playlist senza canali dedicati).

---

## Autore

Sviluppato da Edoardo Tunzi.

> ⭐ Se EasyMap Studio ti è stato utile o ti è piaciuto, lascia una **Star** su GitHub.
>
> 🚀 Se vuoi contribuire allo sviluppo del progetto o collaborare alla sua evoluzione, scrivimi: sarò felice di confrontarmi.
