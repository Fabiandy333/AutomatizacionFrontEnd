import { useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import MetaBar from './components/MetaBar'
import TestSection from './components/TestSection'
import LogPanel from './components/LogPanel'
import { projects, contarCasos } from './data/projects'

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
  const logRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logLines])

  function appendLog(text, type = 'info') {
    setLogLines((prev) => [...prev, { time: nowTime(), text, type }])
  }

  // Simula la ejecucion de un caso de prueba. En un backend real, esto
  // dispararia una llamada HTTP (POST con configPayload en el body) que
  // corre el script de Playwright correspondiente y transmite el log por
  // WebSocket/SSE. configPayload es el JSON que el usuario confirmo en el
  // modal de configuracion (o la ultima version ya confirmada).
  function runCase(seccion, caso, idx, configPayload) {
    const key = `${seccion.nombre}-${caso.id}-${idx}`
    setLiveStatuses((prev) => ({ ...prev, [key]: 'running' }))
    appendLog(`Iniciando ${caso.id} - ${caso.criterio}`)

    if (configPayload) {
      const registros = Array.isArray(configPayload) ? configPayload.length : 1
      appendLog(`Payload recibido: ${registros} registro(s) -> POST /api/run/${caso.id}`)
    }

    setTimeout(() => {
      appendLog(`Ejecutando pasos: ${caso.pasos.split('\n')[0]}`)
    }, 400)

    setTimeout(() => {
      // Si el ultimo estado historico fue FALLIDO, se simula que sigue fallando
      // (hasta que un backend real confirme lo contrario)
      const willFail = caso.estado === 'FALLIDO'
      const finalStatus = willFail ? 'fail' : 'pass'
      setLiveStatuses((prev) => ({ ...prev, [key]: finalStatus }))
      appendLog(
        `${finalStatus === 'pass' ? 'Caso exitoso' : 'Caso fallido'}: ${caso.id}`,
        finalStatus === 'pass' ? 'ok' : 'fail'
      )
    }, 1100)
  }

  function runAllVisible() {
    if (!selectedPlan?.data?.secciones) return
    appendLog(`Ejecutando plan completo: ${selectedPlan.nombre}`)
    let delay = 0
    selectedPlan.data.secciones.forEach((seccion) => {
      seccion.casos.forEach((caso, idx) => {
        setTimeout(() => runCase(seccion, caso, idx), delay)
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