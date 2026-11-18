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
import FolderAdmin from './pages/FolderAdmin';
import InternalLayout from './pages/internal/InternalLayout';
import InternalDashboard from './pages/internal/InternalDashboard';
import InternalProjects from './pages/internal/InternalProjects';
import InternalProjectDetail from './pages/internal/InternalProjectDetail';
import InternalSettings from './pages/internal/InternalSettings';
import { InternalActivitiesPage, InternalAm196Page, InternalStaffPage, InternalAlertsPage } from './pages/internal/InternalPages';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** El rol "asistente" solo usa Documentación Interna. */
function Home() {
  const { user } = useAuth();
  if (user?.role === 'asistente') return <Navigate to="/interna" replace />;
  return <Dashboard />;
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
        <Route index element={<Home />} />
        <Route path="proyectos" element={<Projects />} />
        <Route path="proyectos/:id" element={<ProjectDetail />} />
        <Route path="contratistas" element={<Contractors />} />
        <Route path="revision" element={<Review />} />
        <Route path="sanciones" element={<Sanctions />} />
        <Route path="reportes" element={<Reports />} />
        <Route path="equipo" element={<Team />} />
        <Route path="carpetas" element={<FolderAdmin />} />
        <Route path="auditoria" element={<Audit />} />
        <Route path="interna" element={<InternalLayout />}>
          <Route index element={<InternalDashboard />} />
          <Route path="obras" element={<InternalProjects />} />
          <Route path="obras/:id" element={<InternalProjectDetail />} />
          <Route path="actividades" element={<InternalActivitiesPage />} />
          <Route path="am196" element={<InternalAm196Page />} />
          <Route path="personal" element={<InternalStaffPage />} />
          <Route path="alertas" element={<InternalAlertsPage />} />
          <Route path="configuracion" element={<InternalSettings />} />
        </Route>
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
