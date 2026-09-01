/**
 * Avanzamento della playlist di asset. Modulo volutamente senza dipendenze (niente DOM, niente
 * store): è l'unico pezzo con dei rami veri, e così resta verificabile da riga di comando —
 * vedi `assetRotation.check.ts`.
 */

/**
 * Indice del prossimo asset, oppure -1 quando la sequenza è finita.
 *
 * Con `shuffle` il `loop` non si applica: una riproduzione casuale è per definizione un flusso
 * continuo, non una lista con una fine (nella barra il pulsante loop si disattiva di conseguenza).
 */
export function nextAssetIndex(current: number, count: number, shuffle: boolean, loop: boolean): number {
  if (count <= 0) return -1
  if (count === 1) return loop || shuffle ? 0 : -1

  if (shuffle) {
    // si pesca fra i count-1 indici diversi da quello corrente: ripetere due volte di fila la
    // stessa clip si legge come "la playlist si è piantata", non come casualità
    if (current < 0 || current >= count) return Math.floor(Math.random() * count)
    const draw = Math.floor(Math.random() * (count - 1))
    return draw >= current ? draw + 1 : draw
  }

  const next = current + 1
  if (next < count) return next
  return loop ? 0 : -1
}
