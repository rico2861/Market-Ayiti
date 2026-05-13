import { useState } from 'react';
import { X, AlertCircle, CheckCircle, Phone, ArrowDownLeft, ArrowUpRight, Zap, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { walletAPI } from '../../api';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; initialMode?: 'deposit' | 'withdraw'; }

type Mode = 'menu' | 'deposit' | 'withdraw';

export default function WalletModal({ onClose, initialMode }: Props) {
  const { user, refresh } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode ?? 'menu');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fee = amount ? Math.round(parseFloat(amount) * 1.5) / 100 : 0;
  const net = amount ? parseFloat(amount) - fee : 0;
  const total = amount ? parseFloat(amount) + fee : 0;

  const reset = () => { setAmount(''); setPhone(''); setError(''); setSuccess(''); };

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) < 100) return setError('Minimòm 100 HTG');
    if (!phone || phone.length < 8) return setError('Nimewo MonCash obligatwa');
    setBusy(true); setError('');
    try {
      const res = await walletAPI.deposit({ amount: parseFloat(amount), phone });
      setSuccess(`Depozit ${res.data.net_credited?.toLocaleString()} HTG reyisi! Nouvo balans: ${res.data.new_balance?.toLocaleString()} HTG`);
      if (refresh) await refresh();
      toast.success('Depozit MonCash reyisi!');
      setAmount(''); setPhone('');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erè depozit');
    } finally { setBusy(false); }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) < 500) return setError('Minimòm retrè: 500 HTG');
    if (!phone || phone.length < 8) return setError('Nimewo MonCash pou voye lajan an');
    if (total > (user?.balance || 0)) return setError(`Balans ensifizan. Ou gen ${user?.balance?.toLocaleString()} HTG`);
    setBusy(true); setError('');
    try {
      const res = await walletAPI.withdraw({ amount: parseFloat(amount), phone });
      setSuccess(`Demann retrè ${parseFloat(amount).toLocaleString()} HTG soumèt! Y ap voye nan ${phone} nan 1-5 minit.`);
      if (refresh) await refresh();
      toast.success('Demann retrè soumèt!');
      setAmount(''); setPhone('');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Erè retrè');
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      animation: 'fadeIn 0.3s ease-out'
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'linear-gradient(135deg, #161b22 0%, #0d1117 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        width: '100%',
        maxWidth: window.innerWidth < 480 ? '100%' : 420,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: window.innerWidth < 480 ? 20 : 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {mode !== 'menu' && (
              <button onClick={() => { setMode('menu'); reset(); }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8b949e',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }}>
                ←
              </button>
            )}
            <div>
              <div style={{
                fontSize: mode === 'menu' ? 18 : 16,
                fontWeight: 700,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                {mode === 'deposit' && <ArrowDownLeft size={18} color="#22c55e" />}
                {mode === 'withdraw' && <ArrowUpRight size={18} color="#ef4444" />}
                {mode === 'menu' && <Zap size={18} color="#388bfd" />}
                {mode === 'menu' ? 'MonCash' : mode === 'deposit' ? 'Depozit' : 'Retrè'}
              </div>
              <div style={{ fontSize: 12, color: '#8b949e', marginTop: 2 }}>
                Balans: <span style={{ color: '#22c55e', fontWeight: 700 }}>
                  {user?.balance?.toLocaleString() || 0} HTG
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8b949e',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            }}>
            <X size={18} />
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            animation: 'slideInDown 0.3s ease-out'
          }}>
            <CheckCircle style={{ width: 18, height: 18, color: '#22c55e', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: '#c1e9d1', lineHeight: 1.4 }}>{success}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            background: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid rgba(248, 81, 73, 0.3)',
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            animation: 'slideInDown 0.3s ease-out'
          }}>
            <AlertCircle style={{ width: 18, height: 18, color: '#f85149', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.4 }}>{error}</span>
          </div>
        )}

        {/* Menu Mode */}
        {mode === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeIn 0.3s ease-out' }}>
            {/* Info Cards */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: 16
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                fontSize: 12
              }}>
                <div>
                  <p style={{ color: '#8b949e', margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>
                    Min Depozit
                  </p>
                  <p style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: 0 }}>
                    100 HTG
                  </p>
                </div>
                <div>
                  <p style={{ color: '#8b949e', margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>
                    Min Retrè
                  </p>
                  <p style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: 0 }}>
                    500 HTG
                  </p>
                </div>
                <div>
                  <p style={{ color: '#8b949e', margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>
                    Frè
                  </p>
                  <p style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: 0 }}>
                    1.5%
                  </p>
                </div>
                <div>
                  <p style={{ color: '#8b949e', margin: '0 0 6px', fontWeight: 600, textTransform: 'uppercase', fontSize: 10 }}>
                    Vitès
                  </p>
                  <p style={{ color: 'white', fontWeight: 700, fontSize: 14, margin: 0 }}>
                    1-5 min
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <button onClick={() => { setMode('deposit'); reset(); }}
              style={{
                padding: 14,
                fontSize: 15,
                borderRadius: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.3s',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(34, 197, 94, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
              }}>
              <ArrowDownLeft size={16} />
              Depozit — Mete Lajan
            </button>

            <button onClick={() => { setMode('withdraw'); reset(); }}
              style={{
                padding: 14,
                fontSize: 15,
                borderRadius: 12,
                fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
              }}>
              <ArrowUpRight size={16} />
              Retrè — Retire Lajan
            </button>

            <div style={{
              background: 'rgba(56,139,253,0.08)',
              border: '1px solid rgba(56,139,253,0.2)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              fontSize: 12,
              color: '#93c5fd'
            }}>
              <Lock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Tout transaksyon yo sekirize avèk MonCash. Nimewo ou yo pa stoke.</span>
            </div>
          </div>
        )}

        {/* Deposit/Withdraw Form */}
        {(mode === 'deposit' || mode === 'withdraw') && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            animation: 'fadeIn 0.3s ease-out'
          }}>
            {/* Phone Input */}
            <div>
              <label style={{
                fontSize: 12,
                color: '#8b949e',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'block',
                marginBottom: 8
              }}>
                Nimewo MonCash
              </label>
              <div style={{ position: 'relative' }}>
                <Phone style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 16,
                  height: 16,
                  color: '#388bfd'
                }} />
                <input type="tel"
                  placeholder="+509 3X XX XXXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10,
                    padding: '12px 14px 12px 40px',
                    color: 'white',
                    fontSize: 14,
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    transition: 'all 0.3s'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(56,139,253,0.5)';
                    e.currentTarget.style.background = 'rgba(0,0,0,0.4)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                  }} />
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label style={{
                fontSize: 12,
                color: '#8b949e',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'block',
                marginBottom: 8
              }}>
                Montan (HTG)
              </label>
              <input type="number"
                placeholder={mode === 'deposit' ? 'Minimòm 100 HTG' : 'Minimòm 500 HTG'}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min={mode === 'deposit' ? 100 : 500}
                step={100}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: 'white',
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'JetBrains Mono, monospace',
                  boxSizing: 'border-box',
                  transition: 'all 0.3s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(56,139,253,0.5)';
                  e.currentTarget.style.background = 'rgba(0,0,0,0.4)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                }} />

              {/* Quick Amount Buttons */}
              <div style={{
                display: 'flex',
                gap: 6,
                marginTop: 10,
                flexWrap: 'wrap'
              }}>
                {(mode === 'deposit' ? [500, 1000, 2500, 5000, 10000] : [500, 1000, 2000, 5000]).map(a => (
                  <button key={a}
                    onClick={() => setAmount(String(a))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: amount === String(a) ? 'rgba(56,139,253,0.2)' : 'rgba(255,255,255,0.05)',
                      color: amount === String(a) ? '#58a6ff' : '#8b949e',
                      border: `1px solid ${amount === String(a) ? 'rgba(56,139,253,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      if (amount !== String(a)) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (amount !== String(a)) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                      }
                    }}>
                    {a.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Fee Breakdown */}
            {amount && parseFloat(amount) > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: 14,
                fontSize: 13,
                animation: 'slideInUp 0.3s ease-out'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  paddingBottom: 10,
                  borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <span style={{ color: '#8b949e' }}>Montan:</span>
                  <span style={{ color: 'white', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                    {parseFloat(amount).toLocaleString()} HTG
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  color: '#8b949e'
                }}>
                  <span>Frè MonCash (1.5%):</span>
                  <span style={{ color: '#f85149', fontFamily: 'JetBrains Mono, monospace' }}>
                    -{fee.toLocaleString()} HTG
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 10,
                  borderTop: '1px solid rgba(255,255,255,0.05)'
                }}>
                  <span style={{ fontWeight: 600, color: 'white' }}>
                    {mode === 'deposit' ? 'Ou resevwa:' : 'Y ap voye:'}
                  </span>
                  <span style={{
                    fontWeight: 700,
                    color: '#22c55e',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 14
                  }}>
                    {mode === 'deposit' ? net.toLocaleString() : parseFloat(amount).toLocaleString()} HTG
                  </span>
                </div>
                {mode === 'withdraw' && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#8b949e',
                    marginTop: 8,
                    fontSize: 12
                  }}>
                    <span>Total dedwi:</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {total.toLocaleString()} HTG
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button onClick={mode === 'deposit' ? handleDeposit : handleWithdraw}
              disabled={busy || !amount || !phone}
              style={{
                padding: 14,
                fontSize: 15,
                borderRadius: 12,
                fontWeight: 600,
                border: 'none',
                cursor: busy || !amount || !phone ? 'not-allowed' : 'pointer',
                background: busy || !amount || !phone
                  ? 'rgba(56,139,253,0.1)'
                  : 'linear-gradient(135deg, #388bfd, #1f6feb)',
                color: 'white',
                transition: 'all 0.3s',
                opacity: busy || !amount || !phone ? 0.6 : 1,
                boxShadow: busy || !amount || !phone ? 'none' : '0 4px 12px rgba(56,139,253,0.3)'
              }}
              onMouseEnter={(e) => {
                if (!busy && amount && phone) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(56,139,253,0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!busy && amount && phone) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(56,139,253,0.3)';
                }
              }}>
              {busy ? 'Ap trete...' : mode === 'deposit'
                ? `Depozit ${amount ? parseFloat(amount).toLocaleString() : ''} HTG`
                : `Retrè ${amount ? parseFloat(amount).toLocaleString() : ''} HTG`}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
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

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}