// Configuración centralizada de URLs de API
// Todas las URLs del backend se definen aquí para fácil mantenimiento

// En desarrollo se usa la ruta relativa para que Vite la envíe al proxy. En
// producción se puede configurar un backend externo con VITE_API_BASE_URL.
const API_BASE_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_BASE_URL || ''

export const API_ENDPOINTS = {
  // Pasaportes
  PASAPORTES_BASE: `${API_BASE_URL}/api/pasaportes`,
  PASAPORTES_AGENDAR: `${API_BASE_URL}/api/pasaportes/agendar`,
  PASAPORTES_LOGS: (executionId) => `${API_BASE_URL}/api/pasaportes/${executionId}/logs`,
  PASAPORTES_ESTADO: (executionId) => `${API_BASE_URL}/api/pasaportes/${executionId}/estado`,
  PASAPORTES_OTP: (executionId) => `${API_BASE_URL}/api/pasaportes/${executionId}/otp`,
}

export default API_BASE_URL;
