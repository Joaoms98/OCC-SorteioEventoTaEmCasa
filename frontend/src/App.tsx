import { Navigate, Route, Routes, useLocation, useParams } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { DrawStagePage } from './pages/DrawStagePage';
import { EventDetailPage } from './pages/event-detail/EventDetailPage';
import { EventsPage } from './pages/EventsPage';
import { HomePage } from './pages/HomePage';
import { LivePage } from './pages/LivePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PublicRegistrationPage } from './pages/PublicRegistrationPage';
import { adminPaths, publicPaths } from './routes';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/register/:eventId" element={<PublicRegistrationPage />} />
      <Route path="/live/:eventId" element={<LivePage />} />

      {/* Organizer area: only reachable by typing /admin (the public pages do not link to it). */}
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/admin" element={<EventsPage />} />
        <Route path="/admin/events" element={<Navigate to={adminPaths.home} replace />} />
        <Route path="/admin/events/:eventId" element={<EventDetailPage />} />
      </Route>
      <Route
        path="/admin/events/:eventId/draw"
        element={
          <RequireAuth>
            <DrawStagePage />
          </RequireAuth>
        }
      />

      {/* Addresses from before the organizer area moved to /admin. */}
      <Route path="/login" element={<Navigate to={adminPaths.login} replace />} />
      <Route path="/events/*" element={<LegacyAdminRedirect />} />
      {/* The interactive roulette used to have its own pages; it now lives on the registration page. */}
      <Route path="/spin/:eventId" element={<RegistrationRedirect />} />
      <Route path="/kiosk/:eventId" element={<RegistrationRedirect />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function RegistrationRedirect() {
  const { eventId = '' } = useParams();
  return <Navigate to={publicPaths.register(eventId)} replace />;
}

/** /events -> /admin and /events/<id>[/draw] -> /admin/events/<id>[/draw], keeping the query string. */
function LegacyAdminRedirect() {
  const { pathname, search } = useLocation();
  const rest = pathname.replace(/^\/events\/?/, '');
  return <Navigate to={`${rest ? `/admin/events/${rest}` : adminPaths.home}${search}`} replace />;
}
