import { useState } from 'react';
import { X, AlertCircle, CheckCircle, Phone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { walletAPI } from '../../api';
import toast from 'react-hot-toast';

interface Props { onClose: () => void; }

type Mode = 'menu' | 'deposit' | 'withdraw';

export default function WalletModal({ onClose }: Props) {
  const { user, refresh } = useAuth();
  const [mode, setMode] = useState<Mode>('menu');
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

  const OVERLAY: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16
  };
  const CARD: React.CSSProperties = {
    background: '#161b22', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16, width: '100%', maxWidth: 400,
    maxHeight: '90vh', overflowY: 'auto', padding: 24
  };
  const INPUT: React.CSSProperties = {
    width: '100%', background: '#0d1117',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '10px 14px',
    color: 'white', fontSize: 15, outline: 'none',
    fontFamily: 'JetBrains Mono,monospace', boxSizing: 'border-box'
  };
  const LABEL: React.CSSProperties = {
    fontSize: 11, color: '#8b949e', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    display: 'block', marginBottom: 6
  };

  return (
    <div style={OVERLAY} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={CARD}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {mode !== 'menu' && (
              <button onClick={() => { setMode('menu'); reset(); }}
                style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 18 }}>←</button>
            )}
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>
                {mode === 'menu' ? '🔴 MonCash' : mode === 'deposit' ? 'Depozit' : 'Retrè'}
              </div>
              <div style={{ fontSize: 12, color: '#8b949e' }}>
                Balans: <span style={{ color: '#3fb950', fontWeight: 600 }}>{user?.balance?.toLocaleString() || 0} HTG</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success */}
        {success && (
          <div style={{ background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.3)',
            borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <CheckCircle style={{ width: 16, height: 16, color: '#3fb950', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: '#3fb950' }}>{success}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.2)',
            borderRadius: 10, padding: 12, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertCircle style={{ width: 14, height: 14, color: '#f85149', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, color: '#f85149' }}>{error}</span>
          </div>
        )}

        {mode === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14, fontSize: 12, color: '#8b949e', lineHeight: 1.6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div><span style={{ color: '#8b949e' }}>Depozit min:</span> <span style={{ color: 'white', fontWeight: 600 }}>100 HTG</span></div>
                <div><span style={{ color: '#8b949e' }}>Retrè min:</span> <span style={{ color: 'white', fontWeight: 600 }}>500 HTG</span></div>
                <div><span style={{ color: '#8b949e' }}>Frè:</span> <span style={{ color: 'white', fontWeight: 600 }}>1.5%</span></div>
                <div><span style={{ color: '#8b949e' }}>Vitès:</span> <span style={{ color: 'white', fontWeight: 600 }}>1-5 min</span></div>
              </div>
            </div>
            <button onClick={() => { setMode('deposit'); reset(); }} className="btn-primary w-full" style={{ padding: 14, fontSize: 15 }}>
              ↓ Depozit — Mete Lajan
            </button>
            <button onClick={() => { setMode('withdraw'); reset(); }}
              style={{ padding: 14, fontSize: 15, borderRadius: 8, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
              ↑ Retrè — Retire Lajan
            </button>
          </div>
        )}

        {(mode === 'deposit' || mode === 'withdraw') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={LABEL}>Nimewo MonCash *</label>
              <div style={{ position: 'relative' }}>
                <Phone style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#8b949e' }} />
                <input type="tel" placeholder="+509 3X XX XXXX" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{ ...INPUT, paddingLeft: 36 }} />
              </div>
            </div>
            <div>
              <label style={LABEL}>Montan (HTG) *</label>
              <input type="number" placeholder={mode === 'deposit' ? 'Minimòm 100' : 'Minimòm 500'}
                value={amount} onChange={e => setAmount(e.target.value)}
                min={mode === 'deposit' ? 100 : 500} step={100}
                style={INPUT} />
              {/* Quick amounts */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {(mode === 'deposit' ? [500,1000,2500,5000,10000] : [500,1000,2000,5000]).map(a => (
                  <button key={a} onClick={() => setAmount(String(a))}
                    style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                      background: amount === String(a) ? '#1f6feb' : 'rgba(255,255,255,0.05)',
                      color: amount === String(a) ? 'white' : '#8b949e',
                      border: '1px solid ' + (amount === String(a) ? '#1f6feb' : 'rgba(255,255,255,0.1)') }}>
                    {a.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Fee breakdown */}
            {amount && parseFloat(amount) > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#8b949e' }}>
                  <span>Montan:</span>
                  <span style={{ color: 'white', fontFamily: 'JetBrains Mono,monospace' }}>{parseFloat(amount).toLocaleString()} HTG</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#8b949e' }}>
                  <span>Frè MonCash (1.5%):</span>
                  <span style={{ color: '#f85149', fontFamily: 'JetBrains Mono,monospace' }}>-{fee.toLocaleString()} HTG</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 6, marginTop: 4 }}>
                  <span style={{ fontWeight: 600, color: 'white' }}>{mode === 'deposit' ? 'Ou resevwa:' : 'Y ap voye:'}</span>
                  <span style={{ fontWeight: 700, color: '#3fb950', fontFamily: 'JetBrains Mono,monospace' }}>
                    {mode === 'deposit' ? net.toLocaleString() : parseFloat(amount).toLocaleString()} HTG
                  </span>
                </div>
                {mode === 'withdraw' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b949e', marginTop: 2 }}>
                    <span>Total dedwi balans:</span>
                    <span style={{ fontFamily: 'JetBrains Mono,monospace' }}>{total.toLocaleString()} HTG</span>
                  </div>
                )}
              </div>
            )}

            <button onClick={mode === 'deposit' ? handleDeposit : handleWithdraw}
              disabled={busy || !amount || !phone}
              className="btn-primary w-full" style={{ padding: 13, fontSize: 14, marginTop: 4 }}>
              {busy ? 'Ap trete...' : mode === 'deposit' ? `Depozit ${amount ? parseFloat(amount).toLocaleString() : ''} HTG` : `Retrè ${amount ? parseFloat(amount).toLocaleString() : ''} HTG`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
