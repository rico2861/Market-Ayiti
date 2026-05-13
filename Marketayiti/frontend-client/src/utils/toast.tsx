import React from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, Info, AlertTriangle, Coins } from 'lucide-react';
import type { ReactNode } from 'react';

const card: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '14px 16px',
  borderRadius: 12,
  background: '#0d1117',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
  maxWidth: 'min(420px, calc(100vw - 24px))',
  width: '100%',
  fontFamily: 'Inter, sans-serif',
  cursor: 'default',
};

interface CardProps {
  icon: ReactNode;
  accent: string;
  title: string;
  subtitle?: string;
  toastId: string;
}

function ToastCard({ icon, accent, title, subtitle, toastId }: CardProps) {
  return (
    <div
      style={{ ...card, borderLeft: `3px solid ${accent}` }}
      onClick={() => toast.dismiss(toastId)}
    >
      <span style={{ color: accent, flexShrink: 0, marginTop: 1, display: 'flex' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#e6edf3', fontSize: 14, fontWeight: 600, lineHeight: '20px', wordBreak: 'break-word' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ color: '#8b949e', fontSize: 12, marginTop: 3, lineHeight: '16px', wordBreak: 'break-word' }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

export const showToast = {
  success: (title: string, subtitle?: string, duration = 3000) =>
    toast.custom(
      (t) => <ToastCard toastId={t.id} icon={<CheckCircle2 size={18} />} accent="#3fb950" title={title} subtitle={subtitle} />,
      { duration }
    ),
  error: (title: string, subtitle?: string, duration = 4000) =>
    toast.custom(
      (t) => <ToastCard toastId={t.id} icon={<XCircle size={18} />} accent="#f85149" title={title} subtitle={subtitle} />,
      { duration }
    ),
  info: (title: string, subtitle?: string, duration = 3000) =>
    toast.custom(
      (t) => <ToastCard toastId={t.id} icon={<Info size={18} />} accent="#1f6feb" title={title} subtitle={subtitle} />,
      { duration }
    ),
  warning: (title: string, subtitle?: string, duration = 3500) =>
    toast.custom(
      (t) => <ToastCard toastId={t.id} icon={<AlertTriangle size={18} />} accent="#d29922" title={title} subtitle={subtitle} />,
      { duration }
    ),
  bet: (amount: number, option: 'YES' | 'NO', payout: number) =>
    toast.custom(
      (t) => (
        <ToastCard
          toastId={t.id}
          icon={<Coins size={18} />}
          accent="#a855f7"
          title={`Pari ${option === 'YES' ? 'Wi' : 'Non'} — ${amount.toLocaleString()} HTG`}
          subtitle={`Potansyèl: ${payout.toLocaleString('fr-HT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} HTG si ou genyen`}
        />
      ),
      { duration: 4500 }
    ),
};
