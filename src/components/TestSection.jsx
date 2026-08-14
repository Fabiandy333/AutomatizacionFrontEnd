import CaseRow from "./CaseRow";
import LogPanel from "./LogPanel";
import { useEffect } from "react";

function executionKey(seccion, caso, idx) {
  return `${seccion.nombre}-${caso.id}-${idx}`;
}

export default function TestSection({
  seccion,
  liveStatuses,
  onRunCase,
  logsByExecution,
  visibleLogExecution = null,
}) {
  const firstId = seccion.casos[0]?.id;
  const lastId = seccion.casos[seccion.casos.length - 1]?.id;

  useEffect(() => {
    if (!visibleLogExecution) return;

    const element = document.getElementById(`log-${visibleLogExecution}`);

    if (element) {
      // Pequeño delay para asegurarnos de que el DOM ya esté actualizado
      setTimeout(() => {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [visibleLogExecution]);

  return (
    <section className="section">
      <div className="section-header">
        <h2>{seccion.nombre}</h2>

        <span className="case-ids">
          {firstId}
          {lastId && lastId !== firstId ? ` - ${lastId}` : ""} (
          {seccion.casos.length})
        </span>
      </div>

      <div className="cases-list">
        {seccion.casos.map((caso, idx) => {
          const key = executionKey(seccion, caso, idx);

          const caseLogs = logsByExecution[key] || [];

          const isSelectedLog = visibleLogExecution === key;

          return (
            <div
              key={key}
              className={`case-execution-container ${
                isSelectedLog ? "log-selected" : ""
              }`}
            >
              <CaseRow
                caso={caso}
                liveStatus={liveStatuses[key]}
                configTemplate={caso.configTemplate ?? seccion.configTemplate}
                configSchema={caso.configSchema ?? seccion.configSchema}
                configEndpoint={caso.configEndpoint ?? seccion.configEndpoint}
                onRun={(casoRef, configPayload, backendInfo) =>
                  onRunCase(seccion, casoRef, idx, configPayload, backendInfo)
                }
              />

              {caseLogs.length > 0 && (
                <div
                  id={`log-${key}`}
                  className={`case-log ${isSelectedLog ? "log-highlight" : ""}`}
                >
                  <LogPanel lines={caseLogs} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
