import { useState } from 'react'

// Mapea el estado tal como viene del CSV (EXITOSO / FALLIDO) al estado
// visual de la corrida en vivo. Si el usuario ya ejecuto el script en esta
// sesion, ese resultado (liveStatus) tiene prioridad sobre el historico.
function resolveBadge(estadoHistorico, liveStatus) {
  if (liveStatus === 'running') return { text: 'Ejecutando', cls: 'running' }
  if (liveStatus === 'pass') return { text: 'Exitoso', cls: 'pass' }
  if (liveStatus === 'fail') return { text: 'Fallido', cls: 'fail' }
  if (estadoHistorico === 'EXITOSO') return { text: 'Exitoso (ult. corrida)', cls: 'pass' }
  if (estadoHistorico === 'FALLIDO') return { text: 'Fallido (ult. corrida)', cls: 'fail' }
  return { text: 'Sin ejecutar', cls: 'idle' }
}

export default function CaseRow({ caso, liveStatus, onRun }) {
  const [open, setOpen] = useState(false)
  const badge = resolveBadge(caso.estado, liveStatus)
  const isRunning = liveStatus === 'running'

  return (
    <div className="case-row">
      <div className="case-row-main">
        <span className="case-id">{caso.id}</span>

        <button
          className="case-title"
          style={{ background: 'none', border: 'none', color: 'inherit', textAlign: 'left', padding: 0 }}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="icon-chevron" style={{ marginRight: 4, transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }} />
          <span className="criterio">{caso.criterio || caso.pasos.slice(0, 60)}</span>
        </button>

        <span className={`badge ${badge.cls}`}>{badge.text}</span>

        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {caso.responsableEjecucion || '-'}
        </span>

        <button
          className="run-btn"
          aria-label={`Ejecutar ${caso.id}`}
          disabled={isRunning}
          onClick={() => onRun(caso)}
        >
          <span className="icon-play" />
        </button>
      </div>

      {open && (
        <div className="case-detail">
          <div className="row"><span className="k">Pasos</span><span style={{ whiteSpace: 'pre-line' }}>{caso.pasos}</span></div>
          {caso.componente && <div className="row"><span className="k">Componente</span><span>{caso.componente}</span></div>}
          {caso.fechaEjecucion && <div className="row"><span className="k">Ultima ejecucion</span><span>{caso.fechaEjecucion}</span></div>}
          {caso.observacionError && (
            <div className="row"><span className="k">Observacion</span><span className="error">{caso.observacionError}</span></div>
          )}
          {caso.clasificacionError && (
            <div className="row"><span className="k">Severidad</span><span>{caso.clasificacionError}</span></div>
          )}
        </div>
      )}
    </div>
  )
}
