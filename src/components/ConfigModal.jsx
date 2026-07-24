import { useEffect, useState } from 'react'

/**
 * Modal generico de "configuracion antes de ejecutar".
 * Muestra el JSON que se va a enviar al backend, permite editarlo,
 * y solo llama a onConfirm(json) si el texto es JSON valido.
 *
 * Props:
 * - isOpen: boolean
 * - title: string            -> titulo del modal (ej. "Agendar citas de pasaporte")
 * - description: string      -> texto breve explicando que se va a hacer
 * - initialData: any         -> objeto/array por defecto (la plantilla)
 * - onClose: () => void
 * - onConfirm: (parsedJson) => void   -> se dispara al presionar "Iniciar"
 */
export default function ConfigModal({ isOpen, title, description, initialData, endpoint, onClose, onConfirm }) {
  const [sending, setSending] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState(null)

  // Cada vez que se abre el modal, se reinicia con la plantilla actual
  useEffect(() => {
    if (isOpen) {
      setText(JSON.stringify(initialData, null, 2))
      setError(null)
    }
  }, [isOpen, initialData])

  if (!isOpen) return null

  async function handleConfirm() {
  let parsed
  try {
    parsed = JSON.parse(text)
    setError(null)
  } catch (e) {
    setError('El JSON no es valido: ' + e.message)
    return
  }

  if (!endpoint) {
    // Comportamiento anterior: solo entrega el JSON al padre (App/CaseRow)
    onConfirm(parsed)
    return
  }

  setSending(true)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || `El servidor respondio ${response.status}`)
    }
    onConfirm({ payload: parsed, backend: data })
  } catch (e) {
    setError('No se pudo enviar al backend: ' + e.message)
  } finally {
    setSending(false)
  }
}

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        {description && <p className="modal-description">{description}</p>}

        <label className="modal-label" htmlFor="config-json-editor">
          Datos que se enviaran al backend (puedes editarlos antes de iniciar)
        </label>
        <textarea
          id="config-json-editor"
          className="modal-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>

          <button
            className="btn primary"
            onClick={handleConfirm}
            disabled={sending}
          >
            <span className="icon-play" /> {sending ? "Enviando..." : "Iniciar"}
          </button>
        </div>
      </div>
    </div>
  );
}
