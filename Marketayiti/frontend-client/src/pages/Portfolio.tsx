import { useState, useEffect } from 'react';
import { Wallet, TrendingDown, TrendingUp, ArrowDownCircle, ArrowUpCircle, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { walletAPI } from '../api';
import { Link } from 'react-router-dom';
import WalletModal from '../components/wallet/WalletModal';

const MONTHS = ['Janvye','Fevrye','Mas','Avril','Me','Jen','Jiyè','Out','Septanm','Oktòb','Novanm','Desanm'];

const TX_TYPE_LABEL: Record<string, { label: string; color: string; sign: string }> = {
  deposit:    { label:'Depozit',     color:'#3fb950', sign:'+' },
  withdrawal: { label:'Retrè',       color:'#f85149', sign:'-' },
  win:        { label:'Gain Pari',   color:'#3fb950', sign:'+' },
  bet:        { label:'Mise Pari',   color:'#f85149', sign:'-' },
  bet_slip:   { label:'Fich Kombi',  color:'#f85149', sign:'-' },
  refund:     { label:'Rembourseman', color:'#d29922', sign:'+' },
};

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label:'Konplè',   color:'#3fb950', bg:'rgba(63,185,80,0.1)' },
  pending:   { label:'An kous',  color:'#d29922', bg:'rgba(210,153,34,0.1)' },
  rejected:  { label:'Rejte',    color:'#f85149', bg:'rgba(248,81,73,0.1)' },
  failed:    { label:'Echèk',    color:'#f85149', bg:'rgba(248,81,73,0.1)' },
};

