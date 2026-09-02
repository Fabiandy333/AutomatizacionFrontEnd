import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import LoginPage from './components/LoginPage.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import './styles.css'

function ProtectedApp() {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-main, #0f141c)',
          color: 'var(--text-secondary, #8fa0b5)',
        }}
      >
        Cargando sesión...
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return <App />;
}

function PublicLogin() {
  const { usuario, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (usuario) {
    return <Navigate to="/" replace />;
  }

  return <LoginPage />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicLogin />} />
          <Route path="/:empresaId/:proyectoId/:planId" element={<ProtectedApp />} />
          <Route path="*" element={<ProtectedApp />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
)
