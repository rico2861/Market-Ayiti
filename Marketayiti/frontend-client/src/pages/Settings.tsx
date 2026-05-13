import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Settings as SettingsIcon, Globe, Lock, Bell, Eye, Moon, LogOut, ShieldCheck, ShieldOff, QrCode, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';
import { showToast } from '../utils/toast';

export default function Settings() {
  const location = useLocation();
  const lang = location.pathname.split('/')[1] as 'ht' | 'fr' || 'ht';
  const { user, logout } = useAuth();

  const [darkMode,    setDarkMode]    = useState(true);
  const [emailNotif,  setEmailNotif]  = useState(true);
  const [pushNotif,   setPushNotif]   = useState(false);

  // 2FA state
  const [twoFaEnabled,  setTwoFaEnabled]  = useState(false);
  const [twoFaModal,    setTwoFaModal]    = useState<'setup' | 'disable' | null>(null);
  const [qrImage,       setQrImage]       = useState('');
  const [totpSecret,    setTotpSecret]    = useState('');
  const [totpCode,      setTotpCode]      = useState('');
  const [disablePw,     setDisablePw]     = useState('');
  const [twofaBusy,     setTwofaBusy]     = useState(false);

  useEffect(() => {
    authAPI.twofa.status().then(r => setTwoFaEnabled(r.data.enabled)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    try { await logout(); } catch {}
    window.location.href = `/${lang}/konekte`;
  };

  const openSetup = async () => {
    setTwofaBusy(true);
    try {
      const r = await authAPI.twofa.setup();
      setQrImage(r.data.qr_image);
      setTotpSecret(r.data.secret);
      setTotpCode('');
      setTwoFaModal('setup');
    } catch (e: any) {
      showToast.error('Erè konfigirasyon 2FA', e.response?.data?.detail);
    } finally { setTwofaBusy(false); }
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwofaBusy(true);
    try {
      await authAPI.twofa.enable(totpCode);
      setTwoFaEnabled(true);
      setTwoFaModal(null);
      showToast.success('2FA aktive', 'Kont ou pwoteje avèk verifikasyon an 2 etap');
    } catch (err: any) {
      showToast.error('Kòd envalid', err.response?.data?.detail || 'Verifye kòd la');
    } finally { setTwofaBusy(false); }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwofaBusy(true);
    try {
      await authAPI.twofa.disable(totpCode, disablePw);
      setTwoFaEnabled(false);
      setTwoFaModal(null);
      showToast.info('2FA dezaktive');
    } catch (err: any) {
      showToast.error('Erè', err.response?.data?.detail || 'Kòd oswa modpas envalid');
    } finally { setTwofaBusy(false); }
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)} style={{
      width: 40, height: 20, borderRadius: 10,
      background: value ? '#22c55e' : 'rgba(255,255,255,.1)',
      border: 'none', cursor: 'pointer', transition: 'all .3s', position: 'relative',
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: '50%', background: 'white',
        position: 'absolute', top: 2, left: value ? 22 : 2, transition: 'all .3s',
      }} />
    </button>
  );

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      padding: '12px 14px', background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.08)', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>{children}</div>
  );

  const SectionTitle = ({ label }: { label: string }) => (
    <h2 style={{
      fontSize: 12, fontWeight: 700, color: '#64748b',
      textTransform: 'uppercase', letterSpacing: '.1em',
      margin: '0 0 12px', paddingLeft: 4,
    }}>{label}</h2>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', padding: '20px 16px 120px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'white', margin: '0 0 32px',
          display: 'flex', alignItems: 'center', gap: 12 }}>
          <SettingsIcon size={26} color="#a855f7" />
          {lang === 'fr' ? 'Paramètres' : 'Paramèt'}
        </h1>

        {/* Account */}
        <div style={{ marginBottom: 32 }}>
          <SectionTitle label={lang === 'fr' ? 'Compte' : 'Kont'} />
          <div style={{ padding: 16, background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.08)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 11,
                background: 'linear-gradient(135deg,#388bfd,#1f6feb)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: 16 }}>
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'white', margin: 0 }}>
                  {user?.email || user?.username}
                </p>
                <p style={{ fontSize: 11, color: '#64748b', margin: '3px 0 0' }}>
                  {user?.role === 'admin' ? 'Admin' : lang === 'fr' ? 'Compte actif' : 'Kont aktif'}
                </p>
              </div>
            </div>
            <button onClick={handleLogout} style={{
              width: '100%', padding: 10,
              background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)',
              borderRadius: 8, color: '#f85149', fontWeight: 600, fontSize: 12,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <LogOut size={12} />
              {lang === 'fr' ? 'Se déconnecter' : 'Dekonekte'}
            </button>
          </div>
        </div>

        {/* Security — 2FA */}
        <div style={{ marginBottom: 32 }}>
          <SectionTitle label={lang === 'fr' ? 'Sécurité' : 'Sekirite'} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row>
              <div style={{ width: 34, height: 34, borderRadius: 8,
                background: twoFaEnabled ? 'rgba(34,197,94,0.12)' : 'rgba(163,113,247,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {twoFaEnabled
                  ? <ShieldCheck size={18} color="#22c55e" />
                  : <ShieldOff size={18} color="#a371f7" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>
                  {lang === 'fr' ? 'Authentification 2 facteurs' : 'Otantifikasyon 2 etap (2FA)'}
                </div>
                <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>
                  {twoFaEnabled
                    ? lang === 'fr' ? '✓ Activé — compte protégé' : '✓ Aktive — kont pwoteje'
                    : lang === 'fr' ? 'Recommandé pour sécuriser votre compte' : 'Rekòmande pou pwoteje kont ou'}
                </div>
              </div>
              <button
                onClick={twoFaEnabled ? () => { setTotpCode(''); setDisablePw(''); setTwoFaModal('disable'); } : openSetup}
                disabled={twofaBusy}
                style={{
                  padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: twoFaEnabled ? 'rgba(248,81,73,0.12)' : 'rgba(163,113,247,0.15)',
                  border: `1px solid ${twoFaEnabled ? 'rgba(248,81,73,0.3)' : 'rgba(163,113,247,0.35)'}`,
                  color: twoFaEnabled ? '#f85149' : '#a371f7',
                }}>
                {twoFaEnabled
                  ? lang === 'fr' ? 'Désactiver' : 'Dezaktive'
                  : lang === 'fr' ? 'Activer' : 'Aktive'}
              </button>
            </Row>
          </div>
        </div>

        {/* Preferences */}
        <div style={{ marginBottom: 32 }}>
          <SectionTitle label={lang === 'fr' ? 'Préférences' : 'Prefere'} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              { icon: Moon,  label: lang === 'fr' ? 'Mode sombre' : 'Mod fonse',              value: darkMode,   onChange: setDarkMode },
              { icon: Eye,   label: lang === 'fr' ? 'Notifications email' : 'Email notif',    value: emailNotif, onChange: setEmailNotif },
              { icon: Bell,  label: lang === 'fr' ? 'Notifications push' : 'Push notif',      value: pushNotif,  onChange: setPushNotif },
            ] as const).map((pref, i) => (
              <Row key={i}>
                <pref.icon size={16} color="#388bfd" />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#c9d1d9' }}>{pref.label}</span>
                <Toggle value={pref.value} onChange={pref.onChange} />
              </Row>
            ))}
          </div>
        </div>

        {/* More */}
        <div>
          <SectionTitle label="Plus" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              { icon: Globe, label: lang === 'fr' ? 'Langue' : 'Lang',        color: '#3b82f6' },
              { icon: Lock,  label: lang === 'fr' ? 'Changer mot de passe' : 'Chanje modpas', color: '#f59e0b' },
            ] as const).map((s, i) => (
              <button key={i} style={{
                padding: 14, background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.08)', borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                width: '100%', textAlign: 'left',
              }}>
                <s.icon size={18} color={s.color} />
                <p style={{ fontSize: 12, fontWeight: 700, color: '#c9d1d9', margin: 0 }}>{s.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2FA Setup Modal ──────────────────────────────────────────────── */}
      {twoFaModal === 'setup' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setTwoFaModal(null)}>
          <div style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 28, maxWidth: 420, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <QrCode size={20} color="#a371f7" />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>
                {lang === 'fr' ? 'Configurer l\'authentification 2FA' : 'Konfigire 2FA'}
              </h2>
            </div>
            <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 16, lineHeight: 1.5 }}>
              {lang === 'fr'
                ? '1. Scannez ce QR avec Google Authenticator, Authy ou une app similaire.'
                : '1. Skannen kòd QR sa avèk Google Authenticator, Authy oswa aplikasyon similè.'}
            </p>
            {qrImage && (
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <img src={qrImage} alt="QR 2FA" style={{ width: 200, height: 200, borderRadius: 12,
                  border: '2px solid rgba(163,113,247,0.3)' }} />
              </div>
            )}
            {totpSecret && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '8px 12px', marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 4 }}>
                  {lang === 'fr' ? 'Ou entrez ce code manuellement :' : 'Oswa antre kòd sa manyèlman :'}
                </div>
                <code style={{ fontSize: 13, color: '#a371f7', letterSpacing: '0.1em', wordBreak: 'break-all' }}>
                  {totpSecret}
                </code>
              </div>
            )}
            <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 12 }}>
              {lang === 'fr'
                ? '2. Entrez le code à 6 chiffres affiché dans l\'app pour confirmer :'
                : '2. Antre kòd 6 chif ki parèt nan aplikasyon an pou konfime :'}
            </p>
            <form onSubmit={handleEnable} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="000000" className="input"
                style={{ textAlign: 'center', fontSize: 22, letterSpacing: '0.5em', fontFamily: 'monospace' }}
                autoFocus required
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setTwoFaModal(null)}
                  className="btn btn-ghost" style={{ flex: 1 }}>
                  {lang === 'fr' ? 'Annuler' : 'Anile'}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}
                  disabled={twofaBusy || totpCode.length !== 6}>
                  {twofaBusy ? '…' : lang === 'fr' ? 'Activer 2FA' : 'Aktive 2FA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 2FA Disable Modal ────────────────────────────────────────────── */}
      {twoFaModal === 'disable' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setTwoFaModal(null)}>
          <div style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 28, maxWidth: 380, width: '100%' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <KeyRound size={20} color="#f85149" />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>
                {lang === 'fr' ? 'Désactiver 2FA' : 'Dezaktive 2FA'}
              </h2>
            </div>
            <form onSubmit={handleDisable} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#8b949e', fontWeight: 600,
                  textTransform: 'uppercase', marginBottom: 6 }}>
                  {lang === 'fr' ? 'Mot de passe' : 'Modpas'}
                </label>
                <input type="password" value={disablePw} onChange={e => setDisablePw(e.target.value)}
                  className="input" required autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#8b949e', fontWeight: 600,
                  textTransform: 'uppercase', marginBottom: 6 }}>
                  Kòd TOTP
                </label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                  value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                  placeholder="000000" className="input"
                  style={{ textAlign: 'center', fontSize: 22, letterSpacing: '0.5em', fontFamily: 'monospace' }}
                  required />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setTwoFaModal(null)}
                  className="btn btn-ghost" style={{ flex: 1 }}>
                  {lang === 'fr' ? 'Annuler' : 'Anile'}
                </button>
                <button type="submit" disabled={twofaBusy || totpCode.length !== 6 || !disablePw}
                  style={{ flex: 2, padding: '9px 0', borderRadius: 8, fontWeight: 600, fontSize: 13,
                    background: 'rgba(248,81,73,0.15)', border: '1px solid rgba(248,81,73,0.35)',
                    color: '#f85149', cursor: 'pointer' }}>
                  {twofaBusy ? '…' : lang === 'fr' ? 'Confirmer désactivation' : 'Konfime dezaktivasyon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
