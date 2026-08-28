const STORAGE_KEY = "qa-dashboard:active-executions:v1";

function saveActive(entries, planId) {
  try {
    const serializable = (entries || []).map((entry) => ({
      key: entry.key,
      executionId: entry.executionId,
      seccionNombre: entry.seccionNombre,
      casoId: entry.casoId,
      casoTitulo: entry.casoTitulo,
      startedAt: entry.startedAt,
      configPayload: entry.configPayload,
      environment: entry.environment,
      status: entry.status,
    }));

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        planId: planId ?? null,
        executions: serializable,
      }),
    );
  } catch (error) {
    console.warn("No se pudo guardar las ejecuciones activas:", error);
  }
}

function loadActive() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return { planId: null, executions: [] };
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return { planId: null, executions: [] };
    }

    const executions = Array.isArray(parsed.executions) ? parsed.executions : [];

    return {
      planId: parsed.planId ?? null,
      executions,
    };
  } catch (error) {
    console.warn("No se pudieron leer las ejecuciones activas:", error);

    return { planId: null, executions: [] };
  }
}

function clearActive() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("No se pudo limpiar las ejecuciones activas:", error);
  }
}

export { saveActive, loadActive, clearActive };
