import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Contractors from './pages/Contractors';
import Review from './pages/Review';
import Audit from './pages/Audit';
import Sanctions from './pages/Sanctions';
import Reports from './pages/Reports';
import PublicUpload from './pages/PublicUpload';
import Team from './pages/Team';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/subir/:token" element={<PublicUpload />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="proyectos" element={<Projects />} />
        <Route path="proyectos/:id" element={<ProjectDetail />} />
        <Route path="contratistas" element={<Contractors />} />
        <Route path="revision" element={<Review />} />
        <Route path="sanciones" element={<Sanctions />} />
        <Route path="reportes" element={<Reports />} />
        <Route path="equipo" element={<Team />} />
        <Route path="auditoria" element={<Audit />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
