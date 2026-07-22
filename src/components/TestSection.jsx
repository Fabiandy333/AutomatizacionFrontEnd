import CaseRow from './CaseRow'

export default function TestSection({ seccion, liveStatuses, onRunCase }) {
  const firstId = seccion.casos[0]?.id
  const lastId = seccion.casos[seccion.casos.length - 1]?.id

  return (
    <section className="section">
      <div className="section-header">
        <h2>{seccion.nombre}</h2>
        <span className="case-ids">
          {firstId}{lastId && lastId !== firstId ? ` - ${lastId}` : ''} ({seccion.casos.length})
        </span>
      </div>

      <div>
        {seccion.casos.map((caso, idx) => (
          <CaseRow
            key={`${caso.id}-${idx}`}
            caso={caso}
            liveStatus={liveStatuses[`${seccion.nombre}-${caso.id}-${idx}`]}
            onRun={() => onRunCase(seccion, caso, idx)}
          />
        ))}
      </div>
    </section>
  )
}
