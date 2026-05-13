import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';

const AdminLogin        = lazy(() => import('./pages/AdminLogin'));
const Dashboard         = lazy(() => import('./pages/Dashboard'));
const AdminMarkets      = lazy(() => import('./pages/AdminMarkets'));
const AdminUsers        = lazy(() => import('./pages/AdminUsers'));
const AdminTransactions = lazy(() => import('./pages/AdminTransactions'));
const AdminCategories   = lazy(() => import('./pages/AdminCategories'));
const AdminSettings     = lazy(() => import('./pages/AdminSettings'));
const AdminLogs         = lazy(() => import('./pages/AdminLogs'));
const AdminComments     = lazy(() => import('./pages/AdminComments'));
const AdminFraud        = lazy(() => import('./pages/AdminFraud'));

function Loader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1117' }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.08)', borderTopColor: '#1f6feb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { admin, initialized } = useAdminAuth();
  const location = useLocation();
  if (!initialized) return <Loader />;
  if (!admin || admin.role !== 'admin') return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function RedirectIfAdmin() {
  const { admin, initialized } = useAdminAuth();
  if (!initialized) return <Loader />;
  if (admin?.role === 'admin') return <Navigate to="/dashboard" replace />;
  return <Suspense fallback={<Loader />}><AdminLogin /></Suspense>;
}

const PROTECTED = [
  { path: '/dashboard',     el: Dashboard },
  { path: '/markets',       el: AdminMarkets },
  { path: '/users',         el: AdminUsers },
  { path: '/transactions',  el: AdminTransactions },
  { path: '/categories',    el: AdminCategories },
  { path: '/comments',      el: AdminComments },
  { path: '/settings',      el: AdminSettings },
  { path: '/logs',          el: AdminLogs },
  { path: '/fraud',         el: AdminFraud },
];

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <Routes>
          <Route path="/login" element={<RedirectIfAdmin />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {PROTECTED.map(({ path, el: El }) => (
            <Route key={path} path={path} element={
              <RequireAdmin>
                <Suspense fallback={<Loader />}><El /></Suspense>
              </RequireAdmin>
            } />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#161b22', color: '#e6edf3',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', fontSize: '13px', fontFamily: 'Inter, sans-serif'
            },
            success: { iconTheme: { primary: '#3fb950', secondary: '#0d1117' } },
            error:   { iconTheme: { primary: '#f85149', secondary: '#0d1117' } },
          }}
        />
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
