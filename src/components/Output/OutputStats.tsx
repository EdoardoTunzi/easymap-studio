import { useEffect, useState } from 'react'
import { getRenderStats, subscribeRenderStats, type RenderStats } from '@/engine/renderStats'

/**
 * Pannello diagnostico della finestra di proiezione.
 *
 * Esiste perché "l'immagine sembra povera" ha cause che a occhio si confondono fra loro: una
 * finestra che non copre lo schermo, un supersampling mai attivato, una GPU che non tiene il passo.
 * Sono tre numeri, e vederli scritti evita un'ora di tentativi sul palco.
 */

function formatScale(stats: RenderStats): string {
  const target = stats.bufferWidth * stats.bufferHeight
  if (target === 0) return '—'
  const ratio = (stats.renderWidth * stats.renderHeight) / target
  return `${ratio.toFixed(2)}× pixel`
}

/** Quanto dello schermo stiamo davvero usando: sotto il 100% si proietta meno di quel che si può. */
function screenUsage(stats: RenderStats): number | null {
  if (!stats.screenWidth || !stats.bufferWidth) return null
  return Math.round((stats.bufferWidth / stats.screenWidth) * 100)
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'ok' }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-white/45">{label}</span>
      <span
        className={
          tone === 'warn' ? 'text-amber-300' : tone === 'ok' ? 'text-emerald-300' : 'text-white/90'
        }
      >
        {value}
      </span>
    </div>
  )
}

export function OutputStats() {
  const [stats, setStats] = useState<RenderStats>(getRenderStats)

  useEffect(() => subscribeRenderStats(setStats), [])

  const usage = screenUsage(stats)
  const fpsLow = stats.fps > 0 && stats.fps < 50

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-50 select-none rounded-lg border border-white/10 bg-black/75 px-3.5 py-3 font-mono text-[11px] leading-relaxed backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-6 text-[10px] uppercase tracking-widest text-white/40">
        <span>Output</span>
        <span>S per nascondere</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <Row
          label="Canvas"
          value={`${stats.bufferWidth}×${stats.bufferHeight}`}
          tone={usage != null && usage < 99 ? 'warn' : undefined}
        />
        <Row label="Schermo" value={`${stats.screenWidth}×${stats.screenHeight}`} />
        <Row
          label="Pieno schermo"
          value={stats.fullscreen ? 'sì' : 'NO'}
          tone={stats.fullscreen ? 'ok' : 'warn'}
        />
        <Row label="Buffer interno" value={`${stats.renderWidth}×${stats.renderHeight}`} />
        <Row
          label="Supersampling"
          value={`${stats.superSample}× (${formatScale(stats)})`}
          tone={stats.superSample > 1 ? 'ok' : undefined}
        />
        <Row label="Precisione" value={stats.hdr ? 'half-float' : '8 bit'} />
        <Row label="Pixel ratio" value={stats.dpr.toFixed(2)} />
        <Row label="FPS" value={String(stats.fps)} tone={fpsLow ? 'warn' : 'ok'} />
      </div>
      {!stats.fullscreen && (
        <p className="mt-2 max-w-[15rem] text-[10px] leading-snug text-amber-300/80">
          La finestra non copre lo schermo: premi F. Ogni pixel non usato è risoluzione buttata.
        </p>
      )}
      {fpsLow && (
        <p className="mt-2 max-w-[15rem] text-[10px] leading-snug text-amber-300/80">
          Sotto i 50 fps: abbassa il supersampling o alleggerisci la scena.
        </p>
      )}
    </div>
  )
}
