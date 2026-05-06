import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Phone, AtSign, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { authAPI } from '../api';
import clsx from 'clsx';

interface Props { mode: 'login' | 'register'; }
type DetectedType = 'email' | 'phone' | 'username' | 'invalid' | null;

export default function Auth({ mode }: Props) {
  const { t } = useTranslation();
  const { login, register, user } = useAuth();
  const { path } = useLocale();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [identifier,     setIdentifier]     = useState('');
  const [password,       setPassword]       = useState('');
  const [email,          setEmail]          = useState('');
  const [fullName,       setFullName]       = useState('');
  const [showPw,         setShowPw]         = useState(false);
  const [detected,       setDetected]       = useState<DetectedType>(null);
  const [normalizedValue,setNormalizedValue] = useState('');
  const [busy,           setBusy]           = useState(false);
  const [error,          setError]          = useState('');
  const [suggestions,    setSuggestions]    = useState<string[]>([]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate((location.state as any)?.from || path('home'), { replace: true });
  }, [user]);

  // Live detection — debounced 400ms, avoids spamming backend
  const detectFn = useDebouncedCallback(async (val: string) => {
    if (!val || val.length < 2) { setDetected(null); setNormalizedValue(''); return; }
    try {
      const res = await authAPI.detect(val);
      setDetected(res.data.type as DetectedType);
      setNormalizedValue(res.data.value);
    } catch { setDetected(null); }
  }, 400);

  useEffect(() => { detectFn(identifier); }, [identifier]);

  const pwStrength = useMemo(() => {
    if (!password) return null;
    let s = 0;
    if (password.length >= 8)  s++;
    if (password.length >= 12) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s <= 2 ? 'weak' : s === 3 ? 'medium' : 'strong';
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier || !password) { setError('Tout chan obligatwa'); return; }
    if (detected === 'invalid') { setError(t('auth.identifier_hint_invalid')); return; }
    if (mode === 'register' && !email) { setError('Imel obligatwa'); return; }
    if (mode === 'register' && password.length < 8) { setError('Modpas dwe omwen 8 karaktè'); return; }

    setBusy(true);
    try {
      if (mode === 'login') {
        const { via } = await login(identifier, password);
        toast.success(t('auth.welcome'));
        toast(t(`auth.via_${via}`), { duration: 1500, icon: '✓' });
      } else {
        await register({ identifier, password, email, full_name: fullName || undefined });
        toast.success(t('auth.account_created'));
      }
      navigate(path('home'), { replace: true });
    } catch (e: any) {
      const detail = e.response?.data?.detail || e.response?.data?.errors?.[0]?.message || 'Erè entèn';
      setError(detail);
      // Fetch suggestions if username conflict
      if (e.response?.status === 400 && detail.includes('itilizatè')) {
        try {
          const parts = fullName.trim().split(' ');
          const sRes = await authAPI.requestReset(identifier); // reuse endpoint temporarily
          // Actually call suggest-username
          const r = await fetch(`/api/v1/auth/suggest-username?first=${encodeURIComponent(parts[0]||'')}&last=${encodeURIComponent(parts[1]||'')}`);
          const d = await r.json();
          setSuggestions(d.suggestions || []);
        } catch {}
      }
    } finally { setBusy(false); }
  };

  const HintIcon = detected === 'email' ? Mail
    : detected === 'phone'    ? Phone
    : detected === 'username' ? AtSign
    : AlertCircle;

  return (
    <div className="container py-8 md:py-16 fade-in">
      <div className="mx-auto" style={{ maxWidth: 420 }}>

        {/* Heading only — intentionally no logo/icon on auth pages */}
        <div className="text-center mb-7">
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'white', margin: '0 0 6px' }}>
            {mode === 'login' ? t('auth.login_title') : t('auth.register_title')}
          </h1>
          <p style={{ fontSize: 14, color: '#8b949e', margin: 0 }}>
            {mode === 'login' ? t('auth.login_sub') : t('auth.register_sub')}
          </p>
        </div>

        <div className="rounded-xl p-5 md:p-6"
          style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.08)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ── HYBRID IDENTIFIER ─────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label style={{ fontSize: 11, color: '#8b949e', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('auth.identifier')}
                </label>
                {detected && detected !== 'invalid' && (
                  <span className={clsx('id-hint', `id-hint-${detected}`)}>
                    <HintIcon className="w-2.5 h-2.5" />
                    {t(`auth.identifier_hint_${detected}`)}
                  </span>
                )}
                {detected === 'invalid' && identifier.length > 2 && (
                  <span className="id-hint id-hint-invalid">
                    <AlertCircle className="w-2.5 h-2.5" />
                    {t('auth.identifier_hint_invalid')}
                  </span>
                )}
              </div>
              <input
                type="text" autoFocus autoComplete="username"
                value={identifier} onChange={e => setIdentifier(e.target.value)}
                placeholder={t('auth.identifier_placeholder')}
                className={clsx('input',
                  detected && detected !== 'invalid' ? 'input-success' :
                  detected === 'invalid' && identifier.length > 2 ? 'input-error' : ''
                )}
              />
              {normalizedValue && detected === 'phone' && normalizedValue !== identifier && (
                <p style={{ fontSize: 11, color: '#3fb950', margin: '4px 0 0',
                  fontFamily: 'JetBrains Mono, monospace' }}>→ {normalizedValue}</p>
              )}
            </div>

            {/* ── REGISTER ONLY: email + optional full name ─────────── */}
            {mode === 'register' && (
              <>
                <div>
                  <label style={{ fontSize: 11, color: '#8b949e', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    {t('auth.email')} *
                  </label>
                  <input type="email" autoComplete="email"
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder={t('auth.email_placeholder')} className="input" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#8b949e', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    {t('auth.full_name')}{' '}
                    <span style={{ color: '#484f58', fontWeight: 400, textTransform: 'none' }}>(opsyonèl)</span>
                  </label>
                  <input type="text" autoComplete="name"
                    value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder={t('auth.full_name_placeholder')} className="input" />
                </div>
              </>
            )}

            {/* ── PASSWORD ──────────────────────────────────────────── */}
            <div>
              <label style={{ fontSize: 11, color: '#8b949e', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                {t('auth.password')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={t('auth.password_placeholder')}
                  className="input" style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e' }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'register' && pwStrength && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 3, borderRadius: 2, transition: 'background .3s',
                      background:
                        pwStrength === 'weak'   && i === 1 ? '#f85149' :
                        pwStrength === 'medium' && i <= 2  ? '#d29922' :
                        pwStrength === 'strong'            ? '#3fb950' :
                        'rgba(255,255,255,0.06)'
                    }} />
                  ))}
                </div>
              )}
            </div>

            {/* ── ERROR ─────────────────────────────────────────────── */}
            {suggestions.length > 0 && (
              <div style={{ background:'rgba(31,111,235,0.08)', border:'1px solid rgba(31,111,235,0.2)', borderRadius:8, padding:'8px 12px', marginBottom:12 }}>
                <div style={{ fontSize:11, color:'#8b949e', marginBottom:6 }}>💡 Non itilizatè disponib:</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {suggestions.map(s => (
                    <button key={s} onClick={() => { setIdentifier(s); setSuggestions([]); }}
                      style={{ padding:'4px 10px', borderRadius:20, background:'rgba(31,111,235,0.15)', color:'#388bfd',
                        border:'1px solid rgba(31,111,235,0.3)', fontSize:12, cursor:'pointer', fontFamily:'monospace' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {error && (
              <div style={{
                background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)',
                borderRadius: 8, padding: '9px 12px', fontSize: 12, color: '#f85149',
                display: 'flex', alignItems: 'flex-start', gap: 6
              }}>
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full" style={{ padding: 12 }}>
              {busy ? '...' : (mode === 'login' ? t('auth.login_btn') : t('auth.register_btn'))}
            </button>
          </form>

          {/* Switch mode link */}
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#8b949e' }}>
            {mode === 'login' ? (
              <>{t('auth.no_account')}{' '}
                <Link to={path('register')} style={{ color: '#1f6feb', fontWeight: 600 }}>
                  {t('auth.sign_up_link')}
                </Link>
              </>
            ) : (
              <>{t('auth.has_account')}{' '}
                <Link to={path('login')} style={{ color: '#1f6feb', fontWeight: 600 }}>
                  {t('auth.login_link')}
                </Link>
              </>
            )}
          </div>
        </div>

        {mode === 'register' && (
          <p style={{ textAlign: 'center', fontSize: 11, color: '#484f58', marginTop: 14 }}>
            {t('auth.agree_terms')}
          </p>
        )}
      </div>
    </div>
  );
}
