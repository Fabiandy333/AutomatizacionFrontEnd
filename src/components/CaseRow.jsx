import { useState } from 'react'
import ConfigModal from './ConfigModal'
import defaultConfigTemplate from '../data/templates/agendamiento-pasaportes.js'

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

// caso.configTemplate permite que cada caso traiga su propia plantilla
// (por ejemplo, un caso de "Agendar cita" trae la lista de usuarios a
// agendar). Si el caso no define una, se usa la plantilla generica
// importada arriba como valor por defecto.
export default function CaseRow({ caso, liveStatus, onRun }) {
  const [open, setOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  // "config" guarda la ultima version confirmada por el usuario en esta sesion,
  // para que el boton de play (sin pasar por el modal) reutilice lo ya revisado.
  const [config, setConfig] = useState(caso.configTemplate ?? defaultConfigTemplate)

  const badge = resolveBadge(caso.estado, liveStatus)
  const isRunning = liveStatus === 'running'

  function handleConfirmConfig(parsedJson) {
    setConfig(parsedJson)
    setConfigOpen(false)
    onRun(caso, parsedJson)
  }

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

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="run-btn"
            aria-label={`Configurar datos de ${caso.id}`}
            title="Ver y editar los datos antes de ejecutar"
            disabled={isRunning}
            onClick={() => setConfigOpen(true)}
          >
            <span className="icon-config" />
          </button>

          <button
            className="run-btn"
            aria-label={`Ejecutar ${caso.id}`}
            title="Ejecutar con la ultima configuracion confirmada"
            disabled={isRunning}
            onClick={() => onRun(caso, config)}
          >
            <span className="icon-play" />
          </button>
        </div>
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

      <ConfigModal
        isOpen={configOpen}
        title={`Configuracion de ejecucion - ${caso.id}`}
        description={`Estos son los datos que se enviaran al backend para ejecutar "${caso.criterio || caso.id}". Revisalos y edita lo que necesites antes de iniciar; el backend los recibira tal como queden aqui.`}
        initialData={config}
        onClose={() => setConfigOpen(false)}
        onConfirm={handleConfirmConfig}
      />
    </div>
  )
}