import { useState, useEffect } from 'react';
import { CheckCircle, Vote, Trophy, BarChart2, Music, Users, Grid3X3, Flame } from 'lucide-react';
import { adminAPI } from '../api';
import AdminLayout from '../components/AdminLayout';

const CAT_COLOR: Record<string, string> = {
  politik: '#a371f7', spo: '#3fb950', ekonomi: '#d29922',
  kilti: '#f97316', sosyal: '#58a6ff', lot: '#8b949e', nouvo: '#ef4444'
};

const CAT_ICONS: Record<string, React.ReactNode> = {
  politik: <Vote size={22} />,
  spo:     <Trophy size={22} />,
  ekonomi: <BarChart2 size={22} />,
  kilti:   <Music size={22} />,
  sosyal:  <Users size={22} />,
  lot:     <Grid3X3 size={22} />,
  nouvo:   <Flame size={22} />,
};

const CAT_DESC: Record<string, string> = {
  politik: 'Eleksyon, Gouvènman, Politik',
  spo:     'Foutbòl, Atletis, Konpetisyon',
  ekonomi: 'Finans, Mache, Monè',
  kilti:   'Mizik, Film, Atizay',
  sosyal:  'Sosyete, Kominote, Sante',
  lot:     'Tout lòt sijè',
  nouvo:   'Dènye mache yo'
};

interface Cat {
  id: string; market_count: number;
  active_count: number; total_volume: number;
}

export default function AdminCategories() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getCategories?.()
      .then((r: any) => setCats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalMarkets = cats.reduce((s, c) => s + c.market_count, 0);
  const totalVolume  = cats.reduce((s, c) => s + (c.total_volume || 0), 0);

  const CARD: React.CSSProperties = {
    background: '#161b22', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, padding: 20
  };

  return (
    <AdminLayout>
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'white' }}>Kategori</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#8b949e' }}>
            Jesyon kategori mache yo — {totalMarkets} mache total
          </p>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Mache',  value: totalMarkets, color: 'white' },
            { label: 'Total Volume', value: `${(totalVolume / 1000).toFixed(1)}K HTG`, color: '#3fb950' },
            { label: 'Kategori',     value: cats.filter(c => c.market_count > 0).length, color: '#1f6feb' },
          ].map(({ label, value, color }) => (
            <div key={label} style={CARD}>
              <div style={{ fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'JetBrains Mono,monospace' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Categories grid */}
        {loading ? (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: 40 }}>Chajman...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {cats.map(cat => {
              const color = CAT_COLOR[cat.id] || '#8b949e';
              const pct = totalMarkets > 0 ? (cat.market_count / totalMarkets * 100) : 0;
              return (
                <div key={cat.id} style={{ ...CARD, borderColor: `${color}20` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: `${color}15`, border: `1px solid ${color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color
                    }}>
                      {CAT_ICONS[cat.id] ?? <Grid3X3 size={22} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'white', textTransform: 'capitalize' }}>
                        {cat.id === 'spo' ? 'Spò' : cat.id.charAt(0).toUpperCase() + cat.id.slice(1)}
                      </div>
                      <div style={{ fontSize: 11, color: '#484f58' }}>{CAT_DESC[cat.id] || ''}</div>
                    </div>
                  </div>
                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {[
                      { label: 'Mache', value: cat.market_count },
                      { label: 'Aktif', value: cat.active_count, color: '#3fb950' },
                      { label: 'HTG',   value: cat.total_volume > 0 ? `${(cat.total_volume / 1000).toFixed(0)}K` : '0', color: '#d29922' }
                    ].map(({ label, value, color: c }) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: c || 'white', fontFamily: 'JetBrains Mono,monospace' }}>{value}</div>
                        <div style={{ fontSize: 10, color: '#484f58' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Volume bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#484f58', marginBottom: 4 }}>
                      <span>% nan total mache</span>
                      <span style={{ color }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width .6s' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info box */}
        <div style={{ marginTop: 24, background: 'rgba(31,111,235,0.08)', border: '1px solid rgba(31,111,235,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#8b949e', display: 'flex', gap: 8 }}>
          <CheckCircle size={14} style={{ color: '#1f6feb', flexShrink: 0, marginTop: 1 }} />
          <span>Kategori yo defini nan sistèm. Pou ajoute yon nouvo kategori, kontakte devlopè a. Kategori aktyèl yo: <strong style={{ color: 'white' }}>Politik, Spò, Ekonomi, Kilti, Sosyal, Nouvo, Lòt</strong>.</span>
        </div>
      </div>
    </AdminLayout>
  );
}
