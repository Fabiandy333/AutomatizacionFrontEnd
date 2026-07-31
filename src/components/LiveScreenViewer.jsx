import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import API_BASE_URL from '../config/api'

const SOCKET_URL = API_BASE_URL || window.location.origin

/**
 * Visor de pantalla EN VIVO de una ejecucion, solo lectura.
 * No envia clics, teclas ni coordenadas — unicamente muestra los
 * fotogramas que manda el backend.
 */
export default function LiveScreenViewer({ executionId }) {
  const [frame, setFrame] = useState(null)
  const [error, setError] = useState(null)
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = io(SOCKET_URL)
    socketRef.current = socket

    socket.emit('suscribirse-stream', { executionId })

    socket.on('frame', (payload) => {
      if (payload.executionId === executionId) {
        setFrame(payload.data)
        setError(null)
      }
    })

    socket.on('stream-error', (payload) => {
      if (payload.executionId === executionId) setError(payload.error)
    })

    return () => {
      socket.emit('desuscribirse-stream')
      socket.disconnect()
    }
  }, [executionId])

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#000' }}>
      {error && (
        <div style={{ padding: 12, fontSize: 12.5, color: 'var(--text-muted)' }}>{error}</div>
      )}
      {!error && frame && (
        <img
          src={`data:image/jpeg;base64,${frame}`}
          alt="Pantalla en vivo de la automatizacion (solo visualizacion)"
          style={{ width: '100%', display: 'block' }}
        />
      )}
      {!error && !frame && (
        <div style={{ padding: 12, fontSize: 12.5, color: 'var(--text-muted)' }}>Conectando con la ventana...</div>
      )}
    </div>
  )
}
