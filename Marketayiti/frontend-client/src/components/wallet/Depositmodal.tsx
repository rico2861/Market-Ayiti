import { useState } from 'react';
import { X, Phone, ArrowDownLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { walletAPI } from '../../api';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; }

export default function DepositModal({ onClose }: Props) {
    const { user, refresh } = useAuth();
    const [amount, setAmount] = useState('');
    const [phone, setPhone] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');

    const handleDeposit = async () => {
        if (!amount || parseFloat(amount) < 100) return setError('Minimòm 100 HTG');
        if (!phone || phone.length < 8) return setError('Nimewo MonCash obligatwa');
        setBusy(true);
        setError('');
        try {
            const res = await walletAPI.deposit({ amount: parseFloat(amount), phone });
            setSuccess(`Depozit ${res.data.net_credited?.toLocaleString()} HTG reyisi! Nouvo balans: ${res.data.new_balance?.toLocaleString()} HTG`);
            if (refresh) await refresh();
            toast.success('Depozit MonCash reyisi!');
            setStep('success');
            setTimeout(() => onClose(), 3000);
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Erè depozit');
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
                            background: 'rgba(34, 197, 94, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#22c55e'
                        }}>
                            <ArrowDownLeft size={20} />
                        </div>
                        Depozit
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
                                Depozit Reyisi!
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
                            background: 'rgba(34, 197, 94, 0.08)',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            borderRadius: 12,
                            padding: 14,
                            fontSize: 13,
                            color: '#c1e9d1',
                            lineHeight: 1.5
                        }}>
                            Depozit dirèk nan kont ou via MonCash. Tranzaksyon an pral konplete nan yon minit.
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
                                    color: '#22c55e'
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
                                        e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)';
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
                                placeholder="Minimòm 100 HTG"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                min={100}
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
                                    e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)';
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
                                {[500, 1000, 2500, 5000, 10000].map(a => (
                                    <button key={a}
                                        onClick={() => setAmount(String(a))}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: 8,
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            background: amount === String(a) ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.05)',
                                            color: amount === String(a) ? '#22c55e' : '#8b949e',
                                            border: `1px solid ${amount === String(a) ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255,255,255,0.08)'}`,
                                            transition: 'all 0.3s'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (amount !== String(a)) {
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
                                    <span style={{ color: '#8b949e' }}>Ou depozite:</span>
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
                                    <span style={{ fontWeight: 600, color: 'white' }}>Ou resevwa:</span>
                                    <span style={{
                                        fontWeight: 700,
                                        color: '#22c55e',
                                        fontFamily: 'JetBrains Mono, monospace',
                                        fontSize: 15
                                    }}>
                                        {parseFloat(amount).toLocaleString()} HTG
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button onClick={handleDeposit}
                            disabled={busy || !amount || !phone}
                            style={{
                                padding: 14,
                                fontSize: 15,
                                borderRadius: 12,
                                fontWeight: 600,
                                border: 'none',
                                cursor: busy || !amount || !phone ? 'not-allowed' : 'pointer',
                                background: busy || !amount || !phone
                                    ? 'rgba(34, 197, 94, 0.1)'
                                    : 'linear-gradient(135deg, #22c55e, #16a34a)',
                                color: 'white',
                                transition: 'all 0.3s',
                                opacity: busy || !amount || !phone ? 0.6 : 1,
                                boxShadow: busy || !amount || !phone ? 'none' : '0 4px 12px rgba(34, 197, 94, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8
                            }}
                            onMouseEnter={(e) => {
                                if (!busy && amount && phone) {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(34, 197, 94, 0.4)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!busy && amount && phone) {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
                                }
                            }}>
                            <ArrowDownLeft size={16} />
                            {busy ? 'Ap trete...' : `Depozit ${amount ? parseFloat(amount).toLocaleString() : ''} HTG`}
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