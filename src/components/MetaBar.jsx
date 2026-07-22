export default function MetaBar({ meta }) {
  if (!meta) return null

  const items = [
    { label: 'Celular de pruebas', value: meta.celularPruebas },
    { label: 'Recepcionador', value: meta.recepcionador },
    { label: 'Correo recepcionador', value: meta.correoRecepcionador },
    { label: 'Usuario / Clave', value: `${meta.usuario} / ${meta.clave}` },
    meta.evidenciasUrl && {
      label: 'Evidencias',
      value: <a href={meta.evidenciasUrl} target="_blank" rel="noreferrer">Ver carpeta</a>,
      raw: true,
    },
    meta.docFuncionalUrl && {
      label: 'Doc. funcional',
      value: <a href={meta.docFuncionalUrl} target="_blank" rel="noreferrer">Abrir</a>,
      raw: true,
    },
  ].filter(Boolean)

  return (
    <div className="meta-bar">
      {items.map((item) => (
        <div className="meta-item" key={item.label}>
          <div className="label">{item.label}</div>
          <div className="value">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
