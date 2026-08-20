const API_BASE_URL = import.meta.env.DEV
  ? ""
  : import.meta.env.VITE_API_BASE_URL || "";

export const API_TOKEN = import.meta.env.VITE_API_TOKEN || "";

/**
 * Cliente centralizado para realizar peticiones al backend.
 *
 * En desarrollo:
 *   Vite utiliza el proxy configurado en vite.config.js.
 *
 * En producción:
 *   Se utiliza VITE_API_BASE_URL.
 *
 * El token se envía automáticamente mediante X-API-Key.
 */
export async function apiFetch(url, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };

  if (API_TOKEN) {
    headers["X-API-Key"] = API_TOKEN;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

export const API_ENDPOINTS = {
  // ============================================================
  // PASAPORTES
  // ============================================================

  PASAPORTES_BASE: `${API_BASE_URL}/api/pasaportes`,

  PASAPORTES_AGENDAR: `${API_BASE_URL}/api/pasaportes/agendar`,

  PASAPORTES_COLA: `${API_BASE_URL}/api/pasaportes/cola`,

  /**
   * Stream SSE de logs.
   */
  PASAPORTES_LOGS: (executionId) =>
    `${API_BASE_URL}/api/pasaportes/${encodeURIComponent(executionId)}/logs`,

  /**
   * Obtener log completo.
   */
  PASAPORTES_LOG: (executionId) =>
    `${API_BASE_URL}/api/pasaportes/${encodeURIComponent(executionId)}/log`,

  /**
   * Consultar estado actual de una ejecución.
   */
  PASAPORTES_ESTADO: (executionId) =>
    `${API_BASE_URL}/api/pasaportes/${encodeURIComponent(executionId)}/estado`,

  /**
   * Enviar código OTP.
   */
  PASAPORTES_OTP: (executionId) =>
    `${API_BASE_URL}/api/pasaportes/${encodeURIComponent(executionId)}/otp`,

  /**
   * Informar al backend que el reCAPTCHA fue resuelto.
   */
  PASAPORTES_RECAPTCHA: (executionId, paso) =>
    `${API_BASE_URL}/api/pasaportes/${encodeURIComponent(
      executionId,
    )}/recaptcha-resuelto/${encodeURIComponent(paso)}`,

  // ============================================================
  // SMS
  // ============================================================

  SMS_BASE: `${API_BASE_URL}/api/sms`,

  SMS_LOGIN: `${API_BASE_URL}/api/sms/login`,

  SMS_SISTEMA_ORIGEN: `${API_BASE_URL}/api/sms/sistema-origen`,

  SMS_LOGS: (executionId) =>
    `${API_BASE_URL}/api/sms/${encodeURIComponent(executionId)}/logs`,

  SMS_ESTADO: (executionId) =>
    `${API_BASE_URL}/api/sms/${encodeURIComponent(executionId)}/estado`,
};

export default API_BASE_URL;
