import { useEffect, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import MetaBar from './components/MetaBar';
import TestSection from './components/TestSection';
import LogPanel from './components/LogPanel';
import { projects, contarCasos } from './data/projects';
import { apiFetch, API_ENDPOINTS, API_TOKEN } from './config/api';

function findFirstPlan() {
  for (const project of projects) {
    const plans = project.subproyectos
      ? project.subproyectos.flatMap((subproject) => subproject.planes)
      : project.planes;

    if (plans.length) return plans[0];
  }

  return null;
}

function nowTime() {
  return new Date().toLocaleTimeString('es-CO', {
    hour12: false,
  });
}

function formatDateTime(date) {
  if (!date) return '-';

  return new Date(date).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

function formatDuration(start, end = Date.now()) {
  if (!start) return '-';

  const seconds = Math.max(
    0,
    Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  );

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

function isFinished(status) {
  return ['exitoso', 'fallido', 'requiere_revision'].includes(status);
}

function toLiveStatus(status) {
  return status === 'exitoso' ? 'pass' : 'fail';
}

function executionKey(seccion, caso, idx) {
  return `${seccion.nombre}-${caso.id}-${idx}`;
}

export default function App() {
  const [selectedPlan, setSelectedPlan] = useState(findFirstPlan);
  const [liveStatuses, setLiveStatuses] = useState({});
  const [logsByExecution, setLogsByExecution] = useState({});
  const [activeExecutions, setActiveExecutions] = useState([]);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  // Ejecuciones terminadas que aparecen en el resumen
  const [executionHistory, setExecutionHistory] = useState([]);
  // Ejecución actualmente seleccionada para mostrar el resumen
  const [selectedExecutionSummary, setSelectedExecutionSummary] = useState(null);
  // Para repetir una prueba
  const [lastExecutionRequest, setLastExecutionRequest] = useState(null);
  const eventSourcesRef = useRef(new Map());



  /*
   * Polling del estado de las ejecuciones
   */
  useEffect(() => {
    if (!activeExecutions.some((entry) => !isFinished(entry.status))) {
      return undefined;
    }

    const interval = setInterval(async () => {
      const updated = await Promise.all(
        activeExecutions.map(async (entry) => {
          if (isFinished(entry.status)) return entry;

          try {
            const response = await apiFetch(
              API_ENDPOINTS.PASAPORTES_ESTADO(entry.executionId)
            );

            const data = await response.json();

            const status = (
              data.estado ||
              data.status ||
              data.state ||
              ''
            )
              .toString()
              .trim()
              .toLowerCase();

            return {
              ...entry,
              status: status || entry.status,
              backendData: data,
            };
          } catch {
            return entry;
          }
        })
      );

      updated.forEach((entry) => {
        if (!isFinished(entry.status)) return;

        eventSourcesRef.current.get(entry.key)?.close();
        eventSourcesRef.current.delete(entry.key);

        const finalStatus = toLiveStatus(entry.status);

        setLiveStatuses((previous) => ({
          ...previous,
          [entry.key]: finalStatus,
        }));

        finishExecution(entry, finalStatus);
      });

      const remaining = updated.filter(
        (entry) => !isFinished(entry.status)
      );

      setActiveExecutions(remaining);

    }, 3000);

    return () => clearInterval(interval);
  }, [activeExecutions]);

  useEffect(() => {
    return () => {
      eventSourcesRef.current.forEach((source) => source.close());
      eventSourcesRef.current.clear();
    };
  }, []);

  function appendLog(executionKey, text, type = 'info') {
  setLogsByExecution((previous) => ({
    ...previous,
    [executionKey]: [
      ...(previous[executionKey] || []),
      {
        time: nowTime(),
        text,
        type
      }
    ]
  }));
}

  /*
   * Cuando termina una ejecución se construye el resumen.
   */
  function finishExecution(entry, finalStatus) {
    const finishedAt = new Date();

    const summary = {
      ...entry,

      finishedAt,
      finalStatus,

      duration: formatDuration(
        entry.startedAt,
        finishedAt
      ),

      stepsExecuted:
        entry.backendData?.pasosEjecutados ??
        entry.backendData?.stepsExecuted ??
        entry.backendData?.pasos ??
        0,

      failures:
        entry.backendData?.fallos ??
        entry.backendData?.failures ??
        (finalStatus === 'fail' ? 1 : 0),

      environment:
        entry.backendData?.ambiente ??
        entry.backendData?.environment ??
        import.meta.env.MODE ??
        'QA',
    };

    setExecutionHistory((previous) => [
      summary,
      ...previous.filter(
        (item) => item.key !== entry.key
      ),
    ]);

    setSelectedExecutionSummary(summary);

    appendLog(
      `${entry.caseId} finalizó: ${
        finalStatus === 'pass'
          ? 'EXITOSO'
          : 'FALLIDO'
      }`,
      finalStatus === 'pass' ? 'ok' : 'fail'
    );
  }

  function connectToLogs(executionId, statusKey, caseId) {
  eventSourcesRef.current.get(statusKey)?.close();

  const tokenQuery = API_TOKEN
    ? `?token=${encodeURIComponent(API_TOKEN)}`
    : '';

  const eventSource = new EventSource(
    `${API_ENDPOINTS.PASAPORTES_LOGS(executionId)}${tokenQuery}`
  );

  eventSourcesRef.current.set(statusKey, eventSource);

  eventSource.onmessage = (event) => {
    try {
      const logEntry = JSON.parse(event.data);

      appendLog(
        statusKey,
        logEntry.text || event.data,
        logEntry.type || 'info'
      );
    } catch {
      appendLog(statusKey, event.data, 'info');
    }
  };

  eventSource.onerror = () => {
    console.warn(
      `Conexión de logs interrumpida para ${caseId}; reintentando.`
    );
  };
}

  /*
   * Registra una ejecución creada por el backend.
   */
  function runCase(
    seccion,
    caso,
    idx,
    configPayload,
    backendInfo
  ) {
    const key = executionKey(
      seccion,
      caso,
      idx
    );

    const startedAt = new Date();

    setLiveStatuses((previous) => ({
      ...previous,
      [key]: 'running',
    }));

    appendLog(key,
      `Iniciando ${caso.id} - ${caso.criterio}`
    );

    if (configPayload) {
      const records = Array.isArray(configPayload)
        ? configPayload.length
        : 1;

      appendLog(key,
        `Payload recibido: ${records} registro(s)`
      );
    }

    const execution =
      backendInfo?.ejecuciones?.[0] ??
      backendInfo;

    const executionId =
      execution?.executionId ||
      execution?.id ||
      execution?._id ||
      execution?.uuid;

    const status = (
      execution?.estado ||
      execution?.status ||
      execution?.state ||
      'running'
    )
      .toString()
      .trim()
      .toLowerCase();

    const executionEntry = {
      key,
      executionId,
      status,
      startedAt,
      seccionNombre: seccion.nombre,
      casoId: caso.id,
      casoTitulo: caso.criterio,
      caso,
      configPayload,
      backendData: execution,
      environment:
        execution?.ambiente ||
        execution?.environment ||
        import.meta.env.MODE ||
        'QA',
    };

    // Guardamos la última ejecución para poder repetirla
    setLastExecutionRequest({
      seccion,
      caso,
      idx,
      configPayload,
    });

    if (isFinished(status)) {
      const finalStatus = toLiveStatus(status);

      setLiveStatuses((previous) => ({
        ...previous,
        [key]: finalStatus,
      }));

      finishExecution(
        executionEntry,
        finalStatus
      );

      return;
    }

    if (!executionId) {
      appendLog(key,
        `El backend no devolvió un identificador de ejecución para ${caso.id}`,
        'fail'
      );

      setLiveStatuses((previous) => ({
        ...previous,
        [key]: 'fail',
      }));

      finishExecution(
        executionEntry,
        'fail'
      );

      return;
    }

    setActiveExecutions((previous) => [
      ...previous.filter(
        (entry) => entry.key !== key
      ),
      executionEntry,
    ]);

    connectToLogs(
      executionId,
      key,
      caso.id
    );
  }

  /*
   * Ejecutar nuevamente la última prueba.
   */
  function repeatLastExecution() {
    if (!lastExecutionRequest) return;

    const {
      seccion,
      caso,
      idx,
      configPayload,
    } = lastExecutionRequest;

    setSelectedExecutionSummary(null);

    runCase(
      seccion,
      caso,
      idx,
      configPayload,
      {}
    );
  }

  /*
   * Ejecutar todo el plan.
   */
  async function runAllVisible() {
    if (!selectedPlan?.data?.secciones) {
      return;
    }

    setSelectedExecutionSummary(null);

    console.log(
      `Ejecutando plan completo: ${selectedPlan.nombre}`
    );

    for (const seccion of selectedPlan.data.secciones) {
      for (const [idx, caso] of seccion.casos.entries()) {
        const key = executionKey(
          seccion,
          caso,
          idx
        );

        const endpoint =
          caso.configEndpoint ??
          seccion.configEndpoint;

        const payload =
          caso.configTemplate ??
          seccion.configTemplate ??
          [];

        if (!endpoint) {
          appendLog(key,
            `No hay endpoint configurado para ${caso.id}`,
            'fail'
          );

          setLiveStatuses((previous) => ({
            ...previous,
            [key]: 'fail',
          }));

          continue;
        }

        try {
          const response = await apiFetch(
            endpoint,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify(
                payload
              ),
            }
          );

          const backendInfo =
            await response.json();

          if (!response.ok) {
            throw new Error(
              backendInfo.error ||
                `El servidor respondió ${response.status}`
            );
          }

          runCase(
            seccion,
            caso,
            idx,
            payload,
            backendInfo
          );
        } catch (error) {
          appendLog(
            key,
            `No se pudo iniciar ${caso.id}: ${error.message}`,
            'fail'
          );

          setLiveStatuses((previous) => ({
            ...previous,
            [key]: 'fail',
          }));
        }
      }
    }
  }

  /*
   * Descargar reporte.
   *
   * Si posteriormente tienes un endpoint real de reportes,
   * solamente cambia la URL aquí.
   */
  async function downloadReport(summary) {
    if (!summary) return;

    try {
      const report = {
        caso: summary.casoId,
        criterio: summary.casoTitulo,
        ejecucion: summary.executionId,
        estado: summary.finalStatus,
        inicio: summary.startedAt,
        finalizacion: summary.finishedAt,
        duracion: summary.duration,
        ambiente: summary.environment,
        pasosEjecutados: summary.stepsExecuted,
        fallos: summary.failures,
      };

      const blob = new Blob(
        [JSON.stringify(report, null, 2)],
        {
          type: 'application/json',
        }
      );

      const url =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      link.href = url;
      link.download = `reporte-${summary.casoId}.json`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      appendLog(
        `No se pudo descargar el reporte: ${error.message}`,
        'fail'
      );
    }
  }

  /*
   * Evidencias.
   *
   * Si el backend devuelve una URL de evidencia,
   * se abre automáticamente.
   */
  function viewEvidence(summary) {
    if (!summary) return;

    const evidenceUrl =
      summary.backendData?.evidenciasUrl ||
      summary.backendData?.evidenceUrl ||
      summary.backendData?.evidenciaUrl;

    if (evidenceUrl) {
      window.open(
        evidenceUrl,
        '_blank',
        'noopener,noreferrer'
      );

      return;
    }

    appendLog(
      `No hay evidencias disponibles para ${summary.casoId}`,
      'info'
    );
  }

  const secciones =
    selectedPlan?.data?.secciones || [];

  const totalCasos = selectedPlan
    ? contarCasos(selectedPlan)
    : 0;

  const totalPass =
    Object.values(liveStatuses).filter(
      (status) => status === 'pass'
    ).length;

  const totalFail =
    Object.values(liveStatuses).filter(
      (status) => status === 'fail'
    ).length;

  const totalRunning =
    Object.values(liveStatuses).filter(
      (status) => status === 'running'
    ).length;

  return (
    <div
      className={`app-shell ${
        sidebarVisible ? '' : 'collapsed'
      }`}
    >
      <Sidebar
        projects={projects}
        selectedPlanId={selectedPlan?.id}
        onSelectPlan={(plan) => {
          eventSourcesRef.current.forEach(
            (source) => source.close()
          );

          eventSourcesRef.current.clear();

          setSelectedPlan(plan);
          setLiveStatuses({});
          setActiveExecutions([]);
          setExecutionHistory([]);
          setSelectedExecutionSummary(null);
          setLogLines([]);
        }}
        onToggle={() =>
          setSidebarVisible((v) => !v)
        }
        collapsed={!sidebarVisible}
      />

      <main className="main">
        {!selectedPlan ? (
          <p
            style={{
              color:
                'var(--text-secondary)',
            }}
          >
            Selecciona un plan de casos de
            prueba en el panel izquierdo.
          </p>
        ) : (
          <>
            <div className="main-header">
              <h1>
                {selectedPlan.nombre}
              </h1>

              <p className="subtitle">
                {totalCasos} casos de prueba en{' '}
                {secciones.length} secciones
              </p>
            </div>

            <MetaBar
              meta={selectedPlan.data?.meta}
            />

            <div className="toolbar">
              <div className="summary-pills">
                <span className="pill pass">
                  Exitosos {totalPass}
                </span>

                <span className="pill fail">
                  Fallidos {totalFail}
                </span>

                {totalRunning > 0 && (
                  <span className="pill idle">
                    Ejecutando {totalRunning}
                  </span>
                )}
              </div>

              <button
                className="btn primary"
                onClick={runAllVisible}
              >
                <span className="icon-play" />
                Ejecutar plan completo
              </button>
            </div>

            {/*
             * RESUMEN DE EJECUCIÓN
             */}
            {selectedExecutionSummary && (
              <section className="execution-summary">
                <div className="execution-summary-header">
                  <div>
                    <div className="execution-summary-kicker">
                      EJECUCIÓN FINALIZADA
                    </div>

                    <h2>
                      {selectedExecutionSummary.casoId}
                    </h2>

                    <p>
                      {selectedExecutionSummary.casoTitulo}
                    </p>
                  </div>

                  <span
                    className={`execution-result ${
                      selectedExecutionSummary.finalStatus
                    }`}
                  >
                    {selectedExecutionSummary.finalStatus ===
                    'pass'
                      ? '✓ EXITOSO'
                      : '✕ FALLIDO'}
                  </span>
                </div>

                <div className="execution-timeline">
                  <div className="timeline-line" />

                  <div className="timeline-item">
                    <span className="timeline-dot" />

                    <div>
                      <strong>
                        Ejecución iniciada
                      </strong>

                      <span>
                        {formatDateTime(
                          selectedExecutionSummary.startedAt
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="timeline-item">
                    <span className="timeline-dot" />

                    <div>
                      <strong>
                        Ejecución finalizada
                      </strong>

                      <span>
                        {formatDateTime(
                          selectedExecutionSummary.finishedAt
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="execution-metrics">
                  <div className="execution-metric">
                    <span>Duración</span>
                    <strong>
                      {selectedExecutionSummary.duration}
                    </strong>
                  </div>

                  <div className="execution-metric">
                    <span>Ambiente</span>
                    <strong>
                      {selectedExecutionSummary.environment}
                    </strong>
                  </div>

                  <div className="execution-metric">
                    <span>Pasos ejecutados</span>
                    <strong>
                      {selectedExecutionSummary.stepsExecuted}
                    </strong>
                  </div>

                  <div className="execution-metric">
                    <span>Fallos</span>
                    <strong
                      className={
                        selectedExecutionSummary.failures > 0
                          ? 'metric-danger'
                          : ''
                      }
                    >
                      {selectedExecutionSummary.failures}
                    </strong>
                  </div>
                </div>

                <div className="execution-actions">
                  <button
                    className="btn"
                    onClick={() => {
                      setVisibleLogSection(
                        selectedExecutionSummary.seccionNombre
                      );

                      window.scrollTo({
                        top: document.body.scrollHeight,
                        behavior: 'smooth',
                      });
                    }}
                  >
                    Ver log
                  </button>

                  <button
                    className="btn"
                    onClick={() =>
                      viewEvidence(
                        selectedExecutionSummary
                      )
                    }
                  >
                    Ver evidencias
                  </button>

                  <button
                    className="btn"
                    onClick={() =>
                      downloadReport(
                        selectedExecutionSummary
                      )
                    }
                  >
                    Descargar reporte
                  </button>

                  <button
                    className="btn primary"
                    onClick={repeatLastExecution}
                  >
                    <span className="icon-play" />
                    Repetir prueba
                  </button>
                </div>
              </section>
            )}

            {/*
             * Historial reciente
             */}
            {executionHistory.length > 0 && (
              <section className="execution-history">
                <div className="execution-history-header">
                  <h3>
                    Historial de ejecuciones
                  </h3>

                  <span>
                    {executionHistory.length} ejecución
                    {executionHistory.length !== 1
                      ? 'es'
                      : ''}
                  </span>
                </div>

                <div className="execution-history-list">
                  {executionHistory
                    .slice(0, 5)
                    .map((execution) => (
                      <button
                        key={`${execution.key}-${execution.finishedAt}`}
                        className="execution-history-item"
                        onClick={() =>
                          setSelectedExecutionSummary(
                            execution
                          )
                        }
                      >
                        <span
                          className={`history-status ${
                            execution.finalStatus
                          }`}
                        />

                        <span className="history-case">
                          {execution.casoId}
                        </span>

                        <span className="history-date">
                          {formatDateTime(
                            execution.finishedAt
                          )}
                        </span>

                        <span className="history-duration">
                          {execution.duration}
                        </span>

                        <span
                          className={`history-result ${
                            execution.finalStatus
                          }`}
                        >
                          {execution.finalStatus ===
                          'pass'
                            ? 'Exitoso'
                            : 'Fallido'}
                        </span>
                      </button>
                    ))}
                </div>
              </section>
            )}

            {secciones.map((seccion) => (
              <TestSection
  key={seccion.nombre}
  seccion={seccion}
  liveStatuses={liveStatuses}
  onRunCase={runCase}
  logsByExecution={logsByExecution}
/>

            ))}
          </>
        )}
      </main>

      {!sidebarVisible && (
        <button
          className="sidebar-open-btn"
          onClick={() =>
            setSidebarVisible(true)
          }
          aria-label="Mostrar sidebar"
        >
          ☰
        </button>
      )}
    </div>
  );
}