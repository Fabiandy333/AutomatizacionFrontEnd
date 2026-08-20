import { useEffect, useState } from "react";

import { apiFetch, API_ENDPOINTS } from "../config/api";

export default function OtpModal({
  isOpen,
  email,
  executionId,
  onClose,
  onSubmitted,
}) {
  const [codigo, setCodigo] = useState("");

  const [enviando, setEnviando] = useState(false);

  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setCodigo("");
      setError(null);
    }
  }, [isOpen, executionId]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit() {
    const codigoLimpio = codigo.trim();

    if (!codigoLimpio) {
      setError("Ingresa el código que llegó al correo.");
      return;
    }

    if (!executionId) {
      setError("No se encontró el identificador de la ejecución.");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      console.log("[OTP] Enviando código para ejecución:", executionId);

      const response = await apiFetch(
        API_ENDPOINTS.PASAPORTES_OTP(executionId),
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            codigo: codigoLimpio,
          }),
        },
      );

      const data = await response.json();

      console.log("[OTP] Respuesta backend:", data);

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            `El servidor respondió ${response.status}`,
        );
      }

      /*
       * El backend recibió correctamente
       * el código.
       *
       * Avisamos a CaseRow, pero NO
       * forzamos que la ejecución termine.
       */
      onSubmitted?.(data);

      setCodigo("");
    } catch (e) {
      console.error("[OTP] Error:", e);

      setError("No se pudo enviar el código: " + e.message);
    } finally {
      setEnviando(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();

      if (!enviando) {
        handleSubmit();
      }
    }

    if (event.key === "Escape") {
      if (!enviando) {
        onClose?.();
      }
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!enviando) {
          onClose?.();
        }
      }}
    >
      <div
        className="modal-panel"
        onClick={(event) => event.stopPropagation()}
        style={{
          maxWidth: 420,
        }}
      >
        <div className="modal-header">
          <h3>Ingresar código de verificación</h3>

          <button
            className="modal-close"
            onClick={onClose}
            disabled={enviando}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <p className="modal-description">
          El backend está esperando el código OTP enviado al correo{" "}
          <strong>{email || "del titular"}</strong>.
        </p>

        <label className="modal-label" htmlFor="otp-input">
          Código recibido
        </label>

        <input
          id="otp-input"
          className="modal-textarea"
          style={{
            minHeight: "auto",
            textAlign: "center",
            fontSize: 20,
            letterSpacing: 5,
          }}
          value={codigo}
          onChange={(event) =>
            setCodigo(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          onKeyDown={handleKeyDown}
          maxLength={6}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          autoFocus
          disabled={enviando}
        />

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={enviando}>
            Cancelar
          </button>

          <button
            className="btn primary"
            onClick={handleSubmit}
            disabled={enviando || codigo.trim().length === 0}
          >
            {enviando ? "Enviando..." : "Confirmar código"}
          </button>
        </div>
      </div>
    </div>
  );
}
