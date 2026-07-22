# QA Dashboard

Frontend en React + Vite para organizar y ejecutar los scripts de automatizacion
de QA, agrupados por proyecto > (subproyecto) > plan de casos de prueba > secciones > casos.

## Instalar y correr

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

## Estructura

```
src/
  data/
    projects.js                  Arbol de proyectos, subproyectos y planes
    loteria-valle-soporte.json   Datos parseados del CSV "Flujo Soporte"
  components/
    Sidebar.jsx      Navegacion: proyectos -> subproyectos -> planes
    MetaBar.jsx       Barra de datos del plan (celular de pruebas, recepcionador, etc.)
    TestSection.jsx  Agrupador de casos (ej. "Validacion de ingreso por WhatsApp")
    CaseRow.jsx      Fila de un caso individual con boton de ejecutar
    LogPanel.jsx     Panel de log de ejecucion en vivo
  App.jsx            Estado global: plan seleccionado, resultados en vivo, log
```

## Como agregar un nuevo proyecto o plan de pruebas

1. Exporta el CSV del plan de pruebas (mismo formato: fila de metadata,
   encabezados, luego filas donde la primera columna es un nombre de
   seccion y las demas van vacias, seguidas de las filas `LDV-QA-XX`, etc.)
2. Parsealo al formato JSON usado en `loteria-valle-soporte.json`:
   ```json
   {
     "meta": { "recepcionador": "...", "celularPruebas": "...", ... },
     "secciones": [
       { "nombre": "Validacion de ingreso por WhatsApp", "casos": [ { "id": "LDV-QA-01", "criterio": "...", "pasos": "...", "estado": "EXITOSO", ... } ] }
     ]
   }
   ```
3. Importalo en `src/data/projects.js` y agregalo al arreglo `planes` del
   proyecto o subproyecto correspondiente (Enigma, Octoplus, Directory, SMS,
   SmartBot, Tu Viaje).

## Conectar con la ejecucion real (Playwright)

Ahora mismo `runCase()` en `App.jsx` **simula** la ejecucion (usa `setTimeout`
y marca exitoso/fallido segun el ultimo estado historico del CSV). Para
conectarlo a scripts reales de Playwright:

1. Crea un backend (Node/Express) que reciba `POST /api/run/:casoId` y
   corra el script correspondiente con `child_process.spawn`.
2. Transmite el stdout del proceso por WebSocket o Server-Sent Events.
3. En `runCase()`, reemplaza los `setTimeout` por la llamada real al
   backend y suscribete al canal de log para ir llenando `logLines` con
   lo que realmente devuelve el script (en vez del texto simulado).

## Notas de diseno

- Los IDs de caso, celular de pruebas y correos se muestran en fuente
  monoespaciada (JetBrains Mono) para distinguir datos "de sistema" del
  texto descriptivo.
- Los estados de los casos distinguen entre el **historico** (lo que dice
  el CSV: EXITOSO/FALLIDO) y el **resultado en vivo** de esta sesion
  (badge "Ejecutando" / "Exitoso" / "Fallido" sin el sufijo "ult. corrida").
