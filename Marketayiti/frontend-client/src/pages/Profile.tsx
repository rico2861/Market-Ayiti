import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { authAPI } from '../api';
import { User, Mail, Phone, Shield, Key, CheckCircle, AlertCircle, Save, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

type PwStep = 'idle' | 'request' | 'verify';

const INPUT: React.CSSProperties = {
  width:'100%', background:'#0d1117', border:'1px solid rgba(255,255,255,0.1)',
  borderRadius:8, padding:'10px 14px', color:'white', fontSize:14,
  outline:'none', boxSizing:'border-box' as const
};
const LABEL: React.CSSProperties = {
  fontSize:11, color:'#8b949e', fontWeight:600,
  textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:6
};
const CARD: React.CSSProperties = {
  background:'#161b22', border:'1px solid rgba(255,255,255,0.07)',
  borderRadius:12, padding:'20px 24px', marginBottom:16
};

export default function Profile() {
  const { user, updateUser, refresh } = useAuth();
  const { path } = useLocale();

  // Editable fields (non-sensitive only)
  const [phone,     setPhone]     = useState(user?.phone || '');
  const [email,     setEmail]     = useState(user?.email || '');
  const [saving,    setSaving]    = useState(false);

  // Password reset flow
  const [pwStep,    setPwStep]    = useState<PwStep>('idle');
  const [identifier, setIdentifier] = useState(user?.email || user?.username || '');
  const [code,      setCode]      = useState('');
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy,    setPwBusy]    = useState(false);
  const [pwError,   setPwError]   = useState('');
  const [devCode,   setDevCode]   = useState(''); // shown in UI for dev

  if (!user) return (
    <div style={{ textAlign:'center', padding:'60px 16px' }}>
      <p style={{ color:'#8b949e', marginBottom:16 }}>Ou dwe konekte</p>
      <Link to={path('login')} className="btn-primary">Konekte</Link>
    </div>
  );

  // Save non-sensitive fields
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await authAPI.updateProfile({ phone: phone || null });
      updateUser({ phone: res.data.phone });
      toast.success('Pwofil aktyalize!');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Erè. Eseye ankò.');
    } finally { setSaving(false); }
  };

  // Step 1: Request reset code
  const handleRequestCode = async () => {
    if (!identifier) return setPwError('Antre imel, non itilizatè, oswa telefòn ou');
    setPwBusy(true); setPwError('');
    try {
      const res = await authAPI.requestReset(identifier);
      setDevCode(res.data._dev_code || '');
      setPwStep('verify');
      toast.success('Kòd jenere! Antre li anba a.');
    } catch (e: any) {
      setPwError(e.response?.data?.detail || 'Erè voye kòd');
    } finally { setPwBusy(false); }
  };

  // Step 2: Verify code + set new password
  const handleVerifyAndChange = async () => {
    if (code.length !== 6) return setPwError('Kòd dwe 6 chif');
    if (!newPw || newPw.length < 8) return setPwError('Modpas dwe omwen 8 karaktè');
    if (newPw !== confirmPw) return setPwError('Modpas yo pa matche');
    setPwBusy(true); setPwError('');
    try {
      await authAPI.verifyReset(identifier, code, newPw);
      toast.success('✓ Modpas chanje avèk siksè!', { duration: 4000 });
      setPwStep('idle');
      setCode(''); setNewPw(''); setConfirmPw(''); setDevCode('');
    } catch (e: any) {
      setPwError(e.response?.data?.detail || 'Kòd envalid oswa ekspire');
    } finally { setPwBusy(false); }
  };

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ color:'#8b949e', flexShrink:0 }}>{icon}</span>
      <span style={{ fontSize:12, color:'#8b949e', minWidth:120 }}>{label}</span>
      <span style={{ fontSize:14, color:'white', fontWeight:500 }}>{value || '—'}</span>
    </div>
  );

  return (
    <div className="container py-5 fade-in" style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize:22, fontWeight:700, color:'white', marginBottom:20 }}>Pwofil Mwen</h1>

      {/* Avatar + username */}
      <div style={{ ...CARD, display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
        <div style={{ width:56, height:56, borderRadius:'50%', flexShrink:0,
          background:'linear-gradient(135deg,#1f6feb,#388bfd)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:700, color:'white' }}>
          {user.username[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:'white' }}>@{user.username}</div>
          <div style={{ fontSize:12, color:'#8b949e' }}>
            {user.role === 'admin' ? '👑 Administratè' : '👤 Manm'}
            {' · '}Manm depi {new Date(user.created_at||'').toLocaleDateString('fr-HT',{month:'long',year:'numeric'})}
          </div>
          <div style={{ fontSize:14, color:'#3fb950', fontFamily:'JetBrains Mono,monospace', fontWeight:700, marginTop:4 }}>
            {user.balance.toLocaleString()} HTG
          </div>
        </div>
      </div>

      {/* Read-only info */}
      <div style={CARD}>
        <div style={{ fontSize:13, fontWeight:600, color:'#8b949e', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
          <Lock size={13}/> Enfò Pwoteje (pa ka modifye)
        </div>
        <InfoRow icon={<User size={14}/>}   label="Non Itilizatè" value={user.username} />
        <InfoRow icon={<Shield size={14}/>} label="Rôl"           value={user.role} />
        <InfoRow icon={<Mail size={14}/>}   label="Imel Prensipal" value={user.email} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, padding:'8px 10px', background:'rgba(210,153,34,0.08)', borderRadius:8, fontSize:11, color:'#d29922' }}>
          <AlertCircle size={12}/>
          Non itilizatè ak imel prensipal pa ka chanje pou rezon sekirite. Kontakte admin si nesesè.
        </div>
      </div>

      {/* Editable: phone */}
      <div style={CARD}>
        <div style={{ fontSize:14, fontWeight:600, color:'white', marginBottom:14, display:'flex', alignItems:'center', gap:6 }}>
          <Phone size={15}/> Ajoute / Modifye Nimewo Telefòn
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={LABEL}>Nimewo MonCash / WhatsApp</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="+509 3X XX XXXX" style={INPUT} />
          <p style={{ fontSize:11, color:'#484f58', margin:'6px 0 0' }}>
            Yo pral itilize nimewo sa a pou retrè MonCash.
          </p>
        </div>
        <button onClick={handleSaveProfile} disabled={saving} className="btn-primary" style={{ fontSize:13, padding:'9px 18px' }}>
          <Save size={14}/> {saving ? 'Ap sove...' : 'Sove Chanjman'}
        </button>
      </div>

      {/* Password reset */}
      <div style={CARD}>
        <div style={{ fontSize:14, fontWeight:600, color:'white', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
          <Key size={15} color="#d29922"/> Chanje Modpas
        </div>

        {pwError && (
          <div style={{ background:'rgba(248,81,73,0.08)', border:'1px solid rgba(248,81,73,0.2)', borderRadius:8, padding:'8px 12px', marginBottom:12, display:'flex', gap:6, alignItems:'flex-start', fontSize:12, color:'#f85149' }}>
            <AlertCircle size={13} style={{ flexShrink:0, marginTop:1 }}/>{pwError}
          </div>
        )}

        {pwStep === 'idle' && (
          <div>
            <p style={{ fontSize:13, color:'#8b949e', margin:'0 0 14px' }}>
              Yon kòd 6 chif pral kreye. Antre li pou konfime chanjman an.
            </p>
            <button onClick={() => { setPwStep('request'); setPwError(''); }}
              style={{ padding:'9px 18px', borderRadius:8, background:'rgba(210,153,34,0.1)', border:'1px solid rgba(210,153,34,0.3)', color:'#d29922', cursor:'pointer', fontSize:13, fontWeight:600 }}>
              <Key size={13}/> Kòmanse Chanje Modpas →
            </button>
          </div>
        )}

        {pwStep === 'request' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <p style={{ fontSize:13, color:'#8b949e', margin:0 }}>Konfime idantite ou pou resevwa kòd la.</p>
            <div>
              <label style={LABEL}>Imel / Non itilizatè / Telefòn</label>
              <input value={identifier} onChange={e => setIdentifier(e.target.value)} style={INPUT}
                placeholder="imel, non itilizatè, oswa telefòn" />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { setPwStep('idle'); setPwError(''); }}
                style={{ flex:1, padding:'9px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#8b949e', cursor:'pointer', fontSize:13 }}>
                Anile
              </button>
              <button onClick={handleRequestCode} disabled={pwBusy} className="btn-primary" style={{ flex:2, padding:'9px', fontSize:13 }}>
                {pwBusy ? 'Ap jenere...' : 'Jenere Kòd →'}
              </button>
            </div>
          </div>
        )}

        {pwStep === 'verify' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Show code prominently (dev mode) */}
            {devCode && (
              <div style={{ background:'rgba(31,111,235,0.1)', border:'1px solid rgba(31,111,235,0.3)', borderRadius:10, padding:14 }}>
                <div style={{ fontSize:11, color:'#8b949e', marginBottom:6 }}>Kòd ou a (nan pwoduksyon y ap voye pa SMS/imel):</div>
                <div style={{ fontSize:28, fontWeight:700, color:'#1f6feb', fontFamily:'JetBrains Mono,monospace', letterSpacing:'0.3em', textAlign:'center' }}>
                  {devCode}
                </div>
              </div>
            )}
            <div>
              <label style={LABEL}>Kòd 6 Chif</label>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="123456" maxLength={6} inputMode="numeric"
                style={{ ...INPUT, fontSize:24, letterSpacing:'0.3em', textAlign:'center' as const }} />
            </div>
            <div>
              <label style={LABEL}>Nouvo Modpas</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="Minimòm 8 karaktè" style={INPUT} />
              {newPw && (
                <div style={{ display:'flex', gap:4, marginTop:6 }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ flex:1, height:3, borderRadius:2, transition:'background .3s',
                      background: (newPw.length < 8 && i===1) ? '#f85149'
                        : (newPw.length >= 8 && newPw.length < 12 && i <= 2) ? '#d29922'
                        : (newPw.length >= 12) ? '#3fb950' : 'rgba(255,255,255,0.07)' }} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={LABEL}>Konfime Modpas</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repete modpas la" style={{ ...INPUT, borderColor: confirmPw && confirmPw !== newPw ? '#f85149' : undefined }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { setPwStep('request'); setCode(''); setNewPw(''); setConfirmPw(''); setPwError(''); }}
                style={{ flex:1, padding:'9px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#8b949e', cursor:'pointer', fontSize:13 }}>
                ← Retounen
              </button>
              <button onClick={handleVerifyAndChange} disabled={pwBusy || code.length !== 6 || !newPw || newPw !== confirmPw}
                className="btn-primary" style={{ flex:2, padding:'9px', fontSize:13 }}>
                {pwBusy ? 'Ap verifye...' : '✓ Chanje Modpas'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
