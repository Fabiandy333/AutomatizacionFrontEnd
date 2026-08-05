import CaseRow from './CaseRow'
import LogPanel from './LogPanel'

export default function TestSection({ seccion, liveStatuses, onRunCase, showLogs = false, logLines = [] }) {
  const firstId = seccion.casos[0]?.id
  const lastId = seccion.casos[seccion.casos.length - 1]?.id

  return (
    <section className={`section ${showLogs ? 'with-log' : ''}`}>
      <div className="section-header">
        <h2>{seccion.nombre}</h2>
        <span className="case-ids">
          {firstId}
          {lastId && lastId !== firstId ? ` - ${lastId}` : ""} (
          {seccion.casos.length})
        </span>
      </div>

      <div className="section-body">
        <div className="cases-list">
          {seccion.casos.map((caso, idx) => (
            <CaseRow
              key={`${caso.id}-${idx}`}
              caso={caso}
              liveStatus={liveStatuses[`${seccion.nombre}-${caso.id}-${idx}`]}
              configTemplate={seccion.configTemplate}
              configEndpoint={seccion.configEndpoint}
              onRun={(casoRef, configPayload, backendInfo) =>
                onRunCase(seccion, casoRef, idx, configPayload, backendInfo)
              }
            />
          ))}
        </div>

        {showLogs && (
          <div className="section-log">
            <LogPanel lines={logLines} />
          </div>
        )}
      </div>
    </section>
  )
}
