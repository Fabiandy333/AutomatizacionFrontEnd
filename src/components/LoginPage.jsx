import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const [credenciales, setCredenciales] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  function manejarCambio(e) {
    const { name, value } = e.target;
    setCredenciales((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  }

  async function manejarEnvio(e) {
    e.preventDefault();
    if (!credenciales.username.trim() || !credenciales.password) {
      setError("Completa todos los campos.");
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      await login(credenciales);
    } catch (err) {
      setError(err.message || "Error al iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-main, #0f141c)",
        padding: "20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--bg-surface, #18202c)",
          border: "1px solid var(--border, #263345)",
          borderRadius: "8px",
          padding: "32px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--text-primary, #e2e8f0)",
              margin: 0,
            }}
          >
            QA Automation Platform
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary, #8fa0b5)",
              marginTop: "6px",
            }}
          >
            Inicia sesión para acceder al panel
          </p>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #ef4444",
              color: "#fca5a5",
              padding: "10px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              marginBottom: "18px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={manejarEnvio}>
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="username"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary, #8fa0b5)",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Usuario
            </label>
            <input
              id="username"
              type="text"
              name="username"
              autoFocus
              autoComplete="username"
              value={credenciales.username}
              onChange={manejarCambio}
              disabled={enviando}
              placeholder="admin / analista / auditor"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-input, #0d131a)",
                border: "1px solid var(--border, #263345)",
                borderRadius: "6px",
                color: "#fff",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-secondary, #8fa0b5)",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={credenciales.password}
              onChange={manejarCambio}
              disabled={enviando}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-input, #0d131a)",
                border: "1px solid var(--border, #263345)",
                borderRadius: "6px",
                color: "#fff",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            style={{
              width: "100%",
              padding: "11px",
              background: enviando ? "#475569" : "#2563eb",
              border: "none",
              borderRadius: "6px",
              color: "#fff",
              fontWeight: 600,
              fontSize: "14px",
              cursor: enviando ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {enviando ? "Iniciando..." : "Ingresar"}
          </button>
        </form>

        <div
          style={{
            marginTop: "20px",
            padding: "12px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "6px",
            fontSize: "11px",
            color: "var(--text-muted, #64748b)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>Usuarios de prueba:</div>
          <div>• <strong>admin</strong> / admin123 (control total)</div>
          <div>• <strong>analista</strong> / analista123 (ejecutar + OTP)</div>
          <div>• <strong>auditor</strong> / auditor123 (solo lectura)</div>
        </div>
      </div>
    </div>
  );
}
