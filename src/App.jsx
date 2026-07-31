import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import MetaBar from './components/MetaBar'
import TestSection from './components/TestSection'
import LogPanel from './components/LogPanel'
import { projects, contarCasos } from './data/projects'
import { API_ENDPOINTS } from './config/api'

function findFirstPlan() {
  for (const project of projects) {
    const plans = project.subproyectos ? project.subproyectos.flatMap((subproject) => subproject.planes) : project.planes
    if (plans.length) return plans[0]
  }
  return null
}

function nowTime() {
  return new Date().toLocaleTimeString('es-CO', { hour12: false })
}

function isFinished(status) {
  return ['exitoso', 'fallido', 'requiere_revision'].includes(status)
}

function toLiveStatus(status) {
  return status === 'exitoso' ? 'pass' : 'fail'
}

function executionKey(seccion, caso, idx) {
  return `${seccion.nombre}-${caso.id}-${idx}`
}

export default function App() {
  const [selectedPlan, setSelectedPlan] = useState(findFirstPlan)
  const [liveStatuses, setLiveStatuses] = useState({})
  const [logLines, setLogLines] = useState([])
  const [activeExecutions, setActiveExecutions] = useState([])
  const logRef = useRef(null)
  const eventSourcesRef = useRef(new Map())

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logLines])

  useEffect(() => {
    if (!activeExecutions.some((entry) => !isFinished(entry.status))) return

    const interval = setInterval(async () => {
      const updated = await Promise.all(activeExecutions.map(async (entry) => {
        if (isFinished(entry.status)) return entry

        try {
          const response = await fetch(API_ENDPOINTS.PASAPORTES_ESTADO(entry.executionId))
          const data = await response.json()
          const status = (data.estado || data.status || data.state || '').toString().trim().toLowerCase()
          return { ...entry, status: status || entry.status }
        } catch {
          return entry
        }
      }))

      updated.forEach((entry) => {
        if (!isFinished(entry.status)) return
        eventSourcesRef.current.get(entry.key)?.close()
        eventSourcesRef.current.delete(entry.key)
        setLiveStatuses((previous) => ({ ...previous, [entry.key]: toLiveStatus(entry.status) }))
      })
      setActiveExecutions(updated.filter((entry) => !isFinished(entry.status)))
    }, 3000)

    return () => clearInterval(interval)
  }, [activeExecutions])

  useEffect(() => () => {
    eventSourcesRef.current.forEach((source) => source.close())
    eventSourcesRef.current.clear()
  }, [])

  function appendLog(text, type = 'info') {
    setLogLines((previous) => [...previous, { time: nowTime(), text, type }])
  }

  function connectToLogs(executionId, statusKey, caseId) {
    eventSourcesRef.current.get(statusKey)?.close()
    const eventSource = new EventSource(API_ENDPOINTS.PASAPORTES_LOGS(executionId))
    eventSourcesRef.current.set(statusKey, eventSource)

    eventSource.onmessage = (event) => {
      try {
        const logEntry = JSON.parse(event.data)
        appendLog(logEntry.text || event.data, logEntry.type || 'info')
      } catch {
        appendLog(event.data, 'info')
      }
    }

    eventSource.onerror = () => {
      // EventSource reintenta automáticamente; el polling confirma el estado final.
      console.warn(`Conexión de logs interrumpida para ${caseId}; reintentando.`)
    }
  }

  // Registra una ejecución ya creada por el backend y conecta sus actualizaciones.
  function runCase(seccion, caso, idx, configPayload, backendInfo) {
    const key = executionKey(seccion, caso, idx)
    setLiveStatuses((previous) => ({ ...previous, [key]: 'running' }))
    appendLog(`Iniciando ${caso.id} - ${caso.criterio}`)

    if (configPayload) {
      const records = Array.isArray(configPayload) ? configPayload.length : 1
      appendLog(`Payload recibido: ${records} registro(s)`)
    }

    const execution = backendInfo?.ejecuciones?.[0] ?? backendInfo
    const executionId = execution?.executionId || execution?.id || execution?._id || execution?.uuid
    const status = (execution?.estado || execution?.status || execution?.state || 'running').toString().trim().toLowerCase()

    if (isFinished(status)) {
      setLiveStatuses((previous) => ({ ...previous, [key]: toLiveStatus(status) }))
      return
    }
    if (!executionId) {
      appendLog(`El backend no devolvió un identificador de ejecución para ${caso.id}`, 'fail')
      setLiveStatuses((previous) => ({ ...previous, [key]: 'fail' }))
      return
    }

    setActiveExecutions((previous) => [
      ...previous.filter((entry) => entry.key !== key),
      { key, executionId, status },
    ])
    connectToLogs(executionId, key, caso.id)
  }

  async function runAllVisible() {
    if (!selectedPlan?.data?.secciones) return
    appendLog(`Ejecutando plan completo: ${selectedPlan.nombre}`)

    for (const seccion of selectedPlan.data.secciones) {
      for (const [idx, caso] of seccion.casos.entries()) {
        const key = executionKey(seccion, caso, idx)
        const endpoint = caso.configEndpoint ?? seccion.configEndpoint
        const payload = caso.configTemplate ?? seccion.configTemplate ?? {}

        if (!endpoint) {
          appendLog(`No hay endpoint configurado para ${caso.id}`, 'fail')
          setLiveStatuses((previous) => ({ ...previous, [key]: 'fail' }))
          continue
        }

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const backendInfo = await response.json()
          if (!response.ok) throw new Error(backendInfo.error || `El servidor respondió ${response.status}`)
          runCase(seccion, caso, idx, payload, backendInfo)
        } catch (error) {
          appendLog(`No se pudo iniciar ${caso.id}: ${error.message}`, 'fail')
          setLiveStatuses((previous) => ({ ...previous, [key]: 'fail' }))
        }
      }
    }
  }

  const secciones = selectedPlan?.data?.secciones || []
  const totalCasos = selectedPlan ? contarCasos(selectedPlan) : 0
  const totalPass = Object.values(liveStatuses).filter((status) => status === 'pass').length
  const totalFail = Object.values(liveStatuses).filter((status) => status === 'fail').length
  const totalRunning = Object.values(liveStatuses).filter((status) => status === 'running').length

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        selectedPlanId={selectedPlan?.id}
        onSelectPlan={(plan) => {
          eventSourcesRef.current.forEach((source) => source.close())
          eventSourcesRef.current.clear()
          setSelectedPlan(plan)
          setLiveStatuses({})
          setActiveExecutions([])
        }}
      />

      <main className="main">
        {!selectedPlan ? (
          <p style={{ color: 'var(--text-secondary)' }}>Selecciona un plan de casos de prueba en el panel izquierdo.</p>
        ) : (
          <>
            <div className="main-header">
              <h1>{selectedPlan.nombre}</h1>
              <p className="subtitle">{totalCasos} casos de prueba en {secciones.length} secciones</p>
            </div>
            <MetaBar meta={selectedPlan.data?.meta} />
            <div className="toolbar">
              <div className="summary-pills">
                <span className="pill pass">Exitosos {totalPass}</span>
                <span className="pill fail">Fallidos {totalFail}</span>
                {totalRunning > 0 && <span className="pill idle">Ejecutando {totalRunning}</span>}
              </div>
              <button className="btn primary" onClick={runAllVisible}>
                <span className="icon-play" /> Ejecutar plan completo
              </button>
            </div>
            {secciones.map((seccion) => (
              <TestSection key={seccion.nombre} seccion={seccion} liveStatuses={liveStatuses} onRunCase={runCase} />
            ))}
            <div ref={logRef}><LogPanel lines={logLines} /></div>
          </>
        )}
      </main>
    </div>
  )
}
