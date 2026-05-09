import { useState } from 'react';
import { X, Phone, ArrowUpRight, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { walletAPI } from '../../api';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; }

export default function WithdrawModal({ onClose }: Props) {
    const { user, refresh } = useAuth();
    const [amount, setAmount] = useState('');
    const [phone, setPhone] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');

    const total = amount ? parseFloat(amount) : 0;
    const canWithdraw = total <= (user?.balance || 0);

    const handleWithdraw = async () => {
        if (!amount || parseFloat(amount) < 500) return setError('Minimòm retrè: 500 HTG');
        if (!phone || phone.length < 8) return setError('Nimewo MonCash obligatwa');
        if (!canWithdraw) return setError(`Balans ensifizan. Ou gen ${user?.balance?.toLocaleString()} HTG`);

        setBusy(true);
        setError('');
        try {
            const res = await walletAPI.withdraw({ amount: parseFloat(amount), phone });
            setSuccess(`Demann retrè ${parseFloat(amount).toLocaleString()} HTG soumèt! Y ap voye nan ${phone} nan 1-5 minit.`);
            if (refresh) await refresh();
            toast.success('Demann retrè soumèt!');
            setStep('success');
            setTimeout(() => onClose(), 3000);
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Erè retrè');
        } finally {
            setBusy(false);
        }
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
                maxWidth: window.innerWidth < 480 ? '100%' : 440,
                maxHeight: '90vh',
                overflowY: 'auto',
                padding: window.innerWidth < 480 ? 20 : 32,
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                animation: 'slideUp 0.3s ease-out'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 32
                }}>
                    <div style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                    }}>
                        <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: 'rgba(239, 68, 68, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ef4444'
                        }}>
                            <ArrowUpRight size={20} />
                        </div>
                        Retrè
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
                    }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Success State */}
                {step === 'success' && success && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 20,
                        textAlign: 'center',
                        padding: '40px 20px',
                        animation: 'slideInUp 0.4s ease-out'
                    }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            background: 'rgba(34, 197, 94, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#22c55e'
                        }}>
                            <CheckCircle size={32} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: '0 0 8px' }}>
                                Demann Retrè Soumèt!
                            </h3>
                            <p style={{ color: '#8b949e', fontSize: 14, margin: 0 }}>
                                {success}
                            </p>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && step !== 'success' && (
                    <div style={{
                        background: 'rgba(248, 81, 73, 0.1)',
                        border: '1px solid rgba(248, 81, 73, 0.3)',
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 20,
                        display: 'flex',
                        gap: 10,
                        alignItems: 'flex-start',
                        animation: 'slideInDown 0.3s ease-out'
                    }}>
                        <AlertCircle style={{ width: 18, height: 18, color: '#f85149', flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.4 }}>{error}</span>
                    </div>
                )}

                {/* Form */}
                {step !== 'success' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeIn 0.3s ease-out' }}>
                        {/* Info Box */}
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 12,
                            padding: 14,
                            fontSize: 13,
                            color: '#fca5a5',
                            lineHeight: 1.5
                        }}>
                            Retrè sèl nan kont ou. Lajan an ap wourive nan nimewo MonCash ou an nan 1-5 minit.
                        </div>

                        {/* Balance Info */}
                        <div style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 12,
                            padding: 14,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ color: '#8b949e', fontSize: 13 }}>Balans disponib:</span>
                            <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', fontSize: 15 }}>
                                {user?.balance?.toLocaleString() || 0} HTG
                            </span>
                        </div>

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
                                Nimewo MonCash Resepsyon
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Phone style={{
                                    position: 'absolute',
                                    left: 14,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 16,
                                    height: 16,
                                    color: '#ef4444'
                                }} />
                                <input type="tel"
                                    placeholder="+509 34 XX XXXX"
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
                                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
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
                                placeholder="Minimòm 500 HTG"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                min={500}
                                step={100}
                                max={user?.balance || 0}
                                style={{
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: `1px solid ${!canWithdraw && amount ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255,255,255,0.08)'}`,
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
                                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                                    e.currentTarget.style.background = 'rgba(0,0,0,0.4)';
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = !canWithdraw && amount ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255,255,255,0.08)';
                                    e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                                }} />

                            {/* Quick Amount Buttons */}
                            <div style={{
                                display: 'flex',
                                gap: 6,
                                marginTop: 10,
                                flexWrap: 'wrap'
                            }}>
                                {[500, 1000, 2000, 5000].map(a => (
                                    <button key={a}
                                        disabled={a > (user?.balance || 0)}
                                        onClick={() => setAmount(String(a))}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: 8,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: a > (user?.balance || 0) ? 'not-allowed' : 'pointer',
                                            background: amount === String(a) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
                                            color: amount === String(a) ? '#ef4444' : a > (user?.balance || 0) ? '#475569' : '#8b949e',
                                            border: `1px solid ${amount === String(a) ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255,255,255,0.08)'}`,
                                            opacity: a > (user?.balance || 0) ? 0.5 : 1,
                                            transition: 'all 0.3s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (amount !== String(a) && a <= (user?.balance || 0)) {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (amount !== String(a)) {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                            }
                                        }}>
                                        {a.toLocaleString()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Amount Summary */}
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
                                    marginBottom: 8
                                }}>
                                    <span style={{ color: '#8b949e' }}>Ou retrè:</span>
                                    <span style={{ color: 'white', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                                        {parseFloat(amount).toLocaleString()} HTG
                                    </span>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    paddingTop: 8,
                                    borderTop: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <span style={{ fontWeight: 600, color: 'white' }}>Total dedwi:</span>
                                    <span style={{
                                        fontWeight: 700,
                                        color: '#ef4444',
                                        fontFamily: 'JetBrains Mono, monospace',
                                        fontSize: 15
                                    }}>
                                        -{parseFloat(amount).toLocaleString()} HTG
                                    </span>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: 8,
                                    paddingTop: 8,
                                    borderTop: '1px solid rgba(255,255,255,0.05)',
                                    color: '#8b949e',
                                    fontSize: 12
                                }}>
                                    <span>Balans apre:</span>
                                    <span style={{ color: '#22c55e', fontWeight: 600 }}>
                                        {Math.max(0, (user?.balance || 0) - parseFloat(amount)).toLocaleString()} HTG
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Warning if not enough balance */}
                        {!canWithdraw && amount && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: 12,
                                padding: 12,
                                fontSize: 12,
                                color: '#fca5a5',
                                display: 'flex',
                                gap: 8,
                                alignItems: 'flex-start'
                            }}>
                                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span>Balans ensifizan. Ou gen {user?.balance?.toLocaleString()} HTG</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button onClick={handleWithdraw}
                            disabled={busy || !amount || !phone || !canWithdraw}
                            style={{
                                padding: 14,
                                fontSize: 15,
                                borderRadius: 12,
                                fontWeight: 600,
                                border: 'none',
                                cursor: busy || !amount || !phone || !canWithdraw ? 'not-allowed' : 'pointer',
                                background: busy || !amount || !phone || !canWithdraw
                                    ? 'rgba(239, 68, 68, 0.1)'
                                    : 'linear-gradient(135deg, #ef4444, #dc2626)',
                                color: 'white',
                                transition: 'all 0.3s',
                                opacity: busy || !amount || !phone || !canWithdraw ? 0.6 : 1,
                                boxShadow: busy || !amount || !phone || !canWithdraw ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8
                            }}
                            onMouseEnter={(e) => {
                                if (!busy && amount && phone && canWithdraw) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!busy && amount && phone && canWithdraw) {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
                                }
                            }}>
                            <ArrowUpRight size={16} />
                            {busy ? 'Ap trete...' : `Retrè ${amount ? parseFloat(amount).toLocaleString() : ''} HTG`}
                        </button>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
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