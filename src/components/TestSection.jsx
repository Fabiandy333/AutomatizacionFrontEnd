import CaseRow from "./CaseRow";
import LogPanel from "./LogPanel";

export default function TestSection({
  seccion,
  liveStatuses,
  onRunCase,
  showLogs = false,
  logLines = [],
}) {
  const firstId = seccion.casos[0]?.id;
  const lastId =
    seccion.casos[seccion.casos.length - 1]?.id;

  return (
    <section
      className={`section ${
        showLogs ? "with-log" : ""
      }`}
    >
      {/* Header de la sección */}
      <div className="section-header">
        <div>
          <h2>{seccion.nombre}</h2>
        </div>

        <span className="case-ids">
          {firstId}

          {lastId && lastId !== firstId
            ? ` - ${lastId}`
            : ""}

          {" "}({seccion.casos.length})
        </span>
      </div>

      <div className="section-body">
        {/* Lista de casos */}
        <div className="cases-list">
          {seccion.casos.map((caso, idx) => {
            const key = `${seccion.nombre}-${caso.id}-${idx}`;

            return (
              <CaseRow
                key={key}
                caso={caso}
                liveStatus={liveStatuses[key]}

                configTemplate={
                  caso.configTemplate ??
                  seccion.configTemplate
                }

                configSchema={
                  caso.configSchema ??
                  seccion.configSchema
                }

                configEndpoint={
                  caso.configEndpoint ??
                  seccion.configEndpoint
                }

                onRun={(
                  casoRef,
                  configPayload,
                  backendInfo
                ) =>
                  onRunCase(
                    seccion,
                    casoRef,
                    idx,
                    configPayload,
                    backendInfo
                  )
                }
              />
            );
          })}
        </div>

        {/* Logs de la ejecución */}
        {showLogs && (
          <div className="section-log">
            <LogPanel lines={logLines} />
          </div>
        )}
      </div>
    </section>
  );
}