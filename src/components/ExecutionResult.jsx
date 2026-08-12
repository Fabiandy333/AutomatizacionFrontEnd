export default function ExecutionResult({
  result,
  onViewLogs,
  onViewEvidence,
  onDownloadReport,
  onRepeat
}) {
  if (!result) return null

  const success = result.status === 'pass'

  return (
    <div className={`execution-result ${success ? 'success' : 'failed'}`}>

      <div className="execution-result-header">

        <div className="execution-result-title">
          <span className="execution-result-icon">
            {success ? '✓' : '✕'}
          </span>

          <div>
            <h3>
              {success
                ? 'Ejecución completada'
                : 'Ejecución fallida'}
            </h3>

            <span>
              {result.caseId}
            </span>
          </div>
        </div>

        <span className={`execution-status ${success ? 'pass' : 'fail'}`}>
          {success ? 'EXITOSO' : 'FALLIDO'}
        </span>

      </div>

      <div className="execution-summary">

        <div>
          <span>Inicio</span>
          <strong>{result.startedAt || '-'}</strong>
        </div>

        <div>
          <span>Finalización</span>
          <strong>{result.finishedAt || '-'}</strong>
        </div>

        <div>
          <span>Duración</span>
          <strong>{result.duration || '-'}</strong>
        </div>

        <div>
          <span>Ambiente</span>
          <strong>{result.environment || 'QA'}</strong>
        </div>

      </div>

      <div className="execution-stats">

        <div className="execution-stat">
          <strong>{result.totalSteps || 0}</strong>
          <span>Pasos</span>
        </div>

        <div className="execution-stat success">
          <strong>{result.passedSteps || 0}</strong>
          <span>Exitosos</span>
        </div>

        <div className="execution-stat failed">
          <strong>{result.failedSteps || 0}</strong>
          <span>Fallidos</span>
        </div>

      </div>

      {result.timeline?.length > 0 && (
        <div className="execution-timeline">

          <h4>Línea de tiempo</h4>

          <div className="timeline">

            {result.timeline.map((event, index) => (
              <div
                className={`timeline-item ${event.status || ''}`}
                key={index}
              >

                <div className="timeline-marker">
                  {event.status === 'failed' ? '✕' : '✓'}
                </div>

                <div className="timeline-content">

                  <span className="timeline-time">
                    {event.time}
                  </span>

                  <strong>
                    {event.message}
                  </strong>

                  {event.detail && (
                    <p>{event.detail}</p>
                  )}

                </div>

              </div>
            ))}

          </div>

        </div>
      )}

      <div className="execution-actions">

        <button
          className="btn"
          onClick={onViewLogs}
        >
          Ver log
        </button>

        <button
          className="btn"
          onClick={onViewEvidence}
        >
          Ver evidencias
        </button>

        <button
          className="btn"
          onClick={onDownloadReport}
        >
          Descargar reporte
        </button>

        <button
          className="btn primary"
          onClick={onRepeat}
        >
          <span className="icon-play" />
          Repetir prueba
        </button>

      </div>

    </div>
  )
}