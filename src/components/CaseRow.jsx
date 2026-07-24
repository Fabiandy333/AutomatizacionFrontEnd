import { useState, useEffect } from 'react'
import ConfigModal from './ConfigModal'
import OtpModal from './OtpModal'

 const API_BASE = 'http://localhost:3000/api/pasaportes'
 const POLL_INTERVAL_MS = 3000

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
export default function CaseRow({ caso, liveStatus, configTemplate, configEndpoint, onRun }) {
  const [open, setOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  // "config" guarda la ultima version confirmada por el usuario en esta sesion,
  // para que el boton de play (sin pasar por el modal) reutilice lo ya revisado.
  const [config, setConfig] = useState(caso.configTemplate ?? configTemplate ?? {})
  const [ejecucionesActivas, setEjecucionesActivas] = useState([]) // [{ executionId, email, estado }]
  const [otpActivo, setOtpActivo] = useState(null) // { executionId, email } | null

  const badge = resolveBadge(caso.estado, liveStatus)
  const isRunning = liveStatus === 'running'

  function handleConfirmConfig(resultado) {
    const configPayload = resultado.payload ?? resultado;
    const backendInfo = resultado.backend;
    setConfig(configPayload);
    setConfigOpen(false);
    onRun(caso, configPayload, backendInfo);

    // Arma la lista de ejecuciones a monitorear (soporta 1 usuario o el lote completo)
     if (backendInfo) {
       const nuevas = backendInfo.ejecuciones
         ? backendInfo.ejecuciones.map((e) => ({ executionId: e.executionId, email: e.email, estado: 'pendiente' }))
         : [{ executionId: backendInfo.executionId, email: backendInfo.email, estado: 'pendiente' }]
       setEjecucionesActivas(nuevas)
     }

  }
// Poll del estado de cada ejecucion activa. Cuando alguna llega a
   // "esperando_otp" y todavia no se le mostro el modal, lo abre.
   useEffect(() => {
     if (ejecucionesActivas.length === 0) return
     const interval = setInterval(async () => {
       const actualizadas = await Promise.all(
         ejecucionesActivas.map(async (ej) => {
           try {
             const res = await fetch(`${API_BASE}/${ej.executionId}/estado`)
             const data = await res.json()
             return { ...ej, estado: data.estado }
           } catch {
             return ej
           }
         })
       )
       setEjecucionesActivas(actualizadas)

       if (!otpActivo) {
         const siguiente = actualizadas.find((ej) => ej.estado === 'esperando_otp')
         if (siguiente) setOtpActivo(siguiente)
       }

       // Deja de monitorear las que ya terminaron
       const todasTerminaron = actualizadas.every((ej) => ['exitoso', 'fallido', 'requiere_revision'].includes(ej.estado))
       if (todasTerminaron) clearInterval(interval)
     }, POLL_INTERVAL_MS)

     return () => clearInterval(interval)
   }, [ejecucionesActivas.length, otpActivo])




  return (
    <div className="case-row">
      <div className="case-row-main">
        <span className="case-id">{caso.id}</span>

        <button
          className="case-title"
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            textAlign: "left",
            padding: 0,
          }}
          onClick={() => setOpen((v) => !v)}
        >
          <span
            className="icon-chevron"
            style={{
              marginRight: 4,
              transform: open ? "rotate(90deg)" : "none",
              display: "inline-block",
            }}
          />
          <span className="criterio">
            {caso.criterio || caso.pasos.slice(0, 60)}
          </span>
        </button>

        <span className={`badge ${badge.cls}`}>{badge.text}</span>

        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {caso.responsableEjecucion || "-"}
        </span>

        <div style={{ display: "flex", gap: 6 }}>
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
          <div className="row">
            <span className="k">Pasos</span>
            <span style={{ whiteSpace: "pre-line" }}>{caso.pasos}</span>
          </div>
          {caso.componente && (
            <div className="row">
              <span className="k">Componente</span>
              <span>{caso.componente}</span>
            </div>
          )}
          {caso.fechaEjecucion && (
            <div className="row">
              <span className="k">Ultima ejecucion</span>
              <span>{caso.fechaEjecucion}</span>
            </div>
          )}
          {caso.observacionError && (
            <div className="row">
              <span className="k">Observacion</span>
              <span className="error">{caso.observacionError}</span>
            </div>
          )}
          {caso.clasificacionError && (
            <div className="row">
              <span className="k">Severidad</span>
              <span>{caso.clasificacionError}</span>
            </div>
          )}
        </div>
      )}

      <ConfigModal
        isOpen={configOpen}
        title={`Configuracion de ejecucion - ${caso.id}`}
        description={`...`}
        initialData={config}
        endpoint={caso.configEndpoint ?? configEndpoint}
        onClose={() => setConfigOpen(false)}
        onConfirm={handleConfirmConfig}
      />
     <OtpModal
       isOpen={!!otpActivo}
       email={otpActivo?.email}
       executionId={otpActivo?.executionId}
       apiBase={API_BASE}
       onClose={() => setOtpActivo(null)}
       onSubmitted={() => setOtpActivo(null)}
     />
    </div>
  );
}