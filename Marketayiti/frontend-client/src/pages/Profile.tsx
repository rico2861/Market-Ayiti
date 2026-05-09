import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { authAPI } from '../api';
import { User, Mail, Phone, Shield, Key, CheckCircle, AlertCircle, Save, Lock, Camera, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

type PwStep = 'idle' | 'request' | 'verify';

const INPUT: React.CSSProperties = {
  width: '100%',
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  padding: '12px 16px',
  color: 'white',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box' as const,
  transition: 'all 0.3s'
};

const LABEL: React.CSSProperties = {
  fontSize: 12,
  color: '#8b949e',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: 8
};

export default function Profile() {
  const { user, updateUser } = useAuth();
  const { path } = useLocale();

  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [pwStep, setPwStep] = useState<PwStep>('idle');
  const [identifier, setIdentifier] = useState(user?.email || user?.username || '');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [devCode, setDevCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  if (!user) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <p style={{ color: '#8b949e', marginBottom: 24, fontSize: 16 }}>Ou dwe konekte pou wè pwofil ou</p>
        <Link to={path('login')} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px',
          background: 'linear-gradient(135deg, #388bfd, #1f6feb)', color: 'white',
          borderRadius: 10, fontWeight: 600, textDecoration: 'none', transition: 'all 0.3s',
          boxShadow: '0 4px 20px rgba(56,139,253,0.3)'
        }}>
          Konekte
        </Link>
      </div>
    );
  }

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await authAPI.updateProfile({ phone: phone || null });
      updateUser({ phone: res.data.phone });
      toast.success('✓ Pwofil aktyalize!');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Erè. Eseye ankò.');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestCode = async () => {
    if (!identifier) return setPwError('Antre imel, non itilizatè, oswa telefòn ou');
    setPwBusy(true);
    setPwError('');
    try {
      const res = await authAPI.requestReset(identifier);
      setDevCode(res.data._dev_code || '');
      setPwStep('verify');
      toast.success('✓ Kòd jenere!');
    } catch (e: any) {
      setPwError(e.response?.data?.detail || 'Erè voye kòd');
    } finally {
      setPwBusy(false);
    }
  };

  const handleVerifyAndChange = async () => {
    if (code.length !== 6) return setPwError('Kòd dwe 6 chif');
    if (!newPw || newPw.length < 8) return setPwError('Modpas dwe omwen 8 karaktè');
    if (newPw !== confirmPw) return setPwError('Modpas yo pa matche');
    setPwBusy(true);
    setPwError('');
    try {
      await authAPI.verifyReset(identifier, code, newPw);
      toast.success('✓ Modpas chanje avèk siksè!', { duration: 4000 });
      setPwStep('idle');
      setCode('');
      setNewPw('');
      setConfirmPw('');
      setDevCode('');
    } catch (e: any) {
      setPwError(e.response?.data?.detail || 'Kòd envalid oswa ekspire');
    } finally {
      setPwBusy(false);
    }
  };

  const passwordStrength = newPw.length < 8 ? 0 : newPw.length < 12 ? 1 : 2;
  const strengthColor = passwordStrength === 0 ? '#f85149' : passwordStrength === 1 ? '#d29922' : '#3fb950';
  const strengthLabel = passwordStrength === 0 ? 'Fèb' : passwordStrength === 1 ? 'Mwayen' : 'Fò';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
      paddingTop: 24,
      paddingBottom: 40,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background effects - hidden on mobile */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '100%',
        maxWidth: 500,
        height: 500,
        background: 'radial-gradient(circle, rgba(56,139,253,0.08) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
        transform: 'translate(150px, -150px)',
        display: window.innerWidth < 640 ? 'none' : 'block'
      }} />
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        maxWidth: 300,
        height: 300,
        background: 'radial-gradient(circle, rgba(56,139,253,0.05) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
        transform: 'translate(-100px, 100px)',
        display: window.innerWidth < 640 ? 'none' : 'block'
      }} />

      <div style={{ 
        maxWidth: 900, 
        margin: '0 auto', 
        padding: '0 16px', 
        position: 'relative', 
        zIndex: 1 
      }}>
        {/* Header */}
        <div style={{ marginBottom: 28, animation: 'fadeInDown 0.6s ease-out' }}>
          <h1 style={{ 
            fontSize: window.innerWidth < 640 ? 24 : 32, 
            fontWeight: 700, 
            color: 'white', 
            margin: '0 0 8px', 
            letterSpacing: '-0.5px' 
          }}>
            Pwofil Mwen
          </h1>
          <p style={{ fontSize: 14, color: '#8b949e', margin: 0 }}>
            Jere kònt ak paramèt sekirite ou
          </p>
        </div>

        {/* Avatar + Main Info Card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: window.innerWidth < 640 ? 20 : 28,
          marginBottom: 24,
          display: 'flex',
          flexDirection: window.innerWidth < 640 ? 'column' : 'row',
          gap: window.innerWidth < 640 ? 16 : 24,
          alignItems: window.innerWidth < 640 ? 'stretch' : 'center',
          animation: 'fadeInUp 0.6s ease-out 0.1s both',
          backdropFilter: 'blur(10px)'
        }}>
          {/* Avatar */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            width: window.innerWidth < 640 ? '100%' : 'auto'
          }}>
            <div style={{
              position: 'relative',
              width: 90,
              height: 90,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #388bfd, #1f6feb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              fontWeight: 700,
              color: 'white',
              boxShadow: '0 12px 32px rgba(56,139,253,0.2)',
              flexShrink: 0
            }}>
              {user.username[0].toUpperCase()}
              <div style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 28,
                height: 28,
                background: '#161b22',
                border: '2px solid #0d1117',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1c2128';
                e.currentTarget.style.transform = 'scale(1.1)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.background = '#161b22';
                e.currentTarget.style.transform = 'scale(1)';
              }}>
                <Camera size={14} color="#388bfd" />
              </div>
            </div>
          </div>

          {/* User Info */}
          <div style={{
            flex: 1,
            textAlign: window.innerWidth < 640 ? 'center' : 'left'
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: '0 0 8px' }}>
              @{user.username}
            </h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10, justifyContent: window.innerWidth < 640 ? 'center' : 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#8b949e' }}>
                {user.role === 'admin' ? '👑' : '👤'}
                <span>{user.role === 'admin' ? 'Administratè' : 'Manm'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#8b949e' }}>
                ✓ Verifye
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#8b949e', margin: 0 }}>
              Manm depi {new Date(user.created_at || '').toLocaleDateString('fr-HT', { month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Balance Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(63,185,80,0.1) 0%, rgba(63,185,80,0.05) 100%)',
            border: '1px solid rgba(63,185,80,0.2)',
            borderRadius: 12,
            padding: 16,
            textAlign: 'center',
            minWidth: window.innerWidth < 640 ? '100%' : 180,
            width: window.innerWidth < 640 ? '100%' : 'auto'
          }}>
            <p style={{ fontSize: 11, color: '#8b949e', margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase' }}>
              Balans
            </p>
            <p style={{ fontSize: 24, fontWeight: 700, color: '#3fb950', margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>
              {user.balance.toLocaleString()}
            </p>
            <p style={{ fontSize: 10, color: '#8b949e', margin: '4px 0 0' }}>HTG</p>
          </div>
        </div>

        {/* Two Column Layout - Responsive */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(2, 1fr)',
          gap: window.innerWidth < 768 ? 20 : 24
        }}>
          {/* Left Column - Account Info */}
          <div>
            {/* Secure Info */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: 20,
              marginBottom: 20,
              animation: 'fadeInUp 0.6s ease-out 0.2s both'
            }}>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'white',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <Lock size={16} color="#388bfd" />
                Enfòmasyon Sekirize
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { icon: User, label: 'Non Itilizatè', value: user.username },
                  { icon: Shield, label: 'Rôl', value: user.role },
                  { icon: Mail, label: 'Imel', value: user.email }
                ].map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    paddingBottom: 14,
                    borderBottom: idx < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none'
                  }}>
                    <div style={{ color: '#388bfd', flexShrink: 0, marginTop: 2 }}>
                      <item.icon size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, color: '#8b949e', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase' }}>
                        {item.label}
                      </p>
                      <p style={{ fontSize: 13, color: 'white', margin: 0, fontWeight: 500, wordBreak: 'break-word' }}>
                        {item.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'rgba(210,153,34,0.08)',
                border: '1px solid rgba(210,153,34,0.2)',
                borderRadius: 10,
                padding: 12,
                marginTop: 16,
                display: 'flex',
                gap: 8,
                fontSize: 12,
                color: '#d29922'
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Non itilizatè ak imel pa ka chanje pou sekirite.</span>
              </div>
            </div>

            {/* Phone Section */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: 20,
              animation: 'fadeInUp 0.6s ease-out 0.3s both'
            }}>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'white',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <Phone size={16} color="#388bfd" />
                Nimewo Telefòn
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={LABEL}>Nimewo MonCash / WhatsApp</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+509 3X XX XXXX"
                  style={{
                    ...INPUT,
                    borderColor: phone ? 'rgba(56,139,253,0.3)' : 'rgba(255,255,255,0.08)'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(56,139,253,0.5)';
                    e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = phone ? 'rgba(56,139,253,0.3)' : 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                  }}
                />
                <p style={{ fontSize: 12, color: '#8b949e', margin: '8px 0 0' }}>
                  Yo pral itilize nimewo sa a pou retrè MonCash.
                </p>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: saving ? 'rgba(56,139,253,0.1)' : 'linear-gradient(135deg, #388bfd, #1f6feb)',
                  border: 'none',
                  borderRadius: 10,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: saving ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!saving) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(56,139,253,0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saving) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <Save size={16} />
                {saving ? 'Ap sove...' : 'Sove Chanjman'}
              </button>
            </div>
          </div>

          {/* Right Column - Password */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 20,
            animation: 'fadeInUp 0.6s ease-out 0.4s both'
          }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'white',
              marginBottom: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <Key size={16} color="#d29922" />
              Chanje Modpas
            </div>

            {pwError && (
              <div style={{
                background: 'rgba(248,81,73,0.08)',
                border: '1px solid rgba(248,81,73,0.2)',
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                fontSize: 13,
                color: '#f85149',
                animation: 'slideInDown 0.3s ease-out'
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                {pwError}
              </div>
            )}

            {pwStep === 'idle' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 13, color: '#8b949e', margin: 0 }}>
                  Sekirize kònt ou avèk yon modpas pi fò.
                </p>
                <button
                  onClick={() => {
                    setPwStep('request');
                    setPwError('');
                    setIdentifier(user?.email || user?.username || '');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'linear-gradient(135deg, #388bfd, #1f6feb)',
                    border: 'none',
                    borderRadius: 10,
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(56,139,253,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <Key size={16} />
                  Chanje Modpas
                </button>
              </div>
            )}

            {pwStep === 'request' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideInDown 0.3s ease-out' }}>
                <div style={{ background: 'rgba(56,139,253,0.05)', borderRadius: 10, padding: 12, border: '1px solid rgba(56,139,253,0.2)' }}>
                  <p style={{ fontSize: 12, color: '#8b949e', margin: 0, fontWeight: 600 }}>
                    📧 Yon kòd konfimmasyon ap voye nan : <span style={{ color: '#c9d1d9' }}>{identifier}</span>
                  </p>
                </div>
                <div>
                  <label style={LABEL}>Entwodiksyon</label>
                  <input
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="imel, non, oswa telefòn"
                    style={INPUT}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(56,139,253,0.5)';
                      e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                    }}
                  />
                </div>
                <button
                  onClick={handleRequestCode}
                  disabled={pwBusy || !identifier}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: pwBusy || !identifier ? 'rgba(56,139,253,0.1)' : 'linear-gradient(135deg, #388bfd, #1f6feb)',
                    border: 'none',
                    borderRadius: 10,
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: pwBusy || !identifier ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s',
                    opacity: pwBusy || !identifier ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                  onMouseEnter={(e) => {
                    if (!pwBusy && identifier) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(56,139,253,0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!pwBusy && identifier) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {pwBusy ? 'Ap genere...' : '→ Kontinye'}
                </button>
              </div>
            )}

            {pwStep === 'verify' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'slideInDown 0.3s ease-out' }}>
                {devCode && (
                  <div style={{
                    background: 'rgba(56,139,253,0.1)',
                    border: '2px solid rgba(56,139,253,0.4)',
                    borderRadius: 12,
                    padding: 16,
                    textAlign: 'center'
                  }}>
                    <p style={{ fontSize: 11, color: '#8b949e', margin: '0 0 10px', fontWeight: 600, textTransform: 'uppercase' }}>
                      Kòd konfimmasyon (Dev Mode)
                    </p>
                    <div style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: '#388bfd',
                      fontFamily: 'JetBrains Mono, monospace',
                      letterSpacing: '0.4em',
                      cursor: 'pointer',
                      padding: '12px',
                      transition: 'all 0.3s',
                      borderRadius: 8,
                      background: 'rgba(56,139,253,0.05)',
                      userSelect: 'none'
                    }}
                    onClick={() => {
                      navigator.clipboard.writeText(devCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(56,139,253,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(56,139,253,0.05)';
                    }}>
                      {devCode}
                      {copiedCode && <span style={{ marginLeft: 8, color: '#3fb950' }}>✓</span>}
                    </div>
                  </div>
                )}

                <div>
                  <label style={LABEL}>Antre Kòd 6 Chif</label>
                  <input
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    inputMode="numeric"
                    style={{
                      ...INPUT,
                      fontSize: 24,
                      letterSpacing: '0.4em',
                      textAlign: 'center' as const,
                      fontWeight: 700,
                      fontFamily: 'JetBrains Mono, monospace',
                      borderColor: code.length === 6 ? 'rgba(63,185,80,0.5)' : 'rgba(255,255,255,0.08)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(56,139,253,0.5)';
                      e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = code.length === 6 ? 'rgba(63,185,80,0.5)' : 'rgba(255,255,255,0.08)';
                      e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                    }}
                  />
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 14, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p style={{ fontSize: 12, color: '#8b949e', margin: '0 0 12px', fontWeight: 600 }}>
                    🔐 Nouvo Modpas
                  </p>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ position: 'relative', marginBottom: 10 }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        placeholder="Minimòm 8 karaktè"
                        style={{
                          ...INPUT,
                          paddingRight: 40
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(56,139,253,0.5)';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        }}
                      />
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#8b949e',
                          cursor: 'pointer',
                          padding: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#388bfd';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#8b949e';
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {newPw && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${(passwordStrength + 1) * 33.33}%`,
                              background: strengthColor,
                              transition: 'width 0.3s',
                              borderRadius: 3
                            }} />
                          </div>
                          <span style={{ fontSize: 12, color: strengthColor, fontWeight: 700, minWidth: 40 }}>
                            {strengthLabel}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <input
                      type="password"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                      placeholder="Repete modpas la"
                      style={{
                        ...INPUT,
                        borderColor: confirmPw ? (confirmPw === newPw ? 'rgba(63,185,80,0.5)' : '#f85149') : 'rgba(255,255,255,0.08)',
                        background: confirmPw ? (confirmPw === newPw ? 'rgba(63,185,80,0.05)' : 'rgba(248,81,73,0.05)') : 'rgba(0,0,0,0.2)'
                      }}
                      onFocus={(e) => {
                        if (!(confirmPw && confirmPw !== newPw)) {
                          e.currentTarget.style.borderColor = 'rgba(56,139,253,0.5)';
                        }
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = confirmPw ? (confirmPw === newPw ? 'rgba(63,185,80,0.5)' : '#f85149') : 'rgba(255,255,255,0.08)';
                      }}
                    />
                    {confirmPw && confirmPw === newPw && (
                      <div style={{ fontSize: 12, color: '#3fb950', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={14} /> Modpas kòrèk
                      </div>
                    )}
                    {confirmPw && confirmPw !== newPw && (
                      <div style={{ fontSize: 12, color: '#f85149', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <AlertCircle size={14} /> Modpas pa matche
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleVerifyAndChange}
                  disabled={pwBusy || code.length !== 6 || !newPw || newPw !== confirmPw}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: pwBusy || code.length !== 6 || !newPw || newPw !== confirmPw ? 'rgba(56,139,253,0.1)' : 'linear-gradient(135deg, #388bfd, #1f6feb)',
                    border: 'none',
                    borderRadius: 10,
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: pwBusy || code.length !== 6 || !newPw || newPw !== confirmPw ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s',
                    opacity: pwBusy || code.length !== 6 || !newPw || newPw !== confirmPw ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                  onMouseEnter={(e) => {
                    if (!(pwBusy || code.length !== 6 || !newPw || newPw !== confirmPw)) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(56,139,253,0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(pwBusy || code.length !== 6 || !newPw || newPw !== confirmPw)) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  <CheckCircle size={16} />
                  {pwBusy ? 'Ap verifye...' : '✓ Sove Modpas'}
                </button>

                <button
                  onClick={() => {
                    setPwStep('idle');
                    setCode('');
                    setNewPw('');
                    setConfirmPw('');
                    setPwError('');
                  }}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    color: '#8b949e',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  }}
                >
                  ← Anile
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        input:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(56, 139, 253, 0.1);
        }

        button:focus {
          outline: none;
        }

        @media (max-width: 640px) {
          /* Responsive adjustments already in inline styles */
        }
      `}</style>
    </div>
  );
}