export default function Portfolio() {
  const { user, refresh: refreshUser } = useAuth();
  const { path } = useLocale();
  const [walletOpen, setWalletOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  const fetchTx = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      if (typeFilter) params.type = typeFilter;
      if (month && year) { params.month = month; params.year = year; }
      else if (year) params.year = year;
      const res = await walletAPI.getTransactions(params);
      setTransactions(res.data);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchTx(); }, [typeFilter, month, year]);

  if (!user) return (
    <div style={{ textAlign:'center', padding:'60px 16px' }}>
      <p style={{ color:'#8b949e', marginBottom:16 }}>Ou dwe konekte</p>
      <Link to={path('login')} className="btn-primary">Konekte</Link>
    </div>
  );

  const years = Array.from(new Set(transactions.map(t => new Date(t.created_at).getFullYear()))).sort((a,b)=>b-a);
  const totalDeposits = transactions.filter(t=>t.type==='deposit'&&t.status==='completed').reduce((s,t)=>s+t.amount,0);
  const totalWithdrawals = transactions.filter(t=>t.type==='withdrawal'&&t.status==='completed').reduce((s,t)=>s+t.amount,0);
  const totalWins = transactions.filter(t=>t.type==='win').reduce((s,t)=>s+t.amount,0);

  const SEL: React.CSSProperties = {
    background:'#161b22', border:'1px solid rgba(255,255,255,0.1)',
    color:'#8b949e', borderRadius:8, padding:'6px 10px', fontSize:12, cursor:'pointer'
  };

  return (
    <div className="container py-5 fade-in" style={{ maxWidth: 800 }}>
      {walletOpen && <WalletModal onClose={() => { setWalletOpen(false); refreshUser?.(); fetchTx(); }} />}

      <h1 style={{ fontSize:22, fontWeight:700, color:'white', marginBottom:20 }}>Pòtfolyo</h1>

      {/* Balance card */}
      <div style={{ background:'linear-gradient(135deg,#1a2332,#1f2d40)', border:'1px solid rgba(31,111,235,0.3)', borderRadius:16, padding:24, marginBottom:20 }}>
        <div style={{ fontSize:12, color:'#8b949e', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>Balans Disponib</div>
        <div style={{ fontSize:36, fontWeight:700, color:'#3fb950', fontFamily:'JetBrains Mono,monospace', marginBottom:20 }}>
          {user.balance.toLocaleString()} HTG
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => setWalletOpen(true)} className="btn-primary" style={{ flex:1, padding:12 }}>
            <ArrowDownCircle size={16}/> Depozit
          </button>
          <button onClick={() => setWalletOpen(true)} style={{
            flex:1, padding:12, borderRadius:8, background:'rgba(255,255,255,0.07)',
            border:'1px solid rgba(255,255,255,0.12)', color:'white', cursor:'pointer',
            fontWeight:600, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:6
          }}>
            <ArrowUpCircle size={16}/> Retrè
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:24 }}>
        {[
          { label:'Total Depozit', value:totalDeposits, color:'#3fb950' },
          { label:'Total Retrè',   value:totalWithdrawals, color:'#f85149' },
          { label:'Total Genyen',  value:totalWins, color:'#d29922' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'#161b22', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:10, color:'#8b949e', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:16, fontWeight:700, color, fontFamily:'JetBrains Mono,monospace' }}>{value.toLocaleString()}</div>
            <div style={{ fontSize:10, color:'#484f58' }}>HTG</div>
          </div>
        ))}
      </div>

      {/* Transaction history */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <h2 style={{ fontSize:16, fontWeight:600, color:'white', margin:0 }}>Istorik Transaksyon</h2>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={SEL}>
            <option value="">Tout tip</option>
            <option value="deposit">Depozit</option>
            <option value="withdrawal">Retrè</option>
            <option value="win">Gain</option>
            <option value="bet">Mise</option>
          </select>
          <select value={month} onChange={e=>setMonth(e.target.value)} style={SEL}>
            <option value="">Tout mwa</option>
            {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e=>setYear(e.target.value)} style={SEL}>
            <option value="">Tout ane</option>
            {[...years, new Date().getFullYear()].filter((v,i,a)=>a.indexOf(v)===i).map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'#8b949e' }}>Chajman...</div>
      ) : transactions.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#8b949e' }}>
          <Wallet style={{ width:40, height:40, margin:'0 auto 12px', opacity:0.2, display:'block' }} />
          <p style={{ margin:0 }}>Pa gen transaksyon pou filtè sa a</p>
        </div>
      ) : (
        <div style={{ background:'#161b22', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, overflow:'hidden' }}>
          {/* Table header */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 100px 90px', gap:8, padding:'10px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', fontSize:10, color:'#8b949e', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            <div>Tip</div><div style={{textAlign:'right'}}>Montan</div><div>Dat</div><div>Estati</div>
          </div>
          {transactions.slice(0, 100).map((tx, i) => {
            const cfg = TX_TYPE_LABEL[tx.type] || { label:tx.type, color:'#8b949e', sign:'' };
            const st  = STATUS_BADGE[tx.status] || STATUS_BADGE.completed;
            return (
              <div key={tx.id} style={{
                display:'grid', gridTemplateColumns:'1fr 120px 100px 90px', gap:8,
                padding:'12px 16px', alignItems:'center',
                borderBottom: i < transactions.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)'
              }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'white' }}>{cfg.label}</div>
                  {tx.description && <div style={{ fontSize:11, color:'#484f58', marginTop:1 }}>{tx.description.slice(0,50)}</div>}
                  {tx.phone_number && <div style={{ fontSize:10, color:'#8b949e', fontFamily:'JetBrains Mono,monospace' }}>📱 {tx.phone_number}</div>}
                </div>
                <div style={{ textAlign:'right', fontFamily:'JetBrains Mono,monospace', fontSize:14, fontWeight:700, color:cfg.color }}>
                  {cfg.sign}{tx.amount.toLocaleString()} HTG
                </div>
                <div style={{ fontSize:11, color:'#8b949e' }}>
                  {new Date(tx.created_at).toLocaleDateString('fr-HT',{day:'2-digit',month:'short',year:'2-digit'})}
                </div>
                <div style={{ padding:'3px 8px', borderRadius:20, fontSize:10, fontWeight:600, background:st.bg, color:st.color, textAlign:'center', whiteSpace:'nowrap' }}>
                  {st.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
