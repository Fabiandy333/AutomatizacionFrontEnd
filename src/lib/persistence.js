const STORAGE_KEY = "qa-dashboard:active-executions:v2";

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("No se pudieron leer las ejecuciones activas:", error);

    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn("No se pudo guardar las ejecuciones activas:", error);
  }
}

function toSerializable(entry) {
  return {
    key: entry.key,
    executionId: entry.executionId,
    seccionNombre: entry.seccionNombre,
    casoId: entry.casoId,
    casoTitulo: entry.casoTitulo,
    startedAt: entry.startedAt,
    configPayload: entry.configPayload,
    environment: entry.environment,
    status: entry.status,
  };
}

function saveActive(planId, entries) {
  if (!planId) {
    return;
  }

  const store = readStore();

  store[planId] = {
    executions: (entries || []).map(toSerializable),
  };

  writeStore(store);
}

function loadActive(planId) {
  if (!planId) {
    return [];
  }

  const store = readStore();

  return Array.isArray(store[planId]?.executions) ? store[planId].executions : [];
}

function clearActive(planId) {
  if (!planId) {
    return;
  }

  const store = readStore();

  delete store[planId];

  writeStore(store);
}

export { saveActive, loadActive, clearActive };
