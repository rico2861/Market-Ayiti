import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import type { Locale } from './types';

const NotFound          = lazy(() => import('./pages/NotFound'));
const Home              = lazy(() => import('./pages/Home'));
const Markets           = lazy(() => import('./pages/Markets'));
const PolymarketLive    = lazy(() => import('./pages/PolymarketLive'));
const MarketDetail   = lazy(() => import('./pages/MarketDetail'));
const Auth           = lazy(() => import('./pages/Auth'));
const Portfolio      = lazy(() => import('./pages/Portfolio'));
const MyBets         = lazy(() => import('./pages/MyBets'));
const Profile        = lazy(() => import('./pages/Profile'));
const StaticPage     = lazy(() => import('./pages/StaticPage'));
const AI             = lazy(() => import('./pages/AI'));
const Notifications  = lazy(() => import('./pages/Notifications'));
const Settings       = lazy(() => import('./pages/Settings'));
const Help           = lazy(() => import('./pages/Help'));
const ResetPassword  = lazy(() => import('./pages/Resetpassword'));

function PageLoader() {
  return (
    <div style={{ minHeight:'50vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:30, height:30, border:'3px solid rgba(255,255,255,0.08)', borderTopColor:'#1f6feb', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    </div>
  );
}

function LocaleDetector() {
  const navigate = useNavigate();
  const location = useLocation();
  const supported: Locale[] = ['ht','fr'];
  useEffect(() => {
    const seg = location.pathname.split('/')[1];
    if (!supported.includes(seg as Locale)) {
      const saved = (localStorage.getItem('ayiti_locale') as Locale) || 'ht';
      const lang  = supported.includes(saved) ? saved : 'ht';
      navigate(`/${lang}${location.pathname==='/'?'':location.pathname}${location.search}`, { replace:true });
    }
  }, [location.pathname]);
  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo({ top:0, behavior:'instant' }), [pathname]);
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAuth();
  const location = useLocation();
  const lang = location.pathname.split('/')[1] || 'ht';
  if (!initialized) return <PageLoader />;
  if (!user) return <Navigate to={`/${lang}/konekte`} state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
      <Header />
      <main style={{ flex:1 }}>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </main>
      <Footer />
    </div>
  );
}

function LocaleRoutes({ lang }: { lang: Locale }) {
  const R = {
    ht: { login:'konekte', register:'enskri', portfolio:'pòtfolyo', myBets:'pari-mwen', profile:'pwofil', notifications:'notifikasyon', settings:'paramèt', help:'èd', reset:'reyinisyalize' },
    fr: { login:'connexion', register:'inscription', portfolio:'portefeuille', myBets:'mes-paris', profile:'profil', notifications:'notifications', settings:'parametres', help:'aide', reset:'reinitialiser' }
  }[lang];

  return (
    <Routes>
      <Route path=""                    element={<Layout><Home /></Layout>} />
      <Route path="markets"             element={<Layout><Markets /></Layout>} />
      <Route path="live"                element={<Layout><PolymarketLive /></Layout>} />
      <Route path="market/:category/:slug" element={<Layout><MarketDetail /></Layout>} />
      <Route path={R.login}             element={<Layout><Auth mode="login" /></Layout>} />
      <Route path={R.register}          element={<Layout><Auth mode="register" /></Layout>} />
      <Route path={R.reset}             element={<Layout><ResetPassword /></Layout>} />
      <Route path={R.portfolio}         element={<ProtectedRoute><Layout><Portfolio /></Layout></ProtectedRoute>} />
      <Route path={R.myBets}            element={<ProtectedRoute><Layout><MyBets /></Layout></ProtectedRoute>} />
      <Route path={R.profile}           element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
      <Route path={R.notifications}     element={<ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>} />
      <Route path={R.settings}          element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
      <Route path={R.help}              element={<Layout><Help /></Layout>} />
      <Route path="ai"                  element={<Layout><AI /></Layout>} />
      <Route path="cgu"                 element={<Layout><StaticPage /></Layout>} />
      <Route path="confidentialite"     element={<Layout><StaticPage /></Layout>} />
      <Route path="contact"             element={<Layout><StaticPage /></Layout>} />
      <Route path="about"               element={<Layout><StaticPage /></Layout>} />
      <Route path="*"                   element={<Layout><NotFound /></Layout>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition:true, v7_relativeSplatPath:true }}>
      <AuthProvider>
        <ScrollToTop />
        <LocaleDetector />
        <Routes>
          <Route path="/"    element={<Navigate to="/ht" replace />} />
          <Route path="/ht/*" element={<LocaleRoutes lang="ht" />} />
          <Route path="/fr/*" element={<LocaleRoutes lang="fr" />} />
          <Route path="*"    element={<Navigate to="/ht" replace />} />
        </Routes>
        <Toaster
          position="top-center"
          gutter={8}
          toastOptions={{
            duration: 3500,
            style: {
              background: '#0d1117',
              color: '#e6edf3',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              maxWidth: 'min(420px, calc(100vw - 24px))',
              padding: '12px 16px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
            },
            success: {
              duration: 3000,
              iconTheme: { primary: '#3fb950', secondary: '#0d1117' },
              style: {
                background: '#0d1117',
                borderLeft: '3px solid #3fb950',
              },
            },
            error: {
              duration: 4500,
              iconTheme: { primary: '#f85149', secondary: '#0d1117' },
              style: {
                background: '#0d1117',
                borderLeft: '3px solid #f85149',
              },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
