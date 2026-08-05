import { contarCasosProyecto, contarCasos } from '../data/projects'

function PlanButton({ plan, isActive, onSelect }) {
  if (!plan) return null
  return (
    <button
      className={`plan-btn ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(plan)}
    >
      {plan.nombre}
    </button>
  )
}

function SubproyectoBlock({ subproyecto, selectedPlanId, onSelectPlan }) {
  return (
    <div className="subproject-list">
      <div className="plan-btn disabled" style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
        {subproyecto.nombre}
      </div>
      {subproyecto.planes.length === 0 && (
        <div className="plan-btn disabled">Sin planes cargados</div>
      )}
      {subproyecto.planes.map((plan) => (
        <PlanButton
          key={plan.id}
          plan={plan}
          isActive={selectedPlanId === plan.id}
          onSelect={onSelectPlan}
        />
      ))}
    </div>
  )
}

export default function Sidebar({ projects, selectedPlanId, onSelectPlan, onToggle, collapsed }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <span className="dot" />
        <span>QA Automation</span>
        <button className="sidebar-hide-btn" onClick={onToggle} aria-label="Ocultar sidebar">✕</button>
      </div>

      <div className="project-group">
        {projects.map((proyecto) => {
          const totalCasos = contarCasosProyecto(proyecto)
          return (
            <div key={proyecto.id}>
              <div className="project-btn">
                <span>{proyecto.nombre}</span>
                <span className="count">{totalCasos || '-'}</span>
              </div>

              {proyecto.subproyectos ? (
                proyecto.subproyectos.map((sp) => (
                  <SubproyectoBlock
                    key={sp.id}
                    subproyecto={sp}
                    selectedPlanId={selectedPlanId}
                    onSelectPlan={onSelectPlan}
                  />
                ))
              ) : (
                <div className="subproject-list">
                  {proyecto.planes.length === 0 ? (
                    <div className="plan-btn disabled">Sin planes cargados</div>
                  ) : (
                    proyecto.planes.map((plan) => (
                      <PlanButton
                        key={plan.id}
                        plan={plan}
                        isActive={selectedPlanId === plan.id}
                        onSelect={onSelectPlan}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
