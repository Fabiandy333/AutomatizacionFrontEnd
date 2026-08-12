import loteriaValleSoporte from './loteria-valle-soporte.json'
import pasaporte from './pasaporte.json'
import sms from './sms.json'
import {
  configPorCaso,
  configTemplatesPorSeccion,
  endpointsPorSeccion
} from './templates'

// Cada "plan" representa un archivo de casos de prueba (uno por hoja/CSV
// exportado del plan de pruebas). Para agregar un nuevo plan:
//   1. Exporta el CSV del plan y parsealo al mismo formato que
//      loteria-valle-soporte.json (meta + secciones + casos)
//   2. Importalo arriba y agregalo al proyecto correspondiente


 // Le agrega configTemplate a cada seccion del plan, segun el mapa
 // configTemplatesPorSeccion (por nombre exacto de seccion). Si una
 // seccion no tiene plantilla asociada, queda en null.
 function conPlantillas(data) {
  if (!data?.secciones) return data

  return {
    ...data,

    secciones: data.secciones.map((seccion) => {
      const sectionTemplate =
        configTemplatesPorSeccion[seccion.nombre] ?? null

      const sectionEndpoint =
        endpointsPorSeccion[seccion.nombre] ?? null

      return {
        ...seccion,

        configTemplate: sectionTemplate?.template ?? sectionTemplate,
        configSchema: sectionTemplate?.schema ?? null,
        configEndpoint: sectionEndpoint,

        casos: seccion.casos.map((caso) => {
          const caseConfig = configPorCaso[caso.id]

          return {
            ...caso,

            // Configuración específica del caso
            configTemplate:
              caseConfig?.template ??
              sectionTemplate?.template ??
              sectionTemplate ??
              null,

            configSchema:
              caseConfig?.schema ??
              sectionTemplate?.schema ??
              null,

            configEndpoint:
              caseConfig?.endpoint ??
              sectionEndpoint ??
              null
          }
        })
      }
    })
  }
}

export const projects = [
  {
    id: 'enigma',
    nombre: 'Enigma',
    subproyectos: [
      {
        id: 'loteria-valle',
        nombre: 'Loteria del Valle',
        planes: [
          { id: 'flujo-soporte', nombre: 'Flujo Soporte', data: conPlantillas(loteriaValleSoporte) },
        ],
      },
      {
        id: 'pasaportes',
        nombre: 'Pasaportes',
        planes: [{ id: 'flujo-agendamiento', nombre: 'Flujo agendamiento', data: conPlantillas(pasaporte) }],
        // pendiente de cargar el plan de casos
      },
    ],
  },
  { id: 'octoplus', nombre: 'Octoplus', planes: [] },
  { id: 'directory', nombre: 'Directory', planes: [] },
  { id: 'sms', nombre: 'SMS', planes: [ { id: 'flujo-login', nombre: 'Flujo Login', data: conPlantillas(sms) } ] },
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
