# MEMORY — Registro modifiche EasyMap Studio

Ogni modifica al progetto va registrata qui con data, descrizione e motivazione. Le voci più recenti in alto dentro ogni giornata.

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
