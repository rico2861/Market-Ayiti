import { useState, useEffect, useMemo, memo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { marketsAPI } from '../../api';
import clsx from 'clsx';

interface Props { marketId: string; }

const RANGES: Array<{ id: string; hours: number; labelKey: string }> = [
  { id: '1h',  hours: 1,    labelKey: 'market.time_1h' },
  { id: '6h',  hours: 6,    labelKey: 'market.time_6h' },
  { id: '1d',  hours: 24,   labelKey: 'market.time_1d' },
  { id: '1w',  hours: 168,  labelKey: 'market.time_1w' },
  { id: '1m',  hours: 720,  labelKey: 'market.time_1m' },
  { id: 'all', hours: 8760, labelKey: 'market.time_all' },
];

export default memo(function PriceChart({ marketId }: Props) {
  const { t } = useTranslation();
  const [range, setRange] = useState('1w');
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = RANGES.find(r => r.id === range)!;
    setLoading(true);
    marketsAPI.priceHistory(marketId, r.hours)
      .then(res => setPoints(res.data))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [marketId, range]);

  const data = useMemo(() => points.map(p => ({
    time: new Date(p.timestamp).getTime(),
    yes:  +(p.yes_price * 100).toFixed(1),  // convert 0-1 → 0-100%
    no:   +(p.no_price  * 100).toFixed(1)
  })), [points]);

  const lastPrice = data[data.length - 1]?.yes ?? 50;
  const firstPrice = data[0]?.yes ?? 50;
  const change = lastPrice - firstPrice;

  return (
    <div className="rounded-xl p-4" style={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-[11px] text-[#484f58] uppercase tracking-wider font-semibold">{t('market.pct_chance')}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {Math.round(lastPrice)}%
            </span>
            <span className="text-[12px] font-semibold" style={{
              color: change >= 0 ? '#3fb950' : '#f85149',
              fontFamily: 'JetBrains Mono, monospace'
            }}>
              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ background: '#21262d' }}>
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={clsx('px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors',
                range === r.id ? 'bg-[#1f6feb] text-white' : 'text-[#8b949e] hover:text-white')}
              style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              {t(r.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 240, marginLeft: -12 }}>
        {loading ? (
          <div className="skel w-full h-full" />
        ) : data.length < 2 ? (
          <div className="flex items-center justify-center h-full text-[12px] text-[#484f58]">
            Pa gen ase done
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="yesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3fb950" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3fb950" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']}
                tick={{ fill: '#484f58', fontSize: 10 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                stroke="rgba(255,255,255,0.05)" />
              <YAxis domain={[0, 100]} tick={{ fill: '#484f58', fontSize: 10 }}
                tickFormatter={(v) => `${v}%`} stroke="rgba(255,255,255,0.05)" width={32} />
              <Tooltip contentStyle={{
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, fontSize: 11
              }}
                labelFormatter={(v: any) => new Date(v).toLocaleString()}
                formatter={(v: any) => [`${(+v).toFixed(1)}%`, 'Wi']} />
              <ReferenceLine y={50} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="yes" stroke="#3fb950" strokeWidth={2}
                fill="url(#yesGrad)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
});
