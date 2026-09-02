import { contarCasosProyecto } from '../data/projects'
import { useAuth } from '../context/AuthContext'

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
  const { usuario, logout, puedeVerProyecto } = useAuth();

  // Filtrar empresas y proyectos según lo que el usuario tiene permitido ver
  const proyectosFiltrados = projects
    .map((empresa) => {
      // Si el usuario puede ver toda la empresa
      const veEmpresa = puedeVerProyecto(empresa.id);

      const subproyectos = (empresa.subproyectos || []).filter((sp) => {
        if (veEmpresa) return true;
        return puedeVerProyecto(sp.id);
      });

      if (!veEmpresa && subproyectos.length === 0) {
        return null;
      }

      return {
        ...empresa,
        subproyectos,
      };
    })
    .filter(Boolean);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <span className="dot" />
        <span>QA Automation</span>
        <button className="sidebar-hide-btn" onClick={onToggle} aria-label="Ocultar sidebar">✕</button>
      </div>

      {usuario && (
        <div
          style={{
            padding: "10px 14px",
            margin: "8px 10px 14px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border, #263345)",
            borderRadius: "6px",
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary, #e2e8f0)" }}>
              {usuario.username}
            </span>
            <span
              style={{
                fontSize: "10px",
                padding: "2px 6px",
                background: "rgba(37,99,235,0.2)",
                color: "#60a5fa",
                borderRadius: "4px",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              {usuario.rolNombre || usuario.rol}
            </span>
          </div>
          <button
            onClick={logout}
            style={{
              marginTop: "8px",
              width: "100%",
              padding: "4px 8px",
              background: "transparent",
              border: "1px solid var(--border, #263345)",
              color: "var(--text-secondary, #8fa0b5)",
              borderRadius: "4px",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      )}

      <div className="project-group">
        {proyectosFiltrados.length === 0 ? (
          <div style={{ padding: "16px", fontSize: "12px", color: "var(--text-muted)" }}>
            No tienes proyectos asignados.
          </div>
        ) : (
          proyectosFiltrados.map((proyecto) => {
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
          })
        )}
      </div>
    </aside>
  )
}
