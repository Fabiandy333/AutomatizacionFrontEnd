import { useEffect, useState } from "react";

import ConfigModal from "./ConfigModal";
import OtpModal from "./OtpModal";
import LiveScreenViewer from "./LiveScreenViewer";

import { apiFetch, API_ENDPOINTS } from "../config/api";

const ESTADOS_FINALIZADOS = [
  "exitoso",
  "fallido",
  "requiere_revision",
];

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function resolveBadge(estadoHistorico, liveStatus) {
  if (liveStatus === "running") {
    return {
      text: "Ejecutando",
      cls: "running",
    };
  }

  if (liveStatus === "pass") {
    return {
      text: "Exitoso",
      cls: "pass",
    };
  }

  if (liveStatus === "fail") {
    return {
      text: "Fallido",
      cls: "fail",
    };
  }

  if (normalizeStatus(estadoHistorico) === "exitoso") {
    return {
      text: "Exitoso (ult. corrida)",
      cls: "pass",
    };
  }

  if (normalizeStatus(estadoHistorico) === "fallido") {
    return {
      text: "Fallido (ult. corrida)",
      cls: "fail",
    };
  }

  return {
    text: "Sin ejecutar",
    cls: "idle",
  };
}

function formatCountdown(milliseconds) {
  if (!milliseconds || milliseconds <= 0) {
    return "0s";
  }

  const totalSeconds = Math.ceil(milliseconds / 1000);

  const minutes = Math.floor(totalSeconds / 60);

  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds
      .toString()
      .padStart(2, "0")}s`;
  }

  return `${seconds}s`;
}

function getQueueMessage(queueState) {
  if (!queueState) {
    return null;
  }

  const estado = normalizeStatus(
    queueState.estado ||
      queueState.status ||
      queueState.state,
  );

  const posicion =
    queueState.posicion ??
    queueState.posicionCola;

  const total =
    queueState.total ??
    queueState.totalCola;

  const esperaRestanteMs =
    Number(queueState.esperaRestanteMs) || 0;

  const estimacionMs =
    Number(queueState.estimacionMs) || 0;

  const estimacionTexto =
    queueState.estimacionTexto;

  if (estado === "en_cola") {
    return {
      type: "queue",

      text:
        posicion > 0
          ? `En cola · posición ${posicion}${
              total ? ` de ${total}` : ""
            }`
          : "En cola",

      detail:
        estimacionTexto ||
        (estimacionMs > 0
          ? `Tiempo estimado: ${formatCountdown(
              estimacionMs,
            )}`
          : esperaRestanteMs > 0
            ? `Tiempo estimado: ${formatCountdown(
                esperaRestanteMs,
              )}`
            : "Esperando disponibilidad..."),
    };
  }

  if (estado === "esperando_ventana") {
    return {
      type: "waiting",

      text: "Próxima ejecución",

      detail:
        esperaRestanteMs > 0
          ? `Comienza aproximadamente en ${formatCountdown(
              esperaRestanteMs,
            )}`
          : estimacionTexto ||
            "Iniciando próximamente...",
    };
  }

  if (estado === "en_progreso") {
    return {
      type: "running",

      text: "Ejecutando ahora",

      detail:
        "El navegador está realizando el proceso.",
    };
  }

  if (estado === "esperando_otp") {
    return {
      type: "waiting",

      text: "Esperando código OTP",

      detail:
        "Ingresa el código recibido en el correo.",
    };
  }

  return null;
}

function extractExecutionList(backendInfo) {
  if (!backendInfo) {
    return [];
  }

  if (Array.isArray(backendInfo.ejecuciones)) {
    return backendInfo.ejecuciones.map(
      (execution) => ({
        ...execution,

        executionId:
          execution.executionId ||
          execution.id ||
          execution._id ||
          execution.uuid,

        estado:
          execution.estado ||
          execution.status ||
          execution.state ||
          "en_cola",

        posicion:
          execution.posicion ??
          execution.posicionCola,

        total:
          execution.total ??
          execution.totalCola,

        esperaRestanteMs:
          Number(
            execution.esperaRestanteMs,
          ) || 0,

        estimacionMs:
          Number(execution.estimacionMs) || 0,

        estimacionTexto:
          execution.estimacionTexto ||
          null,

        email:
          execution.email ||
          backendInfo.email ||
          null,
      }),
    );
  }

  const executionId =
    backendInfo.executionId ||
    backendInfo.id ||
    backendInfo._id ||
    backendInfo.uuid;

  if (!executionId) {
    return [];
  }

  return [
    {
      ...backendInfo,

      executionId,

      email:
        backendInfo.email || null,

      estado:
        backendInfo.estado ||
        backendInfo.status ||
        backendInfo.state ||
        "en_cola",

      posicion:
        backendInfo.posicion ??
        backendInfo.posicionCola,

      total:
        backendInfo.total ??
        backendInfo.totalCola,

      esperaRestanteMs:
        Number(
          backendInfo.esperaRestanteMs,
        ) || 0,

      estimacionMs:
        Number(backendInfo.estimacionMs) || 0,

      estimacionTexto:
        backendInfo.estimacionTexto ||
        null,
    },
  ];
}

export default function CaseRow({
  caso,
  liveStatus,
  executionState,
  configTemplate,
  configSchema,
  configEndpoint,
  onRun,
}) {
  const [open, setOpen] = useState(false);

  const [configOpen, setConfigOpen] =
    useState(false);

  const resolvedConfig =
    caso.configTemplate ??
    configTemplate ??
    [];

  const [config, setConfig] =
    useState(resolvedConfig);

  const [ejecucionesActivas, setEjecucionesActivas] =
    useState([]);

  const [otpActivo, setOtpActivo] =
    useState(null);

  const [isExecuting, setIsExecuting] =
    useState(false);

  const [verPantalla, setVerPantalla] =
    useState(false);

  const queueState =
    executionState || null;

  const schema =
    caso.configSchema ??
    configSchema ??
    null;

  const badge = resolveBadge(
    caso.estado,
    liveStatus,
  );

  const isRunning =
    liveStatus === "running";

  /*
   * ID de ejecución.
   *
   * Primero usamos el que entrega App.jsx.
   * Si todavía no existe, buscamos el de la
   * ejecución local.
   */
  const executionId =
    executionState?.executionId ||
    ejecucionesActivas[0]?.executionId ||
    null;

  /*
   * Estado real recibido desde App.jsx.
   *
   * Puede venir como:
   * estado
   * status
   * state
   */
  const executionStatus =
    normalizeStatus(
      executionState?.estado ||
        executionState?.status ||
        executionState?.state ||
        executionState?.backendData?.estado ||
        executionState?.backendData?.status ||
        executionState?.backendData?.state,
    );

  /*
   * Contador visual.
   */
  const [countdown, setCountdown] =
    useState(
      Number(
        queueState?.esperaRestanteMs,
      ) || 0,
    );

  useEffect(() => {
    const remaining =
      Number(
        queueState?.esperaRestanteMs,
      ) || 0;

    setCountdown(
      Math.max(0, remaining),
    );

    if (remaining <= 0) {
      return undefined;
    }

    const interval = setInterval(() => {
      setCountdown(
        (previous) =>
          Math.max(
            0,
            previous - 1000,
          ),
      );
    }, 1000);

    return () =>
      clearInterval(interval);
  }, [
    queueState?.esperaRestanteMs,
  ]);

  /*
   * Sincroniza la ejecución local
   * con el estado enviado por App.jsx.
   */
  useEffect(() => {
    if (!executionState?.executionId) {
      return;
    }

    const currentExecutionId =
      executionState.executionId;

    const existing =
      ejecucionesActivas.find(
        (item) =>
          item.executionId ===
          currentExecutionId,
      );

    const backendData =
      executionState.backendData || {};

    const updatedExecution = {
      ...(existing || {}),

      executionId:
        currentExecutionId,

      email:
        existing?.email ||
        executionState.email ||
        backendData.email ||
        null,

      estado:
        executionState.estado ||
        executionState.status ||
        executionState.state ||
        backendData.estado ||
        backendData.status ||
        backendData.state ||
        "en_cola",

      posicion:
        executionState.posicionCola ??
        executionState.posicion ??
        backendData.posicion ??
        backendData.posicionCola ??
        existing?.posicion,

      total:
        executionState.totalCola ??
        executionState.total ??
        backendData.total ??
        backendData.totalCola ??
        existing?.total,

      esperaRestanteMs:
        Number(
          executionState.esperaRestanteMs,
        ) || 0,

      estimacionMs:
        Number(
          executionState.estimacionMs ??
            backendData.estimacionMs,
        ) ||
        existing?.estimacionMs ||
        0,

      estimacionTexto:
        executionState.estimacionTexto ||
        backendData.estimacionTexto ||
        existing?.estimacionTexto ||
        null,
    };

    setEjecucionesActivas(
      (previous) => {
        const withoutCurrent =
          previous.filter(
            (item) =>
              item.executionId !==
              currentExecutionId,
          );

        const normalizedStatus =
          normalizeStatus(
            updatedExecution.estado,
          );

        /*
         * IMPORTANTE:
         * NO eliminamos esperando_otp.
         *
         * La ejecución debe permanecer
         * disponible mientras el usuario
         * introduce el código.
         */
        if (
          ESTADOS_FINALIZADOS.includes(
            normalizedStatus,
          )
        ) {
          return withoutCurrent;
        }

        return [
          ...withoutCurrent,
          updatedExecution,
        ];
      },
    );
  }, [executionState]);

  /*
   * ==========================================
   * DETECCIÓN DEL OTP
   * ==========================================
   *
   * Esta es la parte más importante.
   *
   * No dependemos únicamente de
   * ejecucionesActivas.
   *
   * Si App.jsx dice:
   *
   * estado: "esperando_otp"
   *
   * abrimos directamente el modal.
   */
  useEffect(() => {
    if (
      executionStatus !==
        "esperando_otp" ||
      !executionId
    ) {
      return;
    }

    const backendData =
      executionState?.backendData || {};

    const ejecucion =
      ejecucionesActivas.find(
        (item) =>
          item.executionId ===
          executionId,
      ) || {};

    const email =
      executionState?.email ||
      ejecucion?.email ||
      backendData.email ||
      backendData.correo ||
      backendData.emailTitular ||
      null;

    setOtpActivo(
      (previous) => {
        if (
          previous?.executionId ===
            executionId &&
          previous?.estado ===
            "esperando_otp"
        ) {
          return previous;
        }

        const otpExecution = {
          ...ejecucion,

          executionId,

          email,

          estado: "esperando_otp",
        };

        return otpExecution;
      },
    );
  }, [
    executionStatus,
    executionId,
    executionState,
    ejecucionesActivas,
  ]);


  /*
   * Cerrar OTP cuando finalice
   * correctamente la ejecución.
   */
  useEffect(() => {
    if (
      !executionStatus ||
      !ESTADOS_FINALIZADOS.includes(
        executionStatus,
      )
    ) {
      return;
    }

    setOtpActivo(null);
  }, [executionStatus]);

  function handleConfirmConfig(resultado) {
    const configPayload =
      resultado.payload ?? resultado;

    const backendInfo =
      resultado.backend;

    setConfig(configPayload);

    setConfigOpen(false);

    onRun(
      caso,
      configPayload,
      backendInfo,
    );

    const nuevas =
      extractExecutionList(
        backendInfo,
      );

    if (nuevas.length > 0) {
      setEjecucionesActivas(
        nuevas,
      );
    }
  }

  async function handleDirectRun() {
    const endpoint =
      caso.configEndpoint ??
      configEndpoint;

    if (!endpoint) {
      onRun(caso, config);

      return;
    }

    setIsExecuting(true);

    try {
      const response =
        await apiFetch(endpoint, {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            config,
          ),
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            `El servidor respondió ${response.status}`,
        );
      }

      onRun(
        caso,
        config,
        data,
      );

      const nuevas =
        extractExecutionList(data);

      if (nuevas.length > 0) {
        setEjecucionesActivas(
          nuevas,
        );
      }
    } catch (error) {
      console.error(
        "Error al ejecutar:",
        error,
      );

      alert(
        "Error al ejecutar: " +
          error.message,
      );
    } finally {
      setIsExecuting(false);
    }
  }

  function handleOtpSubmitted() {
    /*
     * El backend ya recibió el código OTP
     * y continuará la automatización.
     *
     * Cerramos el modal inmediatamente para
     * evitar que el usuario reenvíe el código
     * (un segundo envío generaría un 409,
     * porque la señal ya fue consumida).
     *
     * El estado de la ejecución seguirá
     * llegando por polling.
     */
    console.log(
      "[OTP] Código enviado correctamente, cerrando modal",
    );

    setOtpActivo(null);
  }

  const queueMessage =
    getQueueMessage(queueState);

  return (
    <div className="case-row">
      <div className="case-row-main">
        <span className="case-id">
          {caso.id}
        </span>

        <button
          className="case-title"
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            textAlign: "left",
            padding: 0,
          }}
          onClick={() =>
            setOpen(
              (value) => !value,
            )
          }
        >
          <span
            className="icon-chevron"
            style={{
              marginRight: 4,
              transform: open
                ? "rotate(90deg)"
                : "none",
              display:
                "inline-block",
            }}
          />

          <span className="criterio">
            {caso.criterio ||
              caso.pasos?.slice(
                0,
                60,
              )}
          </span>
        </button>

        <span
          className={`badge ${badge.cls}`}
        >
          {badge.text}
        </span>

        <span
          style={{
            fontSize: 11,
            color:
              "var(--text-muted)",
            fontFamily:
              "var(--font-mono)",
          }}
        >
          {caso.responsableEjecucion ||
            "-"}
        </span>

        <div
          style={{
            display: "flex",
            gap: 6,
          }}
        >
          <button
            className="run-btn"
            aria-label={`Configurar datos de ${caso.id}`}
            title="Ver y editar los datos antes de ejecutar"
            disabled={
              isRunning ||
              isExecuting
            }
            onClick={() =>
              setConfigOpen(true)
            }
          >
            <span className="icon-config" />
          </button>

          <button
            className="run-btn"
            aria-label={`Ejecutar ${caso.id}`}
            title="Ejecutar con la última configuración confirmada"
            disabled={
              isRunning ||
              isExecuting
            }
            onClick={
              handleDirectRun
            }
          >
            <span className="icon-play" />
          </button>
        </div>
      </div>

      {queueMessage && (
        <div
          style={{
            margin:
              "0 16px 12px",
            padding:
              "10px 12px",
            border:
              "1px solid var(--border)",
            borderRadius:
              "var(--radius-md)",
            background:
              "var(--bg-secondary)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: 12,
            }}
          >
            <div>
              <strong
                style={{
                  fontSize: 13,
                }}
              >
                {queueMessage.text}
              </strong>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 11,
                  color:
                    "var(--text-secondary)",
                }}
              >
                {queueMessage.detail}
              </div>
            </div>

            {countdown > 0 &&
              (executionStatus ===
                "en_cola" ||
                executionStatus ===
                  "esperando_ventana") && (
                <strong
                  style={{
                    fontFamily:
                      "var(--font-mono)",
                    fontSize: 14,
                  }}
                >
                  {formatCountdown(
                    countdown,
                  )}
                </strong>
              )}
          </div>
        </div>
      )}

      {open && (
        <div className="case-detail">
          <div className="row">
            <span className="k">
              Pasos
            </span>

            <span
              style={{
                whiteSpace:
                  "pre-line",
              }}
            >
              {caso.pasos}
            </span>
          </div>

          {caso.componente && (
            <div className="row">
              <span className="k">
                Componente
              </span>

              <span>
                {caso.componente}
              </span>
            </div>
          )}

          {caso.fechaEjecucion && (
            <div className="row">
              <span className="k">
                Última ejecución
              </span>

              <span>
                {caso.fechaEjecucion}
              </span>
            </div>
          )}

          {caso.observacionError && (
            <div className="row">
              <span className="k">
                Observación
              </span>

              <span className="error">
                {
                  caso.observacionError
                }
              </span>
            </div>
          )}

          {caso.clasificacionError && (
            <div className="row">
              <span className="k">
                Severidad
              </span>

              <span>
                {
                  caso.clasificacionError
                }
              </span>
            </div>
          )}
        </div>
      )}

      {ejecucionesActivas.length >
        0 && (
        <div
          style={{
            padding:
              "0 16px 12px",
            display: "flex",
            flexDirection:
              "column",
            gap: 8,
          }}
        >
          <label
            style={{
              fontSize: 12,
              display: "flex",
              alignItems:
                "center",
              gap: 6,
              color:
                "var(--text-secondary)",
            }}
          >
            <input
              type="checkbox"
              checked={
                verPantalla
              }
              onChange={(e) =>
                setVerPantalla(
                  e.target
                    .checked,
                )
              }
            />

            Ver pantalla en vivo
          </label>

          {verPantalla &&
            executionId && (
              <LiveScreenViewer
                executionId={
                  executionId
                }
              />
            )}
        </div>
      )}

      <ConfigModal
        isOpen={configOpen}
        title={`${caso.id} — ${caso.criterio}`}
        description="Complete los datos necesarios para ejecutar este caso de prueba."
        initialData={config}
        schema={schema}
        endpoint={
          caso.configEndpoint ??
          configEndpoint
        }
        onClose={() =>
          setConfigOpen(false)
        }
        onConfirm={
          handleConfirmConfig
        }
      />

      <OtpModal
        isOpen={!!otpActivo}
        email={otpActivo?.email}
        executionId={
          otpActivo?.executionId
        }
        onClose={() =>
          setOtpActivo(null)
        }
        onSubmitted={
          handleOtpSubmitted
        }
      />
    </div>
  );
}