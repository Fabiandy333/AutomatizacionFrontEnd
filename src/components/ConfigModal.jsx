import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../config/api'

function cloneData(data) {
  return JSON.parse(JSON.stringify(data ?? {}))
}

function normalizeValue(value, type) {
  if (type === 'date' && value) {
    return value
  }

  return value ?? ''
}

function shouldShowField(field, formData) {
  if (!field.showWhen) return true

  const currentValue = formData[field.showWhen.field]

  return currentValue === field.showWhen.equals
}

function Field({ field, value, onChange, formData }) {
  if (!shouldShowField(field, formData)) {
    return null
  }

  const id = `config-${field.name}`

  if (field.type === 'select') {
    return (
      <div className="config-field">
        <label htmlFor={id}>
          {field.label}
          {field.required && <span className="required">*</span>}
        </label>

        <select
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
        >
          <option value="">Seleccione...</option>

          {(field.options || []).map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === 'radio') {
    return (
      <div className="config-field">
        <label>
          {field.label}
          {field.required && <span className="required">*</span>}
        </label>

        <div className="radio-group">
          {(field.options || []).map((option) => {
            const checked = value === option.value

            return (
              <label
                key={String(option.value)}
                className="radio-option"
              >
                <input
                  type="radio"
                  name={field.name}
                  checked={checked}
                  onChange={() => onChange(field.name, option.value)}
                />

                <span>{option.label}</span>
              </label>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="config-field">
      <label htmlFor={id}>
        {field.label}
        {field.required && <span className="required">*</span>}
      </label>

      <input
        id={id}
        type={field.type || 'text'}
        value={normalizeValue(value, field.type)}
        onChange={(e) => onChange(field.name, e.target.value)}
      />

      {field.format && (
        <small>Formato: {field.format}</small>
      )}
    </div>
  )
}

function FormSection({ section, formData, updateField }) {
  return (
    <div className="config-section">
      <h4>{section.title}</h4>

      {section.description && (
        <p className="config-section-description">
          {section.description}
        </p>
      )}

      <div className="config-fields">
        {(section.fields || []).map((field) => (
          <Field
            key={field.name}
            field={field}
            value={formData[field.name]}
            formData={formData}
            onChange={updateField}
          />
        ))}
      </div>
    </div>
  )
}

function validateForm(schema, formData) {
  if (!schema?.sections) return null

  for (const section of schema.sections) {
    for (const field of section.fields || []) {
      if (!field.required) continue

      if (!shouldShowField(field, formData)) continue

      const value = formData[field.name]

      if (
        value === undefined ||
        value === null ||
        value === ''
      ) {
        return `El campo "${field.label}" es obligatorio.`
      }
    }
  }

  return null
}

export default function ConfigModal({
  isOpen,
  title,
  description,
  initialData,
  schema,
  endpoint,
  onClose,
  onConfirm
}) {
  const [sending, setSending] = useState(false)
  const [records, setRecords] = useState([])
  const [selectedRecord, setSelectedRecord] = useState(0)
  const [error, setError] = useState(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')

  const isBatch = Array.isArray(initialData)

  useEffect(() => {
    if (!isOpen) return

    const cloned = cloneData(initialData)

    if (Array.isArray(cloned)) {
      setRecords(cloned)
      setSelectedRecord(0)
    } else {
      setRecords([cloned])
      setSelectedRecord(0)
    }

    setJsonText(JSON.stringify(cloned, null, 2))
    setError(null)
    setAdvancedOpen(false)
  }, [isOpen, initialData])

  const currentRecord = records[selectedRecord] || {}

  const updateField = (name, value) => {
    setRecords((previous) => {
      const updated = [...previous]

      updated[selectedRecord] = {
        ...updated[selectedRecord],
        [name]: value
      }

      return updated
    })
  }

  useEffect(() => {
    setJsonText(
      JSON.stringify(
        isBatch ? records : records[0],
        null,
        2
      )
    )
  }, [records, isBatch])

  const validationError = useMemo(() => {
    if (!schema) return null

    return validateForm(schema, currentRecord)
  }, [schema, currentRecord])

  if (!isOpen) return null

  async function handleConfirm() {
    setError(null)

    if (validationError) {
      setError(validationError)
      return
    }

    const payload = isBatch ? records : records[0]

    if (!endpoint) {
      onConfirm(payload)
      return
    }

    setSending(true)

    try {
      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error ||
          `El servidor respondió ${response.status}`
        )
      }

      onConfirm({
        payload,
        backend: data
      })
    } catch (e) {
      setError(
        'No se pudo enviar al backend: ' + e.message
      )
    } finally {
      setSending(false)
    }
  }

  function handleJsonChange(value) {
    setJsonText(value)

    try {
      const parsed = JSON.parse(value)

      if (Array.isArray(parsed)) {
        setRecords(parsed)
      } else {
        setRecords([parsed])
      }

      setError(null)
    } catch {
      // Se permite editar JSON sin bloquear mientras está incompleto.
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal-panel config-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>
              {title || 'Configuración de ejecución'}
            </h3>

            {description && (
              <p className="modal-description">
                {description}
              </p>
            )}
          </div>

          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {isBatch && records.length > 1 && (
          <div className="config-record-selector">
            <label>Datos de prueba</label>

            <select
              value={selectedRecord}
              onChange={(e) =>
                setSelectedRecord(Number(e.target.value))
              }
            >
              {records.map((record, index) => (
                <option
                  key={index}
                  value={index}
                >
                  Usuario {index + 1} —{' '}
                  {record.name || 'Sin nombre'}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="config-form">
          {schema?.sections?.map((section) => (
            <FormSection
              key={section.title}
              section={section}
              formData={currentRecord}
              updateField={updateField}
            />
          ))}
        </div>

        {!schema && (
          <div className="modal-error">
            Este caso todavía no tiene un formulario de
            configuración definido.
          </div>
        )}

        {error && (
          <div className="modal-error">
            {error}
          </div>
        )}

        <div className="advanced-config">
          <button
            type="button"
            className="advanced-toggle"
            onClick={() =>
              setAdvancedOpen((value) => !value)
            }
          >
            <span>
              {advancedOpen ? '▼' : '▶'}
            </span>

            Configuración avanzada
          </button>

          {advancedOpen && (
            <div className="advanced-content">
              <p>
                Vista técnica del payload que será enviado
                al backend.
              </p>

              <textarea
                className="modal-textarea"
                value={jsonText}
                onChange={(e) =>
                  handleJsonChange(e.target.value)
                }
                spellCheck={false}
              />
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button
            className="btn"
            onClick={onClose}
            disabled={sending}
          >
            Cancelar
          </button>

          <button
            className="btn primary"
            onClick={handleConfirm}
            disabled={
              sending ||
              !schema ||
              !!validationError
            }
          >
            <span className="icon-play" />

            {sending
              ? 'Enviando...'
              : 'Ejecutar prueba'}
          </button>
        </div>
      </div>
    </div>
  )
}