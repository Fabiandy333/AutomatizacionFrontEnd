import { useEffect, useRef, useState } from "react";

import Sidebar from "./components/Sidebar";
import MetaBar from "./components/MetaBar";
import TestSection from "./components/TestSection";

import { projects, contarCasos } from "./data/projects";

import { apiFetch, API_ENDPOINTS, API_TOKEN } from "./config/api";

function findFirstPlan() {
  for (const project of projects) {
    const plans = project.subproyectos
      ? project.subproyectos.flatMap((subproject) => subproject.planes)
      : project.planes;

    if (plans.length) {
      return plans[0];
    }
  }

  return null;
}

function nowTime() {
  return new Date().toLocaleTimeString("es-CO", {
    hour12: false,
  });
}

function formatDateTime(date) {
  if (!date) return "-";

  return new Date(date).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function formatDuration(start, end = Date.now()) {
  if (!start) return "-";

  const seconds = Math.max(
    0,
    Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000),
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
  return ["exitoso", "fallido", "requiere_revision"].includes(
    String(status || "").toLowerCase(),
  );
}

function toLiveStatus(status) {
  return String(status || "").toLowerCase() === "exitoso" ? "pass" : "fail";
}

function executionKey(seccion, caso, idx) {
  return `${seccion.nombre}-${caso.id}-${idx}`;
}

function normalizeExecutionStatus(data) {
  return (data?.estado || data?.status || data?.state || "en_cola")
    .toString()
    .trim()
    .toLowerCase();
}

function normalizeExecutionData(data, fallback = {}) {
  return {
    ...fallback,
    ...data,

    estado: normalizeExecutionStatus(data),

    posicionCola:
      data?.posicionCola ??
      data?.posicion ??
      fallback?.posicionCola ??
      fallback?.posicion ??
      null,

    totalCola:
      data?.totalCola ??
      data?.total ??
      fallback?.totalCola ??
      fallback?.total ??
      null,

    esperaRestanteMs:
      Number(data?.esperaRestanteMs) || Number(fallback?.esperaRestanteMs) || 0,

    ejecutando: data?.ejecutando ?? fallback?.ejecutando ?? false,

    esperandoOtp:
      data?.esperandoOtp ??
      (normalizeExecutionStatus(data) === "esperando_otp" ||
        fallback?.esperandoOtp ||
        false),

    iniciadoEn: data?.iniciadoEn ?? fallback?.iniciadoEn ?? null,

    finalizadoEn: data?.finalizadoEn ?? fallback?.finalizadoEn ?? null,
  };
}

export default function App() {
  const [selectedPlan, setSelectedPlan] = useState(findFirstPlan);

  const [liveStatuses, setLiveStatuses] = useState({});

  const [logsByExecution, setLogsByExecution] = useState({});

  const [activeExecutions, setActiveExecutions] = useState([]);

  const [sidebarVisible, setSidebarVisible] = useState(true);

  const [executionHistory, setExecutionHistory] = useState([]);

  const [selectedExecutionSummary, setSelectedExecutionSummary] =
    useState(null);

  const [lastExecutionRequest, setLastExecutionRequest] = useState(null);

  const [executionStates, setExecutionStates] = useState({});

  const eventSourcesRef = useRef(new Map());

  const otpLoggeadoRef = useRef(new Set());

  const [visibleLogExecution, setVisibleLogExecution] = useState(null);

  function appendLog(executionKeyValue, text, type = "info") {
    setLogsByExecution((previous) => ({
      ...previous,

      [executionKeyValue]: [
        ...(previous[executionKeyValue] || []),
        {
          time: nowTime(),
          text,
          type,
        },
      ],
    }));
  }

  function finishExecution(entry, finalStatus) {
    const finishedAt = new Date();

    const summary = {
      ...entry,

      finishedAt,

      finalStatus,

      duration: formatDuration(entry.startedAt, finishedAt),

      stepsExecuted:
        entry.backendData?.pasosEjecutados ??
        entry.backendData?.stepsExecuted ??
        entry.backendData?.pasos ??
        0,

      failures:
        entry.backendData?.fallos ??
        entry.backendData?.failures ??
        (finalStatus === "fail" ? 1 : 0),

      environment:
        entry.backendData?.ambiente ??
        entry.backendData?.environment ??
        import.meta.env.MODE ??
        "QA",
    };

    setExecutionHistory((previous) => [
      summary,
      ...previous.filter((item) => item.key !== entry.key),
    ]);

    setSelectedExecutionSummary(summary);

    appendLog(
      entry.key,
      `${entry.casoId} finalizó: ${
        finalStatus === "pass" ? "EXITOSO" : "FALLIDO"
      }`,
      finalStatus === "pass" ? "ok" : "fail",
    );

    setExecutionStates((previous) => ({
      ...previous,

      [entry.key]: {
        ...previous[entry.key],

        executionId: entry.executionId,

        status: entry.status || entry.estado,

        estado: entry.status || entry.estado,

        posicionCola:
          entry.backendData?.posicionCola ??
          previous[entry.key]?.posicionCola ??
          null,

        totalCola: entry.backendData?.totalCola ??
          previous[entry.key]?.totalCola ??
          null,

        esperaRestanteMs: Number(entry.backendData?.esperaRestanteMs) || 0,

        ejecutando: entry.backendData?.ejecutando ?? false,

        iniciadoEn: entry.backendData?.iniciadoEn ?? null,

        finalizadoEn: entry.backendData?.finalizadoEn ?? null,

        esperandoOtp: Boolean(
          entry.backendData?.esperandoOtp || entry.status === "esperando_otp",
        ),

        backendData: entry.backendData ?? previous[entry.key]?.backendData ?? {},
      },
    }));
  }

  function connectToLogs(executionId, statusKey, caseId) {
    eventSourcesRef.current.get(statusKey)?.close();

    const tokenQuery = API_TOKEN
      ? `?token=${encodeURIComponent(API_TOKEN)}`
      : "";

    const eventSource = new EventSource(
      `${API_ENDPOINTS.PASAPORTES_LOGS(executionId)}${tokenQuery}`,
    );

    eventSourcesRef.current.set(statusKey, eventSource);

    eventSource.onmessage = (event) => {
      try {
        const logEntry = JSON.parse(event.data);

        appendLog(
          statusKey,
          logEntry.text || event.data,
          logEntry.type || "info",
        );
      } catch {
        appendLog(statusKey, event.data, "info");
      }
    };

    eventSource.onerror = () => {
      console.warn(
        `Conexión de logs interrumpida para ${caseId}; el navegador intentará reconectar.`,
      );
    };
  }

  useEffect(() => {
    if (!activeExecutions.some((entry) => !isFinished(entry.status))) {
      return undefined;
    }

    const interval = setInterval(async () => {
      const updated = await Promise.all(
        activeExecutions.map(async (entry) => {
          if (isFinished(entry.status)) {
            return entry;
          }

          if (!entry.executionId) {
            return entry;
          }

          try {
            const response = await apiFetch(
              API_ENDPOINTS.PASAPORTES_ESTADO(entry.executionId),
            );

            const data = await response.json();

            if (!response.ok) {
              throw new Error(
                data?.error || `El servidor respondió ${response.status}`,
              );
            }

            const status = normalizeExecutionStatus(data);

            const enrichedData = normalizeExecutionData(data, entry);

            setExecutionStates((previous) => ({
              ...previous,

              [entry.key]: {
                ...previous[entry.key],

                executionId: entry.executionId,

                estado: status,

                status,

                posicionCola: enrichedData.posicionCola,

                totalCola: enrichedData.totalCola,

                esperaRestanteMs: enrichedData.esperaRestanteMs,

                ejecutando: enrichedData.ejecutando,

                iniciadoEn: enrichedData.iniciadoEn,

                finalizadoEn: enrichedData.finalizadoEn,

                esperandoOtp: enrichedData.esperandoOtp,

                backendData: data,
              },
            }));

            if (status === "esperando_otp" && entry.executionId) {
              if (!otpLoggeadoRef.current.has(entry.key)) {
                otpLoggeadoRef.current.add(entry.key);

                appendLog(
                  entry.key,
                  "El navegador está esperando el código OTP enviado al correo.",
                  "info",
                );
              }
            }

            return {
              ...entry,

              status,

              estado: status,

              posicionCola: enrichedData.posicionCola,

              totalCola: enrichedData.totalCola,

              esperaRestanteMs: enrichedData.esperaRestanteMs,

              ejecutando: enrichedData.ejecutando,

              esperandoOtp: enrichedData.esperandoOtp,

              backendData: data,
            };
          } catch (error) {
            console.warn(
              `No se pudo consultar el estado de ${entry.executionId}:`,
              error,
            );

            return entry;
          }
        }),
      );

      updated.forEach((entry) => {
        if (!isFinished(entry.status)) {
          return;
        }

        eventSourcesRef.current.get(entry.key)?.close();

        eventSourcesRef.current.delete(entry.key);

        otpLoggeadoRef.current.delete(entry.key);

        const finalStatus = toLiveStatus(entry.status);

        setLiveStatuses((previous) => ({
          ...previous,
          [entry.key]: finalStatus,
        }));

        finishExecution(entry, finalStatus);
      });

      const remaining = updated.filter((entry) => !isFinished(entry.status));

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

  function runCase(seccion, caso, idx, configPayload, backendInfo) {
    const key = executionKey(seccion, caso, idx);

    const startedAt = new Date();

    setLiveStatuses((previous) => ({
      ...previous,
      [key]: "running",
    }));

    appendLog(key, `Solicitud recibida para ${caso.id} - ${caso.criterio}`);

    if (configPayload) {
      const records = Array.isArray(configPayload) ? configPayload.length : 1;

      appendLog(key, `Payload recibido: ${records} registro(s)`);
    }

    const execution = backendInfo?.ejecuciones?.[0] ?? backendInfo;

    const executionId =
      execution?.executionId ||
      execution?.id ||
      execution?._id ||
      execution?.uuid;

    const status = normalizeExecutionStatus(execution);

    const normalizedExecution = normalizeExecutionData(execution);

    const executionEntry = {
      key,

      executionId,

      status,

      estado: status,

      startedAt,

      seccionNombre: seccion.nombre,

      casoId: caso.id,

      casoTitulo: caso.criterio,

      caso,

      configPayload,

      posicionCola: normalizedExecution.posicionCola,

      totalCola: normalizedExecution.totalCola,

      esperaRestanteMs: normalizedExecution.esperaRestanteMs,

      ejecutando: normalizedExecution.ejecutando,

      esperandoOtp: normalizedExecution.esperandoOtp,

      backendData: execution,

      environment:
        execution?.ambiente ||
        execution?.environment ||
        import.meta.env.MODE ||
        "QA",
    };

    setExecutionStates((previous) => ({
      ...previous,

      [key]: {
        ...previous[key],

        executionId,

        estado: status,

        status,

        posicionCola: executionEntry.posicionCola,

        totalCola: executionEntry.totalCola,

        esperaRestanteMs: executionEntry.esperaRestanteMs,

        ejecutando: executionEntry.ejecutando,

        esperandoOtp: executionEntry.esperandoOtp,

        iniciadoEn: execution?.iniciadoEn ?? startedAt,

        finalizadoEn: execution?.finalizadoEn ?? null,

        backendData: execution,
      },
    }));

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

      finishExecution(executionEntry, finalStatus);

      return;
    }

    if (!executionId) {
      appendLog(
        key,
        `El backend no devolvió un identificador de ejecución para ${caso.id}`,
        "fail",
      );

      setLiveStatuses((previous) => ({
        ...previous,
        [key]: "fail",
      }));

      finishExecution(executionEntry, "fail");

      return;
    }

    setActiveExecutions((previous) => [
      ...previous.filter((entry) => entry.key !== key),

      executionEntry,
    ]);

    connectToLogs(executionId, key, caso.id);
  }

  async function repeatLastExecution() {
    if (!lastExecutionRequest) {
      return;
    }

    const { seccion, caso, idx, configPayload } = lastExecutionRequest;

    setSelectedExecutionSummary(null);

    const endpoint = caso.configEndpoint ?? seccion.configEndpoint;

    if (!endpoint) {
      appendLog(
        executionKey(seccion, caso, idx),
        `No hay endpoint configurado para repetir ${caso.id}`,
        "fail",
      );

      return;
    }

    try {
      const response = await apiFetch(endpoint, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(configPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `El servidor respondió ${response.status}`,
        );
      }

      runCase(seccion, caso, idx, configPayload, data);
    } catch (error) {
      const key = executionKey(seccion, caso, idx);

      appendLog(key, `No se pudo repetir ${caso.id}: ${error.message}`, "fail");

      setLiveStatuses((previous) => ({
        ...previous,
        [key]: "fail",
      }));
    }
  }

  async function runAllVisible() {
    if (!selectedPlan?.data?.secciones) {
      return;
    }

    setSelectedExecutionSummary(null);

    console.log(`Ejecutando plan completo: ${selectedPlan.nombre}`);

    for (const seccion of selectedPlan.data.secciones) {
      for (const [idx, caso] of seccion.casos.entries()) {
        const key = executionKey(seccion, caso, idx);

        const endpoint = caso.configEndpoint ?? seccion.configEndpoint;

        const payload = caso.configTemplate ?? seccion.configTemplate ?? [];

        if (!endpoint) {
          appendLog(key, `No hay endpoint configurado para ${caso.id}`, "fail");

          setLiveStatuses((previous) => ({
            ...previous,
            [key]: "fail",
          }));

          continue;
        }

        try {
          const response = await apiFetch(endpoint, {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify(payload),
          });

          const backendInfo = await response.json();

          if (!response.ok) {
            throw new Error(
              backendInfo.error || `El servidor respondió ${response.status}`,
            );
          }

          runCase(seccion, caso, idx, payload, backendInfo);
        } catch (error) {
          appendLog(
            key,
            `No se pudo iniciar ${caso.id}: ${error.message}`,
            "fail",
          );

          setLiveStatuses((previous) => ({
            ...previous,
            [key]: "fail",
          }));
        }
      }
    }
  }

  async function downloadReport(summary) {
    if (!summary) {
      return;
    }

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

      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json",
      });

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      link.download = `reporte-${summary.casoId}.json`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      appendLog(
        summary?.key,
        `No se pudo descargar el reporte: ${error.message}`,
        "fail",
      );
    }
  }

  function viewEvidence(summary) {
    if (!summary) {
      return;
    }

    const evidenceUrl =
      summary.backendData?.evidenciasUrl ||
      summary.backendData?.evidenceUrl ||
      summary.backendData?.evidenciaUrl;

    if (evidenceUrl) {
      window.open(evidenceUrl, "_blank", "noopener,noreferrer");

      return;
    }

    appendLog(
      summary?.key,
      `No hay evidencias disponibles para ${summary.casoId}`,
      "info",
    );
  }

  const secciones = selectedPlan?.data?.secciones || [];

  const totalCasos = selectedPlan ? contarCasos(selectedPlan) : 0;

  const totalPass = Object.values(liveStatuses).filter(
    (status) => status === "pass",
  ).length;

  const totalFail = Object.values(liveStatuses).filter(
    (status) => status === "fail",
  ).length;

  const totalRunning = Object.values(liveStatuses).filter(
    (status) => status === "running",
  ).length;

  return (
    <div className={`app-shell ${sidebarVisible ? "" : "collapsed"}`}>
      <Sidebar
        projects={projects}
        selectedPlanId={selectedPlan?.id}
        onSelectPlan={(plan) => {
          eventSourcesRef.current.forEach((source) => source.close());

          eventSourcesRef.current.clear();

          setSelectedPlan(plan);

          setLiveStatuses({});

          setLogsByExecution({});

          setActiveExecutions([]);

          setExecutionStates({});

          setExecutionHistory([]);

          setSelectedExecutionSummary(null);

          setVisibleLogExecution(null);

          setLastExecutionRequest(null);
        }}
        onToggle={() => setSidebarVisible((value) => !value)}
        collapsed={!sidebarVisible}
      />

      <main className="main">
        {!selectedPlan ? (
          <p
            style={{
              color: "var(--text-secondary)",
            }}
          >
            Selecciona un plan de casos de prueba en el panel izquierdo.
          </p>
        ) : (
          <>
            <div className="main-header">
              <h1>{selectedPlan.nombre}</h1>

              <p className="subtitle">
                {totalCasos} casos de prueba en {secciones.length} secciones
              </p>
            </div>

            <MetaBar meta={selectedPlan.data?.meta} />

            <div className="toolbar">
              <div className="summary-pills">
                <span className="pill pass">Exitosos {totalPass}</span>

                <span className="pill fail">Fallidos {totalFail}</span>

                {totalRunning > 0 && (
                  <span className="pill idle">Ejecutando {totalRunning}</span>
                )}
              </div>

              <button className="btn primary" onClick={runAllVisible}>
                <span className="icon-play" />
                Ejecutar plan completo
              </button>
            </div>

            {selectedExecutionSummary && (
              <section className="execution-summary">
                <div className="execution-summary-header">
                  <div>
                    <div className="execution-summary-kicker">
                      EJECUCIÓN FINALIZADA
                    </div>

                    <h2>{selectedExecutionSummary.casoId}</h2>

                    <p>{selectedExecutionSummary.casoTitulo}</p>
                  </div>

                  <span
                    className={`execution-result ${
                      selectedExecutionSummary.finalStatus
                    }`}
                  >
                    {selectedExecutionSummary.finalStatus === "pass"
                      ? "✓ EXITOSO"
                      : "✕ FALLIDO"}
                  </span>
                </div>

                <div className="execution-timeline">
                  <div className="timeline-line" />

                  <div className="timeline-item">
                    <span className="timeline-dot" />

                    <div>
                      <strong>Ejecución iniciada</strong>

                      <span>
                        {formatDateTime(selectedExecutionSummary.startedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="timeline-item">
                    <span className="timeline-dot" />

                    <div>
                      <strong>Ejecución finalizada</strong>

                      <span>
                        {formatDateTime(selectedExecutionSummary.finishedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="execution-metrics">
                  <div className="execution-metric">
                    <span>Duración</span>

                    <strong>{selectedExecutionSummary.duration}</strong>
                  </div>

                  <div className="execution-metric">
                    <span>Ambiente</span>

                    <strong>{selectedExecutionSummary.environment}</strong>
                  </div>

                  <div className="execution-metric">
                    <span>Pasos ejecutados</span>

                    <strong>{selectedExecutionSummary.stepsExecuted}</strong>
                  </div>

                  <div className="execution-metric">
                    <span>Fallos</span>

                    <strong
                      className={
                        selectedExecutionSummary.failures > 0
                          ? "metric-danger"
                          : ""
                      }
                    >
                      {selectedExecutionSummary.failures}
                    </strong>
                  </div>
                </div>

                <div className="execution-actions">
                  <button
                    className="btn"
                    onClick={() =>
                      setVisibleLogExecution(selectedExecutionSummary.key)
                    }
                  >
                    Ver log
                  </button>

                  <button
                    className="btn"
                    onClick={() => viewEvidence(selectedExecutionSummary)}
                  >
                    Ver evidencias
                  </button>

                  <button
                    className="btn"
                    onClick={() => downloadReport(selectedExecutionSummary)}
                  >
                    Descargar reporte
                  </button>

                  <button className="btn primary" onClick={repeatLastExecution}>
                    <span className="icon-play" />
                    Repetir prueba
                  </button>
                </div>
              </section>
            )}

            {executionHistory.length > 0 && (
              <section className="execution-history">
                <div className="execution-history-header">
                  <h3>Historial de ejecuciones</h3>

                  <span>
                    {executionHistory.length} ejecución
                    {executionHistory.length !== 1 ? "es" : ""}
                  </span>
                </div>

                <div className="execution-history-list">
                  {executionHistory.slice(0, 5).map((execution) => (
                    <button
                      key={`${execution.key}-${execution.finishedAt}`}
                      className="execution-history-item"
                      onClick={() => setSelectedExecutionSummary(execution)}
                    >
                      <span
                        className={`history-status ${execution.finalStatus}`}
                      />

                      <span className="history-case">{execution.casoId}</span>

                      <span className="history-date">
                        {formatDateTime(execution.finishedAt)}
                      </span>

                      <span className="history-duration">
                        {execution.duration}
                      </span>

                      <span
                        className={`history-result ${execution.finalStatus}`}
                      >
                        {execution.finalStatus === "pass"
                          ? "Exitoso"
                          : "Fallido"}
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
                executionStates={executionStates}
                onRunCase={runCase}
                logsByExecution={logsByExecution}
                visibleLogExecution={visibleLogExecution}
              />
            ))}
          </>
        )}
      </main>

      {!sidebarVisible && (
        <button
          className="sidebar-open-btn"
          onClick={() => setSidebarVisible(true)}
          aria-label="Mostrar sidebar"
        >
          ☰
        </button>
      )}
    </div>
  );
}
