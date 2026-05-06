import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import type { Locale } from './types';

const Home         = lazy(() => import('./pages/Home'));
const Markets      = lazy(() => import('./pages/Markets'));
const MarketDetail = lazy(() => import('./pages/MarketDetail'));
const Auth         = lazy(() => import('./pages/Auth'));
const Portfolio    = lazy(() => import('./pages/Portfolio'));
const MyBets       = lazy(() => import('./pages/MyBets'));
const Profile      = lazy(() => import('./pages/Profile'));
const StaticPage   = lazy(() => import('./pages/StaticPage'));

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
    ht: { login:'konekte', register:'enskri', portfolio:'pòtfolyo', myBets:'pari-mwen', profile:'pwofil' },
    fr: { login:'connexion', register:'inscription', portfolio:'portefeuille', myBets:'mes-paris', profile:'profil' }
  }[lang];

  return (
    <Routes>
      <Route path=""                element={<Layout><Home /></Layout>} />
      <Route path="markets"         element={<Layout><Markets /></Layout>} />
      <Route path="market/:category/:slug" element={<Layout><MarketDetail /></Layout>} />
      <Route path={R.login}         element={<Layout><Auth mode="login" /></Layout>} />
      <Route path={R.register}      element={<Layout><Auth mode="register" /></Layout>} />
      <Route path={R.portfolio}     element={<ProtectedRoute><Layout><Portfolio /></Layout></ProtectedRoute>} />
      <Route path={R.myBets}        element={<ProtectedRoute><Layout><MyBets /></Layout></ProtectedRoute>} />
      <Route path={R.profile}       element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
      <Route path="cgu"             element={<Layout><StaticPage /></Layout>} />
      <Route path="confidentialite" element={<Layout><StaticPage /></Layout>} />
      <Route path="contact"         element={<Layout><StaticPage /></Layout>} />
      <Route path="about"           element={<Layout><StaticPage /></Layout>} />
      <Route path="*"               element={<Navigate to={`/${lang}`} replace />} />
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
        <Toaster position="top-center" toastOptions={{
          duration:3000,
          style:{ background:'#161b22', color:'#e6edf3', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'10px', fontSize:'13px', fontFamily:'Inter,sans-serif', maxWidth:'380px' }
        }} />
      </AuthProvider>
    </BrowserRouter>
  );
}
