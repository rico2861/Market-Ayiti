import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Phone, AtSign, AlertCircle, Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import { showToast } from '../utils/toast';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { authAPI } from '../api';
import clsx from 'clsx';

interface Props { mode: 'login' | 'register'; }
type DetectedType = 'email' | 'phone' | 'username' | 'invalid' | null;

export default function Auth({ mode }: Props) {
  const { t } = useTranslation();
  const { login, register, user, complete2fa } = useAuth();
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
  const [busy,             setBusy]             = useState(false);
  const [error,            setError]            = useState('');
  const [remainingAttempts,setRemainingAttempts] = useState<number | null>(null);
  const [suggestions,      setSuggestions]      = useState<string[]>([]);
  const [step,           setStep]           = useState<'credentials' | '2fa' | 'locked'>('credentials');
  const [totpCode,       setTotpCode]       = useState('');
  const totpRef = useRef<HTMLInputElement>(null);

  // Locked state
  const [lockedEmailMasked, setLockedEmailMasked] = useState('');
  const [lockedUntil,       setLockedUntil]       = useState<Date | null>(null);
  const [unlockCode,        setUnlockCode]        = useState('');
  const [newPassword,       setNewPassword]       = useState('');
  const [confirmPassword,   setConfirmPassword]   = useState('');
  const [showNewPw,         setShowNewPw]         = useState(false);
  const [showConfirmPw,     setShowConfirmPw]     = useState(false);
  const [resendCooldown,    setResendCooldown]    = useState(0);
  const [timeLeft,          setTimeLeft]          = useState(0);

  // Countdown timer for lock expiry
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((lockedUntil.getTime() - Date.now()) / 60000)));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

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
        const result = await login(identifier, password);
        if (result && 'requires_2fa' in result) {
          setStep('2fa');
          setTimeout(() => totpRef.current?.focus(), 100);
          return;
        }
        setRemainingAttempts(null);
        showToast.success(t('auth.welcome'), t('auth.welcome_sub') || 'Bòn rive sou AyitiMarket');
      } else {
        await register({ identifier, password, email, full_name: fullName || undefined });
        showToast.success(t('auth.account_created'), 'Kont ou kreye avèk siksè!');
      }
      navigate(path('home'), { replace: true });
    } catch (e: any) {
      // 423 = account locked → switch to unlock flow
      if (e.response?.status === 423) {
        const data = e.response.data;
        setLockedEmailMasked(data.email_masked || '');
        setLockedUntil(data.locked_until ? new Date(data.locked_until) : null);
        setStep('locked');
        setError('');
        return;
      }
      const data   = e.response?.data || {};
      const detail = data.detail || data.errors?.[0]?.message || 'Erè entèn';
      setError(detail);
      if (typeof data.remaining_attempts === 'number') {
        setRemainingAttempts(data.remaining_attempts);
      }
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

  const handle2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totpCode.length !== 6) { setError('Kòd 6 chif obligatwa'); return; }
    setError('');
    setBusy(true);
    try {
      await complete2fa(totpCode);
      showToast.success(t('auth.welcome'), 'Bòn rive sou AyitiMarket');
      navigate(path('home'), { replace: true });
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Kòd TOTP envalid');
      setTotpCode('');
      totpRef.current?.focus();
    } finally { setBusy(false); }
  };

  const unlockStrength = useMemo(() => {
    if (!newPassword) return 0;
    let s = 0;
    if (newPassword.length >= 8)  s++;
    if (newPassword.length >= 12) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  }, [newPassword]);

  const unlockStrengthLabel = unlockStrength <= 1 ? 'Trè fèb' : unlockStrength === 2 ? 'Fèb' : unlockStrength === 3 ? 'Mwayen' : unlockStrength === 4 ? 'Solid' : 'Trè solid';
  const unlockStrengthColor = unlockStrength <= 2 ? '#f85149' : unlockStrength === 3 ? '#f0883e' : '#3fb950';
  const confirmMatch        = confirmPassword.length > 0 && confirmPassword === newPassword;
  const confirmMismatch     = confirmPassword.length > 0 && confirmPassword !== newPassword;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (unlockCode.length !== 6)  { setError('Kòd 6 chif obligatwa'); return; }
    if (unlockStrength < 3)       { setError('Modpas pa ase solid — ajoute majiskil, chif oswa karaktè espesyal'); return; }
    if (newPassword !== confirmPassword) { setError('Konfirmasyon modpas pa idantik'); return; }
    setBusy(true);
    try {
      await authAPI.unlockAccount(identifier, unlockCode, newPassword, confirmPassword);
      showToast.success('Kont debloke!', 'Ou ka konekte kounye a');
      setStep('credentials');
      setError('');
      setUnlockCode('');
      setNewPassword('');
      setConfirmPassword('');
      setPassword('');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Kòd envalid oswa ekspire');
    } finally { setBusy(false); }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    try {
      await authAPI.requestReset(identifier);
      showToast.success('Kòd voye!', 'Verifye imel ou');
      setResendCooldown(60);
    } catch {
      showToast.error('Erè — Eseye ankò');
    }
  };

  const HintIcon = detected === 'email' ? Mail
    : detected === 'phone'    ? Phone
    : detected === 'username' ? AtSign
    : AlertCircle;

  // ── Locked step ───────────────────────────────────────────────────────────
  if (step === 'locked') return (
    <div className="container py-8 md:py-16 fade-in">
      <div className="mx-auto" style={{ maxWidth: 420 }}>

        {/* Header */}
        <div className="text-center mb-7">
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(248,81,73,0.12)', border: '1px solid rgba(248,81,73,0.3)', marginBottom: 16,
          }}>
            <Lock size={26} color="#f85149" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '0 0 8px' }}>
            Kont ou bloke
          </h1>
          <p style={{ fontSize: 13, color: '#8b949e', margin: 0, lineHeight: 1.6 }}>
            {lockedEmailMasked
              ? <>Yon kòd deblokaj 6 chif voye nan <strong style={{ color: '#e6edf3' }}>{lockedEmailMasked}</strong></>
              : 'Kont ou bloke apre plizyè tantativ echèk.'}
          </p>
          <p style={{ fontSize: 12, color: '#484f58', marginTop: 5 }}>
            Kòd la valid pou <strong style={{ color: '#8b949e' }}>15 minit</strong>
            {timeLeft > 0 && <> — kont debloke otomatikman nan <strong style={{ color: '#8b949e' }}>{timeLeft} minit</strong></>}
          </p>
        </div>

        <div className="rounded-xl p-5 md:p-6" style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.08)' }}>
          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {error && (
              <div style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)',
                borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertCircle size={15} color="#f85149" style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#f85149' }}>{error}</span>
              </div>
            )}

            {/* ── Unlock code ── */}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#8b949e', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Kòd deblokaj (6 chif)
              </label>
              <input
                type="text" inputMode="numeric" maxLength={6} autoFocus
                placeholder="000000"
                value={unlockCode}
                onChange={e => setUnlockCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input"
                style={{
                  textAlign: 'center', fontSize: 30, fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: 12, fontWeight: 700,
                  color: unlockCode.length === 6 ? '#3fb950' : 'white',
                  borderColor: unlockCode.length === 6 ? 'rgba(63,185,80,0.4)' : undefined,
                }}
              />
              {unlockCode.length === 6 && (
                <p style={{ fontSize: 11, color: '#3fb950', margin: '4px 0 0', textAlign: 'center' }}>
                  Kòd antre — kontinye ak modpas
                </p>
              )}
            </div>

            {/* ── New password ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: '#8b949e', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Nouvo modpas
                </label>
                {newPassword && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: unlockStrengthColor }}>
                    {unlockStrengthLabel}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min. 8 karaktè"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="input"
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowNewPw(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', padding: 0 }}>
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength bar — 5 segments */}
              {newPassword && (
                <>
                  <div style={{ marginTop: 6, display: 'flex', gap: 3 }}>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} style={{
                        flex: 1, height: 3, borderRadius: 2, transition: 'background .2s',
                        background: i <= unlockStrength ? unlockStrengthColor : 'rgba(255,255,255,0.06)',
                      }} />
                    ))}
                  </div>
                  {unlockStrength < 3 && (
                    <p style={{ fontSize: 11, color: '#8b949e', margin: '5px 0 0', lineHeight: 1.5 }}>
                      Ajoute: majiskil (A–Z), chif (0–9), oswa karaktè espesyal (!@#$…)
                    </p>
                  )}
                </>
              )}
            </div>

            {/* ── Confirm password ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: '#8b949e', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Konfime modpas
                </label>
                {confirmPassword.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700,
                    color: confirmMatch ? '#3fb950' : '#f85149' }}>
                    {confirmMatch ? 'Idantik' : 'Pa idantik'}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Repete nouvo modpas ou"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="input"
                  style={{
                    paddingRight: 40,
                    borderColor: confirmMismatch ? 'rgba(248,81,73,0.5)' : confirmMatch ? 'rgba(63,185,80,0.4)' : undefined,
                  }}
                />
                <button type="button" onClick={() => setShowConfirmPw(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', padding: 0 }}>
                  {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* ── Submit ── */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                busy ||
                unlockCode.length !== 6 ||
                unlockStrength < 3 ||
                !confirmMatch
              }
              style={{ background: 'linear-gradient(135deg,#f85149,#da3633)', marginTop: 2 }}
            >
              {busy ? 'Verifikasyon…' : 'Debloke kont mwen'}
            </button>

            {/* ── Footer actions ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <button type="button" onClick={handleResendCode} disabled={resendCooldown > 0}
                style={{ background: 'none', border: 'none', padding: 0,
                  cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                  fontSize: 12, color: resendCooldown > 0 ? '#484f58' : '#58a6ff' }}>
                {resendCooldown > 0 ? `Voye ankò nan ${resendCooldown}s` : 'Voye kòd ankò'}
              </button>
              <button type="button"
                onClick={() => { setStep('credentials'); setError(''); setUnlockCode(''); setNewPassword(''); setConfirmPassword(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: '#8b949e', padding: 0 }}>
                ← Tounen
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );

  // ── 2FA step ──────────────────────────────────────────────────────────────
  if (step === '2fa') return (
    <div className="container py-8 md:py-16 fade-in">
      <div className="mx-auto" style={{ maxWidth: 380 }}>
        <div className="text-center mb-7">
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 14, background: 'rgba(163,113,247,0.12)',
            border: '1px solid rgba(163,113,247,0.3)', marginBottom: 16 }}>
            <ShieldCheck size={24} color="#a371f7" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: '0 0 6px' }}>Verifikasyon 2FA</h1>
          <p style={{ fontSize: 13, color: '#8b949e', margin: 0 }}>
            Antre kòd 6 chif nan aplikasyon otantifikatè ou
          </p>
        </div>

        <div className="rounded-xl p-5 md:p-6" style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.08)' }}>
          <form onSubmit={handle2fa} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f85149' }}>
                {error}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#8b949e', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Kòd TOTP
              </label>
              <input
                ref={totpRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoComplete="one-time-code"
                className="input"
                style={{ textAlign: 'center', fontSize: 24, letterSpacing: '0.4em', fontFamily: 'monospace' }}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || totpCode.length !== 6}>
              {busy ? 'Verifikasyon…' : 'Verifye'}
            </button>
            <button type="button" onClick={() => { setStep('credentials'); setError(''); setTotpCode(''); }}
              className="btn btn-ghost btn-sm" style={{ fontSize: 12, color: '#8b949e' }}>
              ← Retounen nan koneksyon
            </button>
          </form>
        </div>
      </div>
    </div>
  );

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

            {/* Progressive lockout warning — shown when remaining attempts are low */}
            {!error && remainingAttempts !== null && remainingAttempts <= 2 && mode === 'login' && (
              <div style={{
                background: remainingAttempts === 1 ? 'rgba(248,81,73,0.08)' : 'rgba(240,136,62,0.08)',
                border: `1px solid ${remainingAttempts === 1 ? 'rgba(248,81,73,0.3)' : 'rgba(240,136,62,0.3)'}`,
                borderRadius: 8, padding: '9px 12px', fontSize: 12,
                color: remainingAttempts === 1 ? '#f85149' : '#f0883e',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                <span>
                  {remainingAttempts === 1
                    ? '⚠️ Dènye tantativ — Kont ou pral bloke si ou echwe ankò'
                    : `Atansyon — ${remainingAttempts} tantativ rete anvan kont bloke`}
                </span>
              </div>
            )}

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginTop: -6 }}>
                <Link to={path('reset')} style={{ fontSize: 12, color: '#8b949e', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#1f6feb')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#8b949e')}>
                  {t('auth.forgot_password')}
                </Link>
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
