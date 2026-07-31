import { useState } from 'react'
import { apiFetch } from '../config/api'

/**
 * Modal para ingresar el codigo OTP que llego al correo del titular.
 * Al confirmar, hace POST a /:executionId/otp y avisa al padre.
 */
export default function OtpModal({ isOpen, email, executionId, apiBase, onClose, onSubmitted }) {
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  async function handleSubmit() {
    if (!codigo.trim()) {
      setError('Ingresa el codigo que llego al correo')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const response = await apiFetch(`${apiBase}/${executionId}/otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: codigo.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `El servidor respondio ${response.status}`)
      setCodigo('')
      onSubmitted()
    } catch (e) {
      setError('No se pudo enviar el codigo: ' + e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3>Ingresar código de verificación</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <p className="modal-description">
          Se envió un código al correo <strong>{email}</strong>. Revísalo e ingrésalo aquí para continuar con el agendamiento.
        </p>

        <label className="modal-label" htmlFor="otp-input">Código recibido</label>
        <input
          id="otp-input"
          className="modal-textarea"
          style={{ minHeight: 'auto', textAlign: 'center', fontSize: 18, letterSpacing: 4 }}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          maxLength={6}
          placeholder="000000"
          autoFocus
        />

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={enviando}>Cancelar</button>
          <button className="btn primary" onClick={handleSubmit} disabled={enviando}>
            {enviando ? 'Enviando...' : 'Confirmar código'}
          </button>
        </div>
      </div>
    </div>
  )
}
