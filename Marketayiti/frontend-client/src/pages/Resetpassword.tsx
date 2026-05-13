// frontend-client/src/pages/ResetPassword.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import { useAlert } from '../components/Alert';
import { useLocale } from '../hooks/useLocale';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, RefreshCw } from 'lucide-react';

type Step = 'request' | 'verify';

const COUNTDOWN_SECONDS = 900; // 15 minutes

function formatCountdown(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const alert = useAlert();
  const { path } = useLocale();

  const [step, setStep] = useState<Step>('request');
  const [loading, setLoading] = useState(false);

  // Step 1: Request
  const [identifier, setIdentifier] = useState('');

  // Step 2: Verify
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Countdown
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (step !== 'verify') return;
    setCountdown(COUNTDOWN_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step]);

  // ── Step 1: Request Reset Code ────────────────────────────
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      alert.warning('Champ requis', 'Veuillez entrer votre email ou identifiant');
      return;
    }

    setLoading(true);
    try {
      await authAPI.requestReset(identifier);
      alert.success('Code envoyé', 'Vérifiez votre email pour le code de réinitialisation');
      setStep('verify');
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Erreur lors de la demande';
      alert.error('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend code ───────────────────────────────────────────
  const handleResend = async () => {
    if (!identifier) return;
    setLoading(true);
    try {
      await authAPI.requestReset(identifier);
      alert.success('Code renvoyé', 'Un nouveau code a été envoyé à votre email');
      setCode('');
      setCountdown(COUNTDOWN_SECONDS);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Erreur lors du renvoi';
      alert.error('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify Code & Reset Password ──────────────────
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || !newPassword || !confirmPassword) {
      alert.warning('Champs requis', 'Veuillez remplir tous les champs');
      return;
    }
    if (code.length !== 6) {
      alert.warning('Code invalide', 'Le code doit contenir 6 chiffres');
      return;
    }
    if (newPassword.length < 8) {
      alert.warning('Mot de passe faible', 'Minimum 8 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert.warning('Mots de passe non identiques', 'Vérifiez votre confirmation');
      return;
    }

    setLoading(true);
    try {
      await authAPI.verifyReset(identifier, code, newPassword);
      alert.success('Succès !', 'Votre mot de passe a été réinitialisé');
      setTimeout(() => navigate(path('login')), 2000);
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Erreur lors de la réinitialisation';
      alert.error('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-8 bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950">
      <div className="w-full max-w-sm">
        {/* Back button */}
        <button
          onClick={() => navigate(path('login'))}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Retour</span>
        </button>

        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Réinitialiser le mot de passe
          </h1>
          <p className="text-gray-400 text-sm">
            {step === 'request'
              ? 'Entrez votre email ou identifiant'
              : 'Entrez le code reçu et votre nouveau mot de passe'}
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-lg p-6 sm:p-8">
          {step === 'request' ? (
            // ── Step 1 ────────────────────────────────────────
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">
                  Email ou identifiant
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 pl-10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                  loading ? 'bg-gray-600 text-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                }`}
              >
                {loading ? 'Envoi...' : 'Envoyer le code'}
              </button>
            </form>
          ) : (
            // ── Step 2 ────────────────────────────────────────
            <form onSubmit={handleVerify} className="space-y-4">
              {/* Countdown */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                background: countdown > 0 ? 'rgba(56,139,253,0.08)' : 'rgba(248,81,73,0.08)',
                border: `1px solid ${countdown > 0 ? 'rgba(56,139,253,0.2)' : 'rgba(248,81,73,0.2)'}`,
              }}>
                {countdown > 0 ? (
                  <>
                    <span style={{ fontSize: 12, color: '#8b949e' }}>Code valide encore</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#388bfd', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCountdown(countdown)}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: '#f85149' }}>Code expiré</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">
                  Code (6 chiffres)
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm text-center tracking-widest font-mono"
                  maxLength={6}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 pl-10 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-500 hover:text-gray-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">
                  Confirmer mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 pl-10 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || countdown === 0}
                className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                  loading || countdown === 0
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
                }`}
              >
                {loading ? 'Réinitialisation...' : 'Réinitialiser'}
              </button>

              {/* Resend button — visible when code expired */}
              {countdown === 0 && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid rgba(56,139,253,0.3)',
                    background: 'rgba(56,139,253,0.08)',
                    color: '#388bfd',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  <RefreshCw size={14} />
                  Renvoyer le code
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setStep('request');
                  setCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="w-full text-gray-400 hover:text-gray-300 text-xs transition-colors"
              >
                Changer d'identifiant ?
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
