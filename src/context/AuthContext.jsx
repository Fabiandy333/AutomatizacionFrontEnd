import { createContext, useContext, useState, useEffect } from "react";
import { apiFetch, API_ENDPOINTS } from "../config/api";

const AuthContext = createContext(null);

export const ROLES = {
  admin: {
    nombre: "Administrador",
    permisos: {
      ejecutar: true,
      configurar: true,
      verLogs: true,
      verEvidencias: true,
      verResultados: true,
      verMetricas: true,
      programar: true,
      ejecucionMasiva: true,
      gestionarUsuarios: true,
      gestionarProyectos: true,
    },
  },
  "qa-lead": {
    nombre: "QA Lead",
    permisos: {
      ejecutar: true,
      configurar: true,
      verLogs: true,
      verEvidencias: true,
      verResultados: true,
      verMetricas: true,
      programar: true,
      ejecucionMasiva: true,
      gestionarUsuarios: false,
      gestionarProyectos: false,
    },
  },
  analista: {
    nombre: "Analista QA",
    permisos: {
      ejecutar: true,
      configurar: true,
      verLogs: true,
      verEvidencias: true,
      verResultados: true,
      verMetricas: false,
      programar: false,
      ejecucionMasiva: false,
      gestionarUsuarios: false,
      gestionarProyectos: false,
    },
  },
  auditor: {
    nombre: "Auditor",
    permisos: {
      ejecutar: false,
      configurar: false,
      verLogs: true,
      verEvidencias: true,
      verResultados: true,
      verMetricas: true,
      programar: false,
      ejecucionMasiva: false,
      gestionarUsuarios: false,
      gestionarProyectos: false,
    },
  },
};

function guardarEnLocalStorage(key, valor) {
  try {
    localStorage.setItem(key, JSON.stringify(valor));
  } catch (e) {
    console.warn("No se pudo guardar en localStorage:", e);
  }
}

function leerDeLocalStorage(key) {
  try {
    const valor = localStorage.getItem(key);
    return valor ? JSON.parse(valor) : null;
  } catch (e) {
    console.warn("No se pudo leer localStorage:", e);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tokenGuardado = leerDeLocalStorage("authToken");
    const usuarioGuardado = leerDeLocalStorage("authUser");

    if (tokenGuardado && usuarioGuardado) {
      setToken(tokenGuardado);
      setUsuario(usuarioGuardado);
    }

    setLoading(false);
  }, []);

  async function login({ username, password }) {
    setLoading(true);
    try {
      const response = await apiFetch(API_ENDPOINTS.AUTH_LOGIN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Credenciales incorrectas");
      }

      const usuarioData = {
        username: data.usuario.username,
        rol: data.usuario.rol,
        rolNombre: data.usuario.rolNombre,
        permisos: data.usuario.permisos,
        proyectosVisibles: data.usuario.proyectosVisibles,
      };

      guardarEnLocalStorage("authUser", usuarioData);
      guardarEnLocalStorage("authToken", data.token);

      setToken(data.token);
      setUsuario(usuarioData);
      return usuarioData;
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("authUser");
    localStorage.removeItem("authToken");
    setToken(null);
    setUsuario(null);
  }

  function tienePermiso(permiso) {
    if (!usuario?.rol) return false;
    const permisos = usuario.permisos || ROLES[usuario.rol]?.permisos || {};
    return Boolean(permisos[permiso]);
  }

  function puedeVerProyecto(id) {
    if (!usuario) return false;
    const visibles = usuario.proyectosVisibles;
    if (visibles === "*") return true;
    if (Array.isArray(visibles)) {
      return visibles.includes(id);
    }
    return visibles === id;
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        loading,
        login,
        logout,
        tienePermiso,
        puedeVerProyecto,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}
