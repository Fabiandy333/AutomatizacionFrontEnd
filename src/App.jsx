import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import MetaBar from './components/MetaBar'
import TestSection from './components/TestSection'
import LogPanel from './components/LogPanel'
import { projects, contarCasos } from './data/projects'
import { API_ENDPOINTS } from './config/api'

// Todos los planes disponibles en orden plano, para poder seleccionar
// el primero por defecto al cargar la app.
function findFirstPlan() {
  for (const p of projects) {
    const planes = p.subproyectos ? p.subproyectos.flatMap((sp) => sp.planes) : p.planes
    if (planes.length) return planes[0]
  }
  return null
}

function nowTime() {
  return new Date().toLocaleTimeString('es-CO', { hour12: false })
}

export default function App() {
  const [selectedPlan, setSelectedPlan] = useState(findFirstPlan)
  const [liveStatuses, setLiveStatuses] = useState({})
  const [logLines, setLogLines] = useState([])
  const [activeExecutions, setActiveExecutions] = useState([])
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logLines])

  useEffect(() => {
    if (activeExecutions.length === 0) return

    const interval = setInterval(async () => {
      const executionChecks = activeExecutions.map(async (entry) => {
        if (entry.status !== 'running') return entry

        try {
          const res = await fetch(API_ENDPOINTS.PASAPORTES_ESTADO(entry.executionId))
          const data = await res.json()
          const estado = (data.estado || data.status || data.state || '').toString().trim().toLowerCase()
          return { ...entry, status: estado || entry.status }
        } catch {
          return entry
        }
      })

      const updated = await Promise.all(executionChecks)
      setActiveExecutions(updated)

      updated.forEach((entry) => {
        if (entry.status === 'exitoso' || entry.status === 'fallido') {
          setLiveStatuses((prev) => ({
            ...prev,
            [entry.key]: entry.status === 'exitoso' ? 'pass' : 'fail',
          }))
        }
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [activeExecutions])

  function appendLog(text, type = 'info') {
    setLogLines((prev) => [...prev, { time: nowTime(), text, type }])
  }

  // Ejecuta un caso y se conecta al backend para recibir logs en tiempo real
  function runCase(seccion, caso, idx, configPayload, backendInfo) {
    const key = `${seccion.nombre}-${caso.id}-${idx}`
    setLiveStatuses((prev) => ({ ...prev, [key]: 'running' }))
    appendLog(`Iniciando ${caso.id} - ${caso.criterio}`)

    if (configPayload) {
      const registros = Array.isArray(configPayload) ? configPayload.length : 1
      appendLog(`Payload recibido: ${registros} registro(s) -> POST /api/run/${caso.id}`)
    }

    const executionSource = backendInfo?.ejecuciones?.[0] ?? backendInfo
    const executionId = executionSource?.executionId || executionSource?.id || executionSource?._id || executionSource?.uuid || null
    const backendStatus = executionSource?.estado || executionSource?.status || executionSource?.state || null

    if (backendStatus) {
      const normalized = backendStatus.toString().trim().toLowerCase()
      if (normalized === 'exitoso' || normalized === 'fallido') {
        setLiveStatuses((prev) => ({ ...prev, [key]: normalized === 'exitoso' ? 'pass' : 'fail' }))
      }
    }

    if (executionId) {
      setActiveExecutions((prev) => [
        ...prev.filter((entry) => entry.key !== key),
        { key, executionId, status: backendStatus?.toString().trim().toLowerCase() || 'running' },
      ])
      connectToLogs(executionId, key, caso.id)
    }
  }

  // Conecta a los logs en tiempo real del backend mediante SSE
  function connectToLogs(executionId, statusKey, caseId) {
    const eventSource = new EventSource(API_ENDPOINTS.PASAPORTES_LOGS(executionId));

    eventSource.onmessage = (event) => {
      try {
        const logEntry = JSON.parse(event.data);
        appendLog(logEntry.text || event.data, logEntry.type || 'info');
      } catch {
        appendLog(event.data, 'info');
      }
    };

    eventSource.onerror = (error) => {
      console.error('Error en conexión de logs:', error);
      
      // Intentar obtener el estado final del backend
      fetch(API_ENDPOINTS.PASAPORTES_ESTADO(executionId))
        .then(res => res.json())
        .then(data => {
          const finalStatus = data.estado === 'exitoso' ? 'pass' : data.estado === 'fallido' ? 'fail' : 'fail';
          setLiveStatuses((prev) => ({ ...prev, [statusKey]: finalStatus }));
          appendLog(
            `${finalStatus === 'pass' ? 'Caso exitoso' : 'Caso fallido'}: ${caseId}`,
            finalStatus === 'pass' ? 'ok' : 'fail'
          );
        })
        .catch(err => {
          console.error('Error al obtener estado:', err);
          appendLog(`Error: No se pudo conectar a los logs de ${caseId}`, 'fail');
          setLiveStatuses((prev) => ({ ...prev, [statusKey]: 'fail' }));
        })
        .finally(() => eventSource.close());
    };
  }

  function runAllVisible() {
    if (!selectedPlan?.data?.secciones) return
    appendLog(`Ejecutando plan completo: ${selectedPlan.nombre}`)
    let delay = 0
    selectedPlan.data.secciones.forEach((seccion) => {
      seccion.casos.forEach((caso, idx) => {
        setTimeout(() => runCase(seccion, caso, idx, null, null), delay)
        delay += 1400
      })
    })
  }

  const secciones = selectedPlan?.data?.secciones || []
  const totalCasos = selectedPlan ? contarCasos(selectedPlan) : 0

  const totalPass = Object.values(liveStatuses).filter((s) => s === 'pass').length
  const totalFail = Object.values(liveStatuses).filter((s) => s === 'fail').length
  const totalRunning = Object.values(liveStatuses).filter((s) => s === 'running').length

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        selectedPlanId={selectedPlan?.id}
        onSelectPlan={(plan) => {
          setSelectedPlan(plan)
          setLiveStatuses({})
        }}
      />

      <main className="main">
        {!selectedPlan ? (
          <p style={{ color: 'var(--text-secondary)' }}>
            Selecciona un plan de casos de prueba en el panel izquierdo.
          </p>
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
              <TestSection
                key={seccion.nombre}
                seccion={seccion}
                liveStatuses={liveStatuses}
                onRunCase={runCase}
              />
            ))}

            <div ref={logRef}>
              <LogPanel lines={logLines} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}