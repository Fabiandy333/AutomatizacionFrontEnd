import loteriaValleSoporte from './loteria-valle-soporte.json'

// Cada "plan" representa un archivo de casos de prueba (uno por hoja/CSV
// exportado del plan de pruebas). Para agregar un nuevo plan:
//   1. Exporta el CSV del plan y parsealo al mismo formato que
//      loteria-valle-soporte.json (meta + secciones + casos)
//   2. Importalo arriba y agregalo al proyecto correspondiente

export const projects = [
  {
    id: 'enigma',
    nombre: 'Enigma',
    subproyectos: [
      {
        id: 'loteria-valle',
        nombre: 'Loteria del Valle',
        planes: [
          { id: 'flujo-soporte', nombre: 'Flujo Soporte', data: loteriaValleSoporte },
        ],
      },
      {
        id: 'pasaportes',
        nombre: 'Pasaportes',
        planes: [], // pendiente de cargar el plan de casos
      },
    ],
  },
  { id: 'octoplus', nombre: 'Octoplus', planes: [] },
  { id: 'directory', nombre: 'Directory', planes: [] },
  { id: 'sms', nombre: 'SMS', planes: [] },
  { id: 'smartbot', nombre: 'SmartBot', planes: [] },
  { id: 'tu-viaje', nombre: 'Tu Viaje', planes: [] },
]

// Helper: cuenta total de casos de un plan
export function contarCasos(plan) {
  if (!plan?.data?.secciones) return 0
  return plan.data.secciones.reduce((acc, s) => acc + s.casos.length, 0)
}

// Helper: cuenta total de casos de un proyecto (sumando subproyectos y planes)
export function contarCasosProyecto(proyecto) {
  const planes = proyecto.subproyectos
    ? proyecto.subproyectos.flatMap((sp) => sp.planes)
    : proyecto.planes || []
  return planes.reduce((acc, p) => acc + contarCasos(p), 0)
}
